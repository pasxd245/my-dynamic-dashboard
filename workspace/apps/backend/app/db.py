"""SQLite persistence layer.

Four tables — `workspaces` (R13), `datasets` (R16), `queries` (R69),
`relationships` (R70). As of **R78** the schema is defined by the
SQLModel models in [db_models.py](db_models.py) (the schema of record)
and evolved through **versioned Alembic migrations**, not the old
hand-bootstrapped `_SCHEMA` / `_add_missing_columns`.

Two code paths build the schema (the standard split — see
[.agents/context/persistence.md](../../../../.agents/context/persistence.md)):

- **Production / `pnpm dev:seed`** → `run_startup_migrations()` runs
  `alembic upgrade head` (adopting existing dev DBs without data loss).
- **Tests** → `create_all_for_tests()` builds the schema directly from
  `SQLModel.metadata` (fast, no migration machinery). A schema-parity
  test pins this equal to the migrated schema.

The DB file lives at ``<data_root>/app.sqlite`` where ``data_root``
follows ``backend.data_dir`` config (R30). Tests override via
``set_db_path(...)`` for hermetic isolation; the engine and Alembic URL
are both resolved lazily from ``get_db_path()`` so the override applies.
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from sqlalchemy import Engine, create_engine
from sqlmodel import SQLModel

# Import the table models so they register on `SQLModel.metadata` before any
# `create_all` / Alembic target lookup.
import app.db_models  # noqa: F401
from app._config.paths import BACKEND_ROOT
from app.storage import get_data_root


_db_path: Path | None = None

_ALEMBIC_INI = BACKEND_ROOT / "alembic.ini"
_ALEMBIC_DIR = BACKEND_ROOT / "alembic"


def _default_db_path() -> Path:
    return get_data_root() / "app.sqlite"


def set_db_path(path: Path | str) -> None:
    global _db_path
    _db_path = Path(path)


def get_db_path() -> Path:
    # Resolve lazily so changes to the data root (via test fixtures or
    # late `MDD_BACKEND__DATA_DIR` overrides) propagate without a
    # module re-import.
    return _db_path if _db_path is not None else _default_db_path()


def get_engine() -> Engine:
    """A fresh SQLAlchemy engine bound to the *current* `get_db_path()`.

    Not cached — the test data-root override changes the path between
    tests, so each call must re-resolve it.
    """
    path = get_db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    return create_engine(
        f"sqlite:///{path}", connect_args={"check_same_thread": False}
    )


def create_all_for_tests() -> None:
    """Build the schema directly from `SQLModel.metadata` (the test path).

    Equivalent to `alembic upgrade head` for a fresh DB — pinned by
    `tests/test_schema_parity.py` — but without replaying each migration's
    DDL, so the test suite stays fast and hermetic.

    Like `upgrade head`, it leaves the DB **stamped at head**: a models-built DB
    is already current, so when a test instantiates `TestClient(app)` the
    lifespan's `run_startup_migrations()` takes the versioned (no-op upgrade)
    branch. R88 collapsed the migration history to a single `0001_baseline`, so
    head is that one revision.
    """
    engine = get_engine()
    SQLModel.metadata.create_all(engine)
    engine.dispose()
    _stamp_head_for_tests()


def _stamp_head_for_tests() -> None:
    """Write `alembic_version = head` on a models-built DB (no DDL replay).

    Reads head from the script directory and inserts it directly, avoiding
    the heavier `command.stamp` env bootstrap on the per-test hot path.
    """
    from alembic.script import ScriptDirectory

    head = ScriptDirectory.from_config(_alembic_config()).get_current_head()
    with get_conn() as con:
        con.execute(
            "CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL)"
        )
        con.execute("DELETE FROM alembic_version")
        con.execute("INSERT INTO alembic_version (version_num) VALUES (?)", (head,))
        con.commit()


@contextmanager
def get_conn() -> Iterator[sqlite3.Connection]:
    con = sqlite3.connect(get_db_path())
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    try:
        yield con
    finally:
        con.close()


def reset_db_for_tests() -> None:
    """Clear all tables. Used by autouse test fixtures."""
    create_all_for_tests()
    with get_conn() as con:
        con.execute("DELETE FROM relationships")
        con.execute("DELETE FROM queries")
        con.execute("DELETE FROM datasets")
        con.execute("DELETE FROM workspaces")
        con.commit()


# --------------------------------------------------------------------------
# Startup migration adopter (production path)
# --------------------------------------------------------------------------


def _alembic_config():
    """Build an Alembic `Config` with an absolute script location.

    The URL is left for `alembic/env.py` to resolve from `get_db_path()`
    (single source of truth), so it is not set here.
    """
    from alembic.config import Config

    cfg = Config(str(_ALEMBIC_INI))
    cfg.set_main_option("script_location", str(_ALEMBIC_DIR))
    return cfg


def run_startup_migrations() -> None:
    """Bring `app.sqlite` to head via `alembic upgrade head`.

    - **Fresh** (no tables) → `upgrade head` creates everything at `0001_baseline`.
    - **Versioned** (`alembic_version` present) → `upgrade head` (no-op when current).

    R88 (clean-slate, decision 5) retired the pre-Alembic *adoption* bridge — the
    one-time heal-then-stamp path (and its `_legacy_adoption_heal` / duplicate-name
    backfill helpers) that lifted a hand-bootstrapped, pre-R78 dev DB to baseline
    shape. We are on `dev` with no backward-compat obligation; a stale pre-Alembic
    DB is re-created (`pnpm dev:seed --reset`), not migrated in place. See
    .agents/context/persistence.md.
    """
    from alembic import command

    path = get_db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    command.upgrade(_alembic_config(), "head")
