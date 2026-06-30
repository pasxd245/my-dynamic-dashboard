"""R122: workflow derive step — a formula-free computed column.

`name = left <op> right` (op ∈ + - * /; right a numeric column or a literal),
applied over the resolved relation. Covers: col−col, col×const, divide-by-zero
→ NULL, chaining (derive → aggregate the derived column), the column-space grows
by one `float` column, and the 422 guards (non-numeric operand, name collision,
unknown operand column).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


# region (string), revenue (int), cost (int). Z has cost 0 → divide-by-zero case.
_CSV = b"region,revenue,cost\nEMEA,100,30\nAPAC,200,50\nZ,10,0\n"
_PROFIT = {"kind": "derive", "name": "profit", "left": "revenue", "op": "-", "right": {"kind": "col", "col": "cost"}}


def _commit_csv(client: TestClient) -> tuple[str, str]:
    ws = client.post("/workspaces", json={"name": "DV"}).json()["id"]
    up = client.post("/uploads", data={"sourceFormat": "csv"}, files={"file": ("d.csv", _CSV, "text/csv")}).json()
    ds = client.post(
        f"/workspaces/{ws}/datasets/batch", json={"temp_id": up["temp_id"], "items": [{"name": "rows"}]}
    ).json()[0]
    return ws, ds["id"]


def _create(client: TestClient, ws: str, ds_id: str, steps: list[dict]):
    defn = {"q": None, "filters": [], "advanced": [], "steps": steps}
    return client.post(f"/workspaces/{ws}/queries", json={"name": "dv", "sourceId": ds_id, "definition": defn})


@pytest.mark.unit
def test_derive_col_minus_col() -> None:
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        created = _create(client, ws, ds_id, [_PROFIT])
        assert created.status_code == 201
        qid = created.json()["id"]
        # The new column is appended as a float.
        assert client.get(f"/queries/{qid}").json()["resolvedColumns"][-1] == {"name": "profit", "dtype": "float"}
        body = client.get(f"/queries/{qid}/rows").json()

    # rows: [region, revenue, cost, profit]; profit = revenue - cost.
    profit = {r[0]: float(r[3]) for r in body["rows"]}
    assert profit == {"EMEA": 70.0, "APAC": 150.0, "Z": 10.0}


@pytest.mark.unit
def test_derive_col_times_const() -> None:
    step = {"kind": "derive", "name": "scaled", "left": "revenue", "op": "*", "right": {"kind": "const", "value": 2}}
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        qid = _create(client, ws, ds_id, [step]).json()["id"]
        body = client.get(f"/queries/{qid}/rows").json()

    assert {r[0]: float(r[3]) for r in body["rows"]} == {"EMEA": 200.0, "APAC": 400.0, "Z": 20.0}


@pytest.mark.unit
def test_derive_divide_by_zero_is_null() -> None:
    step = {"kind": "derive", "name": "ratio", "left": "revenue", "op": "/", "right": {"kind": "col", "col": "cost"}}
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        qid = _create(client, ws, ds_id, [step]).json()["id"]
        rows = client.get(f"/queries/{qid}/rows").json()["rows"]

    by_region = {r[0]: r[3] for r in rows}
    assert by_region["Z"] is None  # 10 / 0 → NULL, not a crash
    assert round(float(by_region["APAC"]), 1) == 4.0  # 200 / 50


@pytest.mark.unit
def test_derive_then_aggregate_the_derived_column() -> None:
    # profit = revenue - cost, THEN sum(profit) by region (each region distinct here).
    agg = {"kind": "aggregate", "dimensions": ["region"], "measures": [{"col": "profit", "agg": "sum"}]}
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        qid = _create(client, ws, ds_id, [_PROFIT, agg]).json()["id"]
        body = client.get(f"/queries/{qid}/rows").json()

    assert {r[0]: float(r[1]) for r in body["rows"]} == {"EMEA": 70.0, "APAC": 150.0, "Z": 10.0}
    # post-chain columns = the aggregate output (region, profit).
    assert body["total"] == 3


@pytest.mark.unit
@pytest.mark.parametrize(
    "step",
    [
        {"kind": "derive", "name": "x", "left": "region", "op": "-", "right": {"kind": "const", "value": 1}},  # non-numeric left
        {"kind": "derive", "name": "revenue", "left": "revenue", "op": "*", "right": {"kind": "const", "value": 2}},  # name collision
        {"kind": "derive", "name": "x", "left": "revenue", "op": "/", "right": {"kind": "col", "col": "ghost"}},  # unknown right col
    ],
)
def test_bad_derive_rejected_on_save_422(step: dict) -> None:
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        resp = _create(client, ws, ds_id, [step])

    assert resp.status_code == 422
