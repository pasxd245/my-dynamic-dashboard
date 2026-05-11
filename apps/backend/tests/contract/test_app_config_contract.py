from __future__ import annotations

from pathlib import Path

import yaml

from app.shared import AppConfig, Fields, _CONFIG_FILE_ENV, _ENV_OVERRIDES, load_config


def test_app_config_get_supports_dotted_public_contract(monkeypatch, tmp_path: Path) -> None:
    override_file = tmp_path / "override.yaml"
    override_file.write_text(
        yaml.dump({"metadata": {"db_path": "contract/metadata.db"}, "backup": {"dir": "contract/backups"}}),
        encoding="utf-8",
    )

    for env_name in _ENV_OVERRIDES.values():
        monkeypatch.delenv(env_name, raising=False)
    monkeypatch.setenv(_CONFIG_FILE_ENV, str(override_file))
    load_config.cache_clear()

    cfg = AppConfig()

    assert cfg.get(Fields.METADATA_DB_PATH) == "contract/metadata.db"
    assert cfg.get(Fields.BACKUP_DIR) == "contract/backups"
    assert cfg.get("missing.value", "fallback") == "fallback"