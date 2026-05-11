from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


def test_upload_flow_contract_scaffold(tmp_path: Path) -> None:
    """Scaffold contract: upload endpoint remains reachable for builder flow evolution."""

    client = TestClient(app)
    workspace_response = client.post("/api/v1/workspaces", json={"name": "ws-upload-flow-contract"})
    workspace_id = workspace_response.json()["id"]

    sample = tmp_path / "sample.csv"
    sample.write_text("a,b\n1,2\n", encoding="utf-8")

    with sample.open("rb") as file_handle:
        response = client.post(
            f"/api/v1/workspaces/{workspace_id}/sources/upload",
            files={"file": ("sample.csv", file_handle, "text/csv")},
        )

    assert response.status_code == 200
    payload = response.json()
    assert "source_id" in payload


def test_upload_contract_accepts_matching_source_type(tmp_path: Path) -> None:
    client = TestClient(app)

    workspace_response = client.post("/api/v1/workspaces", json={"name": "ws-upload-source-match"})
    workspace_id = workspace_response.json()["id"]

    sample = tmp_path / "sample.csv"
    sample.write_text("a,b\n1,2\n", encoding="utf-8")

    with sample.open("rb") as file_handle:
        response = client.post(
            f"/api/v1/workspaces/{workspace_id}/sources/upload",
            files={"file": ("sample.csv", file_handle, "text/csv")},
            data={"source_type": "csv"},
        )

    assert response.status_code == 200


def test_upload_contract_rejects_mismatched_source_type(tmp_path: Path) -> None:
    client = TestClient(app)

    workspace_response = client.post("/api/v1/workspaces", json={"name": "ws-upload-source-mismatch"})
    workspace_id = workspace_response.json()["id"]

    sample = tmp_path / "sample.csv"
    sample.write_text("a,b\n1,2\n", encoding="utf-8")

    with sample.open("rb") as file_handle:
        response = client.post(
            f"/api/v1/workspaces/{workspace_id}/sources/upload",
            files={"file": ("sample.csv", file_handle, "text/csv")},
            data={"source_type": "excel"},
        )

    assert response.status_code == 400
    body = response.json()
    error_code = body.get("error_code", body.get("error", {}).get("code", "")).lower()
    assert error_code == "source_type_mismatch"
