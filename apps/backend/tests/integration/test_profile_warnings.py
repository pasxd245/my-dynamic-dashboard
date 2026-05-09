from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


def test_profile_warnings_include_mixed_and_sentinel(tmp_path: Path) -> None:
    client = TestClient(app)

    workspace_id = client.post("/api/v1/workspaces", json={"name": "ws-warn"}).json()["id"]
    source = tmp_path / "warnings.csv"
    source.write_text("value\n123\nN/A\nabc\n", encoding="utf-8")

    with source.open("rb") as file_handle:
        client.post(
            f"/api/v1/workspaces/{workspace_id}/sources/upload",
            files={"file": ("warnings.csv", file_handle, "text/csv")},
        )

    profile_response = client.get(f"/api/v1/workspaces/{workspace_id}/profile")
    assert profile_response.status_code == 200

    warnings = profile_response.json()["columns"][0]["warnings"]
    assert "mixed_type_values" in warnings
    assert "sentinel_values_detected" in warnings
