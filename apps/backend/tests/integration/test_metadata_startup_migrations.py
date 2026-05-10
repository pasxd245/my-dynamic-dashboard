from __future__ import annotations

import sqlite3
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory

from app.core.metadata_db import init_metadata_db
from app.core.metadata_migrations import run_startup_migrations


def _head_revision(config: Config) -> str:
    script = ScriptDirectory.from_config(config)
    head = script.get_current_head()
    assert head is not None
    return head


def _current_revision(db_path: Path) -> str | None:
    if not db_path.exists():
        return None

    with sqlite3.connect(db_path) as conn:
        table = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='alembic_version'",
        ).fetchone()
        if table is None:
            return None
        row = conn.execute("SELECT version_num FROM alembic_version LIMIT 1").fetchone()
        return row[0] if row else None


def test_fresh_db_startup_runs_upgrade_to_head(metadata_db_path_tmp: Path, alembic_config_for_db: Config) -> None:
    outcome = run_startup_migrations(metadata_db_path_tmp)

    assert outcome.action == "upgrade_only"
    assert _current_revision(metadata_db_path_tmp) == _head_revision(alembic_config_for_db)


def test_existing_untracked_db_is_auto_stamped_before_upgrade(
    metadata_db_path_tmp: Path,
    alembic_config_for_db: Config,
) -> None:
    init_metadata_db(metadata_db_path_tmp)
    assert _current_revision(metadata_db_path_tmp) is None

    outcome = run_startup_migrations(metadata_db_path_tmp)

    assert outcome.action == "stamp_then_upgrade"
    assert _current_revision(metadata_db_path_tmp) == _head_revision(alembic_config_for_db)


def test_repeated_startup_migrations_are_idempotent(metadata_db_path_tmp: Path) -> None:
    first = run_startup_migrations(metadata_db_path_tmp)
    second = run_startup_migrations(metadata_db_path_tmp)

    assert first.target_revision == second.target_revision
    assert second.action == "upgrade_only"
