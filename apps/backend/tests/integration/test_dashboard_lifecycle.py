"""Integration tests for dashboard and panel lifecycle persistence."""
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
    response = client.post("/api/v1/workspaces", json={"name": "dashboard-integration"})
    assert response.status_code == 200
    return response.json()["id"]


def _create_saved_query(client: TestClient, workspace_id: str, name: str) -> str:
    response = client.post(
        f"/api/v1/workspaces/{workspace_id}/saved-queries",
        json={
            "name": name,
            "builder_snapshot": {
                "base_table_id": "t1",
                "selected_columns": [],
                "filters": [],
                "aggregations": [],
                "group_by_columns": [],
                "joins": [],
            },
        },
    )
    assert response.status_code == 201
    return response.json()["query_id"]


def test_dashboard_crud_lifecycle(client: TestClient, workspace_id: str) -> None:
    create_response = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards",
        json={"dashboard_name": "Lifecycle", "description": "Initial"},
    )
    assert create_response.status_code == 201
    dashboard_id = create_response.json()["dashboard_id"]

    list_response = client.get(f"/api/v1/workspaces/{workspace_id}/dashboards")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    patch_response = client.patch(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}",
        json={"description": "Updated description"},
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["description"] == "Updated description"

    delete_response = client.delete(f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}")
    assert delete_response.status_code == 204

    list_after_delete = client.get(f"/api/v1/workspaces/{workspace_id}/dashboards")
    assert list_after_delete.status_code == 200
    assert list_after_delete.json() == []


def test_panel_add_reorder_delete_compacts_order(client: TestClient, workspace_id: str) -> None:
    dashboard_response = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards",
        json={"dashboard_name": "Panel Lifecycle"},
    )
    assert dashboard_response.status_code == 201
    dashboard_id = dashboard_response.json()["dashboard_id"]

    query_a = _create_saved_query(client, workspace_id, "Panel A Query")
    query_b = _create_saved_query(client, workspace_id, "Panel B Query")

    add_a = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/panels",
        json={"saved_query_id": query_a, "panel_name": "Panel A"},
    )
    assert add_a.status_code == 201
    panel_a_id = add_a.json()["panel_id"]

    add_b = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/panels",
        json={"saved_query_id": query_b, "panel_name": "Panel B"},
    )
    assert add_b.status_code == 201
    panel_b_id = add_b.json()["panel_id"]

    reorder = client.patch(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/panels/{panel_b_id}",
        json={"panel_order": 0},
    )
    assert reorder.status_code == 200

    detail = client.get(f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}")
    assert detail.status_code == 200
    panels = detail.json()["panels"]
    assert [panel["panel_order"] for panel in panels] == [0, 1]

    delete_first = client.delete(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/panels/{panel_a_id}"
    )
    assert delete_first.status_code == 204

    detail_after_delete = client.get(f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}")
    assert detail_after_delete.status_code == 200
    remaining = detail_after_delete.json()["panels"]
    assert len(remaining) == 1
    assert remaining[0]["panel_id"] == panel_b_id
    assert remaining[0]["panel_order"] == 0