"""R141: deliverable shaping steps — `sort` (multi-key, NULLS LAST) + `select`
(projection + rename + reorder in one body).

Covers: multi-key sort over raw rows, NULLS LAST in both directions, sort after
an aggregate (typed numeric order), select's projected/renamed/reordered output
(rows + resolvedColumns), rename as a real re-binding (later steps see the NEW
name; the OLD name is gone), the R140 count_distinct naming wart closure, and
the 422 save guards (unknown sort key / unknown select col / duplicate output
name / stale old name after a rename).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app

_CSV = b"region,product,amount\nEMEA,A,100\nEMEA,B,50\nAPAC,A,200\n"
# One blank amount → a NULL integer cell (NULLS-LAST coverage).
_CSV_NULL = b"region,amount\nEMEA,100\nAPAC,\nEMEA,50\n"
_AGG_BY_REGION = {"kind": "aggregate", "dimensions": ["region"], "measures": [{"col": "amount", "agg": "sum"}]}


def _commit_csv(client: TestClient, csv: bytes = _CSV) -> tuple[str, str]:
    ws = client.post("/workspaces", json={"name": "WF"}).json()["id"]
    up = client.post("/uploads", data={"sourceFormat": "csv"}, files={"file": ("d.csv", csv, "text/csv")}).json()
    ds = client.post(
        f"/workspaces/{ws}/datasets/batch", json={"temp_id": up["temp_id"], "items": [{"name": "rows"}]}
    ).json()[0]
    return ws, ds["id"]


def _create(client: TestClient, ws: str, ds_id: str, definition: dict, name: str = "shape"):
    return client.post(f"/workspaces/{ws}/queries", json={"name": name, "sourceId": ds_id, "definition": definition})


def _defn(steps: list[dict]) -> dict:
    return {"q": None, "filters": [], "advanced": [], "steps": steps}


@pytest.mark.unit
def test_sort_multi_key_over_raw_rows() -> None:
    # region ASC majors; amount DESC tie-breaks the two EMEA rows (100 before 50).
    steps = [{"kind": "sort", "keys": [{"col": "region"}, {"col": "amount", "descending": True}]}]
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        created = _create(client, ws, ds_id, _defn(steps))
        assert created.status_code == 201
        qid = created.json()["id"]
        body = client.get(f"/queries/{qid}/rows").json()

    assert [(r[0], r[2]) for r in body["rows"]] == [("APAC", "200"), ("EMEA", "100"), ("EMEA", "50")]
    assert body["total"] == 3


@pytest.mark.unit
@pytest.mark.parametrize("descending", [False, True])
def test_sort_nulls_last_both_directions(descending: bool) -> None:
    steps = [{"kind": "sort", "keys": [{"col": "amount", "descending": descending}]}]
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client, _CSV_NULL)
        qid = _create(client, ws, ds_id, _defn(steps)).json()["id"]
        body = client.get(f"/queries/{qid}/rows").json()

    amounts = [r[1] for r in body["rows"]]
    assert amounts == (["100", "50", None] if descending else ["50", "100", None])


@pytest.mark.unit
def test_aggregate_then_sort_orders_the_measure_numerically() -> None:
    # Typed chain: the summed measure sorts numerically (200 > 150), and unlike
    # top_n nothing is capped. The column space is unchanged by the sort.
    steps = [_AGG_BY_REGION, {"kind": "sort", "keys": [{"col": "amount", "descending": True}]}]
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        qid = _create(client, ws, ds_id, _defn(steps)).json()["id"]
        body = client.get(f"/queries/{qid}/rows").json()
        resolved = client.get(f"/queries/{qid}").json()["resolvedColumns"]

    assert body["rows"] == [["APAC", "200"], ["EMEA", "150"]]
    assert resolved == [{"name": "region", "dtype": "string"}, {"name": "amount", "dtype": "integer"}]


@pytest.mark.unit
def test_select_projects_renames_and_reorders() -> None:
    # Output = EXACTLY the cols listed, in THIS order, dtypes kept, `name ?? col`.
    steps = [{"kind": "select", "cols": [{"col": "amount", "name": "total"}, {"col": "region"}]}]
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        created = _create(client, ws, ds_id, _defn(steps))
        assert created.status_code == 201
        qid = created.json()["id"]
        body = client.get(f"/queries/{qid}/rows").json()
        resolved = client.get(f"/queries/{qid}").json()["resolvedColumns"]

    assert resolved == [{"name": "total", "dtype": "integer"}, {"name": "region", "dtype": "string"}]
    assert body["rows"][0] == ["100", "EMEA"]
    assert body["total"] == 3


@pytest.mark.unit
def test_select_rename_rebinds_for_later_steps() -> None:
    # A rename is a re-binding: the following sort references the NEW name.
    steps = [
        {"kind": "select", "cols": [{"col": "region"}, {"col": "amount", "name": "total"}]},
        {"kind": "sort", "keys": [{"col": "total", "descending": True}]},
    ]
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        qid = _create(client, ws, ds_id, _defn(steps)).json()["id"]
        body = client.get(f"/queries/{qid}/rows").json()

    assert [r[1] for r in body["rows"]] == ["200", "100", "50"]


@pytest.mark.unit
def test_count_distinct_rename_closes_the_r140_wart() -> None:
    # count_distinct(product) outputs a col named `product` (R140); a following
    # select renames it to something a deliverable can carry.
    steps = [
        {"kind": "aggregate", "dimensions": ["region"], "measures": [{"col": "product", "agg": "count_distinct"}]},
        {"kind": "select", "cols": [{"col": "region"}, {"col": "product", "name": "distinct_products"}]},
    ]
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        qid = _create(client, ws, ds_id, _defn(steps)).json()["id"]
        resolved = client.get(f"/queries/{qid}").json()["resolvedColumns"]
        body = client.get(f"/queries/{qid}/rows").json()

    assert resolved == [{"name": "region", "dtype": "string"}, {"name": "distinct_products", "dtype": "integer"}]
    assert {r[0]: r[1] for r in body["rows"]} == {"EMEA": "2", "APAC": "1"}


@pytest.mark.unit
@pytest.mark.parametrize(
    "steps",
    [
        [{"kind": "sort", "keys": [{"col": "ghost"}]}],  # unknown sort key
        [{"kind": "select", "cols": [{"col": "ghost"}]}],  # unknown select col
        # duplicate output name (rename collides with a kept col)
        [{"kind": "select", "cols": [{"col": "region"}, {"col": "product", "name": "region"}]}],
        # the OLD name is gone after a rename — a later step can't reference it
        [
            {"kind": "select", "cols": [{"col": "amount", "name": "total"}]},
            {"kind": "sort", "keys": [{"col": "amount"}]},
        ],
    ],
)
def test_bad_shaping_rejected_on_save_422(steps: list[dict]) -> None:
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        resp = _create(client, ws, ds_id, _defn(steps))

    assert resp.status_code == 422
