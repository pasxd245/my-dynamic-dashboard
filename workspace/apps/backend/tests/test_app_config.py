"""R28: AppConfig facade tests — dotted-key access + typed accessors.

Drifted-pattern reference:
`apps/backend/tests/unit/test_shared_config_namespace.py`.
"""

from __future__ import annotations

import pytest

from app._config import CONFIG, AppConfig, Fields, build_settings


@pytest.mark.unit
def test_facade_get_str_resolves_dotted_key() -> None:
    assert CONFIG.get_str(Fields.BACKEND_HOST) == "0.0.0.0"
    assert CONFIG.get_str(Fields.BACKEND_LOG_LEVEL) == "INFO"


@pytest.mark.unit
def test_facade_get_int_resolves_dotted_key() -> None:
    assert CONFIG.get_int(Fields.BACKEND_PORT) == 8000
    assert CONFIG.get_int(Fields.BACKEND_WORKERS) == 1
    assert CONFIG.get_int(Fields.BACKEND_UPLOAD_MAX_BYTES) == 100 * 1024 * 1024


@pytest.mark.unit
def test_facade_get_returns_list_for_list_fields() -> None:
    origins = CONFIG.get(Fields.BACKEND_CORS_ALLOW_ORIGINS)
    assert origins == ["http://localhost:3000", "http://127.0.0.1:3000"]


@pytest.mark.unit
def test_facade_get_returns_default_on_unknown_key() -> None:
    assert CONFIG.get("nope.does_not_exist", "fallback") == "fallback"
    assert CONFIG.get_str("nope.does_not_exist", "fallback") == "fallback"
    assert CONFIG.get_int("nope.does_not_exist", 42) == 42


@pytest.mark.unit
def test_typed_access_via_settings_property() -> None:
    assert CONFIG.settings.backend.host == "0.0.0.0"
    assert CONFIG.settings.backend.port == 8000
    assert CONFIG.settings.backend.cors_allow_origins == [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]


@pytest.mark.unit
def test_build_settings_returns_fresh_instance() -> None:
    s1 = build_settings()
    s2 = build_settings()
    assert s1 is not s2
    assert s1.backend.port == s2.backend.port


@pytest.mark.unit
def test_app_config_constructible_from_built_settings() -> None:
    cfg = AppConfig(build_settings())
    assert cfg.get_int(Fields.BACKEND_PORT) == 8000
