from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.metadata_db import get_connection, init_metadata_db
from app.main import app
import app.main as main_module
from app.schemas import (
    ActionableError,
    ActiveSourceContext,
    ActiveWorkspaceContext,
    BuilderSessionState,
    ConnectionStatus,
    DependencyStatus,
    WorkflowStage,
)


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
                "contract.csv",
                "csv",
                "hash",
                "utf-8",
                "2026-05-09T00:00:00.000Z",
            ),
        )


def test_builder_experience_contract_scaffold_exists() -> None:
    """Scaffold for spec 007 contract tests."""
    assert True


def test_preflight_schema_foundation_contract() -> None:
    payload = ConnectionStatus(
        status="ready",
        last_checked_at_utc="2026-05-09T00:00:00.000Z",
        summary="Builder dependencies are ready.",
        guidance="Continue to workflow actions.",
        dependencies=[DependencyStatus(name="metadata_db", status="ok")],
    )

    serialized = payload.model_dump()
    assert serialized["status"] == "ready"
    assert isinstance(serialized["dependencies"], list)
    assert serialized["dependencies"][0]["name"] == "metadata_db"


def test_session_state_schema_foundation_contract() -> None:
    payload = BuilderSessionState(
        connection_status=ConnectionStatus(
            status="degraded",
            last_checked_at_utc="2026-05-09T00:00:00.000Z",
            summary="One capability degraded.",
            guidance="Refresh or continue with non-blocked actions.",
            dependencies=[DependencyStatus(name="metadata_db", status="degraded")],
            degraded_capabilities=["results_saved"],
        ),
        active_workspace=ActiveWorkspaceContext(state="resolved", workspace_id="ws_1"),
        active_source=ActiveSourceContext(state="resolved", source_id="src_1", workspace_id="ws_1"),
        current_stage="query",
        stages=[
            WorkflowStage(
                stage_key="query",
                title="Query",
                order_index=3,
                status="in_progress",
                prerequisites=["active_context_resolved"],
            )
        ],
    )

    serialized = payload.model_dump()
    assert serialized["current_stage"] == "query"
    assert serialized["active_workspace"]["state"] == "resolved"
    assert serialized["active_source"]["workspace_id"] == "ws_1"


def test_actionable_error_schema_foundation_contract() -> None:
    payload = ActionableError(
        error_code="ACTIVE_CONTEXT_UNRESOLVED",
        stage="query",
        user_message="Select an active workspace and source before validating query.",
        next_steps=["Open context selector", "Select workspace", "Select source"],
        technical_details={"status": 409},
        correlation_id="corr-1",
        occurred_at_utc="2026-05-09T00:00:00.000Z",
    )

    serialized = payload.model_dump()
    assert serialized["error_code"] == "ACTIVE_CONTEXT_UNRESOLVED"
    assert serialized["stage"] == "query"
    assert len(serialized["next_steps"]) == 3


def test_put_active_context_success_contract(client: TestClient) -> None:
    workspace_id = _create_workspace(client, "us1-contract-ws")
    _seed_source(workspace_id, "src-contract-1")

    response = client.put(
        "/api/v1/workspaces/active-context",
        json={"workspace_id": workspace_id, "source_id": "src-contract-1"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["workspace"]["state"] == "resolved"
    assert body["workspace"]["workspace_id"] == workspace_id
    assert body["source"]["state"] == "resolved"
    assert body["source"]["source_id"] == "src-contract-1"


def test_put_active_context_unresolved_and_stale_errors(client: TestClient) -> None:
    workspace_id = _create_workspace(client, "us1-contract-ws-a")
    other_workspace_id = _create_workspace(client, "us1-contract-ws-b")
    _seed_source(other_workspace_id, "src-contract-other")

    unresolved_response = client.put(
        "/api/v1/workspaces/active-context",
        json={"workspace_id": workspace_id, "source_id": ""},
    )
    assert unresolved_response.status_code == 400
    assert unresolved_response.json()["error_code"] == "ACTIVE_CONTEXT_UNRESOLVED"

    stale_response = client.put(
        "/api/v1/workspaces/active-context",
        json={"workspace_id": workspace_id, "source_id": "src-contract-other"},
    )
    assert stale_response.status_code == 409
    assert stale_response.json()["error_code"] == "ACTIVE_CONTEXT_STALE"


def test_query_validate_and_saved_queries_guard_409_contract(client: TestClient) -> None:
    workspace_id = _create_workspace(client, "us1-guard-ws")
    _seed_source(workspace_id, "src-contract-guard")

    validate_response = client.post(
        "/api/v1/query/validate",
        json={
            "workspace_id": workspace_id,
            "source_id": "src-contract-guard",
            "query_config": {
                "base_table_id": "table_1",
                "selected_columns": [],
                "filters": [],
                "aggregations": [],
                "group_by_columns": [],
                "joins": [],
            },
        },
    )
    assert validate_response.status_code == 409
    assert validate_response.json()["error_code"] == "ACTIVE_CONTEXT_UNRESOLVED"

    saved_queries_response = client.get(
        f"/api/v1/saved-queries?workspace_id={workspace_id}&source_id=src-contract-guard"
    )
    assert saved_queries_response.status_code == 409
    assert saved_queries_response.json()["error_code"] == "ACTIVE_CONTEXT_UNRESOLVED"


def test_get_builder_preflight_status_taxonomy_contract(client: TestClient) -> None:
    response = client.get("/api/v1/builder/preflight")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] in {"ready", "degraded", "unavailable"}
    assert isinstance(body["last_checked_at_utc"], str)
    assert isinstance(body["summary"], str)
    assert isinstance(body["guidance"], str)
    assert isinstance(body["dependencies"], list)
    assert body["dependencies"], "dependencies payload must include at least one dependency"
    dependency = body["dependencies"][0]
    assert dependency["name"] == "metadata_db"
    assert dependency["status"] in {"ok", "degraded", "failed"}


def test_get_builder_session_state_contract_includes_connection_and_stage_prereqs(
    client: TestClient,
) -> None:
    response = client.get("/api/v1/builder/session-state")

    assert response.status_code == 200
    body = response.json()
    assert body["connection_status"]["status"] in {"ready", "degraded", "unavailable"}
    assert body["active_workspace"]["state"] in {"resolved", "unresolved", "stale"}
    assert body["active_source"]["state"] in {"resolved", "unresolved", "stale"}
    assert body["current_stage"] in {"upload_source", "schema_sheet", "query", "results_saved"}

    stages = body["stages"]
    assert isinstance(stages, list)
    assert len(stages) == 4
    assert [stage["stage_key"] for stage in stages] == [
        "upload_source",
        "schema_sheet",
        "query",
        "results_saved",
    ]

    query_stage = next(stage for stage in stages if stage["stage_key"] == "query")
    results_stage = next(stage for stage in stages if stage["stage_key"] == "results_saved")
    assert "active_context_resolved" in query_stage["prerequisites"]
    assert "query_validated" in results_stage["prerequisites"]


def test_builder_workflow_smoke_post_and_get_contract(client: TestClient) -> None:
    run_response = client.post("/api/v1/ops/smoke/builder-workflow", json={})
    assert run_response.status_code == 200

    run_body = run_response.json()
    assert isinstance(run_body["run_id"], str)
    assert run_body["status"] in {"passed", "failed"}
    assert isinstance(run_body["started_at_utc"], str)
    assert isinstance(run_body["completed_at_utc"], str)
    assert isinstance(run_body["stages"], list)
    assert len(run_body["stages"]) == 4

    first_stage = run_body["stages"][0]
    assert first_stage["stage"] == "create_workspace"
    assert first_stage["status"] in {"passed", "failed", "skipped"}
    assert isinstance(first_stage["message"], str)
    assert isinstance(first_stage["diagnostics"], dict)

    get_response = client.get(f"/api/v1/ops/smoke/builder-workflow/{run_body['run_id']}")
    assert get_response.status_code == 200
    get_body = get_response.json()
    assert get_body["run_id"] == run_body["run_id"]
    assert [stage["stage"] for stage in get_body["stages"]] == [
        "create_workspace",
        "upload_source",
        "validate_query",
        "list_saved_queries",
    ]
