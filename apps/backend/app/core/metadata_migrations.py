from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory


@dataclass(frozen=True)
class MigrationState:
    db_exists: bool
    has_alembic_version_table: bool


@dataclass(frozen=True)
class MigrationOutcome:
    action: str
    target_revision: str


def _build_alembic_config(db_path: Path) -> Config:
    backend_root = Path(__file__).resolve().parents[2]
    config = Config(str(backend_root / "alembic.ini"))
    config.set_main_option("script_location", str(backend_root / "alembic"))
    config.set_main_option("sqlalchemy.url", f"sqlite:///{db_path}")
    return config


def detect_state(db_path: Path) -> MigrationState:
    if not db_path.exists():
        return MigrationState(db_exists=False, has_alembic_version_table=False)

    with sqlite3.connect(db_path) as conn:
        row = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='alembic_version'",
        ).fetchone()
    return MigrationState(db_exists=True, has_alembic_version_table=row is not None)


def run_startup_migrations(db_path: Path, logger=None) -> MigrationOutcome:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    config = _build_alembic_config(db_path)
    script = ScriptDirectory.from_config(config)
    target_revision = script.get_current_head()
    if target_revision is None:
        raise RuntimeError("alembic script directory has no head revision")

    state = detect_state(db_path)
    if logger is not None:
        logger.info("metadata migration detect_state", extra={"step": "detect_state", "db_exists": state.db_exists, "has_alembic_version_table": state.has_alembic_version_table})

    if state.db_exists and not state.has_alembic_version_table:
        if logger is not None:
            logger.info("metadata migration stamp_head", extra={"step": "stamp_head", "target_revision": target_revision})
        command.stamp(config, "head")
        action = "stamp_then_upgrade"
    else:
        action = "upgrade_only"

    if logger is not None:
        logger.info("metadata migration upgrade_head", extra={"step": "upgrade_head", "target_revision": target_revision})
    command.upgrade(config, "head")

    return MigrationOutcome(action=action, target_revision=target_revision)
