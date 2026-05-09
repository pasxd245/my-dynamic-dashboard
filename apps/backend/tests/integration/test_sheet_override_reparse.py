import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import metadata_db_path
from app.main import app


def test_sheet_override_updates_only_target_sheet(tmp_path: Path) -> None:
    client = TestClient(app)

    workspace_response = client.post("/api/v1/workspaces", json={"name": "ws-override"})
    workspace_id = workspace_response.json()["id"]

    source = tmp_path / "override.csv"
    source.write_text("id,value\n1,10\n", encoding="utf-8")

    with source.open("rb") as file_handle:
        upload_response = client.post(
            f"/api/v1/workspaces/{workspace_id}/sources/upload",
            files={"file": ("override.csv", file_handle, "text/csv")},
        )

    sheet_id = upload_response.json()["sheets"][0]["id"]

    override_response = client.patch(
        f"/api/v1/workspaces/{workspace_id}/sheets/{sheet_id}/override",
        json={"header_row": 2, "reason": "header moved"},
    )

    assert override_response.status_code == 200
    assert override_response.json()["header_row_effective"] == 2

    with sqlite3.connect(metadata_db_path()) as conn:
        count = conn.execute(
            "SELECT COUNT(*) FROM override_logs WHERE target_id = ?",
            (sheet_id,),
        ).fetchone()[0]

    assert count == 1
