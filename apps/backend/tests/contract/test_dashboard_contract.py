"""Contract tests for Spec 005 dashboard CRUD and panel endpoints."""
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
    response = client.post("/api/v1/workspaces", json={"name": "dashboard-contract"})
    assert response.status_code == 200
    return response.json()["id"]


def _create_saved_query(client: TestClient, workspace_id: str, name: str) -> str:
    payload = {
        "name": name,
        "builder_snapshot": {
            "base_table_id": "t1",
            "selected_columns": [],
            "filters": [],
            "aggregations": [],
            "group_by_columns": [],
            "joins": [],
        },
    }
    response = client.post(f"/api/v1/workspaces/{workspace_id}/saved-queries", json=payload)
    assert response.status_code == 201
    return response.json()["query_id"]


def _create_saved_query_with_parameters(client: TestClient, workspace_id: str, name: str) -> str:
    payload = {
        "name": name,
        "builder_snapshot": {
            "base_table_id": "t1",
            "selected_columns": [
                {"table_id": "t1", "column_name": "week", "alias": "week"},
                {"table_id": "t1", "column_name": "revenue", "alias": "revenue"},
            ],
            "parameters": [
                {"name": "start_date", "parameterType": "date", "required": True},
                {"name": "min_revenue", "parameterType": "numeric", "required": False, "validation": {"min": 0}},
            ],
            "filters": [],
            "aggregations": [],
            "group_by_columns": [],
            "joins": [],
        },
    }
    response = client.post(f"/api/v1/workspaces/{workspace_id}/saved-queries", json=payload)
    assert response.status_code == 201
    return response.json()["query_id"]


def test_dashboard_crud_contract_shape(client: TestClient, workspace_id: str) -> None:
    create_response = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards",
        json={"dashboard_name": "Revenue Overview", "description": "Weekly metrics"},
    )
    assert create_response.status_code == 201
    created = create_response.json()
    assert set(created.keys()) == {
        "dashboard_id",
        "workspace_id",
        "owner_user_id",
        "dashboard_name",
        "description",
        "refresh_cadence",
        "last_refreshed_at",
        "current_run_id",
        "created_at",
        "updated_at",
    }

    dashboard_id = created["dashboard_id"]

    listed = client.get(f"/api/v1/workspaces/{workspace_id}/dashboards")
    assert listed.status_code == 200
    assert isinstance(listed.json(), list)
    assert len(listed.json()) == 1

    detail = client.get(f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}")
    assert detail.status_code == 200
    detail_payload = detail.json()
    assert "panels" in detail_payload
    assert detail_payload["dashboard_id"] == dashboard_id

    patched = client.patch(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}",
        json={"dashboard_name": "Revenue Updated", "refresh_cadence": "15min"},
    )
    assert patched.status_code == 200
    assert patched.json()["dashboard_name"] == "Revenue Updated"
    assert patched.json()["refresh_cadence"] == "15min"

    deleted = client.delete(f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}")
    assert deleted.status_code == 204


def test_panel_add_update_delete_contract_shape(client: TestClient, workspace_id: str) -> None:
    dashboard = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards",
        json={"dashboard_name": "Panel CRUD"},
    )
    assert dashboard.status_code == 201
    dashboard_id = dashboard.json()["dashboard_id"]
    query_id = _create_saved_query(client, workspace_id, "Panel Query")

    add_response = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/panels",
        json={"saved_query_id": query_id, "panel_name": "Main Panel"},
    )
    assert add_response.status_code == 201
    added = add_response.json()
    assert set(added.keys()) == {
        "panel_id",
        "dashboard_id",
        "saved_query_id",
        "panel_name",
        "panel_order",
        "is_visible",
        "chart_config_json",
        "parameter_overrides_json",
        "created_at",
        "updated_at",
    }

    panel_id = added["panel_id"]
    patch_response = client.patch(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/panels/{panel_id}",
        json={"panel_name": "Main Panel Updated", "is_visible": False},
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["panel_name"] == "Main Panel Updated"
    assert patch_response.json()["is_visible"] is False

    delete_response = client.delete(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/panels/{panel_id}"
    )
    assert delete_response.status_code == 204


def test_add_panel_rejects_unknown_saved_query(client: TestClient, workspace_id: str) -> None:
    dashboard = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards",
        json={"dashboard_name": "Panel Validation"},
    )
    assert dashboard.status_code == 201
    dashboard_id = dashboard.json()["dashboard_id"]

    response = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/panels",
        json={"saved_query_id": "missing-query", "panel_name": "Broken"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "dashboard_validation_error"


def test_run_detail_and_panel_data_contract_shape(client: TestClient, workspace_id: str) -> None:
    dashboard = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards",
        json={"dashboard_name": "Run detail"},
    )
    assert dashboard.status_code == 201
    dashboard_id = dashboard.json()["dashboard_id"]

    query_id = _create_saved_query(client, workspace_id, "Run detail query")
    panel = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/panels",
        json={"saved_query_id": query_id, "panel_name": "Panel 1"},
    )
    assert panel.status_code == 201
    panel_id = panel.json()["panel_id"]

    run = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/run",
        json={"parameters": {}},
    )
    assert run.status_code == 202
    run_id = run.json()["run_id"]

    run_detail = client.get(f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/runs/{run_id}")
    assert run_detail.status_code == 200
    detail_payload = run_detail.json()
    assert "panels" in detail_payload
    assert detail_payload["run_id"] == run_id

    panel_data = client.get(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/runs/{run_id}/panels/{panel_id}/data?limit=10&offset=0"
    )
    assert panel_data.status_code == 200
    panel_payload = panel_data.json()
    assert set(panel_payload.keys()) == {
        "panel_id",
        "row_count",
        "is_aggregated",
        "columns",
        "rows",
        "has_more",
    }


def test_run_parameter_validation_error_contract(client: TestClient, workspace_id: str) -> None:
    dashboard = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards",
        json={"dashboard_name": "Run param validation"},
    )
    assert dashboard.status_code == 201
    dashboard_id = dashboard.json()["dashboard_id"]

    query_id = _create_saved_query_with_parameters(client, workspace_id, "Param query")
    panel = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/panels",
        json={"saved_query_id": query_id},
    )
    assert panel.status_code == 201

    run = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/run",
        json={"parameters": {"min_revenue": 10}},
    )
    assert run.status_code == 202
    run_id = run.json()["run_id"]
    run_detail = client.get(f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/runs/{run_id}")
    assert run_detail.status_code == 200
    panels = run_detail.json()["panels"]
    assert panels[0]["error_type"] == "validation"


def test_chart_suggestion_endpoint_contract_shape(client: TestClient, workspace_id: str) -> None:
    dashboard = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards",
        json={"dashboard_name": "Chart suggestion"},
    )
    assert dashboard.status_code == 201
    dashboard_id = dashboard.json()["dashboard_id"]

    query_id = _create_saved_query(client, workspace_id, "Chart query")
    panel = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/panels",
        json={"saved_query_id": query_id},
    )
    assert panel.status_code == 201
    panel_id = panel.json()["panel_id"]

    run = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/run",
        json={"parameters": {}},
    )
    assert run.status_code == 202
    run_id = run.json()["run_id"]

    response = client.get(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/runs/{run_id}/panels/{panel_id}/chart-suggestion"
    )
    assert response.status_code == 200
    payload = response.json()
    assert set(payload.keys()) == {"chart_type", "reason", "axes"}


def test_run_cadence_history_and_exports_contract(client: TestClient, workspace_id: str) -> None:
    dashboard = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards",
        json={"dashboard_name": "Run and export"},
    )
    assert dashboard.status_code == 201
    dashboard_id = dashboard.json()["dashboard_id"]

    query_id = _create_saved_query(client, workspace_id, "Export query")
    panel = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/panels",
        json={"saved_query_id": query_id},
    )
    assert panel.status_code == 201
    panel_id = panel.json()["panel_id"]

    run_response = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/run",
        json={"parameters": {}},
    )
    assert run_response.status_code == 202
    run_id = run_response.json()["run_id"]

    cadence_response = client.patch(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/refresh-cadence",
        json={"refresh_cadence": "15min"},
    )
    assert cadence_response.status_code == 200
    assert cadence_response.json()["refresh_cadence"] == "15min"

    history = client.get(f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/runs")
    assert history.status_code == 200
    assert "runs" in history.json()

    dashboard_export = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/export",
        json={"format": "png"},
    )
    assert dashboard_export.status_code == 200

    panel_export = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/runs/{run_id}/panels/{panel_id}/export",
        json={"format": "csv"},
    )
    assert panel_export.status_code == 200