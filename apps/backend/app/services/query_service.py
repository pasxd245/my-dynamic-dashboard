from __future__ import annotations

import hashlib
import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from app.schemas import (
    ExecutionHistoryItem,
    ExecutionHistoryResponse,
    LoadSavedQueryResponse,
    RecoveryWindowResponse,
    SaveQueryRequest,
    SaveQueryResponse,
    SavedQueryDetailResponse,
    SavedQueryLibraryResponse,
    SavedQuerySummary,
    SavedQueryValidationIssue,
    SavedQueryVersionResponse,
)


GRACE_PERIOD_HOURS = 24


def _utc_now() -> datetime:
    return datetime.now(tz=timezone.utc)


def _utc_now_iso() -> str:
    return _utc_now().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _normalize_tags(tags: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for t in tags:
        normalized = t.strip().lower()
        if normalized and normalized not in seen:
            seen.add(normalized)
            result.append(normalized)
    return result


def _tags_to_json(tags: list[str]) -> str:
    return json.dumps(tags, separators=(",", ":"))


def _tags_from_json(tags_json: str | None) -> list[str]:
    if not tags_json:
        return []
    try:
        return json.loads(tags_json)
    except (json.JSONDecodeError, TypeError):
        return []


def _snapshot_hash(snapshot: dict[str, Any]) -> str:
    serialized = json.dumps(snapshot, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode()).hexdigest()[:16]


def _version_row_to_response(row: Any) -> SavedQueryVersionResponse:
    snapshot = row["builder_snapshot"]
    if isinstance(snapshot, str):
        try:
            snapshot = json.loads(snapshot)
        except (json.JSONDecodeError, TypeError):
            snapshot = {}
    return SavedQueryVersionResponse(
        version_id=str(row["version_id"]),
        query_id=str(row["query_id"]),
        version_number=int(row["version_number"]),
        parent_version_id=row["parent_version_id"],
        builder_snapshot=snapshot,
        sql_snapshot=row["sql_snapshot"],
        validation_state=str(row["validation_state"]),
        created_at=str(row["created_at"]),
        created_by=row["created_by"],
        change_summary=row["change_summary"],
    )


def _query_row_to_summary(row: Any) -> SavedQuerySummary:
    return SavedQuerySummary(
        query_id=str(row["query_id"]),
        workspace_id=str(row["workspace_id"]),
        name=str(row["name"]),
        description=row["description"],
        tags=_tags_from_json(row["tags_json"]) if "tags_json" in row.keys() else [],
        version_count=int(row["version_count"]) if row["version_count"] is not None else 1,
        execution_count=int(row["execution_count"]) if row["execution_count"] is not None else 0,
        created_at=str(row["created_at"]),
        updated_at=str(row["updated_at"]),
        last_executed_at=row["last_executed_at"],
        created_by=row["created_by"],
        deleted_at=row["deleted_at"] if "deleted_at" in row.keys() else None,
        recoverable_until=row["recoverable_until"] if "recoverable_until" in row.keys() else None,
    )


class SchemaValidator:
    """Revalidates a saved query builder snapshot against current workspace schema."""

    def __init__(self, conn: Any) -> None:
        self._conn = conn

    def validate_base_table(self, base_table_id: str) -> SavedQueryValidationIssue | None:
        row = self._conn.execute(
            "SELECT id FROM files WHERE id = ?", (base_table_id,)
        ).fetchone()
        if row is None:
            return SavedQueryValidationIssue(
                type="base_table_missing",
                field_id=base_table_id,
                message=f"Base table '{base_table_id}' no longer exists in the workspace.",
            )
        return None

    def validate_columns(self, selected_columns: list[dict[str, Any]]) -> list[SavedQueryValidationIssue]:
        issues: list[SavedQueryValidationIssue] = []
        for col in selected_columns:
            table_id = col.get("table_id", "")
            col_name = col.get("column_name", "")
            if not table_id or not col_name:
                continue
            row = self._conn.execute(
                """
                SELECT c.id FROM columns c
                JOIN sheets s ON c.sheet_id = s.id
                JOIN source_files sf ON s.source_file_id = sf.id
                JOIN files f ON f.filename = sf.filename_original
                WHERE f.id = ? AND c.name = ?
                """,
                (table_id, col_name),
            ).fetchone()
            if row is None:
                issues.append(SavedQueryValidationIssue(
                    type="column_deleted",
                    field_id=f"{table_id}.{col_name}",
                    message=f"Column '{col_name}' in table '{table_id}' no longer exists.",
                ))
        return issues

    def validate_relationships(self, joins: list[dict[str, Any]]) -> list[SavedQueryValidationIssue]:
        issues: list[SavedQueryValidationIssue] = []
        for j in joins:
            rule_id = j.get("relationship_rule_id", "")
            if not rule_id:
                continue
            row = self._conn.execute(
                "SELECT status FROM relationship_rules WHERE id = ?", (rule_id,)
            ).fetchone()
            if row is None:
                issues.append(SavedQueryValidationIssue(
                    type="relationship_downgraded",
                    field_id=rule_id,
                    message=f"Relationship rule '{rule_id}' no longer exists.",
                ))
            elif row["status"] not in ("approved",):
                issues.append(SavedQueryValidationIssue(
                    type="relationship_downgraded",
                    field_id=rule_id,
                    message=f"Relationship rule '{rule_id}' status changed to '{row['status']}'.",
                ))
        return issues


@dataclass
class SavedQueryService:
    db_path: Path

    def _get_conn(self) -> Any:
        import sqlite3
        from app.core.metadata_db import get_connection
        return get_connection(self.db_path)

    def create_query(
        self,
        *,
        workspace_id: str,
        request: SaveQueryRequest,
    ) -> SaveQueryResponse:
        from app.core.metadata_db import get_connection
        now = _utc_now_iso()
        query_id = str(uuid.uuid4())
        version_id = str(uuid.uuid4())
        tags = _normalize_tags(request.tags)
        tags_json = _tags_to_json(tags)
        snapshot_json = json.dumps(request.builder_snapshot, separators=(",", ":"))
        config_hash = _snapshot_hash(request.builder_snapshot)

        with get_connection(self.db_path) as conn:
            # Check for duplicate name within workspace (active queries only)
            existing = conn.execute(
                "SELECT query_id FROM saved_queries WHERE workspace_id = ? AND name = ? AND deleted_at IS NULL",
                (workspace_id, request.name),
            ).fetchone()
            if existing:
                raise DuplicateQueryNameError(request.name)

            conn.execute(
                """
                INSERT INTO saved_queries (
                    query_id, workspace_id, name, description, query_config, config_hash,
                    created_at, updated_at, last_executed_at, created_by,
                    tags_json, deleted_at, recoverable_until, version_count, execution_count, source_query_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, NULL, 1, 0, NULL)
                """,
                (query_id, workspace_id, request.name, request.description,
                 snapshot_json, config_hash, now, now, request.created_by, tags_json),
            )
            conn.execute(
                """
                INSERT INTO saved_query_versions (
                    version_id, query_id, version_number, parent_version_id,
                    builder_snapshot, sql_snapshot, validation_state, created_at, created_by, change_summary
                ) VALUES (?, ?, 1, NULL, ?, NULL, 'valid', ?, ?, ?)
                """,
                (version_id, query_id, snapshot_json, now, request.created_by, request.change_summary),
            )
            conn.execute(
                """
                INSERT INTO saved_query_events (event_id, query_id, version_id, event_type, occurred_at, performed_by, metadata_json)
                VALUES (?, ?, ?, 'created', ?, ?, NULL)
                """,
                (str(uuid.uuid4()), query_id, version_id, now, request.created_by),
            )

        return SaveQueryResponse(
            query_id=query_id,
            workspace_id=workspace_id,
            name=request.name,
            description=request.description,
            tags=tags,
            version_id=version_id,
            version_number=1,
            created_at=now,
            updated_at=now,
            created_by=request.created_by,
        )

    def list_queries(
        self,
        *,
        workspace_id: str,
        state: str = "active",
        tag: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> SavedQueryLibraryResponse:
        from app.core.metadata_db import get_connection

        params: list[Any] = [workspace_id]
        where_clauses = ["workspace_id = ?"]

        if state == "active":
            where_clauses.append("deleted_at IS NULL")
        elif state == "deleted":
            where_clauses.append("deleted_at IS NOT NULL")
        # else "all" — no filter

        if tag:
            normalized_tag = tag.strip().lower()
            where_clauses.append("tags_json LIKE ?")
            params.append(f"%{normalized_tag}%")

        where_sql = " AND ".join(where_clauses)

        with get_connection(self.db_path) as conn:
            total_row = conn.execute(
                f"SELECT COUNT(*) FROM saved_queries WHERE {where_sql}", params
            ).fetchone()
            total = int(total_row[0])

            rows = conn.execute(
                f"""
                SELECT * FROM saved_queries WHERE {where_sql}
                ORDER BY updated_at DESC
                LIMIT ? OFFSET ?
                """,
                [*params, limit, offset],
            ).fetchall()

        items = [_query_row_to_summary(r) for r in rows]
        next_offset = offset + limit if offset + limit < total else None
        return SavedQueryLibraryResponse(
            items=items, total=total, limit=limit, offset=offset, next_offset=next_offset
        )

    def search_queries(
        self,
        *,
        workspace_id: str,
        q: str,
        state: str = "active",
        tag: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> SavedQueryLibraryResponse:
        from app.core.metadata_db import get_connection

        pattern = f"%{q}%"
        params: list[Any] = [workspace_id, pattern, pattern, pattern]
        where_clauses = [
            "workspace_id = ?",
            "(name LIKE ? OR description LIKE ? OR tags_json LIKE ?)",
        ]

        if state == "active":
            where_clauses.append("deleted_at IS NULL")
        elif state == "deleted":
            where_clauses.append("deleted_at IS NOT NULL")

        if tag:
            normalized_tag = tag.strip().lower()
            where_clauses.append("tags_json LIKE ?")
            params.append(f"%{normalized_tag}%")

        where_sql = " AND ".join(where_clauses)

        with get_connection(self.db_path) as conn:
            total_row = conn.execute(
                f"SELECT COUNT(*) FROM saved_queries WHERE {where_sql}", params
            ).fetchone()
            total = int(total_row[0])

            rows = conn.execute(
                f"""
                SELECT * FROM saved_queries WHERE {where_sql}
                ORDER BY updated_at DESC
                LIMIT ? OFFSET ?
                """,
                [*params, limit, offset],
            ).fetchall()

        items = [_query_row_to_summary(r) for r in rows]
        next_offset = offset + limit if offset + limit < total else None
        return SavedQueryLibraryResponse(
            items=items, total=total, limit=limit, offset=offset, next_offset=next_offset
        )

    def get_query_detail(self, *, workspace_id: str, query_id: str) -> SavedQueryDetailResponse:
        from app.core.metadata_db import get_connection

        with get_connection(self.db_path) as conn:
            row = conn.execute(
                "SELECT * FROM saved_queries WHERE query_id = ? AND workspace_id = ?",
                (query_id, workspace_id),
            ).fetchone()
            if row is None:
                raise QueryNotFoundError(query_id)

            version_rows = conn.execute(
                "SELECT * FROM saved_query_versions WHERE query_id = ? ORDER BY version_number DESC",
                (query_id,),
            ).fetchall()

        versions = [_version_row_to_response(v) for v in version_rows]
        latest_version = versions[0] if versions else None

        summary = _query_row_to_summary(row)
        return SavedQueryDetailResponse(
            query_id=summary.query_id,
            workspace_id=summary.workspace_id,
            name=summary.name,
            description=summary.description,
            tags=summary.tags,
            version_count=summary.version_count,
            execution_count=summary.execution_count,
            created_at=summary.created_at,
            updated_at=summary.updated_at,
            last_executed_at=summary.last_executed_at,
            created_by=summary.created_by,
            deleted_at=summary.deleted_at,
            recoverable_until=summary.recoverable_until,
            latest_version=latest_version,
            versions=versions,
        )

    def load_query(
        self, *, workspace_id: str, query_id: str, version_id: str | None = None
    ) -> LoadSavedQueryResponse:
        from app.core.metadata_db import get_connection

        with get_connection(self.db_path) as conn:
            qrow = conn.execute(
                "SELECT * FROM saved_queries WHERE query_id = ? AND workspace_id = ?",
                (query_id, workspace_id),
            ).fetchone()
            if qrow is None:
                raise QueryNotFoundError(query_id)

            if version_id:
                vrow = conn.execute(
                    "SELECT * FROM saved_query_versions WHERE version_id = ? AND query_id = ?",
                    (version_id, query_id),
                ).fetchone()
            else:
                vrow = conn.execute(
                    "SELECT * FROM saved_query_versions WHERE query_id = ? ORDER BY version_number DESC LIMIT 1",
                    (query_id,),
                ).fetchone()

            if vrow is None:
                raise QueryNotFoundError(query_id)

            snapshot_raw = vrow["builder_snapshot"]
            if isinstance(snapshot_raw, str):
                try:
                    snapshot = json.loads(snapshot_raw)
                except (json.JSONDecodeError, TypeError):
                    snapshot = {}
            else:
                snapshot = snapshot_raw

            validator = SchemaValidator(conn)
            issues: list[SavedQueryValidationIssue] = []

            base_table_id = snapshot.get("base_table_id", "")
            if base_table_id:
                issue = validator.validate_base_table(base_table_id)
                if issue:
                    issues.append(issue)
                    return LoadSavedQueryResponse(
                        query_id=query_id,
                        version_id=str(vrow["version_id"]),
                        version_number=int(vrow["version_number"]),
                        builder_snapshot=snapshot,
                        validation_issues=issues,
                        can_load=False,
                    )

            issues.extend(validator.validate_columns(snapshot.get("selected_columns", [])))
            issues.extend(validator.validate_relationships(snapshot.get("joins", [])))

        return LoadSavedQueryResponse(
            query_id=query_id,
            version_id=str(vrow["version_id"]),
            version_number=int(vrow["version_number"]),
            builder_snapshot=snapshot,
            validation_issues=issues,
            can_load=True,
        )

    def duplicate_query(
        self,
        *,
        workspace_id: str,
        query_id: str,
        name: str,
        description: str | None = None,
        tags: list[str] | None = None,
        created_by: str | None = None,
    ) -> SaveQueryResponse:
        from app.core.metadata_db import get_connection

        now = _utc_now_iso()
        new_query_id = str(uuid.uuid4())
        new_version_id = str(uuid.uuid4())

        with get_connection(self.db_path) as conn:
            src = conn.execute(
                "SELECT * FROM saved_queries WHERE query_id = ? AND workspace_id = ?",
                (query_id, workspace_id),
            ).fetchone()
            if src is None:
                raise QueryNotFoundError(query_id)

            vrow = conn.execute(
                "SELECT * FROM saved_query_versions WHERE query_id = ? ORDER BY version_number DESC LIMIT 1",
                (query_id,),
            ).fetchone()
            if vrow is None:
                raise QueryNotFoundError(query_id)

            # check name collision
            dup_check = conn.execute(
                "SELECT query_id FROM saved_queries WHERE workspace_id = ? AND name = ? AND deleted_at IS NULL",
                (workspace_id, name),
            ).fetchone()
            if dup_check:
                raise DuplicateQueryNameError(name)

            resolved_tags = _normalize_tags(tags if tags is not None else _tags_from_json(src["tags_json"]))
            tags_json = _tags_to_json(resolved_tags)
            snapshot_json = vrow["builder_snapshot"]

            conn.execute(
                """
                INSERT INTO saved_queries (
                    query_id, workspace_id, name, description, query_config, config_hash,
                    created_at, updated_at, last_executed_at, created_by,
                    tags_json, deleted_at, recoverable_until, version_count, execution_count, source_query_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, NULL, 1, 0, ?)
                """,
                (new_query_id, workspace_id, name, description or src["description"],
                 snapshot_json, _snapshot_hash(json.loads(snapshot_json) if isinstance(snapshot_json, str) else snapshot_json),
                 now, now, created_by, tags_json, query_id),
            )
            conn.execute(
                """
                INSERT INTO saved_query_versions (
                    version_id, query_id, version_number, parent_version_id,
                    builder_snapshot, sql_snapshot, validation_state, created_at, created_by, change_summary
                ) VALUES (?, ?, 1, NULL, ?, ?, 'valid', ?, ?, 'Duplicated from source query')
                """,
                (new_version_id, new_query_id, snapshot_json, vrow["sql_snapshot"], now, created_by),
            )
            conn.execute(
                """
                INSERT INTO saved_query_events (event_id, query_id, version_id, event_type, occurred_at, performed_by, metadata_json)
                VALUES (?, ?, ?, 'duplicated', ?, ?, ?)
                """,
                (str(uuid.uuid4()), new_query_id, new_version_id, now, created_by,
                 json.dumps({"source_query_id": query_id})),
            )

        return SaveQueryResponse(
            query_id=new_query_id,
            workspace_id=workspace_id,
            name=name,
            description=description or (src["description"] if src["description"] else None),
            tags=resolved_tags,
            version_id=new_version_id,
            version_number=1,
            created_at=now,
            updated_at=now,
            created_by=created_by,
        )

    def update_query(
        self,
        *,
        workspace_id: str,
        query_id: str,
        name: str | None = None,
        description: str | None = None,
        tags: list[str] | None = None,
        builder_snapshot: dict[str, Any] | None = None,
        change_summary: str | None = None,
        updated_by: str | None = None,
    ) -> SavedQueryDetailResponse:
        from app.core.metadata_db import get_connection

        now = _utc_now_iso()

        with get_connection(self.db_path) as conn:
            row = conn.execute(
                "SELECT * FROM saved_queries WHERE query_id = ? AND workspace_id = ? AND deleted_at IS NULL",
                (query_id, workspace_id),
            ).fetchone()
            if row is None:
                raise QueryNotFoundError(query_id)

            new_name = name if name is not None else row["name"]
            new_description = description if description is not None else row["description"]
            resolved_tags = _normalize_tags(tags) if tags is not None else _tags_from_json(row["tags_json"])
            tags_json = _tags_to_json(resolved_tags)

            # Check name collision (only if name changed)
            if new_name != row["name"]:
                dup = conn.execute(
                    "SELECT query_id FROM saved_queries WHERE workspace_id = ? AND name = ? AND deleted_at IS NULL AND query_id != ?",
                    (workspace_id, new_name, query_id),
                ).fetchone()
                if dup:
                    raise DuplicateQueryNameError(new_name)

            updates: list[str] = ["name = ?", "description = ?", "tags_json = ?", "updated_at = ?"]
            update_params: list[Any] = [new_name, new_description, tags_json, now]

            new_version_id: str | None = None
            if builder_snapshot is not None:
                # Create a new version
                last_ver = conn.execute(
                    "SELECT version_id, version_number FROM saved_query_versions WHERE query_id = ? ORDER BY version_number DESC LIMIT 1",
                    (query_id,),
                ).fetchone()
                parent_version_id = last_ver["version_id"] if last_ver else None
                new_version_number = (int(last_ver["version_number"]) + 1) if last_ver else 1
                new_version_id = str(uuid.uuid4())
                snapshot_json = json.dumps(builder_snapshot, separators=(",", ":"))
                conn.execute(
                    """
                    INSERT INTO saved_query_versions (
                        version_id, query_id, version_number, parent_version_id,
                        builder_snapshot, sql_snapshot, validation_state, created_at, created_by, change_summary
                    ) VALUES (?, ?, ?, ?, ?, NULL, 'valid', ?, ?, ?)
                    """,
                    (new_version_id, query_id, new_version_number, parent_version_id,
                     snapshot_json, now, updated_by, change_summary),
                )
                updates.append("query_config = ?")
                update_params.append(snapshot_json)
                updates.append("version_count = version_count + 1")
                updates.append("config_hash = ?")
                update_params.append(_snapshot_hash(builder_snapshot))

            update_params.append(query_id)
            conn.execute(
                f"UPDATE saved_queries SET {', '.join(updates)} WHERE query_id = ?",
                update_params,
            )
            conn.execute(
                """
                INSERT INTO saved_query_events (event_id, query_id, version_id, event_type, occurred_at, performed_by, metadata_json)
                VALUES (?, ?, ?, 'updated', ?, ?, NULL)
                """,
                (str(uuid.uuid4()), query_id, new_version_id, now, updated_by),
            )

        return self.get_query_detail(workspace_id=workspace_id, query_id=query_id)

    def delete_query(self, *, workspace_id: str, query_id: str, deleted_by: str | None = None) -> RecoveryWindowResponse:
        from app.core.metadata_db import get_connection

        now = _utc_now()
        now_iso = now.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
        recoverable_until = (now + timedelta(hours=GRACE_PERIOD_HOURS)).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

        with get_connection(self.db_path) as conn:
            row = conn.execute(
                "SELECT query_id FROM saved_queries WHERE query_id = ? AND workspace_id = ? AND deleted_at IS NULL",
                (query_id, workspace_id),
            ).fetchone()
            if row is None:
                raise QueryNotFoundError(query_id)

            conn.execute(
                "UPDATE saved_queries SET deleted_at = ?, recoverable_until = ?, updated_at = ? WHERE query_id = ?",
                (now_iso, recoverable_until, now_iso, query_id),
            )
            conn.execute(
                """
                INSERT INTO saved_query_events (event_id, query_id, version_id, event_type, occurred_at, performed_by, metadata_json)
                VALUES (?, ?, NULL, 'deleted', ?, ?, ?)
                """,
                (str(uuid.uuid4()), query_id, now_iso, deleted_by,
                 json.dumps({"recoverable_until": recoverable_until})),
            )

        expires_in = int(timedelta(hours=GRACE_PERIOD_HOURS).total_seconds())
        return RecoveryWindowResponse(
            query_id=query_id,
            is_deleted=True,
            deleted_at=now_iso,
            recoverable_until=recoverable_until,
            expires_in_seconds=expires_in,
        )

    def restore_query(self, *, workspace_id: str, query_id: str, restored_by: str | None = None) -> SavedQueryDetailResponse:
        from app.core.metadata_db import get_connection

        now = _utc_now()
        now_iso = now.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

        with get_connection(self.db_path) as conn:
            row = conn.execute(
                "SELECT * FROM saved_queries WHERE query_id = ? AND workspace_id = ? AND deleted_at IS NOT NULL",
                (query_id, workspace_id),
            ).fetchone()
            if row is None:
                raise QueryNotFoundError(query_id)

            recoverable_until_str = row["recoverable_until"]
            if recoverable_until_str:
                try:
                    rec_until = datetime.fromisoformat(recoverable_until_str.replace("Z", "+00:00"))
                    if now > rec_until:
                        raise RestoreWindowExpiredError(query_id, recoverable_until_str)
                except ValueError:
                    pass

            conn.execute(
                "UPDATE saved_queries SET deleted_at = NULL, recoverable_until = NULL, updated_at = ? WHERE query_id = ?",
                (now_iso, query_id),
            )
            conn.execute(
                """
                INSERT INTO saved_query_events (event_id, query_id, version_id, event_type, occurred_at, performed_by, metadata_json)
                VALUES (?, ?, NULL, 'restored', ?, ?, NULL)
                """,
                (str(uuid.uuid4()), query_id, now_iso, restored_by),
            )

        return self.get_query_detail(workspace_id=workspace_id, query_id=query_id)

    def record_execution(
        self,
        *,
        query_id: str,
        version_id: str | None = None,
        executed_by: str | None = None,
        status: str = "completed",
        row_count: int | None = None,
        execution_ms: int | None = None,
        error_message: str | None = None,
    ) -> str:
        from app.core.metadata_db import get_connection

        now = _utc_now_iso()
        execution_id = str(uuid.uuid4())

        with get_connection(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO saved_query_executions (execution_id, query_id, version_id, executed_by, status, row_count, execution_ms, executed_at, error_message)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (execution_id, query_id, version_id, executed_by, status, row_count, execution_ms, now, error_message),
            )
            conn.execute(
                "UPDATE saved_queries SET execution_count = execution_count + 1, last_executed_at = ? WHERE query_id = ?",
                (now, query_id),
            )

        return execution_id

    def get_execution_history(
        self,
        *,
        workspace_id: str,
        query_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> ExecutionHistoryResponse:
        from app.core.metadata_db import get_connection

        with get_connection(self.db_path) as conn:
            # verify query belongs to workspace
            qrow = conn.execute(
                "SELECT query_id FROM saved_queries WHERE query_id = ? AND workspace_id = ?",
                (query_id, workspace_id),
            ).fetchone()
            if qrow is None:
                raise QueryNotFoundError(query_id)

            total_row = conn.execute(
                "SELECT COUNT(*) FROM saved_query_executions WHERE query_id = ?", (query_id,)
            ).fetchone()
            total = int(total_row[0])

            rows = conn.execute(
                """
                SELECT e.*, v.version_number
                FROM saved_query_executions e
                LEFT JOIN saved_query_versions v ON e.version_id = v.version_id
                WHERE e.query_id = ?
                ORDER BY e.executed_at DESC
                LIMIT ? OFFSET ?
                """,
                (query_id, limit, offset),
            ).fetchall()

        items = [
            ExecutionHistoryItem(
                execution_id=str(r["execution_id"]),
                query_id=str(r["query_id"]),
                version_id=r["version_id"],
                version_number=r["version_number"] if "version_number" in r.keys() else None,
                executed_at=str(r["executed_at"]),
                executed_by=r["executed_by"],
                status=str(r["status"]),
                row_count=r["row_count"],
                execution_ms=r["execution_ms"],
                error_message=r["error_message"],
            )
            for r in rows
        ]
        return ExecutionHistoryResponse(items=items, total=total, limit=limit, offset=offset)


class QueryNotFoundError(Exception):
    def __init__(self, query_id: str) -> None:
        self.query_id = query_id
        super().__init__(f"Saved query '{query_id}' not found.")


class DuplicateQueryNameError(Exception):
    def __init__(self, name: str) -> None:
        self.name = name
        super().__init__(f"A saved query named '{name}' already exists.")


class RestoreWindowExpiredError(Exception):
    def __init__(self, query_id: str, recoverable_until: str) -> None:
        self.query_id = query_id
        self.recoverable_until = recoverable_until
        super().__init__(f"Recovery window for query '{query_id}' expired at {recoverable_until}.")
