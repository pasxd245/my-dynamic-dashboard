from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


def test_manifest_export_import_contract_shape(tmp_path: Path) -> None:
    client = TestClient(app)

    workspace_id = client.post("/api/v1/workspaces", json={"name": "ws-manifest"}).json()["id"]
    source = tmp_path / "manifest.csv"
    source.write_text("id,amount\n1,10\n2,20\n", encoding="utf-8")

    with source.open("rb") as file_handle:
        client.post(
            f"/api/v1/workspaces/{workspace_id}/sources/upload",
            files={"file": ("manifest.csv", file_handle, "text/csv")},
        )

    export_response = client.post(f"/api/v1/workspaces/{workspace_id}/manifest/export")
    assert export_response.status_code == 200

    export_payload = export_response.json()
    assert set(export_payload.keys()) == {
        "version",
        "workspace",
        "source_files",
        "sheets",
        "columns",
        "profiles",
        "roles",
        "overrides",
        "manifest_hash",
    }

    import_response = client.post(
        "/api/v1/workspaces/manifest/import",
        json={"manifest": export_payload},
    )
    assert import_response.status_code == 200
    assert set(import_response.json().keys()) == {
        "id",
        "name",
        "status",
        "manifest_version",
    }