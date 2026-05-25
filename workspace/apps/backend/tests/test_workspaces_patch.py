"""R25: PATCH /workspaces/{id} — rename behavior tests.

Per the R22 sub-rule ("every accepted field gets one behavior
test"), each happy-path / error path asserts the observable state
change in addition to the response shape.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests._conformance import validate_response


def _create(client: TestClient, name: str = "Marketing") -> str:
    return client.post("/workspaces", json={"name": name}).json()["id"]


@pytest.mark.unit
def test_patch_renames_workspace_and_returns_updated_row() -> None:
    with TestClient(app) as client:
        ws_id = _create(client, "Marketing")

        resp = client.patch(f"/workspaces/{ws_id}", json={"name": "Marketing 2026"})

        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == ws_id
        assert body["name"] == "Marketing 2026"
        validate_response("workspaces/patch.contract.yaml", 200, body)

        # Behavior conformance: re-list shows the new name.
        listed = client.get("/workspaces").json()
        assert any(w["id"] == ws_id and w["name"] == "Marketing 2026" for w in listed)


@pytest.mark.unit
def test_patch_unknown_id_returns_404_not_found() -> None:
    with TestClient(app) as client:
        resp = client.patch("/workspaces/ws_deadbeef", json={"name": "anything"})

    assert resp.status_code == 404
    assert resp.json() == {"code": "not_found"}
    validate_response("workspaces/patch.contract.yaml", 404, resp.json())


@pytest.mark.unit
def test_patch_duplicate_name_returns_409_name_taken() -> None:
    with TestClient(app) as client:
        sales = _create(client, "Sales Ops")
        mkt_id = _create(client, "Marketing")

        # Try to rename Marketing → Sales Ops (already taken).
        resp = client.patch(f"/workspaces/{mkt_id}", json={"name": "Sales Ops"})

        assert resp.status_code == 409
        assert resp.json() == {"code": "name_taken"}
        validate_response("workspaces/patch.contract.yaml", 409, resp.json())

        # Behavior conformance: both workspaces still have their
        # original names — the rejection is total, not partial.
        rows = client.get("/workspaces").json()
        by_id = {w["id"]: w["name"] for w in rows}
        assert by_id[mkt_id] == "Marketing"
        assert by_id[sales] == "Sales Ops"


@pytest.mark.unit
def test_patch_rename_to_self_is_idempotent_200() -> None:
    with TestClient(app) as client:
        ws_id = _create(client, "Marketing")
        resp = client.patch(f"/workspaces/{ws_id}", json={"name": "Marketing"})

    assert resp.status_code == 200
    assert resp.json()["name"] == "Marketing"


@pytest.mark.unit
def test_patch_empty_name_returns_422() -> None:
    with TestClient(app) as client:
        ws_id = _create(client)
        resp = client.patch(f"/workspaces/{ws_id}", json={"name": ""})

    assert resp.status_code == 422


@pytest.mark.unit
def test_patch_name_too_long_returns_422() -> None:
    with TestClient(app) as client:
        ws_id = _create(client)
        resp = client.patch(f"/workspaces/{ws_id}", json={"name": "x" * 81})

    assert resp.status_code == 422


@pytest.mark.unit
def test_patch_extra_field_returns_422() -> None:
    with TestClient(app) as client:
        ws_id = _create(client)
        resp = client.patch(
            f"/workspaces/{ws_id}", json={"name": "ok", "rogue": "x"}
        )

    assert resp.status_code == 422
