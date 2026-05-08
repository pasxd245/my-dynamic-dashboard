from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


def test_profile_sampling_metadata_for_large_files(tmp_path: Path) -> None:
    client = TestClient(app)

    workspace_id = client.post("/api/v1/workspaces", json={"name": "ws-sample"}).json()["id"]
    source = tmp_path / "large.csv"

    rows = ["id,value"]
    for index in range(12050):
        rows.append(f"{index},{index % 7}")
    source.write_text("\n".join(rows), encoding="utf-8")

    with source.open("rb") as file_handle:
        client.post(
            f"/api/v1/workspaces/{workspace_id}/sources/upload",
            files={"file": ("large.csv", file_handle, "text/csv")},
        )

    profile_response = client.get(f"/api/v1/workspaces/{workspace_id}/profile")
    assert profile_response.status_code == 200

    first = profile_response.json()["columns"][0]
    assert first["sampled"] is True
    assert first["sample_size"] is not None
    assert first["sample_seed"] == 42
