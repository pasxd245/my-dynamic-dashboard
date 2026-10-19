"""R199 CR-1 — a FILTERED single-source read pages in file order, under any filter shape.

A shared filter of two values (``CAST(col AS VARCHAR) IN (?, ?)``) or with
``(blank)`` (``… OR col IS NULL …``), and a definition ``in`` atom (the same
shape), made DuckDB emit the scan out of file order despite
``preserve_insertion_order`` — measured from 50k rows; past ~130k the paged read
(``LIMIT/OFFSET``, no ``ORDER BY``) returned some rows twice and others never
(130k: 30 343 distinct of 30 389). A one-value filter kept order, which is why
the round's first test passed by accident and had to ``sorted()`` its rows.

The fix orders a filtered scan by the parquet's ``file_row_number`` — an
explicit order, not an engine default (``test_paging_partitions``: the R171
reliance is what failed here). The unfiltered scan keeps its R172 behaviour.

Driven at the reader for the paged walk (the API caps ``page_size`` at 100;
scale is load-bearing, see ``test_paging_partitions``), and through HTTP for the
unpaged widget read and the export, which have no page to compare.

**Teeth**: run against ``468befe..ebb2cde``'s reader, the three paged cases and
the two HTTP cases fail.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import duck
from app.ingest.filters import FilterPredicate
from app.ingest.rows_reader import query_dataset_rows
from app.main import app
from tests.test_params import _EMPTY, _query

# The smallest size at which the unfixed read stopped PARTITIONING (it was out
# of order from 50k): ~0.5 s per case.
_ROWS = 130_000
_PAGE = 5_000


def _parquet(path: Path, *, collide: bool = False) -> Path:
    """`collide` adds a USER column named `file_row_number` (R199 CR-6) whose values
    run backwards, so a read that confused it with the position would show."""
    extra = f", {_ROWS} - i AS file_row_number" if collide else ""
    with duck.connect() as con:
        con.execute(
            "COPY (SELECT CAST(i AS VARCHAR) AS id, CASE WHEN i % 7 = 0 THEN NULL WHEN i % 5 = 0 THEN 'North' "
            f"WHEN i % 11 = 0 THEN 'West' ELSE 'South' END AS team{extra} FROM range({_ROWS}) t(i)) "
            f"TO '{path}' (FORMAT PARQUET)"
        )
    return path


def _walk(path: Path, *, collide: bool = False, **kw) -> tuple[list[str], int]:
    cols = ["id", "team", "file_row_number"] if collide else ["id", "team"]
    seen: list[str] = []
    page, total = 1, 1
    while (page - 1) * _PAGE < total:
        rows, total = query_dataset_rows(path, cols, page=page, page_size=_PAGE, q=None, **kw)
        if collide:  # the user's own column comes back with its own values
            assert all(int(r[2]) == _ROWS - int(r[0]) for r in rows)
        seen += [r[0] for r in rows]
        page += 1
    return seen, total


@pytest.mark.unit
@pytest.mark.parametrize(
    "kw",
    [
        pytest.param({"name_filters": [("team", ["North", "West"])]}, id="shared-two-values"),
        pytest.param({"name_filters": [("team", ["North", None])]}, id="shared-value-and-blank"),
        pytest.param(
            {
                "filters": [
                    FilterPredicate(col_index=1, col_name="team", dtype="string", op="in", vals=("North", "West"))
                ]
            },
            id="definition-in-atom",
        ),
    ],
)
@pytest.mark.parametrize("collide", [False, True], ids=["plain", "user-file_row_number"])
def test_filtered_pages_partition_in_file_order(tmp_path: Path, kw: dict, collide: bool) -> None:
    seen, total = _walk(_parquet(tmp_path / "t.parquet", collide=collide), collide=collide, **kw)
    assert total > _PAGE * 4  # a real multi-page walk
    assert len(seen) == total
    assert len(set(seen)) == total, "a row came back on two pages while another never came back"
    assert seen == sorted(seen, key=int), "the filtered read re-ordered the user's rows"


def _csv(rows: int) -> bytes:
    lines = ["id,team"]
    for i in range(rows):
        team = "" if i % 7 == 0 else "North" if i % 5 == 0 else "West" if i % 11 == 0 else "South"
        lines.append(f"{i},{team}")
    return ("\n".join(lines) + "\n").encode()


@pytest.mark.unit
def test_unpaged_widget_read_and_export_keep_file_order() -> None:
    client = TestClient(app)
    ws = client.post("/workspaces", json={"name": "Order"}).json()["id"]
    up = client.post(
        "/uploads", data={"sourceFormat": "csv"}, files={"file": ("o.csv", _csv(_ROWS), "text/csv")}
    ).json()
    ds = client.post(
        f"/workspaces/{ws}/datasets/batch", json={"temp_id": up["temp_id"], "items": [{"name": "o"}]}
    ).json()[0]["id"]
    q = _query(client, ws, ds, {**_EMPTY}).json()["id"]
    ctl = "ctl_0000c001"
    wid = "wdg_0000c001"
    dsh = client.post(
        f"/workspaces/{ws}/dashboards",
        json={
            "name": "O",
            "slug": "o",
            "definition": {
                "widgets": [{"id": wid, "queryId": q, "title": "t", "chartType": "table", "agg": "count", "span": 1}],
                "controls": [
                    {
                        "id": ctl,
                        "kind": "values",
                        "label": "Team",
                        "column": "team",
                        "targets": "all",
                        "saved": ["North"],
                    }
                ],
            },
        },
    ).json()["id"]

    # The widget's unpaged read (capped at dashboard_max_rows) under a viewer selection with blank.
    r = client.get(f"/queries/{q}/rows?unpaged=true&dashboard={dsh}&widget={wid}&f.{ctl}=North,~blank")
    assert r.status_code == 200
    ids = [int(row[0]) for row in r.json()["rows"]]
    assert len(ids) == 10_000 and r.json()["total"] > len(ids)
    assert ids == sorted(ids), "the widget's capped read is not the first rows in file order"

    # The export lists every filtered row in file order.
    r = client.post(
        f"/queries/{q}/export",
        json={
            "format": "csv",
            "filters": [{"column": "team", "values": ["North", "West"], "control": ctl}],
            "dashboard": {"id": dsh, "widgetId": wid},
        },
    )
    assert r.status_code == 200
    exported = [int(line.split(",")[0]) for line in r.text.splitlines()[1:]]
    assert len(exported) == len(set(exported)) and exported == sorted(exported)
    # The order column never leaks into the file (BOM + the dataset's own columns only).
    assert r.text.splitlines()[0] == "\ufeffid,team,Source.Name"


# --- R199 CR-6 — a dataset whose header has `file_row_number` -------------------------
#
# DuckDB refuses `read_parquet(?, file_row_number=true)` on such a file; the CR-1 fix
# turned every filtered read, the export, `/values` and `/totals` into a 500 for it.
# Every read path below must answer 200, in file order, with the user's own column.

_N6 = 60_000  # past the 50k at which a filtered scan was seen out of order


def _csv6() -> bytes:
    lines = ["id,team,file_row_number"]
    for i in range(_N6):
        team = "" if i % 7 == 0 else "North" if i % 5 == 0 else "West" if i % 11 == 0 else "South"
        lines.append(f"{i},{team},{_N6 - i}")
    return ("\n".join(lines) + "\n").encode()


def _commit(client: TestClient, ws: str, csv: bytes, name: str) -> str:
    up = client.post("/uploads", data={"sourceFormat": "csv"}, files={"file": (f"{name}.csv", csv, "text/csv")}).json()
    return client.post(
        f"/workspaces/{ws}/datasets/batch", json={"temp_id": up["temp_id"], "items": [{"name": name}]}
    ).json()[0]["id"]


def _in_order_with_own_column(rows: list[list[str | None]], header: list[str]) -> list[int]:
    i_id, i_frn = header.index("id"), header.index("file_row_number")
    ids = [int(r[i_id]) for r in rows]
    assert ids == sorted(ids) and len(set(ids)) == len(ids), "not in file order"
    assert all(int(r[i_frn]) == _N6 - int(r[i_id]) for r in rows), "the user's file_row_number was replaced"
    return ids


@pytest.mark.unit
def test_every_read_path_survives_a_user_column_named_file_row_number() -> None:
    client = TestClient(app)
    ws = client.post("/workspaces", json={"name": "Collide"}).json()["id"]
    ds = _commit(client, ws, _csv6(), "collide")
    cols = [c["name"] for c in client.get(f"/datasets/{ds}").json()["columns"]]
    assert "file_row_number" in cols
    i_team = cols.index("team")
    plain = _query(client, ws, ds, {**_EMPTY}, "plain").json()["id"]
    in_atom = _query(
        client,
        ws,
        ds,
        {**_EMPTY, "filters": [{"col": i_team, "dtype": "string", "op": "in", "vals": ["North", "West"]}]},
        "in atom",
    ).json()["id"]
    searched = _query(client, ws, ds, {**_EMPTY, "q": "west"}, "q").json()["id"]
    ctl, wid = "ctl_0000c006", "wdg_0000c006"
    dsh = client.post(
        f"/workspaces/{ws}/dashboards",
        json={
            "name": "C",
            "slug": "c",
            "definition": {
                "widgets": [
                    {"id": wid, "queryId": plain, "title": "t", "chartType": "table", "agg": "count", "span": 1}
                ],
                "controls": [{"id": ctl, "kind": "values", "label": "Team", "column": "team", "targets": "all"}],
            },
        },
    ).json()["id"]

    def rows_ok(url: str) -> list[int]:
        r = client.get(url)
        assert r.status_code == 200, (url, r.text[:300])
        return _in_order_with_own_column(r.json()["rows"], cols)

    # /rows — plain (unfiltered), `q`, a definition `in` atom, a shared multi-value + blank; paged and unpaged.
    assert rows_ok(f"/queries/{plain}/rows?page=2&page_size=100")[0] == 100
    rows_ok(f"/queries/{searched}/rows?unpaged=true")
    rows_ok(f"/queries/{in_atom}/rows?unpaged=true")
    shared = f"&dashboard={dsh}&widget={wid}&f.{ctl}=North,~blank"
    rows_ok(f"/queries/{plain}/rows?unpaged=true{shared}")
    pages: list[int] = []
    for page in range(1, 6):
        pages += rows_ok(f"/queries/{plain}/rows?page={page}&page_size=100{shared}")
    first = rows_ok(f"/queries/{plain}/rows?unpaged=true{shared}")
    assert pages == first[:500], "paged reads do not partition the unpaged read"

    # /export — unfiltered and shared-filtered: file order, the user's column, no order column.
    for body in (
        {"format": "csv"},
        {
            "format": "csv",
            "filters": [{"column": "team", "values": ["West", None], "control": ctl}],
            "dashboard": {"id": dsh, "widgetId": wid},
        },
    ):
        r = client.post(f"/queries/{plain}/export", json=body)
        assert r.status_code == 200, r.text[:300]
        lines = r.text.lstrip("\ufeff").splitlines()
        header = lines[0].split(",")
        assert header == cols
        _in_order_with_own_column([ln.split(",") for ln in lines[1:]], header)

    # /values and /totals over the same (ordered) relation.
    r = client.get(f"/queries/{plain}/values?column=file_row_number")
    assert r.status_code == 200 and r.json()["values"][:3] == ["1", "2", "3"], r.text[:300]
    r = client.post(f"/queries/{plain}/totals", json={"columns": ["file_row_number"]})
    assert r.status_code == 200 and r.json()["rowCount"] == _N6, r.text[:300]
    assert r.json()["sums"]["file_row_number"] == str(sum(range(1, _N6 + 1)))


@pytest.mark.unit
def test_a_joined_query_whose_driving_dataset_has_file_row_number() -> None:
    """R172's joined path read the driving source with `file_row_number=true`, so a
    join over such a dataset was a 500 since R172 — the same helper fixes it."""
    from tests.test_joins import _create_join, _declare_id_join

    client = TestClient(app)
    ws = client.post("/workspaces", json={"name": "CollideJoin"}).json()["id"]
    left = _commit(client, ws, b"id,file_row_number\n1,30\n2,20\n3,10\n", "left")
    right = _commit(client, ws, b"id,name\n1,Acme A\n2,Acme B\n3,Acme C\n", "right")
    q = _create_join(client, ws, left, _declare_id_join(client, ws, left, right)).json()["id"]
    r = client.get(f"/queries/{q}/rows?page=1&page_size=10")
    assert r.status_code == 200, r.text[:300]
    names = [c["name"] for c in client.get(f"/queries/{q}").json()["resolvedColumns"]]
    frn = next(n for n in names if n.endswith("file_row_number"))
    assert [row[names.index(frn)] for row in r.json()["rows"]] == ["30", "20", "10"]
