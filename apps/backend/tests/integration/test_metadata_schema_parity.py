from __future__ import annotations

import sqlite3
from pathlib import Path

from app.core.metadata_db import init_metadata_db

LEGACY_TABLES = {
    "workspaces",
    "source_files",
    "sheets",
    "columns",
    "column_profiles",
    "role_assignments",
    "override_logs",
    "manifest_snapshots",
    "files",
    "file_schemas",
    "relationship_rules",
    "relationship_audit",
    "saved_queries",
    "query_execution_log",
    "dashboards",
    "dashboard_panels",
    "dashboard_runs",
    "dashboard_run_panels",
    "dashboard_run_events",
    "deployment_bundles",
    "backup_artifacts",
    "deployment_events",
    "restore_runs",
    "saved_query_versions",
    "saved_query_events",
    "saved_query_executions",
}

ALLOWED_ADDITIONS = {"alembic_version", "column_mappings"}
SAVED_QUERY_ADDITIVE_COLUMNS = {
    "tags_json",
    "deleted_at",
    "recoverable_until",
    "version_count",
    "execution_count",
    "source_query_id",
}


def _table_names(db_path: Path) -> set[str]:
    with sqlite3.connect(db_path) as conn:
        rows = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    return {row[0] for row in rows if not row[0].startswith("sqlite_")}


def _columns(db_path: Path, table: str) -> set[str]:
    with sqlite3.connect(db_path) as conn:
        rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return {row[1] for row in rows}


def test_legacy_schema_parity_against_migrated_schema(tmp_path: Path, migrated_metadata_db: Path) -> None:
    legacy_db = tmp_path / "legacy.db"
    init_metadata_db(legacy_db)

    legacy_tables = _table_names(legacy_db)
    migrated_tables = _table_names(migrated_metadata_db)

    assert LEGACY_TABLES.issubset(legacy_tables)
    assert LEGACY_TABLES.issubset(migrated_tables)
    assert migrated_tables - legacy_tables == ALLOWED_ADDITIONS

    for table in LEGACY_TABLES:
        assert _columns(legacy_db, table) == _columns(migrated_metadata_db, table)


def test_saved_query_additive_columns_are_in_baseline(migrated_metadata_db: Path) -> None:
    saved_query_columns = _columns(migrated_metadata_db, "saved_queries")
    assert SAVED_QUERY_ADDITIVE_COLUMNS.issubset(saved_query_columns)
