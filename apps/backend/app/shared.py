from __future__ import annotations

import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

from recursivenamespace import RecursiveNamespace, rns
import yaml

DEFAULT_CONFIG_PATH = Path(__file__).resolve().parent / "resources" / "default.yaml"

# Env-var name for an optional operator-supplied override file.
_CONFIG_FILE_ENV = "CONFIG_FILE"

# Mapping from dotted config key → env-var override name.
_ENV_OVERRIDES: dict[str, str] = {
    "metadata.db_path": "METADATA_DB_PATH",
    "parquet.root_dir": "PARQUET_ROOT_DIR",
    "app.env": "APP_ENV",
    "backend.host": "BACKEND_HOST",
    "backend.port": "BACKEND_PORT",
    "backend.workers": "BACKEND_WORKERS",
    "backend.log_level": "BACKEND_LOG_LEVEL",
    "dashboard.api_base_url": "DASHBOARD_API_BASE_URL",
    "backup.retention_days": "BACKUP_RETENTION_DAYS",
    "backup.dir": "BACKUP_DIR",
    "deployment.strict_validation": "DEPLOYMENT_STRICT_VALIDATION",
}


class Const:
    APP_NAME = "my-dynamic-dashboard-backend"


class Fields:
    METADATA_DB_PATH = "metadata.db_path"
    PARQUET_ROOT_DIR = "parquet.root_dir"
    APP_ENV = "app.env"
    BACKEND_HOST = "backend.host"
    BACKEND_PORT = "backend.port"
    BACKEND_WORKERS = "backend.workers"
    BACKEND_LOG_LEVEL = "backend.log_level"
    DASHBOARD_API_BASE_URL = "dashboard.api_base_url"
    BACKUP_RETENTION_DAYS = "backup.retention_days"
    BACKUP_DIR = "backup.dir"
    DEPLOYMENT_STRICT_VALIDATION = "deployment.strict_validation"


class AppConfig:
    """Resolved configuration values after layered precedence application."""

    def __init__(self, config_path: Path | None = None):
        self.cfg: RecursiveNamespace = self._load_namespace(config_path)

    @staticmethod
    def _load_namespace(config_path: Path | None = None) -> RecursiveNamespace:
        return load_config(_resolve_config_path(config_path))

    def get(self, key: str, default: Any = None, show_log: bool = False) -> Any:
        return self.cfg.get_or_else(key, or_else=default, show_log=show_log)

    def get_path(self, key: str, default: Path | None = None) -> Path | None:
        raw = self.get(key)
        if raw is None:
            return default
        return Path(str(raw))

    def get_int(self, key: str, default: int = 0) -> int:
        raw = self.get(key)
        if raw is None:
            return default
        try:
            return int(raw)
        except (ValueError, TypeError):
            return default

    def get_str(self, key: str, default: str = "") -> str:
        raw = self.get(key)
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


def _deep_merge(target: dict[str, Any], source: dict[str, Any]) -> dict[str, Any]:
    for key, value in source.items():
        if isinstance(value, dict) and isinstance(target.get(key), dict):
            _deep_merge(target[key], value)
            continue
        target[key] = value
    return target


def _set_dotted_value(target: dict[str, Any], dotted_key: str, value: Any) -> None:
    current = target
    parts = dotted_key.split(".")
    for part in parts[:-1]:
        existing = current.get(part)
        if not isinstance(existing, dict):
            existing = {}
            current[part] = existing
        current = existing
    current[parts[-1]] = value


def _resolve_config_path(config_path: Path | None = None) -> Path | None:
    if config_path is not None:
        return config_path

    raw_cf = os.getenv(_CONFIG_FILE_ENV, "").strip()
    if not raw_cf:
        return None
    return Path(raw_cf)


@lru_cache
@rns.rns()
def load_config(config_path: Path | None = None) -> dict[str, Any]:
    """Build a RecursiveNamespace-backed config using layered precedence.

    Layers (low → high):
      1. Packaged ``resources/default.yaml``
      2. Operator ``CONFIG_FILE`` yaml (if env var is set)
      3. Individual environment variable overrides
    """
    config_path = _resolve_config_path(config_path)

    values: dict[str, Any] = {}

    # Layer 1: packaged defaults
    _deep_merge(values, _load_yaml(DEFAULT_CONFIG_PATH))

    # Layer 2: operator config file
    if config_path is not None:
        _deep_merge(values, _load_yaml(config_path))

    # Layer 3: environment variable overrides
    for dotted_key, env_name in _ENV_OVERRIDES.items():
        raw = os.getenv(env_name, "").strip()
        if raw:
            _set_dotted_value(values, dotted_key, raw)

    return values


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
CONFIG = AppConfig()

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
