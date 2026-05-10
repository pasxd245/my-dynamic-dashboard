from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml


DEFAULT_CONFIG_PATH = Path(__file__).resolve().parent / "resources" / "default.yaml"

# Env-var name for an optional operator-supplied override file.
_CONFIG_FILE_ENV = "CONFIG_FILE"

# Mapping from field name → env-var override name.
_ENV_OVERRIDES: dict[str, str] = {
    "metadata_db_path": "METADATA_DB_PATH",
    "parquet_root_dir": "PARQUET_ROOT_DIR",
    "app_env": "APP_ENV",
    "backend_host": "BACKEND_HOST",
    "backend_port": "BACKEND_PORT",
    "backend_workers": "BACKEND_WORKERS",
    "backend_log_level": "BACKEND_LOG_LEVEL",
    "dashboard_api_base_url": "DASHBOARD_API_BASE_URL",
    "backup_retention_days": "BACKUP_RETENTION_DAYS",
    "backup_dir": "BACKUP_DIR",
    "deployment_strict_validation": "DEPLOYMENT_STRICT_VALIDATION",
}


class Const:
    APP_NAME = "my-dynamic-dashboard-backend"


class Fields:
    METADATA_DB_PATH = "metadata_db_path"
    PARQUET_ROOT_DIR = "parquet_root_dir"
    APP_ENV = "app_env"
    BACKEND_HOST = "backend_host"
    BACKEND_PORT = "backend_port"
    BACKEND_WORKERS = "backend_workers"
    BACKEND_LOG_LEVEL = "backend_log_level"
    DASHBOARD_API_BASE_URL = "dashboard_api_base_url"
    BACKUP_RETENTION_DAYS = "backup_retention_days"
    BACKUP_DIR = "backup_dir"
    DEPLOYMENT_STRICT_VALIDATION = "deployment_strict_validation"


@dataclass(frozen=True)
class AppConfig:
    """Resolved configuration values after layered precedence application.

    Precedence (low → high): packaged default.yaml < CONFIG_FILE yaml < env vars.
    """

    values: dict[str, Any] = field(default_factory=dict)

    def get(self, key: str, default: Any = None) -> Any:
        return self.values.get(key, default)

    def get_path(self, key: str, default: Path | None = None) -> Path | None:
        raw = self.values.get(key)
        if raw is None:
            return default
        return Path(str(raw))

    def get_int(self, key: str, default: int = 0) -> int:
        raw = self.values.get(key)
        if raw is None:
            return default
        try:
            return int(raw)
        except (ValueError, TypeError):
            return default

    def get_str(self, key: str, default: str = "") -> str:
        raw = self.values.get(key)
        if raw is None:
            return default
        return str(raw).strip()

    def backend_host(self) -> str:
        return self.get_str(Fields.BACKEND_HOST, "127.0.0.1")

    def backend_port(self) -> int:
        return self.get_int(Fields.BACKEND_PORT, 8000)

    def metadata_db_path(self) -> Path | None:
        return self.get_path(Fields.METADATA_DB_PATH)

    def parquet_root_dir(self) -> Path | None:
        return self.get_path(Fields.PARQUET_ROOT_DIR)


def _load_yaml(path: Path) -> dict[str, Any]:
    """Load a YAML file and return its top-level mapping, or {} on error."""
    try:
        with path.open("r", encoding="utf-8") as fh:
            data = yaml.safe_load(fh)
        return data if isinstance(data, dict) else {}
    except FileNotFoundError:
        return {}


def load_config(*, config_path: Path | None = None) -> AppConfig:
    """Build AppConfig using layered precedence.

    Layers (low → high):
      1. Packaged ``resources/default.yaml``
      2. Operator ``CONFIG_FILE`` yaml (if env var is set)
      3. Individual environment variable overrides
    """
    # Layer 1: packaged defaults
    values: dict[str, Any] = _load_yaml(DEFAULT_CONFIG_PATH)

    # Layer 2: operator config file
    if config_path is None:
        raw_cf = os.getenv(_CONFIG_FILE_ENV, "").strip()
        if raw_cf:
            config_path = Path(raw_cf)
    if config_path is not None:
        values.update(_load_yaml(config_path))

    # Layer 3: environment variable overrides
    for field_name, env_name in _ENV_OVERRIDES.items():
        raw = os.getenv(env_name, "").strip()
        if raw:
            values[field_name] = raw

    return AppConfig(values=values)


# ---------------------------------------------------------------------------
# Bootstrap singletons (T017: centralized shared runtime bootstrap concerns)
# Imported by main.py and other modules that need the shared resolved paths.
# ---------------------------------------------------------------------------

def _resolve_bootstrap_paths(cfg: AppConfig) -> tuple[Path, Path]:
    """Resolve DB_PATH and PARQUET_ROOT from AppConfig + repo-root context."""
    # Lazy imports avoid circular dependencies at module load time.
    from app.core.config import metadata_db_path, parquet_root_dir, repo_root  # noqa: PLC0415

    project_root = repo_root()
    db_path = cfg.get_path(Fields.METADATA_DB_PATH)
    parquet_root = cfg.get_path(Fields.PARQUET_ROOT_DIR)

    if db_path is None:
        db_path = metadata_db_path()
    elif not db_path.is_absolute():
        db_path = (project_root / db_path).resolve()

    if parquet_root is None:
        parquet_root = parquet_root_dir()
    elif not parquet_root.is_absolute():
        parquet_root = (project_root / parquet_root).resolve()

    parquet_root.mkdir(parents=True, exist_ok=True)
    return db_path, parquet_root


# Module-level config singleton resolved at import time.
CONFIG: AppConfig = load_config()

_db_path, _parquet_root = _resolve_bootstrap_paths(CONFIG)

DB_PATH: Path = _db_path
PARQUET_ROOT: Path = _parquet_root


def current_db_path() -> Path:
    from app import main as main_module  # noqa: PLC0415

    return getattr(main_module, "DB_PATH", DB_PATH)


def current_parquet_root() -> Path:
    from app import main as main_module  # noqa: PLC0415

    return getattr(main_module, "PARQUET_ROOT", PARQUET_ROOT)

APP_LOGGER: logging.Logger = logging.getLogger(Const.APP_NAME)
