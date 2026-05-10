from __future__ import annotations

import sqlite3
from pathlib import Path


def _table_sql(db_path: Path, table: str) -> str:
    with sqlite3.connect(db_path) as conn:
        row = conn.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name=?",
            (table,),
        ).fetchone()
    assert row is not None
    return row[0]


def test_column_mappings_table_shape_and_constraints(migrated_metadata_db: Path) -> None:
    with sqlite3.connect(migrated_metadata_db) as conn:
        columns = conn.execute("PRAGMA table_info(column_mappings)").fetchall()
        fks = conn.execute("PRAGMA foreign_key_list(column_mappings)").fetchall()

    column_names = {row[1] for row in columns}
    assert column_names == {
        "id",
        "workspace_id",
        "source_file_id",
        "from_column_name",
        "to_column_name",
        "from_version",
        "to_version",
        "confidence",
        "accepted_by",
        "created_at",
    }

    fk_targets = {(row[3], row[2], row[4]) for row in fks}
    assert ("workspace_id", "workspaces", "id") in fk_targets
    assert ("source_file_id", "source_files", "id") in fk_targets

    ddl = _table_sql(migrated_metadata_db, "column_mappings")
    assert "confidence >= 0.0 AND confidence <= 1.0" in ddl
    assert "to_version >= from_version" in ddl


def test_runtime_paths_do_not_depend_on_column_mappings() -> None:
    service_dir = Path(__file__).resolve().parents[2] / "app" / "services"
    service_sources = "\n".join(path.read_text(encoding="utf-8") for path in service_dir.glob("*.py"))

    assert "column_mappings" not in service_sources
