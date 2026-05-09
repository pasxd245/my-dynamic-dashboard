"""Contract tests for Spec 006 production deployment API surface."""

from fastapi.testclient import TestClient

from app.main import app


def test_get_health_returns_readiness_liveness_shape() -> None:
    client = TestClient(app)

    response = client.get("/health")
    assert response.status_code in (200, 503)

    payload = response.json()
    assert payload["service"] == "backend"
    assert isinstance(payload["version"], str)
    assert payload["status"] in {"healthy", "degraded", "not_ready"}
    assert "timestamp_utc" in payload
    assert isinstance(payload["dependencies"], list)

    if payload["dependencies"]:
        dependency = payload["dependencies"][0]
        assert {"name", "status"}.issubset(dependency.keys())


def test_get_current_deployment_contract() -> None:
    client = TestClient(app)
    response = client.get("/api/v1/ops/deployments/current")
    assert response.status_code in (200, 404)


def test_record_deployment_event_contract() -> None:
    client = TestClient(app)
    response = client.post(
        "/api/v1/ops/deployments",
        json={
            "bundle_id": "bundle-001",
            "event_type": "deployment_started",
            "operator_id": "ops-user",
            "message": "deploy started",
        },
    )
    assert response.status_code == 201
    payload = response.json()
    assert {"event_id", "event_type", "service", "severity", "timestamp_utc"}.issubset(payload.keys())


def test_backup_ops_contract_surface() -> None:
    client = TestClient(app)

    list_response = client.get("/api/v1/ops/backups")
    run_response = client.post("/api/v1/ops/backups/run")

    assert list_response.status_code == 200
    assert isinstance(list_response.json(), list)
    assert run_response.status_code == 202
    run_payload = run_response.json()
    assert {"run_id", "status", "requested_at_utc"}.issubset(run_payload.keys())


def test_restore_ops_contract_surface() -> None:
    client = TestClient(app)
    backup_id = client.post("/api/v1/ops/backups/run").json()["run_id"]
    restore_response = client.post(
        "/api/v1/ops/restore",
        json={"backup_id": backup_id, "operator_id": "ops-user"},
    )

    assert restore_response.status_code == 202
    payload = restore_response.json()
    assert {"restore_run_id", "backup_id", "status", "started_at_utc"}.issubset(payload.keys())
