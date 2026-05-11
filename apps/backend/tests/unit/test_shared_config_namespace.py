from __future__ import annotations

from pathlib import Path

import yaml
from recursivenamespace import RecursiveNamespace

from app.shared import Fields, _CONFIG_FILE_ENV, _ENV_OVERRIDES, load_config


def test_load_config_returns_recursive_namespace(monkeypatch, tmp_path: Path) -> None:
    override_file = tmp_path / "override.yaml"
    override_file.write_text(
        yaml.dump({"metadata": {"db_path": "tmp/metadata.db"}, "backend": {"host": "127.0.0.1"}}),
        encoding="utf-8",
    )

    for env_name in _ENV_OVERRIDES.values():
        monkeypatch.delenv(env_name, raising=False)
    monkeypatch.setenv(_CONFIG_FILE_ENV, str(override_file))
    load_config.cache_clear()

    cfg = load_config()

    assert isinstance(cfg, RecursiveNamespace)
    assert cfg.metadata.db_path == "tmp/metadata.db"
    assert cfg.backend.host == "127.0.0.1"
    assert cfg.get_or_else(Fields.BACKEND_PORT) == 8000


def test_env_overrides_flow_through_dotted_keys(monkeypatch) -> None:
    for env_name in _ENV_OVERRIDES.values():
        monkeypatch.delenv(env_name, raising=False)
    monkeypatch.delenv(_CONFIG_FILE_ENV, raising=False)
    monkeypatch.setenv("METADATA_DB_PATH", "tmp/override.db")
    load_config.cache_clear()

    cfg = load_config()

    assert cfg.get_or_else(Fields.METADATA_DB_PATH) == "tmp/override.db"
    assert cfg.metadata.db_path == "tmp/override.db"