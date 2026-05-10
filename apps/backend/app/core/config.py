from __future__ import annotations

import os
from pathlib import Path
from dataclasses import dataclass

from app.utils.env_helper import METADATA_DB_PATH, read_path_env


def repo_root() -> Path:
    env_root = os.getenv("REPO_ROOT")
    if env_root:
        return Path(env_root).resolve()

    resolved = Path(__file__).resolve()

    # Prefer the first ancestor that looks like the repo root.
    for parent in resolved.parents:
        if (parent / "apps").exists() and (parent / "devops").exists():
            return parent

    # Container fallback for /app/app/core/config.py layout.
    if len(resolved.parents) >= 3 and (resolved.parents[2] / "app").exists():
        return resolved.parents[2]

    # Last resort: current working directory.
    return Path.cwd().resolve()


def data_dir() -> Path:
    root = repo_root() / "data"
    root.mkdir(parents=True, exist_ok=True)
    return root


def metadata_db_path() -> Path:
    return read_path_env(METADATA_DB_PATH, data_dir() / "metadata.db")


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
        from app.shared import CONFIG, Fields  # noqa: PLC0415

        return cls(
            app_env=CONFIG.get_str(Fields.APP_ENV, "development").lower(),
            backend_host=CONFIG.backend_host(),
            backend_port=CONFIG.backend_port(),
            backend_workers=CONFIG.get_int(Fields.BACKEND_WORKERS, 1),
            backend_log_level=CONFIG.get_str(Fields.BACKEND_LOG_LEVEL, "INFO").upper(),
            dashboard_api_base_url=CONFIG.get_str(Fields.DASHBOARD_API_BASE_URL, "http://localhost:8000"),
            backup_retention_days=CONFIG.get_int(Fields.BACKUP_RETENTION_DAYS, 30),
            backups_dir=Path(CONFIG.get_str(Fields.BACKUP_DIR, str(data_dir() / "backups"))),
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
        from app.shared import CONFIG, Fields  # noqa: PLC0415

        return self.app_env == "production" or _as_bool(
            CONFIG.get_str(Fields.DEPLOYMENT_STRICT_VALIDATION, "0")
        )
