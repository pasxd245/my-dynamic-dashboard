from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


def test_workspace_profile_contract_shape(tmp_path: Path) -> None:
    client = TestClient(app)

    workspace_id = client.post("/api/v1/workspaces", json={"name": "ws-profile"}).json()["id"]
    source = tmp_path / "profile.csv"
    source.write_text("agent_id,amount\nA1,10\nA2,20\n", encoding="utf-8")

    with source.open("rb") as file_handle:
        upload_response = client.post(
            f"/api/v1/workspaces/{workspace_id}/sources/upload",
            files={"file": ("profile.csv", file_handle, "text/csv")},
        )

    assert upload_response.status_code == 200

    profile_response = client.get(f"/api/v1/workspaces/{workspace_id}/profile")
    assert profile_response.status_code == 200

    payload = profile_response.json()
    assert "columns" in payload
    assert len(payload["columns"]) >= 1
    first = payload["columns"][0]
    assert set(first.keys()) == {
        "column_id",
        "column_name",
        "effective_type",
        "null_ratio",
        "distinct_count",
        "uniqueness_ratio",
        "warnings",
        "sampled",
        "sample_size",
        "sample_seed",
    }
