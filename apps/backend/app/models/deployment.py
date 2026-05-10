from __future__ import annotations

from sqlmodel import Field, SQLModel


class DeploymentBundle(SQLModel, table=True):
    __tablename__ = "deployment_bundles"

    bundle_id: str = Field(primary_key=True)
    release_version: str
    backend_image: str
    builder_image: str
    dashboard_image: str
    compose_revision: str
    env_contract_version: str
    status: str
    created_at_utc: str
    created_by: str
    backup_set_reference: str | None = None


class BackupArtifact(SQLModel, table=True):
    __tablename__ = "backup_artifacts"

    backup_id: str = Field(primary_key=True)
    artifact_name: str
    artifact_path: str
    created_at_utc: str
    sqlite_integrity_ok: int
    checksum: str | None = None
    size_bytes: int | None = None
    status: str
    is_latest_valid: int = Field(default=0)
    retention_expires_at_utc: str | None = None


class DeploymentEvent(SQLModel, table=True):
    __tablename__ = "deployment_events"

    event_id: str = Field(primary_key=True)
    bundle_id: str = Field(foreign_key="deployment_bundles.bundle_id")
    event_type: str
    operator_id: str
    message: str | None = None
    service: str = Field(default="backend")
    severity: str = Field(default="INFO")
    created_at_utc: str


class RestoreRun(SQLModel, table=True):
    __tablename__ = "restore_runs"

    restore_run_id: str = Field(primary_key=True)
    backup_id: str = Field(foreign_key="backup_artifacts.backup_id")
    status: str
    validation_result: str | None = None
    started_at_utc: str
    finished_at_utc: str | None = None
    requested_by: str
    duration_seconds: int | None = None
    notes: str | None = None
