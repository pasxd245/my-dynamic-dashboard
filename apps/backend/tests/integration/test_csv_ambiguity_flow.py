from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


def test_malformed_csv_returns_parse_error(tmp_path: Path) -> None:
    client = TestClient(app)

    workspace_response = client.post("/api/v1/workspaces", json={"name": "ws-csv"})
    workspace_id = workspace_response.json()["id"]

    malformed = tmp_path / "bad.csv"
    malformed.write_text('id,name\n1,"unterminated\n2,b', encoding="utf-8")

    with malformed.open("rb") as file_handle:
        response = client.post(
            f"/api/v1/workspaces/{workspace_id}/sources/upload",
            files={"file": ("bad.csv", file_handle, "text/csv")},
        )

    assert response.status_code == 400
    payload = response.json()
    # Spec 007 switched to ActionableError envelope (error_code at top level).
    error_code = payload.get("error_code", payload.get("error", {}).get("code", "")).lower()
    assert "parse" in error_code
