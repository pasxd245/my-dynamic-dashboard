"""R132: Workflow noun — create / list / get / delete / name-unique / bad-source.

A Workflow consolidates + transforms saved QUERIES into a (later, R133)
materialized output. This round is the noun's CRUD: it validates that each
source is a query in the workspace, and enforces per-workspace name uniqueness.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests._conformance import validate_response


_FIXTURES = Path(__file__).parent / "fixtures"
_STEP = {"kind": "aggregate", "dimensions": ["name"], "measures": [{"col": "amount", "agg": "sum"}]}


def _query_source(client: TestClient) -> tuple[str, str]:
    """Commit sample.csv → a dataset → a saved query; return (workspace, query id)."""
    ws = client.post("/workspaces", json={"name": "WF"}).json()["id"]
    up = client.post(
        "/uploads",
        data={"sourceFormat": "csv"},
        files={"file": ("sample.csv", (_FIXTURES / "sample.csv").read_bytes(), "text/csv")},
    ).json()
    ds = client.post(
        f"/workspaces/{ws}/datasets/batch", json={"temp_id": up["temp_id"], "items": [{"name": "leads"}]}
    ).json()[0]
    qid = client.post(
        f"/workspaces/{ws}/queries",
        json={"name": "all leads", "sourceId": ds["id"], "definition": {"q": None, "filters": [], "advanced": []}},
    ).json()["id"]
    return ws, qid


def _create(client: TestClient, ws: str, qid: str, name: str = "wf", steps=None):
    return client.post(
        f"/workspaces/{ws}/workflows",
        json={"name": name, "definition": {"sources": [qid], "steps": steps if steps is not None else [_STEP]}},
    )


@pytest.mark.unit
def test_create_persists_and_returns_workflow() -> None:
    with TestClient(app) as client:
        ws, qid = _query_source(client)
        resp = _create(client, ws, qid)

    assert resp.status_code == 201
    body = resp.json()
    assert body["id"].startswith("wf_")
    assert body["workspaceId"] == ws
    assert body["definition"]["sources"] == [qid]
    assert body["definition"]["steps"][0]["kind"] == "aggregate"
    # not run yet → no materialized output.
    assert "resolvedColumns" not in body and "materializedAt" not in body
    validate_response("workflows/post.contract.yaml", 201, body)


@pytest.mark.unit
def test_list_and_get() -> None:
    with TestClient(app) as client:
        ws, qid = _query_source(client)
        wid = _create(client, ws, qid, name="first").json()["id"]
        listed = client.get(f"/workspaces/{ws}/workflows")
        got = client.get(f"/workflows/{wid}")

    assert {w["name"] for w in listed.json()} == {"first"}
    validate_response("workflows/get.contract.yaml", 200, listed.json())
    assert got.status_code == 200
    validate_response("workflows/detail-get.contract.yaml", 200, got.json())


@pytest.mark.unit
def test_get_unknown_returns_404() -> None:
    with TestClient(app) as client:
        resp = client.get("/workflows/wf_00000000")
    assert resp.status_code == 404
    assert resp.json() == {"code": "not_found"}


@pytest.mark.unit
def test_duplicate_name_in_workspace_returns_409() -> None:
    with TestClient(app) as client:
        ws, qid = _query_source(client)
        _create(client, ws, qid, name="dupe")
        resp = _create(client, ws, qid, name="dupe")
    assert resp.status_code == 409
    assert resp.json() == {"code": "name_taken"}


@pytest.mark.unit
def test_unknown_source_returns_422() -> None:
    with TestClient(app) as client:
        ws, _qid = _query_source(client)
        resp = client.post(
            f"/workspaces/{ws}/workflows",
            json={"name": "bad", "definition": {"sources": ["qr_00000000"], "steps": []}},
        )
    assert resp.status_code == 422


@pytest.mark.unit
def test_delete_then_404() -> None:
    with TestClient(app) as client:
        ws, qid = _query_source(client)
        wid = _create(client, ws, qid).json()["id"]
        assert client.delete(f"/workflows/{wid}").status_code == 204
        assert client.get(f"/workflows/{wid}").status_code == 404
