"""Integration tests for dashboard run, history, exports, and failure isolation."""
from __future__ import annotations

import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.metadata_db import get_connection, init_metadata_db
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
    response = client.post("/api/v1/workspaces", json={"name": "dashboard-run-integration"})
    assert response.status_code == 200
    return response.json()["id"]


def _create_saved_query(
    client: TestClient,
    workspace_id: str,
    *,
    name: str,
    parameters: list[dict[str, object]] | None = None,
    selected_columns: list[dict[str, object]] | None = None,
) -> str:
    response = client.post(
        f"/api/v1/workspaces/{workspace_id}/saved-queries",
        json={
            "name": name,
            "builder_snapshot": {
                "base_table_id": "t1",
                "selected_columns": selected_columns
                or [
                    {"table_id": "t1", "column_name": "week", "alias": "week"},
                    {"table_id": "t1", "column_name": "revenue", "alias": "revenue"},
                ],
                "parameters": parameters or [],
                "filters": [],
                "aggregations": [],
                "group_by_columns": [],
                "joins": [],
            },
        },
    )
    assert response.status_code == 201
    return response.json()["query_id"]


def _create_dashboard_with_panels(client: TestClient, workspace_id: str, query_ids: list[str]) -> tuple[str, list[str]]:
    dashboard = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards",
        json={"dashboard_name": "Run dashboard"},
    )
    assert dashboard.status_code == 201
    dashboard_id = dashboard.json()["dashboard_id"]

    panel_ids: list[str] = []
    for query_id in query_ids:
        panel = client.post(
            f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/panels",
            json={"saved_query_id": query_id},
        )
        assert panel.status_code == 201
        panel_ids.append(panel.json()["panel_id"])

    return dashboard_id, panel_ids


def test_manual_refresh_and_overlap_conflict(client: TestClient, workspace_id: str) -> None:
    query_id = _create_saved_query(client, workspace_id, name="Manual refresh")
    dashboard_id, _ = _create_dashboard_with_panels(client, workspace_id, [query_id])

    run = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/run",
        json={"parameters": {}},
    )
    assert run.status_code == 202

    with get_connection(main_module.DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO dashboard_runs (
                run_id, dashboard_id, run_number, triggered_by, status, parameters_json,
                created_at, started_at, completed_at, total_duration_ms
            ) VALUES ('manual-running', ?, 999, 'manual', 'running', '{}', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', NULL, NULL)
            """,
            (dashboard_id,),
        )

    conflict = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/run",
        json={"parameters": {}},
    )
    assert conflict.status_code == 409


def test_run_history_and_detail_projection(client: TestClient, workspace_id: str) -> None:
    query_id = _create_saved_query(client, workspace_id, name="Run history")
    dashboard_id, panel_ids = _create_dashboard_with_panels(client, workspace_id, [query_id])

    run = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/run",
        json={"parameters": {}},
    )
    assert run.status_code == 202
    run_id = run.json()["run_id"]

    history = client.get(f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/runs")
    assert history.status_code == 200
    assert len(history.json()["runs"]) >= 1

    detail = client.get(f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/runs/{run_id}")
    assert detail.status_code == 200
    assert len(detail.json()["panels"]) == 1

    data = client.get(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/runs/{run_id}/panels/{panel_ids[0]}/data?limit=10&offset=0"
    )
    assert data.status_code == 200
    assert data.json()["panel_id"] == panel_ids[0]


def test_export_context_fidelity_endpoints(client: TestClient, workspace_id: str) -> None:
    query_id = _create_saved_query(client, workspace_id, name="Export panel")
    dashboard_id, panel_ids = _create_dashboard_with_panels(client, workspace_id, [query_id])

    run = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/run",
        json={"parameters": {}},
    )
    assert run.status_code == 202
    run_id = run.json()["run_id"]

    export_png = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/export",
        json={"format": "png"},
    )
    assert export_png.status_code == 200

    export_pdf = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/export",
        json={"format": "pdf"},
    )
    assert export_pdf.status_code == 200

    export_xlsx = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/runs/{run_id}/panels/{panel_ids[0]}/export",
        json={"format": "xlsx"},
    )
    assert export_xlsx.status_code == 200

    export_csv = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/runs/{run_id}/panels/{panel_ids[0]}/export",
        json={"format": "csv"},
    )
    assert export_csv.status_code == 200


def test_chart_override_persists_across_runs(client: TestClient, workspace_id: str) -> None:
    query_id = _create_saved_query(client, workspace_id, name="Override persistence")
    dashboard_id, panel_ids = _create_dashboard_with_panels(client, workspace_id, [query_id])
    panel_id = panel_ids[0]

    patch = client.patch(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/panels/{panel_id}",
        json={"chart_config_json": {"chartType": "line", "xAxis": "week", "yAxis": "revenue"}},
    )
    assert patch.status_code == 200

    first_run = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/run",
        json={"parameters": {}},
    )
    assert first_run.status_code == 202

    second_run = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/run",
        json={"parameters": {}},
    )
    assert second_run.status_code == 202

    detail = client.get(f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}")
    assert detail.status_code == 200
    panel = detail.json()["panels"][0]
    assert panel["panel_id"] == panel_id
    assert panel["chart_config_json"] == {"chartType": "line", "xAxis": "week", "yAxis": "revenue"}


def test_single_panel_validation_failure_isolated(client: TestClient, workspace_id: str) -> None:
    valid_query = _create_saved_query(client, workspace_id, name="Valid panel")
    invalid_query = _create_saved_query(
        client,
        workspace_id,
        name="Invalid panel",
        parameters=[{"name": "required_param", "parameterType": "numeric", "required": True}],
    )
    dashboard_id, _ = _create_dashboard_with_panels(client, workspace_id, [valid_query, invalid_query])

    run = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/run",
        json={"parameters": {}},
    )
    assert run.status_code == 202
    run_id = run.json()["run_id"]

    detail = client.get(f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/runs/{run_id}")
    assert detail.status_code == 200
    statuses = {panel["status"] for panel in detail.json()["panels"]}
    assert "completed" in statuses
    assert "failed" in statuses


def test_timeout_panel_isolated_with_healthy_panel(client: TestClient, workspace_id: str, monkeypatch: pytest.MonkeyPatch) -> None:
    original = main_module.PanelExecutorService.validate_declared_parameters

    call_count = {"value": 0}

    def flaky_validate(self, *, snapshot, provided):
        call_count["value"] += 1
        if call_count["value"] == 1:
            raise TimeoutError("simulated timeout")
        return original(self, snapshot=snapshot, provided=provided)

    monkeypatch.setattr(main_module.PanelExecutorService, "validate_declared_parameters", flaky_validate)

    query_a = _create_saved_query(client, workspace_id, name="Timeout candidate")
    query_b = _create_saved_query(client, workspace_id, name="Healthy candidate")
    dashboard_id, _ = _create_dashboard_with_panels(client, workspace_id, [query_a, query_b])

    run = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/run",
        json={"parameters": {}},
    )
    assert run.status_code == 202
    run_id = run.json()["run_id"]

    detail = client.get(f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/runs/{run_id}")
    assert detail.status_code == 200
    statuses = {panel["status"] for panel in detail.json()["panels"]}
    assert "timeout" in statuses
    assert "completed" in statuses


def test_block_export_when_panel_failed(client: TestClient, workspace_id: str) -> None:
    bad_query = _create_saved_query(
        client,
        workspace_id,
        name="Broken export",
        parameters=[{"name": "must_provide", "parameterType": "numeric", "required": True}],
    )
    dashboard_id, panel_ids = _create_dashboard_with_panels(client, workspace_id, [bad_query])

    run = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/run",
        json={"parameters": {}},
    )
    assert run.status_code == 202
    run_id = run.json()["run_id"]

    export = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/runs/{run_id}/panels/{panel_ids[0]}/export",
        json={"format": "csv"},
    )
    assert export.status_code == 400


def test_performance_budget_smoke_for_run_and_exports(client: TestClient, workspace_id: str) -> None:
    query_id = _create_saved_query(client, workspace_id, name="Perf smoke")
    dashboard_id, panel_ids = _create_dashboard_with_panels(client, workspace_id, [query_id])

    started = time.monotonic()
    run = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/run",
        json={"parameters": {}},
    )
    assert run.status_code == 202
    assert time.monotonic() - started < 3.0

    run_id = run.json()["run_id"]

    started = time.monotonic()
    panel_data = client.get(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/runs/{run_id}/panels/{panel_ids[0]}/data?limit=100&offset=0"
    )
    assert panel_data.status_code == 200
    assert time.monotonic() - started < 3.0

    started = time.monotonic()
    export_dashboard = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/export",
        json={"format": "png"},
    )
    assert export_dashboard.status_code == 200
    assert time.monotonic() - started < 5.0

    started = time.monotonic()
    export_panel = client.post(
        f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/runs/{run_id}/panels/{panel_ids[0]}/export",
        json={"format": "csv"},
    )
    assert export_panel.status_code == 200
    assert time.monotonic() - started < 10.0
