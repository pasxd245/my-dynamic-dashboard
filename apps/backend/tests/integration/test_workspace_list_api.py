from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from app.core.metadata_db import init_metadata_db
from app.main import app
import app.main as main_module


def _client(tmp_path: Path, monkeypatch) -> TestClient:
    db_path = tmp_path / "metadata.db"
    parquet_root = tmp_path / "parquet"
    monkeypatch.setattr(main_module, "DB_PATH", db_path)
    monkeypatch.setattr(main_module, "PARQUET_ROOT", parquet_root)
    init_metadata_db(db_path)
    return TestClient(app)


def test_create_and_list_workspaces_api(tmp_path: Path, monkeypatch) -> None:
    client = _client(tmp_path, monkeypatch)

    create_one = client.post("/api/v1/workspaces", json={"name": "ws-alpha"})
    create_two = client.post("/api/v1/workspaces", json={"name": "ws-beta"})

    assert create_one.status_code == 200
    assert create_two.status_code == 200

    listed = client.get("/api/v1/workspaces")
    assert listed.status_code == 200

    payload = listed.json()
    assert isinstance(payload, list)

    names = {item["name"] for item in payload}
    assert "ws-alpha" in names
    assert "ws-beta" in names


def test_create_workspace_requires_name(tmp_path: Path, monkeypatch) -> None:
    client = _client(tmp_path, monkeypatch)

    response = client.post("/api/v1/workspaces", json={})

    assert response.status_code == 422
