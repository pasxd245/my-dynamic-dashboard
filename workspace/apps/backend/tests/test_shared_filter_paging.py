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


def _parquet(path: Path) -> Path:
    with duck.connect() as con:
        con.execute(
            "COPY (SELECT CAST(i AS VARCHAR) AS id, CASE WHEN i % 7 = 0 THEN NULL WHEN i % 5 = 0 THEN 'North' "
            f"WHEN i % 11 = 0 THEN 'West' ELSE 'South' END AS team FROM range({_ROWS}) t(i)) "
            f"TO '{path}' (FORMAT PARQUET)"
        )
    return path


def _walk(path: Path, **kw) -> tuple[list[str], int]:
    seen: list[str] = []
    page, total = 1, 1
    while (page - 1) * _PAGE < total:
        rows, total = query_dataset_rows(path, ["id", "team"], page=page, page_size=_PAGE, q=None, **kw)
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
def test_filtered_pages_partition_in_file_order(tmp_path: Path, kw: dict) -> None:
    seen, total = _walk(_parquet(tmp_path / "t.parquet"), **kw)
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
