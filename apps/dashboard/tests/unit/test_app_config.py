from __future__ import annotations

from pathlib import Path

import pytest

from dashboard.shared import DashboardAppConfig


def test_dashboard_app_config_uses_default_resource_values(tmp_path: Path) -> None:
    config_file = tmp_path / "default.yaml"
    config_file.write_text(
        """
api_base_url: http://localhost:8000
api_timeout_seconds: 11
api_retries: 4
log_level: warning
smoke_mode_enabled: false
strict_validation_enabled: false
refresh_cadence_default: daily
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


def test_dashboard_app_config_env_overrides_defaults(tmp_path: Path) -> None:
    config_file = tmp_path / "default.yaml"
    config_file.write_text(
        """
api_base_url: http://localhost:8000
api_timeout_seconds: 10
api_retries: 2
log_level: INFO
smoke_mode_enabled: false
strict_validation_enabled: false
refresh_cadence_default: manual
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
