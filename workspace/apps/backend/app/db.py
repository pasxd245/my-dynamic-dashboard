"""SQLite persistence layer.

Two tables — `workspaces` (the R13 model promoted from an in-memory
list) and `datasets` (R16). Schema is created `IF NOT EXISTS` at
app startup via the FastAPI lifespan. No migrations framework yet;
revisit when a schema-change round arrives.

Tests override the DB location by setting the `MDD_DB_PATH`
environment variable before importing the app, OR by calling
`set_db_path(...)` before instantiating the `TestClient`.
"""

from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator


_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_DB_PATH = _BACKEND_ROOT / "data" / "app.sqlite"

_db_path: Path = Path(os.environ.get("MDD_DB_PATH", _DEFAULT_DB_PATH))


def set_db_path(path: Path | str) -> None:
    global _db_path
    _db_path = Path(path)


def get_db_path() -> Path:
    return _db_path


_SCHEMA = """
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
"""

# Unique indexes added by R25 (CRUD hygiene chain). Created AFTER the
# duplicate-name back-fill runs, so existing data with duplicates gets
# renamed first (otherwise the index creation would fail).
_R25_UNIQUE_INDEXES = """
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_name_unique
    ON workspaces(name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_datasets_name_unique
    ON datasets(workspace_id, name);
"""


def _backfill_duplicate_names(con: sqlite3.Connection) -> None:
    """Resolve duplicate names by suffixing later rows with `(N)`.

    Runs once per bootstrap before R25's unique indexes are created.
    The oldest row (by `created_at`, then `id` as tiebreaker) keeps
    its name; siblings get `<name> (2)`, `<name> (3)`, etc. Logs
    each rename so operators can see what changed.

    Idempotent: a fresh DB has no duplicates, so this is a no-op.
    """
    # Workspaces: global uniqueness on `name`.
    dups = con.execute(
        "SELECT name FROM workspaces GROUP BY name HAVING COUNT(*) > 1"
    ).fetchall()
    for (name,) in dups:
        rows = con.execute(
            "SELECT id FROM workspaces WHERE name = ? "
            "ORDER BY created_at ASC, id ASC",
            (name,),
        ).fetchall()
        # Skip the first (oldest); rename the rest.
        for idx, (ws_id,) in enumerate(rows[1:], start=2):
            new_name = f"{name} ({idx})"
            con.execute(
                "UPDATE workspaces SET name = ? WHERE id = ?", (new_name, ws_id)
            )
            print(
                f"[db.backfill] renamed workspace {ws_id}: "
                f"{name!r} -> {new_name!r}"
            )

    # Datasets: per-workspace uniqueness on `(workspace_id, name)`.
    dups = con.execute(
        "SELECT workspace_id, name FROM datasets "
        "GROUP BY workspace_id, name HAVING COUNT(*) > 1"
    ).fetchall()
    for ws_id, name in dups:
        rows = con.execute(
            "SELECT id FROM datasets WHERE workspace_id = ? AND name = ? "
            "ORDER BY created_at ASC, id ASC",
            (ws_id, name),
        ).fetchall()
        for idx, (ds_id,) in enumerate(rows[1:], start=2):
            new_name = f"{name} ({idx})"
            con.execute(
                "UPDATE datasets SET name = ? WHERE id = ?", (new_name, ds_id)
            )
            print(
                f"[db.backfill] renamed dataset {ds_id} in {ws_id}: "
                f"{name!r} -> {new_name!r}"
            )


def bootstrap_schema() -> None:
    path = get_db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path) as con:
        con.executescript(_SCHEMA)
        # R25: back-fill duplicate names BEFORE creating the unique
        # indexes — otherwise the CREATE UNIQUE INDEX fails on the
        # duplicates that the index is supposed to prevent.
        _backfill_duplicate_names(con)
        con.executescript(_R25_UNIQUE_INDEXES)
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
    """Clear both tables. Used by autouse test fixtures."""
    bootstrap_schema()
    with get_conn() as con:
        con.execute("DELETE FROM datasets")
        con.execute("DELETE FROM workspaces")
        con.commit()
