from fastapi.testclient import TestClient

from app.main import app


def test_create_workspace_contract_shape() -> None:
    client = TestClient(app)

    response = client.post("/api/v1/workspaces", json={"name": "demo"})

    assert response.status_code == 200
    payload = response.json()
    assert set(payload.keys()) == {"id", "name", "status", "manifest_version"}
    assert payload["name"] == "demo"
    assert payload["status"] == "draft"
    assert payload["manifest_version"] == 1
