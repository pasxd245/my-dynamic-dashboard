from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.api import raise_bad_request, raise_not_found
from app.apps.deployment_app import DEPLOYMENT_APP
from app.core.logging import correlation_id_ctx
from app.schemas import AuditEvent, DeploymentBundleDto, DeploymentEventRequest, HealthDependency, HealthSnapshot
from app.services.audit_service import AuditService
from app.services.backup_service import BackupService
from app.services.deployment_service import DeploymentService
from app.shared import current_db_path

router = APIRouter(tags=["deployment"])


def _deployment_service() -> DeploymentService:
    return DEPLOYMENT_APP.deployment_service()


def _backup_service() -> BackupService:
    return DEPLOYMENT_APP.backup_service()


def _audit_service() -> AuditService:
    return DEPLOYMENT_APP.audit_service()


@router.get("/health")
def health() -> JSONResponse:
    db_path = current_db_path()
    metadata_ready = db_path.exists()
    dependency = HealthDependency(
        name="metadata_db",
        status="ok" if metadata_ready else "failed",
        detail=str(db_path),
    )
    snapshot = HealthSnapshot(
        service="backend",
        version="dev",
        status="healthy" if metadata_ready else "not_ready",
        timestamp_utc=datetime.now(timezone.utc).isoformat(),
        dependencies=[dependency],
    )
    status_code = 200 if metadata_ready else 503
    return JSONResponse(status_code=status_code, content=snapshot.model_dump())


@router.get("/api/health")
def api_health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/api/v1/config")
def runtime_config() -> dict[str, str]:
    """Expose lightweight runtime config consumed by the builder shell."""
    return {
        "apiBaseUrl": "/api/v1",
        "logLevel": "info",
        "i18nLocale": "en-US",
    }


@router.get("/api/v1/ops/deployments/current")
def get_current_deployment() -> DeploymentBundleDto:
    deployment = _deployment_service().get_current_deployment()
    if deployment is None:
        raise_not_found("No deployment bundle recorded", code="deployment_not_found")
    return deployment


@router.post("/api/v1/ops/deployments", status_code=201)
def record_deployment_event(request: DeploymentEventRequest) -> AuditEvent:
    _deployment_service().record_deployment_event(
        bundle_id=request.bundle_id,
        event_type=request.event_type,
        operator_id=request.operator_id,
        message=request.message,
    )
    return _audit_service().emit(
        event_type=request.event_type,
        message=request.message or "deployment event recorded",
        service="backend",
        severity="INFO",
        correlation_id=correlation_id_ctx.get(),
        bundle_id=request.bundle_id,
        operator_id=request.operator_id,
    )


@router.get("/api/v1/ops/backups")
def list_backups(limit: int = 30):
    return _backup_service().list_backups(limit=limit)


@router.post("/api/v1/ops/backups/run", status_code=202)
def run_backup() -> dict[str, str]:
    return _backup_service().run_backup()


@router.post("/api/v1/ops/restore", status_code=202)
def run_restore(payload: dict[str, str]):
    backup_id = str(payload.get("backup_id", "")).strip()
    operator_id = str(payload.get("operator_id", "system")).strip() or "system"
    if not backup_id:
        raise_bad_request("backup_id is required", code="backup_id_required")
    try:
        return _backup_service().run_restore(backup_id=backup_id, operator_id=operator_id)
    except ValueError as exc:
        message = str(exc)
        if message == "backup_not_found":
            raise_not_found("Backup artifact not found", code="backup_not_found")
        if message == "backup_invalid":
            raise_bad_request("Backup artifact failed integrity checks", code="backup_invalid")
        raise_bad_request("Restore request is invalid", code="restore_invalid")
