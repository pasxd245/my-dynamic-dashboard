import sqlite3

from app.core.config import metadata_db_path
from app.core.metadata_db import init_metadata_db


REQUIRED_TABLES = {
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
}
SPEC_004_TABLES = {
    "saved_query_versions",
    "saved_query_events",
    "saved_query_executions",
}
SPEC_005_TABLES = {
    "dashboards",
    "dashboard_panels",
    "dashboard_runs",
    "dashboard_run_panels",
    "dashboard_run_events",
}
SPEC_006_TABLES = {
    "deployment_bundles",
    "backup_artifacts",
    "deployment_events",
    "restore_runs",
}


def test_metadata_schema_contains_required_tables() -> None:
    db_path = metadata_db_path()
    init_metadata_db(db_path)

    with sqlite3.connect(db_path) as conn:
        rows = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()

    table_names = {row[0] for row in rows}
    assert REQUIRED_TABLES.issubset(table_names)
    assert SPEC_004_TABLES.issubset(table_names)
    assert SPEC_005_TABLES.issubset(table_names)
    assert SPEC_006_TABLES.issubset(table_names)
