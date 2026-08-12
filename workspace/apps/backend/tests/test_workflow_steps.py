"""R120: workflow v1 — a query's transform `steps` (the aggregate step).

A saved query can carry an ordered `steps` list; v1 = one aggregate step
(`GROUP BY → measures`) applied after the source/join/filter resolve. Its
`/rows` run returns the SHAPED (grouped) rows, and the saved query exposes its
POST-step columns as `resolvedColumns`. Covers: save+run, the query's own
filters applying BEFORE the step, scalar step, post-step resolvedColumns,
preview, the 422 save guards (bad column / >1 step), and run-time drift → 409.
"""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import app


# region (REPEATED), product, amount → SUM(amount) by region = EMEA 150, APAC 200.
_CSV = b"region,product,amount\nEMEA,A,100\nEMEA,B,50\nAPAC,A,200\n"
_AGG_BY_REGION = {"kind": "aggregate", "dimensions": ["region"], "measures": [{"col": "amount", "agg": "sum"}]}


def _commit_csv(client: TestClient) -> tuple[str, str]:
    ws = client.post("/workspaces", json={"name": "WF"}).json()["id"]
    up = client.post("/uploads", data={"sourceFormat": "csv"}, files={"file": ("d.csv", _CSV, "text/csv")}).json()
    ds = client.post(
        f"/workspaces/{ws}/datasets/batch", json={"temp_id": up["temp_id"], "items": [{"name": "rows"}]}
    ).json()[0]
    return ws, ds["id"]


def _create(client: TestClient, ws: str, ds_id: str, definition: dict, name: str = "wf"):
    return client.post(f"/workspaces/{ws}/queries", json={"name": name, "sourceId": ds_id, "definition": definition})


def _defn(steps: list[dict], filters: list | None = None) -> dict:
    return {"q": None, "filters": filters or [], "advanced": [], "steps": steps}


def _as_map(rows: list[list]) -> dict[str, str]:
    return {r[0]: r[1] for r in rows}


@pytest.mark.unit
def test_save_and_run_aggregate_step() -> None:
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        created = _create(client, ws, ds_id, _defn([_AGG_BY_REGION]))
        assert created.status_code == 201
        qid = created.json()["id"]
        # GET exposes the query's POST-step output columns as resolvedColumns.
        assert client.get(f"/queries/{qid}").json()["resolvedColumns"] == [
            {"name": "region", "dtype": "string"},
            {"name": "amount", "dtype": "integer"},
        ]
        rows = client.get(f"/queries/{qid}/rows")

    assert rows.status_code == 200
    body = rows.json()
    assert _as_map(body["rows"]) == {"EMEA": "150", "APAC": "200"}
    assert body["total"] == 2


@pytest.mark.unit
def test_avg_step_runs_and_reports_float() -> None:
    """R140 — the widened measure vocabulary flows through the SAVED-step path
    too: an avg step groups correctly and resolvedColumns reports float."""
    step = {"kind": "aggregate", "dimensions": ["region"], "measures": [{"col": "amount", "agg": "avg"}]}
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        created = _create(client, ws, ds_id, _defn([step]))
        assert created.status_code == 201
        qid = created.json()["id"]
        assert client.get(f"/queries/{qid}").json()["resolvedColumns"] == [
            {"name": "region", "dtype": "string"},
            {"name": "amount", "dtype": "float"},
        ]
        rows = client.get(f"/queries/{qid}/rows")

    assert _as_map(rows.json()["rows"]) == {"EMEA": "75.0", "APAC": "200.0"}


@pytest.mark.unit
def test_query_filter_applies_before_the_step() -> None:
    # filter amount (col 2, integer) > 60 keeps 100 + 200 (50 excluded), THEN
    # group by region → EMEA 100, APAC 200.
    flt = [{"col": 2, "dtype": "integer", "op": "gt", "val": 60}]
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        qid = _create(client, ws, ds_id, _defn([_AGG_BY_REGION], filters=flt)).json()["id"]
        rows = client.get(f"/queries/{qid}/rows").json()

    assert _as_map(rows["rows"]) == {"EMEA": "100", "APAC": "200"}


@pytest.mark.unit
def test_scalar_step_returns_one_row() -> None:
    step = {"kind": "aggregate", "dimensions": [], "measures": [{"col": "amount", "agg": "sum"}]}
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        qid = _create(client, ws, ds_id, _defn([step])).json()["id"]
        rows = client.get(f"/queries/{qid}/rows").json()

    assert rows["rows"] == [["350"]]
    assert rows["total"] == 1


@pytest.mark.unit
def test_preview_with_step_returns_shaped_rows_and_columns() -> None:
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        resp = client.post(
            f"/workspaces/{ws}/queries/preview",
            json={"sourceId": ds_id, "definition": _defn([_AGG_BY_REGION])},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert _as_map(body["rows"]) == {"EMEA": "150", "APAC": "200"}
    assert body["resolvedColumns"] == [{"name": "region", "dtype": "string"}, {"name": "amount", "dtype": "integer"}]
    # R129 — the PRE-step (base) columns are reported too (the source dataset's,
    # here): the builder's editors author against these, not the shaped result.
    assert {c["name"] for c in body["baseColumns"]} == {"region", "product", "amount", "Source.Name"}


@pytest.mark.unit
def test_stepless_query_is_unchanged() -> None:
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        qid = _create(client, ws, ds_id, _defn([])).json()["id"]
        body = client.get(f"/queries/{qid}/rows").json()

    # Raw rows, paged as before (3 rows, no grouping).
    assert body["total"] == 3
    assert len(body["rows"]) == 3


@pytest.mark.unit
@pytest.mark.parametrize(
    "steps",
    [
        [{"kind": "aggregate", "dimensions": ["nope"], "measures": [{"agg": "count"}]}],  # unknown dim
        [{"kind": "aggregate", "dimensions": [], "measures": [{"col": "region", "agg": "sum"}]}],  # sum non-numeric
        [{"kind": "bogus", "dimensions": [], "measures": [{"agg": "count"}]}],  # unknown step kind
    ],
)
def test_bad_step_rejected_on_save_422(steps: list[dict]) -> None:
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        resp = _create(client, ws, ds_id, _defn(steps))

    assert resp.status_code == 422


@pytest.mark.unit
def test_aggregate_then_top_n_orders_numerically_and_caps() -> None:
    # aggregate by region (EMEA 150, APAC 200) → top_n by amount DESC, n=2.
    # The chain is TYPED, so the measure sorts NUMERICALLY (200 > 150), not
    # lexically ("150" < "200" would be the wrong order if stringified early).
    steps = [_AGG_BY_REGION, {"kind": "top_n", "col": "amount", "n": 2, "descending": True}]
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        created = _create(client, ws, ds_id, _defn(steps))
        assert created.status_code == 201
        qid = created.json()["id"]
        body = client.get(f"/queries/{qid}/rows").json()
        # top_n preserves the column space → resolvedColumns is the aggregate output.
        assert client.get(f"/queries/{qid}").json()["resolvedColumns"] == [
            {"name": "region", "dtype": "string"},
            {"name": "amount", "dtype": "integer"},
        ]

    assert body["rows"] == [["APAC", "200"], ["EMEA", "150"]]


@pytest.mark.unit
def test_top_n_only_over_raw_rows() -> None:
    # No aggregate — just the top 2 raw rows by amount DESC (200, 100).
    steps = [{"kind": "top_n", "col": "amount", "n": 2, "descending": True}]
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        qid = _create(client, ws, ds_id, _defn(steps)).json()["id"]
        body = client.get(f"/queries/{qid}/rows").json()

    assert [r[2] for r in body["rows"]] == ["200", "100"]
    assert body["total"] == 2


@pytest.mark.unit
@pytest.mark.parametrize(
    "steps",
    [
        [{"kind": "top_n", "col": "ghost", "n": 1}],  # unknown order column
        [_AGG_BY_REGION, {"kind": "top_n", "col": "product", "n": 1}],  # col dropped by the aggregate
        [{"kind": "top_n", "col": "amount", "n": 1}] * 9,  # > _MAX_STEPS (8)
    ],
)
def test_bad_chain_rejected_on_save_422(steps: list[dict]) -> None:
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        resp = _create(client, ws, ds_id, _defn(steps))

    assert resp.status_code == 422


@pytest.mark.unit
def test_drifted_step_returns_409_step_invalid_on_run() -> None:
    # A saved step whose dimension column no longer exists (injected directly,
    # bypassing the create-time guard) → 409 step_invalid on run. R165 W-8 split this
    # from `query_stale`: it is NOT "like a drifted filter", and saying so is what put
    # a filter sentence on a query with no filters.
    drifted = _defn([{"kind": "aggregate", "dimensions": ["ghost"], "measures": [{"agg": "count"}]}])
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        with db.get_conn() as con:
            con.execute(
                "INSERT INTO queries (id, workspace_id, source_id, name, definition_json, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                ("qr_5eeb0000", ws, ds_id, "Drift", json.dumps(drifted), "2026-06-30T00:00:00Z"),
            )
            con.commit()
        resp = client.get("/queries/qr_5eeb0000/rows")

    assert resp.status_code == 409
    assert resp.json() == {"code": "step_invalid"}
