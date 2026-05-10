from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping

import yaml

from dashboard.utils.env_helper import env_bool, env_float, env_int, env_str, validate_http_url


DEFAULT_CONFIG_PATH = Path(__file__).resolve().parent / "resources" / "default.yaml"


@dataclass(frozen=True)
class DashboardAppConfig:
    api_base_url: str
    api_timeout_seconds: float
    api_retries: int
    log_level: str
    smoke_mode_enabled: bool
    strict_validation_enabled: bool
    refresh_cadence_default: str

    @classmethod
    def from_sources(
        cls,
        *,
        env: Mapping[str, str] | None = None,
        default_path: Path = DEFAULT_CONFIG_PATH,
    ) -> "DashboardAppConfig":
        defaults = _load_defaults(default_path)

        api_base_url = env_str(
            "DASHBOARD_API_BASE_URL",
            default=str(defaults["api_base_url"]),
            env=env,
        ).rstrip("/")
        validate_http_url(api_base_url)

        return cls(
            api_base_url=api_base_url,
            api_timeout_seconds=env_float(
                "DASHBOARD_API_TIMEOUT_SECONDS",
                default=float(defaults["api_timeout_seconds"]),
                env=env,
            ),
            api_retries=env_int(
                "DASHBOARD_API_RETRIES",
                default=int(defaults["api_retries"]),
                env=env,
            ),
            log_level=env_str(
                "DASHBOARD_LOG_LEVEL",
                default=str(defaults["log_level"]),
                env=env,
            ).upper(),
            smoke_mode_enabled=env_bool(
                "DASHBOARD_SMOKE",
                default=bool(defaults["smoke_mode_enabled"]),
                env=env,
            ),
            strict_validation_enabled=env_bool(
                "DEPLOYMENT_STRICT_VALIDATION",
                default=bool(defaults["strict_validation_enabled"]),
                env=env,
            ) or env_str("APP_ENV", default="development", env=env).lower() == "production",
            refresh_cadence_default=env_str(
                "DASHBOARD_REFRESH_CADENCE_DEFAULT",
                default=str(defaults["refresh_cadence_default"]),
                env=env,
            ),
        )


def _load_defaults(default_path: Path) -> dict[str, Any]:
    if not default_path.exists():
        return {
            "api_base_url": "http://localhost:8000",
            "api_timeout_seconds": 10,
            "api_retries": 2,
            "log_level": "INFO",
            "smoke_mode_enabled": False,
            "strict_validation_enabled": False,
            "refresh_cadence_default": "manual",
        }

    with default_path.open("r", encoding="utf-8") as handle:
        payload = yaml.safe_load(handle) or {}

    return {
        "api_base_url": payload.get("api_base_url", "http://localhost:8000"),
        "api_timeout_seconds": payload.get("api_timeout_seconds", 10),
        "api_retries": payload.get("api_retries", 2),
        "log_level": payload.get("log_level", "INFO"),
        "smoke_mode_enabled": payload.get("smoke_mode_enabled", False),
        "strict_validation_enabled": payload.get("strict_validation_enabled", False),
        "refresh_cadence_default": payload.get("refresh_cadence_default", "manual"),
    }


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
