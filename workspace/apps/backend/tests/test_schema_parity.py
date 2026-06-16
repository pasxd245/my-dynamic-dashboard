"""R78 schema-parity guard — the binding check against silent divergence.

Proves the persistence-foundation invariant three ways, structurally:

    legacy _SCHEMA  ==  SQLModel.metadata.create_all()  ==  alembic upgrade head

- **legacy == models** → the SQLModel models reproduce today's schema
  exactly (so retiring the hand-bootstrap changed the *mechanism*, not
  the schema).
- **models == migrated** → the `0001_baseline` migration matches the
  models (so production, which migrates, gets the same schema tests build
  via `create_all`).

"Parity" is **structural / behavioral**, not byte-identical SQL text (see
.agents/context/persistence.md): we compare columns (name/type/notnull/
default/pk), foreign keys incl. `ON DELETE`, indexes (name/unique/columns),
and the `CHECK` clauses — everything the wire contract depends on.
"""

from __future__ import annotations

import re
import sqlite3
from pathlib import Path

import pytest

from app import db


# Frozen copy of the hand-bootstrapped schema (pre-R78 db.py `_SCHEMA` +
# `_R25_UNIQUE_INDEXES`), advanced to the **R79** shape: the `queries` table's
# legacy `dataset_id` (column + FK + index) is retired and `source_id` is now
# NOT NULL — the schema the `0002_query_source_id` migration produces at head.
# This is the "ground truth" the migration foundation must reproduce. Do not
# edit to match the models on a whim — it changes only when a reviewed
# migration genuinely changes the schema (R79 J-2), never to paper over drift.
_LEGACY_SCHEMA = """
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS datasets (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
    size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
    row_count INTEGER NOT NULL CHECK (row_count >= 0),
    column_count INTEGER NOT NULL CHECK (column_count >= 1),
    columns_json TEXT NOT NULL,
    source_format TEXT NOT NULL CHECK (source_format IN ('csv', 'excel')),
    sheet_name TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_datasets_workspace_id
    ON datasets(workspace_id);

CREATE TABLE IF NOT EXISTS queries (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL,
    name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
    definition_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_queries_workspace_id
    ON queries(workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_queries_name_unique
    ON queries(workspace_id, name);

CREATE TABLE IF NOT EXISTS relationships (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    left_dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    left_column TEXT NOT NULL,
    right_dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    right_column TEXT NOT NULL,
    cardinality TEXT NOT NULL
        CHECK (cardinality IN ('one_to_one', 'one_to_many', 'many_to_many')),
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_relationships_workspace_id
    ON relationships(workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_relationships_pair_unique
    ON relationships(workspace_id, left_dataset_id, left_column, right_dataset_id, right_column);
"""

_R25_UNIQUE_INDEXES = """
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_name_unique
    ON workspaces(name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_datasets_name_unique
    ON datasets(workspace_id, name);
"""

# The `queries` table BEFORE the R79 rename cleanup — `dataset_id` (NOT NULL,
# FK, indexed) with a nullable `source_id` (post-R76 additive widening). This is
# the shape a real *pre-Alembic* dev DB carries, so the adoption test migrates
# from HERE through `0002_query_source_id` to the head shape, exercising the
# backfill + column drop on seeded data (R79 J-2).
_PRE_R79_QUERIES = """
CREATE TABLE IF NOT EXISTS queries (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    source_id TEXT,
    name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
    definition_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_queries_workspace_id
    ON queries(workspace_id);
CREATE INDEX IF NOT EXISTS idx_queries_dataset_id
    ON queries(dataset_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_queries_name_unique
    ON queries(workspace_id, name);
"""

# Full pre-R79 schema = the head-shape ground truth with its `queries` table
# swapped back to the pre-rename block above (the other three tables are
# unchanged by R79).
_PRE_R79_SCHEMA = (
    _LEGACY_SCHEMA[: _LEGACY_SCHEMA.index("CREATE TABLE IF NOT EXISTS queries")]
    + _PRE_R79_QUERIES.strip()
    + "\n\n"
    + _LEGACY_SCHEMA[_LEGACY_SCHEMA.index("CREATE TABLE IF NOT EXISTS relationships") :]
)

_TABLES = ("workspaces", "datasets", "queries", "relationships")
_IGNORED_TABLES = {"alembic_version", "sqlite_sequence"}


def _extract_check_clauses(create_sql: str) -> set[str]:
    """Pull every `CHECK (...)` clause out of a CREATE TABLE statement,
    balancing nested parens, and normalize whitespace for comparison."""
    clauses: set[str] = set()
    for m in re.finditer(r"\bCHECK\b", create_sql, flags=re.IGNORECASE):
        i = create_sql.find("(", m.end())
        if i == -1:
            continue
        depth = 0
        for j in range(i, len(create_sql)):
            if create_sql[j] == "(":
                depth += 1
            elif create_sql[j] == ")":
                depth -= 1
                if depth == 0:
                    inner = create_sql[i + 1 : j]
                    clauses.add(re.sub(r"\s+", " ", inner).strip().lower())
                    break
    return clauses


def _introspect(path: Path) -> dict:
    """Normalized structural snapshot of a SQLite DB's 4 metadata tables."""
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    try:
        present = {
            r["name"]
            for r in con.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        } - _IGNORED_TABLES
        snapshot: dict = {"tables": present, "by_table": {}}
        for t in _TABLES:
            # Known, behavior-equivalent SQLite quirk: an inline `id TEXT
            # PRIMARY KEY` (legacy) reports notnull=0 — SQLite historically
            # allows NULL in a non-INTEGER PK — while SQLAlchemy emits an
            # explicit `NOT NULL` (notnull=1). The app always supplies `id`
            # and PK uniqueness applies either way, so we canonicalize the PK
            # column's notnull to 1 rather than make the model replicate the
            # quirk. (This is the "byte-for-byte is unachievable; structural
            # parity is the real invariant" case — see persistence.md.)
            cols = [
                (r["name"], r["type"], 1 if r["pk"] else r["notnull"], r["dflt_value"], r["pk"])
                for r in con.execute(f"PRAGMA table_info({t})").fetchall()
            ]
            fks = {
                (r["from"], r["table"], r["to"], (r["on_delete"] or "").upper())
                for r in con.execute(f"PRAGMA foreign_key_list({t})").fetchall()
            }
            indexes = set()
            for ix in con.execute(f"PRAGMA index_list({t})").fetchall():
                ix_cols = tuple(
                    r["name"]
                    for r in con.execute(
                        f"PRAGMA index_info({ix['name']})"
                    ).fetchall()
                )
                # Auto-indexes (PK / inline UNIQUE) get system-assigned names
                # that can differ harmlessly; pin them by shape, real indexes
                # by name.
                name = None if ix["name"].startswith("sqlite_autoindex_") else ix["name"]
                indexes.add((name, bool(ix["unique"]), ix_cols))
            create_sql = con.execute(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name=?",
                (t,),
            ).fetchone()["sql"]
            snapshot["by_table"][t] = {
                "columns": cols,
                "foreign_keys": fks,
                "indexes": indexes,
                "checks": _extract_check_clauses(create_sql),
            }
        return snapshot
    finally:
        con.close()


def _build_legacy(path: Path) -> None:
    con = sqlite3.connect(path)
    con.executescript(_LEGACY_SCHEMA)
    con.executescript(_R25_UNIQUE_INDEXES)
    con.commit()
    con.close()


def _build_pre_r79(path: Path) -> None:
    """A pre-Alembic dev DB at the pre-R79 shape (queries.dataset_id present,
    source_id nullable) — what the adoption path migrates forward."""
    con = sqlite3.connect(path)
    con.executescript(_PRE_R79_SCHEMA)
    con.executescript(_R25_UNIQUE_INDEXES)
    con.commit()
    con.close()


@pytest.fixture
def _restore_db_path():
    original = db.get_db_path()
    yield
    db.set_db_path(original)


def test_models_and_migration_match_legacy_schema(tmp_path: Path, _restore_db_path):
    legacy_path = tmp_path / "legacy.sqlite"
    models_path = tmp_path / "models.sqlite"
    migrated_path = tmp_path / "migrated.sqlite"

    # 1. legacy ground truth.
    _build_legacy(legacy_path)

    # 2. models via create_all (the test schema path).
    db.set_db_path(models_path)
    db.create_all_for_tests()

    # 3. migrated via the production adopter (fresh DB → upgrade head).
    db.set_db_path(migrated_path)
    db.run_startup_migrations()

    legacy = _introspect(legacy_path)
    models = _introspect(models_path)
    migrated = _introspect(migrated_path)

    assert models == legacy, "SQLModel.create_all() diverged from the legacy schema"
    assert migrated == legacy, "alembic upgrade head diverged from the legacy schema"


def test_existing_db_adopted_without_data_loss(tmp_path: Path, _restore_db_path):
    """R78 J-3 + R79 J-2 core guarantee: a pre-Alembic DB at the pre-R79 shape
    (queries.dataset_id, nullable source_id) with real data is adopted
    (heal-then-stamp → upgrade through 0002) without losing data; the rename
    cleanup BACKFILLS source_id = dataset_id, drops dataset_id, and lands the
    head schema. Re-running the adopter is idempotent."""
    existing = tmp_path / "existing.sqlite"
    _build_pre_r79(existing)
    con = sqlite3.connect(existing)
    con.execute("PRAGMA foreign_keys = ON")
    con.execute(
        "INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)",
        ("ws_1", "Acme", "2026-06-16T00:00:00Z"),
    )
    con.execute(
        "INSERT INTO datasets (id, workspace_id, name, size_bytes, row_count,"
        " column_count, columns_json, source_format, sheet_name, created_at)"
        " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ("ds_1", "ws_1", "Deals", 10, 5, 2, "[]", "csv", None, "2026-06-16T00:00:00Z"),
    )
    # A dataset-rooted query (the pre-R79 norm): dataset_id set, source_id NULL.
    con.execute(
        "INSERT INTO queries (id, workspace_id, dataset_id, source_id, name,"
        " definition_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ("qr_1", "ws_1", "ds_1", None, "Won deals",
         '{"filters": [], "advanced": [], "joins": []}', "2026-06-16T00:00:00Z"),
    )
    con.commit()
    con.close()

    db.set_db_path(existing)
    db.run_startup_migrations()  # pre-Alembic branch: heal-then-stamp → upgrade
    db.run_startup_migrations()  # idempotent: now versioned → plain upgrade

    con = sqlite3.connect(existing)
    try:
        assert con.execute("SELECT name FROM workspaces WHERE id='ws_1'").fetchone()[0] == "Acme"
        assert con.execute("SELECT name FROM datasets WHERE id='ds_1'").fetchone()[0] == "Deals"
        # R79 backfill: the dataset-rooted query's source is now its old dataset_id…
        assert con.execute("SELECT source_id FROM queries WHERE id='qr_1'").fetchone()[0] == "ds_1"
        # …and no row is left with a NULL canonical source.
        assert con.execute("SELECT COUNT(*) FROM queries WHERE source_id IS NULL").fetchone()[0] == 0
        # The legacy column is gone.
        cols = {r[1] for r in con.execute("PRAGMA table_info(queries)").fetchall()}
        assert "dataset_id" not in cols and "source_id" in cols
        assert con.execute("SELECT version_num FROM alembic_version").fetchone()[0] == "0002_query_source_id"
    finally:
        con.close()

    # The adopted DB matches the canonical (head) schema.
    assert _introspect(existing)["by_table"] == _introspect_models(tmp_path)


def _introspect_models(tmp_path: Path) -> dict:
    p = tmp_path / "_models_ref.sqlite"
    db.set_db_path(p)
    db.create_all_for_tests()
    return _introspect(p)["by_table"]


def test_migration_leaves_alembic_version(tmp_path: Path, _restore_db_path):
    """The migrated DB is genuinely versioned (so subsequent boots take the
    fast versioned path, not heal-then-stamp again)."""
    migrated_path = tmp_path / "versioned.sqlite"
    db.set_db_path(migrated_path)
    db.run_startup_migrations()

    con = sqlite3.connect(migrated_path)
    try:
        version = con.execute("SELECT version_num FROM alembic_version").fetchone()
    finally:
        con.close()
    assert version is not None and version[0] == "0002_query_source_id"
