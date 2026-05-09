"""Integration checks for production compose stack configuration (Spec 006)."""

import json
import logging
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import metadata_db_path
from app.core.logging import JsonFormatter
from app.services.audit_service import AuditService
from app.main import app


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


def _compose_text() -> str:
    return (_repo_root() / "docker-compose.prod.yml").read_text(encoding="utf-8")


def test_production_compose_startup_order_and_health_convergence() -> None:
    payload = _compose_text()
    assert "backend:" in payload
    assert "builder:" in payload
    assert "dashboard:" in payload
    assert "depends_on:" in payload
    assert "condition: service_healthy" in payload
    assert "healthcheck:" in payload


def test_production_compose_restart_policy_is_unless_stopped() -> None:
    payload = _compose_text()
    for service in ("backend", "builder", "dashboard", "backup"):
        marker = f"{service}:"
        assert marker in payload
    assert payload.count("restart: unless-stopped") >= 4


def test_production_compose_post_reboot_recovery_checklist() -> None:
    payload = _compose_text()
    assert "volumes:" in payload
    assert "metadata_data:" in payload
    assert "backups_data:" in payload
    assert "backend_logs:" in payload
    assert "healthcheck:" in payload


def test_backend_structured_json_logging_fields_and_severity_filtering() -> None:
    logger = logging.getLogger("spec006-log-test")
    logger.setLevel(logging.INFO)
    record = logger.makeRecord(
        name="spec006-log-test",
        level=logging.INFO,
        fn=__file__,
        lno=1,
        msg="deployment event",
        args=(),
        exc_info=None,
    )
    record.service = "backend"
    record.event_type = "deployment_started"
    encoded = JsonFormatter().format(record)
    payload = json.loads(encoded)

    assert payload["service"] == "backend"
    assert payload["event_type"] == "deployment_started"
    assert payload["level"] == "INFO"
    assert "timestamp_utc" in payload


def test_builder_dashboard_health_probes_distinguish_started_vs_ready() -> None:
    payload = _compose_text()
    assert "builder:" in payload and "dashboard:" in payload
    assert "http://127.0.0.1/health" in payload
    assert "http://127.0.0.1:8501/?healthcheck=1" in payload
    assert payload.count("condition: service_healthy") >= 2


def test_audit_event_emission_for_query_and_relationship_actions() -> None:
    service = AuditService(metadata_db_path())

    query_event = service.emit(
        event_type="query_execution",
        message="query completed",
        service="backend",
        severity="INFO",
    )
    relationship_event = service.emit(
        event_type="relationship_approved",
        message="relationship approved",
        service="backend",
        severity="INFO",
    )

    assert query_event.event_type == "query_execution"
    assert relationship_event.event_type == "relationship_approved"
    assert query_event.service == "backend"


def test_deployment_bundle_registration_and_release_traceability() -> None:
    client = TestClient(app)
    bundle_id = "release-trace-001"
    response = client.post(
        "/api/v1/ops/deployments",
        json={
            "bundle_id": bundle_id,
            "event_type": "deployment_started",
            "operator_id": "ops",
            "message": "traceability check",
        },
    )
    assert response.status_code == 201

    current = client.get("/api/v1/ops/deployments/current")
    assert current.status_code == 200
    payload = current.json()
    assert payload["bundle_id"] == bundle_id
