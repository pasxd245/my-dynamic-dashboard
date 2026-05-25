"""R25: DELETE /datasets/{id} — delete + parquet cleanup tests."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.storage import dataset_dir
from tests._conformance import validate_response


_FIXTURES = Path(__file__).parent / "fixtures"


def _make_workspace(client: TestClient, name: str = "Marketing") -> str:
    return client.post("/workspaces", json={"name": name}).json()["id"]


def _make_dataset(client: TestClient, ws_id: str, name: str = "leads") -> str:
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
def test_delete_dataset_returns_204_and_removes_parquet() -> None:
    with TestClient(app) as client:
        ws_id = _make_workspace(client)
        ds_id = _make_dataset(client, ws_id, "leads_2025")

        # Sanity: directory exists before.
        target = dataset_dir(ws_id, ds_id)
        assert target.exists()
        assert (target / "parsed.parquet").exists()

        resp = client.delete(f"/datasets/{ds_id}")

        assert resp.status_code == 204
        assert resp.content == b""

        # Behavior conformance: DB row gone.
        ds_rows = client.get("/datasets").json()
        assert all(d["id"] != ds_id for d in ds_rows)

        # Behavior conformance: parquet directory gone.
        assert not target.exists()


@pytest.mark.unit
def test_delete_dataset_unknown_returns_404() -> None:
    with TestClient(app) as client:
        resp = client.delete("/datasets/ds_deadbeef")

    assert resp.status_code == 404
    assert resp.json() == {"code": "not_found"}
    validate_response("datasets/delete.contract.yaml", 404, resp.json())


@pytest.mark.unit
def test_delete_dataset_already_deleted_returns_404() -> None:
    with TestClient(app) as client:
        ws_id = _make_workspace(client)
        ds_id = _make_dataset(client, ws_id, "leads")
        first = client.delete(f"/datasets/{ds_id}")
        second = client.delete(f"/datasets/{ds_id}")

    assert first.status_code == 204
    assert second.status_code == 404


@pytest.mark.unit
def test_delete_dataset_does_not_touch_workspace() -> None:
    """Deleting the last dataset should NOT delete the workspace.
    The cascade only goes one way (workspace → datasets); deleting
    a dataset is unrelated to the workspace lifecycle."""
    with TestClient(app) as client:
        ws_id = _make_workspace(client, "Marketing")
        ds_id = _make_dataset(client, ws_id, "only_one")

        resp = client.delete(f"/datasets/{ds_id}")
        assert resp.status_code == 204

        # Workspace still exists.
        rows = client.get("/workspaces").json()
        assert any(w["id"] == ws_id for w in rows)
