"""Pydantic Settings model — Layer 1 + Layer 3 of the three-layer
precedence (Layer 2 via `MDD_CONFIG_FILE` is wired in
`app_config.py`).

Drifted-pattern reference: `apps/backend/app/resources/default.yaml`
shape, plus `apps/backend/app/shared.py` lines 18-30 (`_ENV_OVERRIDES`
mapping dotted-key → env-var name).

Three-layer precedence (low → high):

    1. Packaged defaults: workspace/apps/backend/data/config/default.yaml
       (rendered from workspace/config/values.yaml via js-tmpl)
    2. Operator override: MDD_CONFIG_FILE=<path> points at an override
       yaml; deep-merged on top of layer 1
    3. Per-key env-var overrides:
       MDD_BACKEND__PORT=9090 overrides backend.port
       (pydantic-settings' env_nested_delimiter='__')

Validation runs at load time — invalid values (e.g., port="abc") raise
ValidationError immediately rather than fail at silent-default
fallback.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, ClassVar

import yaml
from pydantic import BaseModel, ConfigDict, Field
from pydantic_settings import (
    BaseSettings,
    PydanticBaseSettingsSource,
    SettingsConfigDict,
)

from .paths import DEFAULT_CONFIG_PATH


_CONFIG_FILE_ENV = "MDD_CONFIG_FILE"


class TmpSweepSettings(BaseModel):
    """R30: tmp-upload sweep job — runtime safety net.

    The sweep is a lifespan-spawned asyncio task that hard-deletes
    `data/uploads_tmp/<temp_id>/` directories older than the TTL.
    Disabled in tests via `MDD_BACKEND__TMP_SWEEP__ENABLED=false`.
    """

    model_config = ConfigDict(extra="forbid")

    enabled: bool = True
    interval_seconds: int = Field(default=3600, ge=60)
    ttl_seconds: int = Field(default=86400, ge=60)


class BackendSettings(BaseModel):
    """Inner settings for the backend service."""

    model_config = ConfigDict(extra="forbid")

    host: str = "127.0.0.1"
    port: int = Field(default=8000, ge=1, le=65535)
    workers: int = Field(default=1, ge=1)
    log_level: str = "INFO"
    cors_allow_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    upload_max_bytes: int = Field(default=100 * 1024 * 1024, ge=0)
    tmp_sweep: TmpSweepSettings = Field(default_factory=TmpSweepSettings)
    # `data_dir` controls the runtime data root that hosts
    # `uploads_tmp/`, `datasets/`, and `app.sqlite`. None falls back
    # to `paths.DEFAULT_DATA_DIR` (`<BACKEND_ROOT>/data`). Set via
    # values.yaml or `MDD_BACKEND__DATA_DIR=/var/lib/mdd`.
    data_dir: str | None = None


class _YamlConfigSource(PydanticBaseSettingsSource):
    """Custom pydantic-settings source loading from a YAML file.

    Pydantic-settings ships TOML + .env + secret-files but not YAML
    OOTB; this ~20-line subclass plugs YAML into the source chain.
    Returns `{}` if the file doesn't exist (graceful fallback so
    fresh clones without `pnpm config:render` still boot via the
    BaseModel defaults).
    """

    def __init__(self, settings_cls: type[BaseSettings], path: Path):
        super().__init__(settings_cls)
        self._path = path

    def _load(self) -> dict[str, Any]:
        if not self._path.exists():
            return {}
        with self._path.open("r", encoding="utf-8") as fh:
            data = yaml.safe_load(fh)
        return data if isinstance(data, dict) else {}

    def get_field_value(self, field, field_name):
        raw = self._load().get(field_name)
        return raw, field_name, False

    def __call__(self) -> dict[str, Any]:
        return self._load()


class Settings(BaseSettings):
    """Top-level settings — nested by section.

    Use as: ``settings.backend.port`` (typed, IDE autocomplete).
    """

    model_config = SettingsConfigDict(
        env_prefix="MDD_",
        env_nested_delimiter="__",
        extra="ignore",  # extra YAML keys are tolerated (forward-compat)
    )

    backend: BackendSettings = Field(default_factory=BackendSettings)

    # Resolved at class-load via _resolve_config_paths(); class-level
    # config-file paths used by settings_customise_sources().
    _yaml_paths: ClassVar[list[Path]] = []

    @classmethod
    def settings_customise_sources(  # type: ignore[override]
        cls,
        settings_cls,
        init_settings,
        env_settings,
        dotenv_settings,
        file_secret_settings,
    ):
        """Source precedence (high → low, since pydantic-settings calls
        them in order):

            env > init > yaml_files (layer 2 + layer 1) > defaults

        Layer 1 (default.yaml) and Layer 2 (MDD_CONFIG_FILE) are both
        YAML sources; we add Layer 2 first so it takes precedence over
        Layer 1 when both define the same key.
        """
        sources: list[PydanticBaseSettingsSource] = [
            init_settings,
            env_settings,
        ]
        for path in cls._yaml_paths:
            sources.append(_YamlConfigSource(settings_cls, path))
        sources.append(dotenv_settings)
        sources.append(file_secret_settings)
        return tuple(sources)


def _resolve_yaml_paths() -> list[Path]:
    """Compose the YAML source paths in precedence order (Layer 2 first
    so it overrides Layer 1 when both define a key)."""
    import os

    paths: list[Path] = []
    layer_2 = os.environ.get(_CONFIG_FILE_ENV, "").strip()
    if layer_2:
        paths.append(Path(layer_2))
    paths.append(DEFAULT_CONFIG_PATH)
    return paths


def build_settings() -> Settings:
    """Construct a Settings instance with the current yaml paths.

    Re-reads `MDD_CONFIG_FILE` each call so tests can monkeypatch and
    rebuild without polluting module state.
    """
    Settings._yaml_paths = _resolve_yaml_paths()  # noqa: SLF001
    return Settings()
