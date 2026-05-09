import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import metadata_db_path
from app.main import app


def test_time_anchor_hard_reject_and_measure_soft_override(tmp_path: Path) -> None:
    client = TestClient(app)

    workspace_id = client.post("/api/v1/workspaces", json={"name": "ws-compat"}).json()["id"]
    source = tmp_path / "compat.csv"
    source.write_text("name,value\nA1,10\nA2,20\n", encoding="utf-8")

    with source.open("rb") as file_handle:
        client.post(
            f"/api/v1/workspaces/{workspace_id}/sources/upload",
            files={"file": ("compat.csv", file_handle, "text/csv")},
        )

    columns = client.get(f"/api/v1/workspaces/{workspace_id}/profile").json()["columns"]
    name_column_id = next(column["column_id"] for column in columns if column["column_name"] == "name")

    hard_fail = client.put(
        f"/api/v1/workspaces/{workspace_id}/columns/{name_column_id}/roles",
        json={"roles": ["time_anchor"]},
    )
    assert hard_fail.status_code == 422

    soft_fail = client.put(
        f"/api/v1/workspaces/{workspace_id}/columns/{name_column_id}/roles",
        json={"roles": ["measure"]},
    )
    assert soft_fail.status_code == 422

    soft_ok = client.put(
        f"/api/v1/workspaces/{workspace_id}/columns/{name_column_id}/roles",
        json={"roles": ["measure"], "override_reason": "business exception"},
    )
    assert soft_ok.status_code == 200
    assert soft_ok.json()["assignments"][0]["override_used"] is True

    with sqlite3.connect(metadata_db_path()) as conn:
        role_row = conn.execute(
            """
            SELECT role, override_used, override_reason
            FROM role_assignments
            WHERE column_id = ?
            ORDER BY assigned_at DESC
            LIMIT 1
            """,
            (name_column_id,),
        ).fetchone()
        override_row = conn.execute(
            """
            SELECT target_kind, target_id, reason
            FROM override_logs
            WHERE workspace_id = ? AND target_id = ?
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (workspace_id, name_column_id),
        ).fetchone()

    assert role_row == ("measure", 1, "business exception")
    assert override_row == ("role_assignment", name_column_id, "business exception")
