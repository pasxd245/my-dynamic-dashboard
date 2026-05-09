from __future__ import annotations

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
    main_module.BUILDER_SESSION_SERVICE.reset_active_context()
    init_metadata_db(db_path)
    return TestClient(app)


def _create_workspace(client: TestClient, name: str) -> str:
    response = client.post("/api/v1/workspaces", json={"name": name})
    assert response.status_code == 200
    return response.json()["id"]


def _seed_source(workspace_id: str, source_id: str) -> None:
    with get_connection(main_module.DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO source_files (
                id, workspace_id, filename_original, extension, content_hash,
                encoding_detected, parse_status, reject_reason, uploaded_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'parsed', NULL, ?)
            """,
            (
                source_id,
                workspace_id,
                "integration.csv",
                "csv",
                "hash",
                "utf-8",
                "2026-05-09T00:00:00.000Z",
            ),
        )


def _minimal_query_config() -> dict[str, object]:
    return {
        "base_table_id": "table_1",
        "selected_columns": [
            {
                "table_id": "table_1",
                "column_name": "id",
                "alias": "id",
            }
        ],
        "filters": [],
        "aggregations": [],
        "group_by_columns": [],
        "joins": [],
    }


def test_explicit_context_required_before_query_and_saved_queries(client: TestClient) -> None:
    workspace_id = _create_workspace(client, "us1-integration-ws")
    _seed_source(workspace_id, "src-us1")

    blocked_validate = client.post(
        f"/api/v1/workspaces/{workspace_id}/queries/validate",
        json=_minimal_query_config(),
    )
    assert blocked_validate.status_code == 409

    blocked_saved = client.get(f"/api/v1/workspaces/{workspace_id}/saved-queries")
    assert blocked_saved.status_code == 409

    set_context = client.put(
        "/api/v1/workspaces/active-context",
        json={"workspace_id": workspace_id, "source_id": "src-us1"},
    )
    assert set_context.status_code == 200

    allowed_validate = client.post(
        f"/api/v1/workspaces/{workspace_id}/queries/validate",
        json=_minimal_query_config(),
    )
    assert allowed_validate.status_code == 200

    allowed_saved = client.get(f"/api/v1/workspaces/{workspace_id}/saved-queries")
    assert allowed_saved.status_code == 200


def test_stale_context_detection_and_reselection_recovery(client: TestClient) -> None:
    workspace_a = _create_workspace(client, "us1-stale-a")
    workspace_b = _create_workspace(client, "us1-stale-b")
    _seed_source(workspace_a, "src-a")
    _seed_source(workspace_b, "src-b")

    initial_set = client.put(
        "/api/v1/workspaces/active-context",
        json={"workspace_id": workspace_a, "source_id": "src-a"},
    )
    assert initial_set.status_code == 200

    workspace_a_validate = client.post(
        f"/api/v1/workspaces/{workspace_a}/queries/validate",
        json=_minimal_query_config(),
    )
    assert workspace_a_validate.status_code == 200

    stale_validate = client.post(
        f"/api/v1/workspaces/{workspace_b}/queries/validate",
        json=_minimal_query_config(),
    )
    assert stale_validate.status_code == 409

    reselection = client.put(
        "/api/v1/workspaces/active-context",
        json={"workspace_id": workspace_b, "source_id": "src-b"},
    )
    assert reselection.status_code == 200

    recovered_validate = client.post(
        f"/api/v1/workspaces/{workspace_b}/queries/validate",
        json=_minimal_query_config(),
    )
    assert recovered_validate.status_code == 200


def test_shell_stage_ordering_and_prerequisite_unlock_transitions(client: TestClient) -> None:
    workspace_id = _create_workspace(client, "us3-stage-ws")
    _seed_source(workspace_id, "src-us3")

    initial_state = client.get("/api/v1/builder/session-state")
    assert initial_state.status_code == 200
    initial_body = initial_state.json()
    assert [stage["stage_key"] for stage in initial_body["stages"]] == [
        "upload_source",
        "schema_sheet",
        "query",
        "results_saved",
    ]
    assert initial_body["current_stage"] == "upload_source"

    initial_stages = {stage["stage_key"]: stage for stage in initial_body["stages"]}
    assert initial_stages["upload_source"]["status"] == "in_progress"
    assert initial_stages["schema_sheet"]["status"] == "locked"
    assert initial_stages["schema_sheet"]["missing_prerequisites"] == ["upload_complete"]
    assert initial_stages["query"]["status"] == "locked"
    assert initial_stages["query"]["missing_prerequisites"] == ["active_context_resolved"]
    assert initial_stages["results_saved"]["status"] == "locked"
    assert initial_stages["results_saved"]["missing_prerequisites"] == ["query_validated"]

    set_context = client.put(
        "/api/v1/workspaces/active-context",
        json={"workspace_id": workspace_id, "source_id": "src-us3"},
    )
    assert set_context.status_code == 200

    context_state = client.get("/api/v1/builder/session-state")
    assert context_state.status_code == 200
    context_body = context_state.json()
    assert context_body["current_stage"] == "schema_sheet"

    context_stages = {stage["stage_key"]: stage for stage in context_body["stages"]}
    assert context_stages["upload_source"]["status"] == "completed"
    assert context_stages["schema_sheet"]["status"] == "in_progress"
    assert context_stages["schema_sheet"]["missing_prerequisites"] == []
    assert context_stages["query"]["status"] == "ready"
    assert context_stages["query"]["missing_prerequisites"] == []
    assert context_stages["results_saved"]["status"] == "locked"

    validate_response = client.post(
        f"/api/v1/workspaces/{workspace_id}/queries/validate",
        json=_minimal_query_config(),
    )
    assert validate_response.status_code == 200

    validated_state = client.get("/api/v1/builder/session-state")
    assert validated_state.status_code == 200
    validated_body = validated_state.json()
    assert validated_body["current_stage"] == "results_saved"

    validated_stages = {stage["stage_key"]: stage for stage in validated_body["stages"]}
    assert validated_stages["query"]["status"] == "completed"
    assert validated_stages["results_saved"]["status"] == "in_progress"
    assert validated_stages["results_saved"]["missing_prerequisites"] == []
