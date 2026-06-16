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
    `tests/test_schema_parity.py` — but without the migration machinery,
    so the 193-test suite stays fast and hermetic.
    """
    engine = get_engine()
    SQLModel.metadata.create_all(engine)
    engine.dispose()


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


def _table_exists(con: sqlite3.Connection, name: str) -> bool:
    row = con.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)
    ).fetchone()
    return row is not None


def run_startup_migrations() -> None:
    """Bring `app.sqlite` to head, adopting any existing DB without data loss.

    Three states (R78 J-3 — see persistence.md):

    - **Fresh** (no tables) → `upgrade head` creates everything.
    - **Pre-Alembic** (tables present, no `alembic_version`) →
      **heal-then-stamp**: run the one-time legacy heal so the DB truly
      matches the baseline shape, `stamp` the baseline, then `upgrade head`.
    - **Versioned** (`alembic_version` present) → `upgrade head`.
    """
    from alembic import command

    path = get_db_path()
    path.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(path) as con:
        has_alembic = _table_exists(con, "alembic_version")
        has_known_table = _table_exists(con, "workspaces")

    cfg = _alembic_config()

    if not has_alembic and has_known_table:
        # Pre-Alembic existing DB: lift it to baseline shape, then adopt.
        with sqlite3.connect(path) as con:
            con.row_factory = sqlite3.Row
            _legacy_adoption_heal(con)
            con.commit()
        command.stamp(cfg, "0001_baseline")

    command.upgrade(cfg, "head")


# --------------------------------------------------------------------------
# Legacy adoption bridge (one-time, R78)
#
# These helpers are NOT steady-state schema logic — the hand-bootstrapped
# `_SCHEMA` is retired into the `0001_baseline` migration. They exist only
# to lift a *pre-Alembic* dev DB to baseline shape before it is stamped, so
# a DB created before R25/R76 (missing the unique indexes / `source_id`) is
# not silently mis-stamped. Delete once every dev DB carries `alembic_version`.
# --------------------------------------------------------------------------

_R25_UNIQUE_INDEXES = """
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_name_unique
    ON workspaces(name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_datasets_name_unique
    ON datasets(workspace_id, name);
"""


def _backfill_duplicate_names(con: sqlite3.Connection) -> None:
    """Resolve duplicate names by suffixing later rows with `(N)` so the
    R25 unique indexes can be created on a legacy DB. Idempotent — a fresh
    or already-deduped DB is a no-op. (One-time adoption bridge.)"""
    dups = con.execute(
        "SELECT name FROM workspaces GROUP BY name HAVING COUNT(*) > 1"
    ).fetchall()
    for (name,) in dups:
        rows = con.execute(
            "SELECT id FROM workspaces WHERE name = ? ORDER BY created_at ASC, id ASC",
            (name,),
        ).fetchall()
        for idx, (ws_id,) in enumerate(rows[1:], start=2):
            new_name = f"{name} ({idx})"
            con.execute("UPDATE workspaces SET name = ? WHERE id = ?", (new_name, ws_id))
            print(f"[db.adopt] renamed workspace {ws_id}: {name!r} -> {new_name!r}")

    dups = con.execute(
        "SELECT workspace_id, name FROM datasets GROUP BY workspace_id, name HAVING COUNT(*) > 1"
    ).fetchall()
    for ws_id, name in dups:
        rows = con.execute(
            "SELECT id FROM datasets WHERE workspace_id = ? AND name = ? ORDER BY created_at ASC, id ASC",
            (ws_id, name),
        ).fetchall()
        for idx, (ds_id,) in enumerate(rows[1:], start=2):
            new_name = f"{name} ({idx})"
            con.execute("UPDATE datasets SET name = ? WHERE id = ?", (new_name, ds_id))
            print(f"[db.adopt] renamed dataset {ds_id} in {ws_id}: {name!r} -> {new_name!r}")


def _add_missing_columns(con: sqlite3.Connection) -> None:
    """Add `queries.source_id` (R76) to a pre-R76 DB. Idempotent.
    (One-time adoption bridge.)"""
    cols = {row["name"] for row in con.execute("PRAGMA table_info(queries)").fetchall()}
    if "source_id" not in cols:
        con.execute("ALTER TABLE queries ADD COLUMN source_id TEXT")
        print("[db.adopt] added queries.source_id (R76 composition)")


def _legacy_adoption_heal(con: sqlite3.Connection) -> None:
    """Lift a pre-Alembic DB to the baseline schema shape before stamping.

    Tables already exist on a pre-Alembic DB (by definition of this branch),
    so this only adds the late-arriving column + unique indexes that older
    DBs may lack — exactly what the old `bootstrap_schema()` did on every
    boot. All steps are idempotent.
    """
    _add_missing_columns(con)
    _backfill_duplicate_names(con)
    con.executescript(_R25_UNIQUE_INDEXES)
