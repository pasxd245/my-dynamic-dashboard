from __future__ import annotations

from collections.abc import Mapping
from functools import lru_cache
from pathlib import Path
from typing import Any

from recursivenamespace import RecursiveNamespace, rns
import yaml

from dashboard.utils.env_helper import validate_http_url


DEFAULT_CONFIG_PATH = Path(__file__).resolve().parent / "resources" / "default.yaml"
_CONFIG_FILE_ENV = "MDD_CONFIG_FILE"

_ENV_OVERRIDES: dict[str, str] = {
    "app.env": "APP_ENV",
    "api.base_url": "DASHBOARD_API_BASE_URL",
    "api.timeout_seconds": "DASHBOARD_API_TIMEOUT_SECONDS",
    "api.retries": "DASHBOARD_API_RETRIES",
    "log.level": "DASHBOARD_LOG_LEVEL",
    "dashboard.smoke_mode_enabled": "DASHBOARD_SMOKE",
    "deployment.strict_validation": "DEPLOYMENT_STRICT_VALIDATION",
    "dashboard.refresh_cadence.default": "DASHBOARD_REFRESH_CADENCE_DEFAULT",
}


class Fields:
    APP_ENV = "app.env"
    API_BASE_URL = "api.base_url"
    API_TIMEOUT_SECONDS = "api.timeout_seconds"
    API_RETRIES = "api.retries"
    LOG_LEVEL = "log.level"
    SMOKE_MODE_ENABLED = "dashboard.smoke_mode_enabled"
    STRICT_VALIDATION_ENABLED = "deployment.strict_validation"
    REFRESH_CADENCE_DEFAULT = "dashboard.refresh_cadence.default"


class DashboardAppConfig:
    def __init__(
        self,
        *,
        env: Mapping[str, str] | None = None,
        default_path: Path = DEFAULT_CONFIG_PATH,
        config_path: Path | None = None,
    ):
        self.cfg: RecursiveNamespace = self._load_namespace(
            env=env,
            default_path=default_path,
            config_path=config_path,
        )
        validate_http_url(self.api_base_url)

    @classmethod
    def from_sources(
        cls,
        *,
        env: Mapping[str, str] | None = None,
        default_path: Path = DEFAULT_CONFIG_PATH,
        config_path: Path | None = None,
    ) -> "DashboardAppConfig":
        return cls(
            env=env,
            default_path=default_path,
            config_path=config_path,
        )

    @staticmethod
    def _load_namespace(
        *,
        env: Mapping[str, str] | None,
        default_path: Path,
        config_path: Path | None,
    ) -> RecursiveNamespace:
        return load_config(
            env=env,
            default_path=default_path,
            config_path=config_path,
        )

    def get(self, key: str, default: Any = None, show_log: bool = False) -> Any:
        return self.cfg.get_or_else(key, or_else=default, show_log=show_log)

    def get_str(self, key: str, default: str = "") -> str:
        raw = self.get(key, default)
        if raw is None:
            return default
        return str(raw).strip()

    def get_int(self, key: str, default: int = 0) -> int:
        raw = self.get(key, default)
        try:
            return int(raw)
        except (TypeError, ValueError):
            return default

    def get_float(self, key: str, default: float = 0.0) -> float:
        raw = self.get(key, default)
        try:
            return float(raw)
        except (TypeError, ValueError):
            return default

    def get_bool(self, key: str, default: bool = False) -> bool:
        raw = self.get(key, default)
        if isinstance(raw, bool):
            return raw
        return str(raw).strip().lower() in {"1", "true", "yes", "on"}

    @property
    def api_base_url(self) -> str:
        return self.get_str(Fields.API_BASE_URL, "http://localhost:8000").rstrip("/")

    @property
    def api_timeout_seconds(self) -> float:
        return self.get_float(Fields.API_TIMEOUT_SECONDS, 10.0)

    @property
    def api_retries(self) -> int:
        return self.get_int(Fields.API_RETRIES, 2)

    @property
    def log_level(self) -> str:
        return self.get_str(Fields.LOG_LEVEL, "INFO").upper()

    @property
    def smoke_mode_enabled(self) -> bool:
        return self.get_bool(Fields.SMOKE_MODE_ENABLED, False)

    @property
    def strict_validation_enabled(self) -> bool:
        return self.get_bool(Fields.STRICT_VALIDATION_ENABLED, False) or self.get_str(Fields.APP_ENV, "development").lower() == "production"

    @property
    def refresh_cadence_default(self) -> str:
        return self.get_str(Fields.REFRESH_CADENCE_DEFAULT, "manual")


def _load_yaml(default_path: Path) -> dict[str, Any]:
    if not default_path.exists():
        return {}

    with default_path.open("r", encoding="utf-8") as handle:
        payload = yaml.safe_load(handle) or {}
    return payload if isinstance(payload, dict) else {}


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


def _resolve_config_path(
    config_path: Path | None,
    env: Mapping[str, str] | None,
) -> Path | None:
    if config_path is not None:
        return config_path

    source = {} if env is None else env
    raw = source.get(_CONFIG_FILE_ENV) if env is not None else None
    if env is None:
        from os import getenv

        raw = getenv(_CONFIG_FILE_ENV, "")
    if raw is None:
        return None
    value = str(raw).strip()
    if not value:
        return None
    return Path(value)


def _build_payload(
    *,
    env: Mapping[str, str] | None,
    default_path: Path,
    config_path: Path | None,
) -> dict[str, Any]:
    values: dict[str, Any] = {
        "app": {"env": "development"},
        "api": {"base_url": "http://localhost:8000", "timeout_seconds": 10, "retries": 2},
        "log": {"level": "INFO"},
        "dashboard": {"smoke_mode_enabled": False, "refresh_cadence": {"default": "manual"}},
        "deployment": {"strict_validation": False},
    }

    _deep_merge(values, _load_yaml(default_path))

    if config_path is not None:
        _deep_merge(values, _load_yaml(config_path))

    if env is None:
        from os import environ

        env = environ

    for dotted_key, env_name in _ENV_OVERRIDES.items():
        raw = env.get(env_name)
        if raw is not None and str(raw).strip() != "":
            _set_dotted_value(values, dotted_key, raw)

    api_section = values.get("api")
    if isinstance(api_section, dict):
        base_url = api_section.get("base_url")
        if base_url is not None:
            api_section["base_url"] = str(base_url).rstrip("/")

    return values


@lru_cache
@rns.rns()
def _load_cached_config(default_path: Path = DEFAULT_CONFIG_PATH, config_path: Path | None = None) -> dict[str, Any]:
    return _build_payload(env=None, default_path=default_path, config_path=config_path)


@rns.rns()
def _load_config_for_env(
    default_path: Path = DEFAULT_CONFIG_PATH,
    config_path: Path | None = None,
    env_items: tuple[tuple[str, str], ...] = (),
) -> dict[str, Any]:
    return _build_payload(env=dict(env_items), default_path=default_path, config_path=config_path)


def load_config(
    *,
    env: Mapping[str, str] | None = None,
    default_path: Path = DEFAULT_CONFIG_PATH,
    config_path: Path | None = None,
) -> RecursiveNamespace:
    resolved_config_path = _resolve_config_path(config_path, env)
    if env is None:
        return _load_cached_config(default_path, resolved_config_path)
    return _load_config_for_env(default_path, resolved_config_path, tuple(sorted((str(k), str(v)) for k, v in env.items())))


_CONFIG: DashboardAppConfig | None = None


def get_app_config() -> DashboardAppConfig:
    global _CONFIG
    if _CONFIG is None:
        _CONFIG = DashboardAppConfig.from_sources()
    return _CONFIG


def reload_app_config() -> DashboardAppConfig:
    global _CONFIG
    _CONFIG = DashboardAppConfig.from_sources()
    return _CONFIG
