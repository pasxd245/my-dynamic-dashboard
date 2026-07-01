"""R134: Workflow run → materialize + rows.

Running a workflow resolves its (v1: single) source query via the shared query
engine, applies the workflow's transform steps, writes the TYPED output to
parquet, and captures the output schema (`resolvedColumns` + `materializedAt`).
`GET /workflows/{id}/rows` pages that materialized output; before the first run
there is no output, so it 404s.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests._conformance import validate_response
from tests.test_workflows import _STEP, _create, _query_source


@pytest.mark.unit
def test_run_materializes_and_captures_schema() -> None:
    with TestClient(app) as client:
        ws, qid = _query_source(client)
        wid = _create(client, ws, qid, steps=[_STEP]).json()["id"]
        resp = client.post(f"/workflows/{wid}/run")

    assert resp.status_code == 200
    body = resp.json()
    # The aggregate step's output schema is captured: dimension `name` + `amount` sum.
    assert [c["name"] for c in body["resolvedColumns"]] == ["name", "amount"]
    assert body["materializedAt"].endswith("Z")
    validate_response("workflows/run-post.contract.yaml", 200, body)


@pytest.mark.unit
def test_rows_after_run_returns_grouped_output() -> None:
    with TestClient(app) as client:
        ws, qid = _query_source(client)
        wid = _create(client, ws, qid, steps=[_STEP]).json()["id"]
        client.post(f"/workflows/{wid}/run")
        rows = client.get(f"/workflows/{wid}/rows")

    assert rows.status_code == 200
    body = rows.json()
    # One row per distinct `name` (the aggregate dimension); each has 2 cells.
    assert body["total"] == len(body["rows"]) >= 1
    assert all(len(r) == 2 for r in body["rows"])
    validate_response("workflows/rows-get.contract.yaml", 200, body)


@pytest.mark.unit
def test_run_passthrough_no_steps_materializes_source_columns() -> None:
    with TestClient(app) as client:
        ws, qid = _query_source(client)
        wid = _create(client, ws, qid, steps=[]).json()["id"]
        run = client.post(f"/workflows/{wid}/run")
        rows = client.get(f"/workflows/{wid}/rows?unpaged=true")

    assert run.status_code == 200
    # No steps → the materialized output IS the source query's columns.
    assert [c["name"] for c in run.json()["resolvedColumns"]] == ["id", "name", "amount", "signed_up"]
    assert rows.status_code == 200
    assert rows.json()["total"] == len(rows.json()["rows"]) >= 1


@pytest.mark.unit
def test_rows_before_run_returns_404() -> None:
    with TestClient(app) as client:
        ws, qid = _query_source(client)
        wid = _create(client, ws, qid).json()["id"]
        resp = client.get(f"/workflows/{wid}/rows")
    assert resp.status_code == 404
    assert resp.json() == {"code": "not_found"}


@pytest.mark.unit
def test_run_unknown_returns_404() -> None:
    with TestClient(app) as client:
        resp = client.post("/workflows/wf_00000000/run")
    assert resp.status_code == 404
    assert resp.json() == {"code": "not_found"}


@pytest.mark.unit
def test_run_after_source_query_deleted_returns_409() -> None:
    with TestClient(app) as client:
        ws, qid = _query_source(client)
        wid = _create(client, ws, qid).json()["id"]
        client.delete(f"/queries/{qid}")
        resp = client.post(f"/workflows/{wid}/run")
    assert resp.status_code == 409
    assert resp.json() == {"code": "query_stale"}
