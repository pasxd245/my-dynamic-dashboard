"""Contract tests for Spec 004: Saved Queries API shape."""
from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.metadata_db import init_metadata_db
from app.main import app
import app.main as main_module
from tests.conftest import seed_source_activate


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    db_path = tmp_path / "metadata.db"
    parquet_root = tmp_path / "parquet"
    monkeypatch.setattr(main_module, "DB_PATH", db_path)
    monkeypatch.setattr(main_module, "PARQUET_ROOT", parquet_root)
    init_metadata_db(db_path)
    return TestClient(app)


@pytest.fixture()
def workspace_id(client: TestClient) -> str:
    r = client.post("/api/v1/workspaces", json={"name": "contract-ws"})
    assert r.status_code == 200
    wid = r.json()["id"]
    seed_source_activate(client, wid)
    return wid


def _minimal_snapshot() -> dict:
    return {
        "base_table_id": "t1",
        "selected_columns": [],
        "filters": [],
        "aggregations": [],
        "group_by_columns": [],
        "joins": [],
    }


# ── POST /saved-queries ────────────────────────────────────────────────────────


def test_create_saved_query_201_shape(client: TestClient, workspace_id: str) -> None:
    r = client.post(
        f"/api/v1/workspaces/{workspace_id}/saved-queries",
        json={"name": "My Query", "builder_snapshot": _minimal_snapshot()},
    )
    assert r.status_code == 201
    body = r.json()
    assert "query_id" in body
    assert body["name"] == "My Query"
    assert "version_id" in body
    assert body["version_number"] == 1
    assert "created_at" in body
    assert "workspace_id" in body


def test_create_saved_query_409_duplicate_name(client: TestClient, workspace_id: str) -> None:
    payload = {"name": "DupQuery", "builder_snapshot": _minimal_snapshot()}
    r1 = client.post(f"/api/v1/workspaces/{workspace_id}/saved-queries", json=payload)
    assert r1.status_code == 201
    r2 = client.post(f"/api/v1/workspaces/{workspace_id}/saved-queries", json=payload)
    assert r2.status_code == 409
    body = r2.json()
    # Spec 007 changed the error envelope to ActionableError; accept both shapes.
    error_code = body.get("error_code", body.get("error", {}).get("code", ""))
    assert "duplicate" in error_code.lower()


def test_create_saved_query_returns_tags(client: TestClient, workspace_id: str) -> None:
    r = client.post(
        f"/api/v1/workspaces/{workspace_id}/saved-queries",
        json={"name": "Tagged", "builder_snapshot": _minimal_snapshot(), "tags": ["Finance", "Weekly"]},
    )
    assert r.status_code == 201
    assert sorted(r.json()["tags"]) == ["finance", "weekly"]


# ── GET /saved-queries ─────────────────────────────────────────────────────────


def test_list_saved_queries_shape(client: TestClient, workspace_id: str) -> None:
    r = client.get(f"/api/v1/workspaces/{workspace_id}/saved-queries")
    assert r.status_code == 200
    body = r.json()
    assert "items" in body
    assert "total" in body
    assert "limit" in body
    assert "offset" in body


def test_list_saved_queries_returns_created(client: TestClient, workspace_id: str) -> None:
    client.post(
        f"/api/v1/workspaces/{workspace_id}/saved-queries",
        json={"name": "ListQ", "builder_snapshot": _minimal_snapshot()},
    )
    r = client.get(f"/api/v1/workspaces/{workspace_id}/saved-queries")
    assert r.json()["total"] == 1
    assert r.json()["items"][0]["name"] == "ListQ"


# ── GET /saved-queries/search ──────────────────────────────────────────────────


def test_search_saved_queries_shape(client: TestClient, workspace_id: str) -> None:
    r = client.get(f"/api/v1/workspaces/{workspace_id}/saved-queries/search?q=test")
    assert r.status_code == 200
    body = r.json()
    assert "items" in body
    assert "total" in body


# ── GET /saved-queries/{query_id} ─────────────────────────────────────────────


def test_get_saved_query_shape(client: TestClient, workspace_id: str) -> None:
    create_r = client.post(
        f"/api/v1/workspaces/{workspace_id}/saved-queries",
        json={"name": "DetailQ", "builder_snapshot": _minimal_snapshot()},
    )
    query_id = create_r.json()["query_id"]
    r = client.get(f"/api/v1/workspaces/{workspace_id}/saved-queries/{query_id}")
    assert r.status_code == 200
    body = r.json()
    assert "query_id" in body
    assert "latest_version" in body
    assert "versions" in body


def test_get_saved_query_404(client: TestClient, workspace_id: str) -> None:
    r = client.get(f"/api/v1/workspaces/{workspace_id}/saved-queries/nonexistent-id")
    assert r.status_code == 404


# ── POST /saved-queries/{id}/load ─────────────────────────────────────────────


def test_load_saved_query_shape(client: TestClient, workspace_id: str) -> None:
    create_r = client.post(
        f"/api/v1/workspaces/{workspace_id}/saved-queries",
        json={"name": "LoadQ", "builder_snapshot": _minimal_snapshot()},
    )
    query_id = create_r.json()["query_id"]
    r = client.post(f"/api/v1/workspaces/{workspace_id}/saved-queries/{query_id}/load")
    assert r.status_code == 200
    body = r.json()
    assert "builder_snapshot" in body
    assert "validation_issues" in body
    assert "can_load" in body


# ── POST /saved-queries/{id}/duplicate ────────────────────────────────────────


def test_duplicate_saved_query_shape(client: TestClient, workspace_id: str) -> None:
    create_r = client.post(
        f"/api/v1/workspaces/{workspace_id}/saved-queries",
        json={"name": "Original", "builder_snapshot": _minimal_snapshot()},
    )
    query_id = create_r.json()["query_id"]
    r = client.post(
        f"/api/v1/workspaces/{workspace_id}/saved-queries/{query_id}/duplicate",
        json={"name": "Copy of Original"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["query_id"] != query_id
    assert body["name"] == "Copy of Original"
    assert body["version_number"] == 1


# ── PATCH /saved-queries/{id} ────────────────────────────────────────────────


def test_patch_saved_query_shape(client: TestClient, workspace_id: str) -> None:
    create_r = client.post(
        f"/api/v1/workspaces/{workspace_id}/saved-queries",
        json={"name": "PatchQ", "builder_snapshot": _minimal_snapshot()},
    )
    query_id = create_r.json()["query_id"]
    r = client.patch(
        f"/api/v1/workspaces/{workspace_id}/saved-queries/{query_id}",
        json={"name": "PatchQ Renamed"},
    )
    assert r.status_code == 200
    assert r.json()["name"] == "PatchQ Renamed"


# ── DELETE /saved-queries/{id} ────────────────────────────────────────────────


def test_delete_saved_query_shape(client: TestClient, workspace_id: str) -> None:
    create_r = client.post(
        f"/api/v1/workspaces/{workspace_id}/saved-queries",
        json={"name": "DelQ", "builder_snapshot": _minimal_snapshot()},
    )
    query_id = create_r.json()["query_id"]
    r = client.delete(f"/api/v1/workspaces/{workspace_id}/saved-queries/{query_id}")
    assert r.status_code == 200
    body = r.json()
    assert body["is_deleted"] is True
    assert "recoverable_until" in body
    assert "expires_in_seconds" in body


# ── POST /saved-queries/{id}/restore ─────────────────────────────────────────


def test_restore_saved_query_shape(client: TestClient, workspace_id: str) -> None:
    create_r = client.post(
        f"/api/v1/workspaces/{workspace_id}/saved-queries",
        json={"name": "RestoreQ", "builder_snapshot": _minimal_snapshot()},
    )
    query_id = create_r.json()["query_id"]
    client.delete(f"/api/v1/workspaces/{workspace_id}/saved-queries/{query_id}")
    r = client.post(f"/api/v1/workspaces/{workspace_id}/saved-queries/{query_id}/restore")
    assert r.status_code == 200
    assert r.json()["deleted_at"] is None


# ── GET /saved-queries/{id}/executions ───────────────────────────────────────


def test_get_execution_history_shape(client: TestClient, workspace_id: str) -> None:
    create_r = client.post(
        f"/api/v1/workspaces/{workspace_id}/saved-queries",
        json={"name": "ExecQ", "builder_snapshot": _minimal_snapshot()},
    )
    query_id = create_r.json()["query_id"]
    r = client.get(f"/api/v1/workspaces/{workspace_id}/saved-queries/{query_id}/executions")
    assert r.status_code == 200
    body = r.json()
    assert "items" in body
    assert "total" in body
