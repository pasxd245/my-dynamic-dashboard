"""R28: AppConfig three-layer precedence tests.

Drifted-pattern reference:
`apps/backend/tests/integration/test_config_precedence.py`.

Layers (low → high):
    1. Packaged defaults: workspace/apps/backend/data/config/default.yaml
       (rendered from workspace/config/values.yaml via js-tmpl)
    2. Operator override: MDD_CONFIG_FILE=<path> yaml
    3. Per-key env-var: MDD_BACKEND__PORT, MDD_BACKEND__HOST, etc.
       (pydantic-settings env_nested_delimiter='__')

Each test resets relevant env vars + rebuilds Settings via
build_settings() so module state doesn't leak between cases.
"""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from app._config import AppConfig, Fields
from app._config.settings import _CONFIG_FILE_ENV, build_settings


def _fresh_app_config(monkeypatch, *, env: dict[str, str] | None = None, config_file: Path | None = None) -> AppConfig:
    """Build a fresh AppConfig with isolated env state.

    Clears MDD_CONFIG_FILE + any MDD_BACKEND__* env vars before
    applying the test's overrides.
    """
    # Clear all MDD_-prefixed env we care about.
    monkeypatch.delenv(_CONFIG_FILE_ENV, raising=False)
    for env_name in ("MDD_BACKEND__HOST", "MDD_BACKEND__PORT", "MDD_BACKEND__WORKERS", "MDD_BACKEND__LOG_LEVEL"):
        monkeypatch.delenv(env_name, raising=False)

    if env:
        for k, v in env.items():
            monkeypatch.setenv(k, v)
    if config_file is not None:
        monkeypatch.setenv(_CONFIG_FILE_ENV, str(config_file))

    return AppConfig(build_settings())


@pytest.mark.integration
def test_layer1_defaults_only(monkeypatch) -> None:
    """Layer 1: rendered default.yaml supplies all values when no env
    or CONFIG_FILE is set."""
    cfg = _fresh_app_config(monkeypatch)

    assert cfg.get_str(Fields.BACKEND_HOST) == "0.0.0.0"
    assert cfg.get_int(Fields.BACKEND_PORT) == 8000
    assert cfg.get_int(Fields.BACKEND_WORKERS) == 1
    assert cfg.get_str(Fields.BACKEND_LOG_LEVEL) == "INFO"


@pytest.mark.integration
def test_layer3_env_override_wins_over_default(monkeypatch) -> None:
    """Layer 3: env var beats Layer 1 default."""
    cfg = _fresh_app_config(
        monkeypatch,
        env={"MDD_BACKEND__PORT": "9090", "MDD_BACKEND__LOG_LEVEL": "DEBUG"},
    )

    assert cfg.get_int(Fields.BACKEND_PORT) == 9090
    assert cfg.get_str(Fields.BACKEND_LOG_LEVEL) == "DEBUG"
    # Un-overridden fields still come from Layer 1.
    assert cfg.get_int(Fields.BACKEND_WORKERS) == 1


@pytest.mark.integration
def test_layer2_config_file_override_beats_default(monkeypatch, tmp_path) -> None:
    """Layer 2: MDD_CONFIG_FILE yaml beats Layer 1 default."""
    override = tmp_path / "override.yaml"
    override.write_text(
        yaml.dump({"backend": {"log_level": "WARNING", "workers": 4}}),
    )

    cfg = _fresh_app_config(monkeypatch, config_file=override)

    assert cfg.get_str(Fields.BACKEND_LOG_LEVEL) == "WARNING"
    assert cfg.get_int(Fields.BACKEND_WORKERS) == 4
    # Default not in override still comes from Layer 1.
    assert cfg.get_int(Fields.BACKEND_PORT) == 8000


@pytest.mark.integration
def test_layer3_env_beats_layer2_config_file(monkeypatch, tmp_path) -> None:
    """Layer 3 wins over Layer 2: env beats CONFIG_FILE."""
    override = tmp_path / "override.yaml"
    override.write_text(yaml.dump({"backend": {"port": 7070}}))

    cfg = _fresh_app_config(
        monkeypatch,
        env={"MDD_BACKEND__PORT": "9090"},
        config_file=override,
    )

    assert cfg.get_int(Fields.BACKEND_PORT) == 9090  # env wins


@pytest.mark.integration
def test_invalid_port_raises_validation_error(monkeypatch) -> None:
    """Pydantic catches invalid types at load time."""
    from pydantic import ValidationError

    monkeypatch.delenv(_CONFIG_FILE_ENV, raising=False)
    monkeypatch.setenv("MDD_BACKEND__PORT", "not-a-number")
    with pytest.raises(ValidationError):
        build_settings()


@pytest.mark.integration
def test_cors_origins_from_default_yaml(monkeypatch) -> None:
    """List fields render correctly from the Layer 1 yaml."""
    cfg = _fresh_app_config(monkeypatch)
    assert cfg.get(Fields.BACKEND_CORS_ALLOW_ORIGINS) == ["http://localhost:3000"]
