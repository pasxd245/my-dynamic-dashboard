from __future__ import annotations

import os
from collections.abc import Mapping
from urllib.parse import urlparse

from dashboard.core.errors import DashboardConfigError


TRUE_VALUES = {"1", "true", "yes", "on"}


def _resolve_env(env: Mapping[str, str] | None = None) -> Mapping[str, str]:
    return os.environ if env is None else env


def env_str(name: str, *, default: str, env: Mapping[str, str] | None = None) -> str:
    value = _resolve_env(env).get(name)
    if value is None:
        return default
    return str(value).strip()


def env_int(name: str, *, default: int, env: Mapping[str, str] | None = None) -> int:
    raw = env_str(name, default=str(default), env=env)
    try:
        return int(raw)
    except ValueError as exc:
        raise DashboardConfigError(f"{name} must be an integer") from exc


def env_float(name: str, *, default: float, env: Mapping[str, str] | None = None) -> float:
    raw = env_str(name, default=str(default), env=env)
    try:
        return float(raw)
    except ValueError as exc:
        raise DashboardConfigError(f"{name} must be numeric") from exc


def env_bool(name: str, *, default: bool, env: Mapping[str, str] | None = None) -> bool:
    raw = env_str(name, default="1" if default else "0", env=env)
    return raw.lower() in TRUE_VALUES


def validate_http_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise DashboardConfigError("DASHBOARD_API_BASE_URL must be a valid http(s) URL")
