"""Integration tests: Saved Query soft-delete and restore (US5)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
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
    r = client.post("/api/v1/workspaces", json={"name": "recovery-ws"})
    return r.json()["id"]


def _snap() -> dict:
    return {"base_table_id": "t1", "selected_columns": [], "filters": [], "aggregations": [], "group_by_columns": [], "joins": []}


def _create(client: TestClient, workspace_id: str, name: str) -> str:
    r = client.post(
        f"/api/v1/workspaces/{workspace_id}/saved-queries",
        json={"name": name, "builder_snapshot": _snap()},
    )
    assert r.status_code == 201
    return r.json()["query_id"]


# ── Soft-delete lifecycle ─────────────────────────────────────────────────────

def test_soft_delete_sets_deleted_at(client: TestClient, workspace_id: str) -> None:
    qid = _create(client, workspace_id, "SoftDelete")
    r = client.delete(f"/api/v1/workspaces/{workspace_id}/saved-queries/{qid}")
    assert r.status_code == 200
    body = r.json()
    assert body["is_deleted"] is True
    assert body["deleted_at"] is not None
    assert body["recoverable_until"] is not None
    assert body["expires_in_seconds"] > 0


def test_soft_delete_excludes_from_active(client: TestClient, workspace_id: str) -> None:
    qid = _create(client, workspace_id, "Gone")
    client.delete(f"/api/v1/workspaces/{workspace_id}/saved-queries/{qid}")
    r = client.get(f"/api/v1/workspaces/{workspace_id}/saved-queries")
    assert r.json()["total"] == 0


def test_soft_delete_event_recorded(client: TestClient, workspace_id: str) -> None:
    import sqlite3, app.main as m
    qid = _create(client, workspace_id, "EventCheck")
    client.delete(f"/api/v1/workspaces/{workspace_id}/saved-queries/{qid}")
    with sqlite3.connect(m.DB_PATH) as conn:
        evt = conn.execute(
            "SELECT event_type FROM saved_query_events WHERE query_id = ? AND event_type = 'deleted'",
            (qid,),
        ).fetchone()
    assert evt is not None


# ── Restore within grace window ───────────────────────────────────────────────

def test_restore_within_window(client: TestClient, workspace_id: str) -> None:
    qid = _create(client, workspace_id, "Restore Me")
    client.delete(f"/api/v1/workspaces/{workspace_id}/saved-queries/{qid}")

    r = client.post(f"/api/v1/workspaces/{workspace_id}/saved-queries/{qid}/restore")
    assert r.status_code == 200
    body = r.json()
    assert body["deleted_at"] is None
    assert body["recoverable_until"] is None


def test_restore_makes_active_again(client: TestClient, workspace_id: str) -> None:
    qid = _create(client, workspace_id, "RestoreActive")
    client.delete(f"/api/v1/workspaces/{workspace_id}/saved-queries/{qid}")
    client.post(f"/api/v1/workspaces/{workspace_id}/saved-queries/{qid}/restore")

    r = client.get(f"/api/v1/workspaces/{workspace_id}/saved-queries")
    assert r.json()["total"] == 1


# ── Restore rejection after expiry ────────────────────────────────────────────

def test_restore_after_expiry_returns_409(client: TestClient, workspace_id: str, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    import sqlite3
    import app.main as m

    qid = _create(client, workspace_id, "Expired")
    client.delete(f"/api/v1/workspaces/{workspace_id}/saved-queries/{qid}")

    # Manually backdate the recoverable_until to the past
    past_iso = (datetime.now(tz=timezone.utc) - timedelta(hours=25)).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    with sqlite3.connect(m.DB_PATH) as conn:
        conn.execute(
            "UPDATE saved_queries SET recoverable_until = ? WHERE query_id = ?",
            (past_iso, qid),
        )

    r = client.post(f"/api/v1/workspaces/{workspace_id}/saved-queries/{qid}/restore")
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "restore_window_expired"


# ── Execution history preserved after delete ─────────────────────────────────

def test_execution_history_preserved_after_delete(client: TestClient, workspace_id: str) -> None:
    import sqlite3, uuid
    import app.main as m

    qid = _create(client, workspace_id, "HistoryQ")
    now = datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

    # Insert a fake execution record directly
    with sqlite3.connect(m.DB_PATH) as conn:
        conn.execute(
            "INSERT INTO saved_query_executions (execution_id, query_id, version_id, executed_by, status, executed_at) VALUES (?, ?, NULL, NULL, 'completed', ?)",
            (str(uuid.uuid4()), qid, now),
        )

    client.delete(f"/api/v1/workspaces/{workspace_id}/saved-queries/{qid}")

    # Execution record should still exist
    with sqlite3.connect(m.DB_PATH) as conn:
        count = conn.execute(
            "SELECT COUNT(*) FROM saved_query_executions WHERE query_id = ?", (qid,)
        ).fetchone()[0]
    assert count == 1
