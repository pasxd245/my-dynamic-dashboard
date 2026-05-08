from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


def test_manifest_import_blocks_on_latest_source_hash_mismatch(tmp_path: Path) -> None:
    client = TestClient(app)

    workspace_id = client.post("/api/v1/workspaces", json={"name": "ws-export"}).json()["id"]
    source = tmp_path / "shared.csv"
    source.write_text("id,amount\n1,10\n", encoding="utf-8")

    with source.open("rb") as file_handle:
        client.post(
            f"/api/v1/workspaces/{workspace_id}/sources/upload",
            files={"file": ("shared.csv", file_handle, "text/csv")},
        )

    manifest = client.post(
        f"/api/v1/workspaces/{workspace_id}/manifest/export"
    ).json()

    mismatch_workspace_id = client.post(
        "/api/v1/workspaces", json={"name": "ws-mismatch"}
    ).json()["id"]
    source.write_text("id,amount\n1,999\n", encoding="utf-8")

    with source.open("rb") as file_handle:
        client.post(
            f"/api/v1/workspaces/{mismatch_workspace_id}/sources/upload",
            files={"file": ("shared.csv", file_handle, "text/csv")},
        )

    import_response = client.post(
        "/api/v1/workspaces/manifest/import",
        json={"manifest": manifest},
    )
    assert import_response.status_code == 409

    payload = import_response.json()
    assert payload["error"]["code"] == "manifest_hash_mismatch"
    mismatch = payload["error"]["details"]["mismatches"][0]
    assert mismatch["filename_original"] == "shared.csv"
    assert mismatch["expected_hash"] != mismatch["actual_hash"]