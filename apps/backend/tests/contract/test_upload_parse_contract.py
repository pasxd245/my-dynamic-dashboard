from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


def test_workspace_upload_contract_shape(tmp_path: Path) -> None:
    client = TestClient(app)

    workspace_response = client.post("/api/v1/workspaces", json={"name": "ws-us1"})
    workspace_id = workspace_response.json()["id"]

    sample = tmp_path / "sample.csv"
    sample.write_text("agent_id,amount\nA1,10\n", encoding="utf-8")

    with sample.open("rb") as file_handle:
        response = client.post(
            f"/api/v1/workspaces/{workspace_id}/sources/upload",
            files={"file": ("sample.csv", file_handle, "text/csv")},
        )

    assert response.status_code == 200
    payload = response.json()
    assert set(payload.keys()) == {"source_id", "warnings", "sheets"}
    assert isinstance(payload["warnings"], list)
    assert len(payload["sheets"]) == 1
    assert set(payload["sheets"][0].keys()) == {
        "id",
        "name",
        "header_row_effective",
        "data_range_effective",
    }
