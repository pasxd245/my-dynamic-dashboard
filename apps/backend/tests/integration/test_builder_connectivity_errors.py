from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.metadata_db import get_connection, init_metadata_db
from app.main import app
import app.main as main_module
from app.schemas import ConnectionStatus, DependencyStatus


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    db_path = tmp_path / "metadata.db"
    parquet_root = tmp_path / "parquet"
    monkeypatch.setattr(main_module, "DB_PATH", db_path)
    monkeypatch.setattr(main_module, "PARQUET_ROOT", parquet_root)
    main_module.BUILDER_SESSION_SERVICE.reset_active_context()
    main_module.PREFLIGHT_SERVICE = None
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


def _assert_actionable_envelope(payload: dict[str, object], stage: str) -> None:
    assert isinstance(payload.get("error_code"), str)
    assert payload.get("stage") == stage
    assert isinstance(payload.get("user_message"), str)
    assert isinstance(payload.get("next_steps"), list)
    assert payload["next_steps"]
    assert isinstance(payload.get("correlation_id"), str)
    assert isinstance(payload.get("occurred_at_utc"), str)


def test_preflight_unavailable_degraded_ready_transitions_and_refresh_recovery(
    client: TestClient,
) -> None:
    ready_response = client.get("/api/v1/builder/preflight")
    assert ready_response.status_code == 200
    assert ready_response.json()["status"] == "ready"

    class _DegradedPreflight:
        metadata_db_path = main_module.DB_PATH

        @staticmethod
        def evaluate() -> ConnectionStatus:
            return ConnectionStatus(
                status="degraded",
                last_checked_at_utc="2026-05-09T00:00:00.000Z",
                summary="Builder dependencies are degraded.",
                guidance="Continue with non-blocked actions and retry preflight.",
                dependencies=[
                    DependencyStatus(
                        name="metadata_db",
                        status="degraded",
                        detail=str(main_module.DB_PATH),
                    )
                ],
                degraded_capabilities=["results_saved"],
            )

    main_module.PREFLIGHT_SERVICE = _DegradedPreflight()
    degraded_response = client.get("/api/v1/builder/preflight")
    assert degraded_response.status_code == 200
    assert degraded_response.json()["status"] == "degraded"

    session_state_response = client.get("/api/v1/builder/session-state")
    assert session_state_response.status_code == 200
    assert session_state_response.json()["connection_status"]["status"] == "degraded"

    main_module.PREFLIGHT_SERVICE = None
    if main_module.DB_PATH.exists():
        main_module.DB_PATH.unlink()

    unavailable_response = client.get("/api/v1/builder/preflight")
    assert unavailable_response.status_code == 200
    assert unavailable_response.json()["status"] == "unavailable"

    init_metadata_db(main_module.DB_PATH)
    recovery_response = client.get("/api/v1/builder/preflight")
    assert recovery_response.status_code == 200
    assert recovery_response.json()["status"] == "ready"


def test_standardized_actionable_errors_for_upload_profile_query_and_saved_actions(
    client: TestClient,
) -> None:
    workspace_id = _create_workspace(client, "us2-connectivity-ws")
    _seed_source(workspace_id, "src-us2")

    upload_response = client.post(
        f"/api/v1/workspaces/{workspace_id}/sources/upload",
        files={"file": ("invalid.txt", b"not-a-supported-source", "text/plain")},
    )
    assert upload_response.status_code == 400
    _assert_actionable_envelope(upload_response.json(), "upload_source")

    profile_response = client.get("/api/v1/workspaces/workspace-missing/profile")
    assert profile_response.status_code == 404
    _assert_actionable_envelope(profile_response.json(), "schema_sheet")

    query_response = client.post(
        f"/api/v1/workspaces/{workspace_id}/queries/validate",
        json={
            "base_table_id": "table_1",
            "selected_columns": [],
            "filters": [],
            "aggregations": [],
            "group_by_columns": [],
            "joins": [],
        },
    )
    assert query_response.status_code == 409
    _assert_actionable_envelope(query_response.json(), "query")

    saved_response = client.get(f"/api/v1/workspaces/{workspace_id}/saved-queries")
    assert saved_response.status_code == 409
    _assert_actionable_envelope(saved_response.json(), "results_saved")
