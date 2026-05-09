from __future__ import annotations

import os
from pathlib import Path
from dataclasses import dataclass


def repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


def data_dir() -> Path:
    root = repo_root() / "data"
    root.mkdir(parents=True, exist_ok=True)
    return root


def metadata_db_path() -> Path:
    return data_dir() / "metadata.db"


def parquet_root_dir() -> Path:
    root = data_dir() / "parquet"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _as_bool(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class DeploymentEnvironment:
    app_env: str
    backend_host: str
    backend_port: int
    backend_workers: int
    backend_log_level: str
    dashboard_api_base_url: str
    backup_retention_days: int
    backups_dir: Path

    @classmethod
    def from_env(cls) -> "DeploymentEnvironment":
        backend_port = int(os.getenv("BACKEND_PORT", "8000"))
        backend_workers = int(os.getenv("BACKEND_WORKERS", "1"))
        backup_retention_days = int(os.getenv("BACKUP_RETENTION_DAYS", "30"))
        return cls(
            app_env=os.getenv("APP_ENV", "development").strip().lower(),
            backend_host=os.getenv("BACKEND_HOST", "0.0.0.0").strip(),
            backend_port=backend_port,
            backend_workers=backend_workers,
            backend_log_level=os.getenv("BACKEND_LOG_LEVEL", "INFO").strip().upper(),
            dashboard_api_base_url=os.getenv("DASHBOARD_API_BASE_URL", "http://localhost:8000").strip(),
            backup_retention_days=backup_retention_days,
            backups_dir=Path(os.getenv("BACKUP_DIR", str(data_dir() / "backups"))),
        )

    def validate(self) -> list[str]:
        errors: list[str] = []
        if not self.backend_host:
            errors.append("BACKEND_HOST must be non-empty")
        if self.backend_port <= 0 or self.backend_port > 65535:
            errors.append("BACKEND_PORT must be in range 1..65535")
        if self.backend_workers <= 0:
            errors.append("BACKEND_WORKERS must be greater than 0")
        if self.backend_log_level not in {"DEBUG", "INFO", "WARN", "ERROR"}:
            errors.append("BACKEND_LOG_LEVEL must be one of DEBUG/INFO/WARN/ERROR")
        if not self.dashboard_api_base_url.startswith(("http://", "https://")):
            errors.append("DASHBOARD_API_BASE_URL must start with http:// or https://")
        if self.backup_retention_days <= 0:
            errors.append("BACKUP_RETENTION_DAYS must be greater than 0")
        return errors

    @property
    def strict_validation_enabled(self) -> bool:
        return self.app_env == "production" or _as_bool(os.getenv("DEPLOYMENT_STRICT_VALIDATION", "0"))
