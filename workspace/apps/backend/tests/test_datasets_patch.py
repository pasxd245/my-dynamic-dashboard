"""R25: PATCH /datasets/{id} — rename behavior tests."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests._conformance import validate_response


_FIXTURES = Path(__file__).parent / "fixtures"


def _make_workspace(client: TestClient, name: str = "Marketing") -> str:
    return client.post("/workspaces", json={"name": name}).json()["id"]


def _make_dataset(client: TestClient, ws_id: str, name: str) -> str:
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
def test_patch_dataset_renames_and_returns_updated_row() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds_id = _make_dataset(client, ws, "commission_calc")

        resp = client.patch(f"/datasets/{ds_id}", json={"name": "commission_2026"})

        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["id"] == ds_id
        assert body["name"] == "commission_2026"
        # Other fields preserved.
        assert body["workspaceId"] == ws
        assert body["sourceFormat"] == "csv"
        validate_response("datasets/patch.contract.yaml", 200, body)

        # Behavior conformance: re-list shows the new name.
        ds_rows = client.get("/datasets").json()
        renamed = next(d for d in ds_rows if d["id"] == ds_id)
        assert renamed["name"] == "commission_2026"


@pytest.mark.unit
def test_patch_dataset_unknown_returns_404_not_found() -> None:
    with TestClient(app) as client:
        resp = client.patch("/datasets/ds_deadbeef", json={"name": "x"})

    assert resp.status_code == 404
    assert resp.json() == {"code": "not_found"}
    validate_response("datasets/patch.contract.yaml", 404, resp.json())


@pytest.mark.unit
def test_patch_dataset_duplicate_in_same_workspace_returns_409() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        _make_dataset(client, ws, "alpha")
        beta_id = _make_dataset(client, ws, "beta")

        # Rename beta → alpha (taken in this workspace).
        resp = client.patch(f"/datasets/{beta_id}", json={"name": "alpha"})

        assert resp.status_code == 409
        assert resp.json() == {"code": "name_taken"}
        validate_response("datasets/patch.contract.yaml", 409, resp.json())

        # Behavior conformance: beta is unchanged.
        ds_rows = client.get("/datasets").json()
        beta = next(d for d in ds_rows if d["id"] == beta_id)
        assert beta["name"] == "beta"


@pytest.mark.unit
def test_patch_dataset_same_name_in_different_workspace_is_allowed() -> None:
    """Per-workspace uniqueness — datasets in different workspaces
    may share a name."""
    with TestClient(app) as client:
        ws_a = _make_workspace(client, "A")
        ws_b = _make_workspace(client, "B")
        _make_dataset(client, ws_a, "shared_name")
        b_id = _make_dataset(client, ws_b, "b_original")

        # Rename ws_b's dataset to a name that exists in ws_a — should succeed.
        resp = client.patch(f"/datasets/{b_id}", json={"name": "shared_name"})

        assert resp.status_code == 200
        assert resp.json()["name"] == "shared_name"


@pytest.mark.unit
def test_patch_dataset_empty_name_returns_422() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds_id = _make_dataset(client, ws, "x")
        resp = client.patch(f"/datasets/{ds_id}", json={"name": ""})

    assert resp.status_code == 422


@pytest.mark.unit
def test_patch_dataset_name_too_long_returns_422() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds_id = _make_dataset(client, ws, "x")
        # Dataset name max is 120 (not 80 like workspace).
        resp = client.patch(f"/datasets/{ds_id}", json={"name": "y" * 121})

    assert resp.status_code == 422


@pytest.mark.unit
def test_patch_dataset_120_chars_is_accepted() -> None:
    """Boundary test for the dataset-specific 120-char limit."""
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds_id = _make_dataset(client, ws, "x")
        resp = client.patch(f"/datasets/{ds_id}", json={"name": "y" * 120})

    assert resp.status_code == 200
