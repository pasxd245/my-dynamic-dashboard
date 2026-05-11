from __future__ import annotations

from pathlib import Path

import pytest
from recursivenamespace import RecursiveNamespace

from dashboard.shared import DashboardAppConfig, Fields


def test_dashboard_app_config_uses_default_resource_values(tmp_path: Path) -> None:
    config_file = tmp_path / "default.yaml"
    config_file.write_text(
        """
app:
    env: development
api:
    base_url: http://localhost:8000
    timeout_seconds: 11
    retries: 4
log:
    level: warning
dashboard:
    smoke_mode_enabled: false
    refresh_cadence:
        default: daily
deployment:
    strict_validation: false
""".strip()
        + "\n",
        encoding="utf-8",
    )

    cfg = DashboardAppConfig.from_sources(default_path=config_file, env={})
    assert cfg.api_base_url == "http://localhost:8000"
    assert cfg.api_timeout_seconds == 11
    assert cfg.api_retries == 4
    assert cfg.log_level == "WARNING"
    assert cfg.smoke_mode_enabled is False
    assert cfg.strict_validation_enabled is False
    assert cfg.refresh_cadence_default == "daily"
    assert isinstance(cfg.cfg, RecursiveNamespace)
    assert cfg.cfg.api.base_url == "http://localhost:8000"
    assert cfg.get(Fields.REFRESH_CADENCE_DEFAULT) == "daily"


def test_dashboard_app_config_env_overrides_defaults(tmp_path: Path) -> None:
    config_file = tmp_path / "default.yaml"
    config_file.write_text(
        """
app:
    env: development
api:
    base_url: http://localhost:8000
    timeout_seconds: 10
    retries: 2
log:
    level: INFO
dashboard:
    smoke_mode_enabled: false
    refresh_cadence:
        default: manual
deployment:
    strict_validation: false
""".strip()
        + "\n",
        encoding="utf-8",
    )

    env = {
        "DASHBOARD_API_BASE_URL": "https://api.example.com/",
        "DASHBOARD_API_TIMEOUT_SECONDS": "3.5",
        "DASHBOARD_API_RETRIES": "7",
        "DASHBOARD_LOG_LEVEL": "debug",
        "DASHBOARD_SMOKE": "true",
        "DEPLOYMENT_STRICT_VALIDATION": "1",
        "DASHBOARD_REFRESH_CADENCE_DEFAULT": "hourly",
    }

    cfg = DashboardAppConfig.from_sources(default_path=config_file, env=env)
    assert cfg.api_base_url == "https://api.example.com"
    assert cfg.api_timeout_seconds == pytest.approx(3.5)
    assert cfg.api_retries == 7
    assert cfg.log_level == "DEBUG"
    assert cfg.smoke_mode_enabled is True
    assert cfg.strict_validation_enabled is True
    assert cfg.refresh_cadence_default == "hourly"
    assert cfg.cfg.api.base_url == "https://api.example.com"


def test_dashboard_app_config_treats_app_env_as_strict_validation_signal(tmp_path: Path) -> None:
    config_file = tmp_path / "default.yaml"
    config_file.write_text(
        """
app:
    env: development
api:
    base_url: http://localhost:8000
    timeout_seconds: 10
    retries: 2
log:
    level: INFO
dashboard:
    smoke_mode_enabled: false
    refresh_cadence:
        default: manual
deployment:
    strict_validation: false
""".strip()
        + "\n",
        encoding="utf-8",
    )

    cfg = DashboardAppConfig.from_sources(default_path=config_file, env={"APP_ENV": "production"})

    assert cfg.strict_validation_enabled is True
