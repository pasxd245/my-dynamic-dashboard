from fastapi.testclient import TestClient

from app.main import app


def test_query_builder_contract_scaffold_loads() -> None:
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
