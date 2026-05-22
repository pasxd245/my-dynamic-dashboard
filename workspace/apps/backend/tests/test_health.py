import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.mark.unit
def test_health_ok() -> None:
    client = TestClient(app)
    resp = client.get("/health")

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert isinstance(body["duckdb"], str)
    assert body["duckdb"]
