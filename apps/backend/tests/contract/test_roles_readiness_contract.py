from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


def test_roles_and_readiness_contract_shapes(tmp_path: Path) -> None:
    client = TestClient(app)

    workspace_id = client.post("/api/v1/workspaces", json={"name": "ws-roles"}).json()["id"]
    source = tmp_path / "roles.csv"
    source.write_text("id,event_date,amount,status\n1,2024-01-01,10,won\n", encoding="utf-8")

    with source.open("rb") as file_handle:
        client.post(
            f"/api/v1/workspaces/{workspace_id}/sources/upload",
            files={"file": ("roles.csv", file_handle, "text/csv")},
        )

    profile = client.get(f"/api/v1/workspaces/{workspace_id}/profile").json()
    column_id = profile["columns"][0]["column_id"]

    assign_response = client.put(
        f"/api/v1/workspaces/{workspace_id}/columns/{column_id}/roles",
        json={"roles": ["identity_key"]},
    )
    assert assign_response.status_code == 200
    assert "assignments" in assign_response.json()

    readiness_response = client.get(f"/api/v1/workspaces/{workspace_id}/readiness")
    assert readiness_response.status_code == 200
    readiness_payload = readiness_response.json()
    assert set(readiness_payload.keys()) == {
        "complete",
        "missing_required_roles",
        "unresolved_critical_warnings",
        "surface_role",
    }
