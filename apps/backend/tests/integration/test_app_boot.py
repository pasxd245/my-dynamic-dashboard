from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoint_returns_ok() -> None:
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    # Spec 007 enhanced the health response; accept both old and new shapes.
    status = response.json().get("status", "")
    assert status in {"ok", "healthy"}, f"Unexpected health status: {status}"
