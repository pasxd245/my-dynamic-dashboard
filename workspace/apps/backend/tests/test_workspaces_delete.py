"""R25: DELETE /workspaces/{id} — block-on-non-empty cascade rule.

Each test exercises a response code AND asserts the observable
state change (or non-change for the 409 case) per the R22 sub-rule.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests._conformance import validate_response


_FIXTURES = Path(__file__).parent / "fixtures"


def _make_workspace(client: TestClient, name: str = "Marketing") -> str:
    return client.post("/workspaces", json={"name": name}).json()["id"]


def _make_dataset(client: TestClient, ws_id: str, name: str = "leads") -> str:
    """Upload sample.csv then commit it to the given workspace."""
    csv_path = _FIXTURES / "sample.csv"
    temp = client.post(
        "/uploads",
        data={"sourceFormat": "csv"},
        files={"file": ("sample.csv", csv_path.read_bytes(), "text/csv")},
    ).json()["temp_id"]
    body = client.post(
        f"/workspaces/{ws_id}/datasets/batch",
        json={"temp_id": temp, "items": [{"name": name}]},
    ).json()
    return body[0]["id"]


@pytest.mark.unit
def test_delete_empty_workspace_returns_204() -> None:
    with TestClient(app) as client:
        ws_id = _make_workspace(client, "R&D")

        resp = client.delete(f"/workspaces/{ws_id}")

        assert resp.status_code == 204
        assert resp.content == b""

        # Behavior: list no longer contains it.
        rows = client.get("/workspaces").json()
        assert all(w["id"] != ws_id for w in rows)


@pytest.mark.unit
def test_delete_unknown_returns_404_not_found() -> None:
    with TestClient(app) as client:
        resp = client.delete("/workspaces/ws_deadbeef")

    assert resp.status_code == 404
    assert resp.json() == {"code": "not_found"}
    validate_response("workspaces/delete.contract.yaml", 404, resp.json())


@pytest.mark.unit
def test_delete_already_deleted_returns_404() -> None:
    with TestClient(app) as client:
        ws_id = _make_workspace(client, "Once")
        first = client.delete(f"/workspaces/{ws_id}")
        second = client.delete(f"/workspaces/{ws_id}")

    assert first.status_code == 204
    assert second.status_code == 404


@pytest.mark.unit
def test_delete_non_empty_returns_409_non_empty_with_count() -> None:
    with TestClient(app) as client:
        ws_id = _make_workspace(client, "Marketing")
        _make_dataset(client, ws_id, name="leads_2025")
        _make_dataset(client, ws_id, name="contacts_2026")

        resp = client.delete(f"/workspaces/{ws_id}")

        assert resp.status_code == 409
        body = resp.json()
        assert body == {"code": "non_empty", "datasetCount": 2}
        validate_response("workspaces/delete.contract.yaml", 409, body)

        # Behavior conformance: workspace still exists; datasets still
        # exist. The 409 must be a pure rejection, not a partial action.
        rows = client.get("/workspaces").json()
        assert any(w["id"] == ws_id for w in rows)
        ds_rows = client.get("/datasets").json()
        assert len(ds_rows) == 2
