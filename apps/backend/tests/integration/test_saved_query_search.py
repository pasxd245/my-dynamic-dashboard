"""Integration tests: Saved Query search and browse (US2)."""
from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.metadata_db import init_metadata_db
from app.main import app
import app.main as main_module


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
    r = client.post("/api/v1/workspaces", json={"name": "search-ws"})
    return r.json()["id"]


def _snap() -> dict:
    return {"base_table_id": "t1", "selected_columns": [], "filters": [], "aggregations": [], "group_by_columns": [], "joins": []}


def _create(client: TestClient, workspace_id: str, name: str, tags: list[str] | None = None, description: str = "") -> str:
    payload: dict = {"name": name, "builder_snapshot": _snap(), "description": description}
    if tags:
        payload["tags"] = tags
    r = client.post(f"/api/v1/workspaces/{workspace_id}/saved-queries", json=payload)
    assert r.status_code == 201
    return r.json()["query_id"]


# ── Pagination ────────────────────────────────────────────────────────────────


def test_list_pagination(client: TestClient, workspace_id: str) -> None:
    for i in range(5):
        _create(client, workspace_id, f"Query {i:02d}")

    r = client.get(f"/api/v1/workspaces/{workspace_id}/saved-queries?limit=2&offset=0")
    body = r.json()
    assert r.status_code == 200
    assert body["total"] == 5
    assert len(body["items"]) == 2
    assert body["next_offset"] == 2

    r2 = client.get(f"/api/v1/workspaces/{workspace_id}/saved-queries?limit=2&offset=4")
    body2 = r2.json()
    assert len(body2["items"]) == 1
    assert body2["next_offset"] is None


# ── Keyword search ────────────────────────────────────────────────────────────


def test_keyword_search_by_name(client: TestClient, workspace_id: str) -> None:
    _create(client, workspace_id, "Revenue Report")
    _create(client, workspace_id, "Customer Churn Analysis")
    _create(client, workspace_id, "Revenue Weekly")

    r = client.get(f"/api/v1/workspaces/{workspace_id}/saved-queries/search?q=Revenue")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 2
    names = {i["name"] for i in body["items"]}
    assert "Revenue Report" in names
    assert "Revenue Weekly" in names


def test_keyword_search_case_insensitive(client: TestClient, workspace_id: str) -> None:
    _create(client, workspace_id, "Finance Summary", description="quarterly finance review")
    r = client.get(f"/api/v1/workspaces/{workspace_id}/saved-queries/search?q=finance")
    assert r.json()["total"] == 1


def test_keyword_search_by_description(client: TestClient, workspace_id: str) -> None:
    _create(client, workspace_id, "Sales Q1", description="monthly revenue breakdown")
    _create(client, workspace_id, "HR Roster", description="employee list")
    r = client.get(f"/api/v1/workspaces/{workspace_id}/saved-queries/search?q=revenue")
    assert r.json()["total"] == 1


# ── Tag filter ────────────────────────────────────────────────────────────────


def test_tag_filter(client: TestClient, workspace_id: str) -> None:
    _create(client, workspace_id, "Finance Report", tags=["finance", "monthly"])
    _create(client, workspace_id, "HR Report", tags=["hr"])
    _create(client, workspace_id, "Finance Weekly", tags=["finance", "weekly"])

    r = client.get(f"/api/v1/workspaces/{workspace_id}/saved-queries?tag=finance")
    assert r.status_code == 200
    assert r.json()["total"] == 2


# ── Soft-delete exclusion ─────────────────────────────────────────────────────


def test_deleted_excluded_from_active_list(client: TestClient, workspace_id: str) -> None:
    qid = _create(client, workspace_id, "ToDelete")
    _create(client, workspace_id, "Keeper")

    client.delete(f"/api/v1/workspaces/{workspace_id}/saved-queries/{qid}")

    r = client.get(f"/api/v1/workspaces/{workspace_id}/saved-queries")
    assert r.json()["total"] == 1
    assert r.json()["items"][0]["name"] == "Keeper"


def test_deleted_queries_visible_with_state_filter(client: TestClient, workspace_id: str) -> None:
    qid = _create(client, workspace_id, "DeletedQ")
    client.delete(f"/api/v1/workspaces/{workspace_id}/saved-queries/{qid}")

    r = client.get(f"/api/v1/workspaces/{workspace_id}/saved-queries?state=deleted")
    assert r.json()["total"] == 1
    assert r.json()["items"][0]["deleted_at"] is not None
