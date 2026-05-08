from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator
import uuid


def init_metadata_db(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(db_path) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS workspaces (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'draft',
                manifest_version INTEGER NOT NULL DEFAULT 1,
                content_hash TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS source_files (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                filename_original TEXT NOT NULL,
                extension TEXT NOT NULL,
                content_hash TEXT NOT NULL,
                encoding_detected TEXT,
                parse_status TEXT NOT NULL,
                reject_reason TEXT,
                uploaded_at TEXT NOT NULL,
                FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sheets (
                id TEXT PRIMARY KEY,
                source_file_id TEXT NOT NULL,
                sheet_name TEXT NOT NULL,
                header_row_detected INTEGER NOT NULL,
                header_row_effective INTEGER NOT NULL,
                data_range_detected TEXT NOT NULL,
                data_range_effective TEXT NOT NULL,
                multi_range_warning INTEGER NOT NULL DEFAULT 0,
                committed_at TEXT NOT NULL,
                FOREIGN KEY(source_file_id) REFERENCES source_files(id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS columns (
                id TEXT PRIMARY KEY,
                sheet_id TEXT NOT NULL,
                name TEXT NOT NULL,
                ordinal INTEGER NOT NULL,
                inferred_type TEXT NOT NULL,
                effective_type TEXT NOT NULL,
                type_override_reason TEXT,
                is_all_null INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY(sheet_id) REFERENCES sheets(id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS column_profiles (
                id TEXT PRIMARY KEY,
                column_id TEXT NOT NULL,
                null_ratio REAL NOT NULL,
                distinct_count INTEGER NOT NULL,
                uniqueness_ratio REAL NOT NULL,
                duplicate_signature TEXT,
                numeric_min REAL,
                numeric_max REAL,
                date_min TEXT,
                date_max TEXT,
                top_k_values_json TEXT NOT NULL,
                warnings_json TEXT NOT NULL,
                sampled INTEGER NOT NULL DEFAULT 0,
                sample_size INTEGER,
                sample_seed INTEGER,
                computed_at TEXT NOT NULL,
                FOREIGN KEY(column_id) REFERENCES columns(id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS role_assignments (
                id TEXT PRIMARY KEY,
                column_id TEXT NOT NULL,
                role TEXT NOT NULL,
                accepted INTEGER NOT NULL,
                override_used INTEGER NOT NULL,
                override_reason TEXT,
                assigned_by TEXT,
                assigned_at TEXT NOT NULL,
                FOREIGN KEY(column_id) REFERENCES columns(id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS override_logs (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                target_kind TEXT NOT NULL,
                target_id TEXT NOT NULL,
                old_value_json TEXT NOT NULL,
                new_value_json TEXT NOT NULL,
                reason TEXT NOT NULL,
                actor TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS manifest_snapshots (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                manifest_version INTEGER NOT NULL,
                manifest_json TEXT NOT NULL,
                manifest_hash TEXT NOT NULL,
                exported_at TEXT NOT NULL,
                FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
                table_id TEXT NOT NULL,
                filename TEXT NOT NULL,
                extension TEXT NOT NULL,
                version INTEGER NOT NULL,
                parquet_path TEXT NOT NULL,
                row_count INTEGER NOT NULL,
                schema_hash TEXT NOT NULL,
                schema_changed INTEGER NOT NULL DEFAULT 0,
                uploaded_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS file_schemas (
                id TEXT PRIMARY KEY,
                file_id TEXT NOT NULL,
                column_name TEXT NOT NULL,
                data_type TEXT NOT NULL,
                is_nullable INTEGER NOT NULL,
                ordinal INTEGER NOT NULL,
                FOREIGN KEY(file_id) REFERENCES files(id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS relationship_rules (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                from_column_id TEXT NOT NULL,
                to_column_id TEXT NOT NULL,
                join_type TEXT NOT NULL,
                rel_type TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'suggested',
                overlap_pct REAL,
                cardinality TEXT,
                low_overlap_acknowledged INTEGER NOT NULL DEFAULT 0,
                override_reason TEXT,
                actor TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
                FOREIGN KEY(from_column_id) REFERENCES columns(id),
                FOREIGN KEY(to_column_id) REFERENCES columns(id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS relationship_audit (
                id TEXT PRIMARY KEY,
                relationship_id TEXT NOT NULL,
                action TEXT NOT NULL,
                old_status TEXT,
                new_status TEXT NOT NULL,
                reason TEXT,
                actor TEXT,
                timestamp TEXT NOT NULL,
                FOREIGN KEY(relationship_id) REFERENCES relationship_rules(id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS saved_queries (
                query_id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                query_config TEXT NOT NULL,
                config_hash TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                last_executed_at TEXT,
                created_by TEXT,
                FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS query_execution_log (
                execution_id TEXT PRIMARY KEY,
                query_id TEXT,
                workspace_id TEXT NOT NULL,
                state TEXT NOT NULL,
                result_row_count INTEGER,
                result_column_count INTEGER,
                execution_time_ms INTEGER,
                is_preview INTEGER NOT NULL DEFAULT 0,
                error_message TEXT,
                error_code TEXT,
                lineage_metadata TEXT NOT NULL,
                query_config_snapshot TEXT NOT NULL,
                executed_at TEXT NOT NULL,
                FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
                FOREIGN KEY(query_id) REFERENCES saved_queries(query_id)
            )
            """
        )
        conn.execute("DROP TABLE IF EXISTS relationships")
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_files_filename_version
            ON files(filename, version)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_file_schemas_file_id
            ON file_schemas(file_id)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_relationship_rules_workspace
            ON relationship_rules(workspace_id)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_relationship_rules_status
            ON relationship_rules(workspace_id, status)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_relationship_rules_columns
            ON relationship_rules(from_column_id, to_column_id)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_relationship_audit_timeline
            ON relationship_audit(relationship_id, timestamp)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_source_files_workspace
            ON source_files(workspace_id)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_sheets_source
            ON sheets(source_file_id)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_columns_sheet
            ON columns(sheet_id)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_profiles_column
            ON column_profiles(column_id)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_roles_column
            ON role_assignments(column_id)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_saved_queries_workspace
            ON saved_queries(workspace_id)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_saved_queries_created_at
            ON saved_queries(created_at DESC)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_query_execution_workspace
            ON query_execution_log(workspace_id)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_query_execution_query
            ON query_execution_log(query_id)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_query_execution_timeline
            ON query_execution_log(executed_at DESC)
            """
        )


@contextmanager
def get_connection(db_path: Path) -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def persist_role_assignment(
    conn: sqlite3.Connection,
    *,
    workspace_id: str,
    column_id: str,
    role: str,
    override_used: bool,
    override_reason: str | None,
    assigned_by: str,
    assigned_at: str,
) -> None:
    conn.execute(
        """
        INSERT INTO role_assignments (
            id, column_id, role, accepted, override_used,
            override_reason, assigned_by, assigned_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            str(uuid.uuid4()),
            column_id,
            role,
            1,
            int(override_used),
            override_reason,
            assigned_by,
            assigned_at,
        ),
    )

    if not override_used or not override_reason:
        return

    old_value_json = json.dumps(
        {"override_reason": None, "override_used": False, "role": role},
        separators=(",", ":"),
        sort_keys=True,
    )
    new_value_json = json.dumps(
        {
            "override_reason": override_reason,
            "override_used": True,
            "role": role,
        },
        separators=(",", ":"),
        sort_keys=True,
    )
    conn.execute(
        """
        INSERT INTO override_logs (
            id, workspace_id, target_kind, target_id,
            old_value_json, new_value_json, reason, actor, created_at
        ) VALUES (?, ?, 'role_assignment', ?, ?, ?, ?, ?, ?)
        """,
        (
            str(uuid.uuid4()),
            workspace_id,
            column_id,
            old_value_json,
            new_value_json,
            override_reason,
            assigned_by,
            assigned_at,
        ),
    )


def persist_manifest_snapshot(
    conn: sqlite3.Connection,
    *,
    workspace_id: str,
    manifest_version: int,
    manifest_json: str,
    manifest_hash: str,
    exported_at: str,
) -> None:
    conn.execute(
        """
        INSERT INTO manifest_snapshots (
            id, workspace_id, manifest_version, manifest_json, manifest_hash, exported_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            str(uuid.uuid4()),
            workspace_id,
            manifest_version,
            manifest_json,
            manifest_hash,
            exported_at,
        ),
    )
