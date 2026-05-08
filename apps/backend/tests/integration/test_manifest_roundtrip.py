from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


def test_manifest_roundtrip_reexports_same_payload(tmp_path: Path) -> None:
    client = TestClient(app)

    workspace_id = client.post("/api/v1/workspaces", json={"name": "ws-roundtrip"}).json()["id"]
    source = tmp_path / "roundtrip.csv"
    source.write_text(
        "id,status,event_date\n"
        "1,won,2024-01-01\n"
        "2,lost,2024-01-02\n",
        encoding="utf-8",
    )

    with source.open("rb") as file_handle:
        upload_response = client.post(
            f"/api/v1/workspaces/{workspace_id}/sources/upload",
            files={"file": ("roundtrip.csv", file_handle, "text/csv")},
        )
    assert upload_response.status_code == 200

    sheet_id = upload_response.json()["sheets"][0]["id"]
    override_response = client.patch(
        f"/api/v1/workspaces/{workspace_id}/sheets/{sheet_id}/override",
        json={"header_row": 1, "reason": "confirm detected header"},
    )
    assert override_response.status_code == 200

    columns = client.get(f"/api/v1/workspaces/{workspace_id}/profile").json()["columns"]
    by_name = {column["column_name"]: column["column_id"] for column in columns}

    role_response = client.put(
        f"/api/v1/workspaces/{workspace_id}/columns/{by_name['status']}/roles",
        json={"roles": ["measure"], "override_reason": "business override"},
    )
    assert role_response.status_code == 200

    export_response = client.post(f"/api/v1/workspaces/{workspace_id}/manifest/export")
    assert export_response.status_code == 200
    original_manifest = export_response.json()

    import_response = client.post(
        "/api/v1/workspaces/manifest/import",
        json={"manifest": original_manifest},
    )
    assert import_response.status_code == 200
    imported_workspace_id = import_response.json()["id"]

    reexport_response = client.post(
        f"/api/v1/workspaces/{imported_workspace_id}/manifest/export"
    )
    assert reexport_response.status_code == 200
    assert reexport_response.json() == original_manifest