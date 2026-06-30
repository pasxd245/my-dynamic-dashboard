"""R123: workflow filter step — a post-aggregate / post-derive WHERE (HAVING-like).

`filter` keeps rows matching ALL predicates (AND) over the CURRENT column space,
by effective NAME. Distinct from `definition.filters` (which filter the SOURCE
rows before any step). Covers: filter after aggregate ("regions with total >
X"), filter alone over raw rows, multi-predicate AND, and the 422 guards
(column dropped by a prior step, op invalid for the column dtype).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


_CSV = b"region,product,amount\nEMEA,A,100\nEMEA,B,50\nAPAC,A,200\n"
_AGG = {"kind": "aggregate", "dimensions": ["region"], "measures": [{"col": "amount", "agg": "sum"}]}


def _commit_csv(client: TestClient) -> tuple[str, str]:
    ws = client.post("/workspaces", json={"name": "FL"}).json()["id"]
    up = client.post("/uploads", data={"sourceFormat": "csv"}, files={"file": ("d.csv", _CSV, "text/csv")}).json()
    ds = client.post(
        f"/workspaces/{ws}/datasets/batch", json={"temp_id": up["temp_id"], "items": [{"name": "rows"}]}
    ).json()[0]
    return ws, ds["id"]


def _create(client: TestClient, ws: str, ds_id: str, steps: list[dict]):
    defn = {"q": None, "filters": [], "advanced": [], "steps": steps}
    return client.post(f"/workspaces/{ws}/queries", json={"name": "fl", "sourceId": ds_id, "definition": defn})


@pytest.mark.unit
def test_filter_after_aggregate_having_like() -> None:
    # aggregate by region (EMEA 150, APAC 200) → keep total amount > 160 → APAC only.
    steps = [_AGG, {"kind": "filter", "predicates": [{"col": "amount", "op": "gt", "val": 160}]}]
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        qid = _create(client, ws, ds_id, steps).json()["id"]
        body = client.get(f"/queries/{qid}/rows").json()

    assert body["rows"] == [["APAC", "200"]]
    assert body["total"] == 1


@pytest.mark.unit
def test_filter_alone_over_raw_rows() -> None:
    steps = [{"kind": "filter", "predicates": [{"col": "amount", "op": "gt", "val": 60}]}]
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        qid = _create(client, ws, ds_id, steps).json()["id"]
        body = client.get(f"/queries/{qid}/rows").json()

    assert sorted(int(r[2]) for r in body["rows"]) == [100, 200]  # 50 excluded
    assert body["total"] == 2


@pytest.mark.unit
def test_filter_multi_predicate_and() -> None:
    steps = [
        {"kind": "filter", "predicates": [{"col": "region", "op": "equals", "val": "EMEA"}, {"col": "amount", "op": "gte", "val": 80}]}
    ]
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        qid = _create(client, ws, ds_id, steps).json()["id"]
        body = client.get(f"/queries/{qid}/rows").json()

    # EMEA AND amount>=80 → only EMEA/A/100.
    assert body["rows"] == [["EMEA", "A", "100"]]


@pytest.mark.unit
@pytest.mark.parametrize(
    "steps",
    [
        [_AGG, {"kind": "filter", "predicates": [{"col": "product", "op": "equals", "val": "A"}]}],  # col dropped by aggregate
        [{"kind": "filter", "predicates": [{"col": "region", "op": "gt", "val": "x"}]}],  # gt invalid for string
    ],
)
def test_bad_filter_rejected_on_save_422(steps: list[dict]) -> None:
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        resp = _create(client, ws, ds_id, steps)

    assert resp.status_code == 422
