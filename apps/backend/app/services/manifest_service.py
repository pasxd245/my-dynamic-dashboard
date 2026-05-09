from __future__ import annotations

import hashlib
import json
import sqlite3
from typing import Any
import uuid


def canonical_json(payload: Any) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def compute_manifest_hash(manifest: dict) -> str:
    return sha256_text(canonical_json(manifest))


def compute_source_hash(file_bytes: bytes) -> str:
    return sha256_bytes(file_bytes)


def _rows_to_dicts(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]


def export_workspace_manifest(conn: sqlite3.Connection, workspace_id: str) -> dict[str, Any]:
    workspace_row = conn.execute(
        """
        SELECT name, status, manifest_version
        FROM workspaces
        WHERE id = ?
        """,
        (workspace_id,),
    ).fetchone()
    if workspace_row is None:
        raise ValueError("Workspace not found")

    source_files = _rows_to_dicts(
        conn.execute(
            """
            SELECT filename_original, extension, content_hash, encoding_detected,
                   parse_status, reject_reason, uploaded_at
            FROM source_files
            WHERE workspace_id = ?
            ORDER BY filename_original ASC, uploaded_at ASC
            """,
            (workspace_id,),
        ).fetchall()
    )
    sheets = _rows_to_dicts(
        conn.execute(
            """
            SELECT sf.filename_original, s.sheet_name, s.header_row_detected,
                   s.header_row_effective, s.data_range_detected,
                   s.data_range_effective, s.multi_range_warning, s.committed_at
            FROM sheets s
            JOIN source_files sf ON sf.id = s.source_file_id
            WHERE sf.workspace_id = ?
            ORDER BY sf.filename_original ASC, s.sheet_name ASC
            """,
            (workspace_id,),
        ).fetchall()
    )
    columns = _rows_to_dicts(
        conn.execute(
            """
            SELECT sf.filename_original, s.sheet_name, c.name, c.ordinal,
                   c.inferred_type, c.effective_type, c.type_override_reason,
                   c.is_all_null
            FROM columns c
            JOIN sheets s ON s.id = c.sheet_id
            JOIN source_files sf ON sf.id = s.source_file_id
            WHERE sf.workspace_id = ?
            ORDER BY sf.filename_original ASC, s.sheet_name ASC, c.ordinal ASC
            """,
            (workspace_id,),
        ).fetchall()
    )
    profiles = _rows_to_dicts(
        conn.execute(
            """
            SELECT sf.filename_original, s.sheet_name, c.name AS column_name,
                   c.ordinal AS column_ordinal, cp.null_ratio, cp.distinct_count,
                   cp.uniqueness_ratio, cp.duplicate_signature, cp.numeric_min,
                   cp.numeric_max, cp.date_min, cp.date_max, cp.top_k_values_json,
                   cp.warnings_json, cp.sampled, cp.sample_size, cp.sample_seed,
                   cp.computed_at
            FROM column_profiles cp
            JOIN columns c ON c.id = cp.column_id
            JOIN sheets s ON s.id = c.sheet_id
            JOIN source_files sf ON sf.id = s.source_file_id
            WHERE sf.workspace_id = ?
            ORDER BY sf.filename_original ASC, s.sheet_name ASC, c.ordinal ASC, cp.computed_at ASC
            """,
            (workspace_id,),
        ).fetchall()
    )
    roles = _rows_to_dicts(
        conn.execute(
            """
            SELECT sf.filename_original, s.sheet_name, c.name AS column_name,
                   c.ordinal AS column_ordinal, ra.role, ra.accepted,
                   ra.override_used, ra.override_reason, ra.assigned_by,
                   ra.assigned_at
            FROM role_assignments ra
            JOIN columns c ON c.id = ra.column_id
            JOIN sheets s ON s.id = c.sheet_id
            JOIN source_files sf ON sf.id = s.source_file_id
            WHERE sf.workspace_id = ?
            ORDER BY sf.filename_original ASC, s.sheet_name ASC, c.ordinal ASC, ra.role ASC, ra.assigned_at ASC
            """,
            (workspace_id,),
        ).fetchall()
    )

    override_rows = conn.execute(
        """
        SELECT ol.target_kind, ol.target_id, ol.old_value_json, ol.new_value_json,
               ol.reason, ol.actor, ol.created_at,
               s.sheet_name, sf_sheet.filename_original AS sheet_filename,
               c.name AS column_name, c.ordinal AS column_ordinal,
               sf_column.filename_original AS column_filename,
               sheet_for_column.sheet_name AS column_sheet_name
        FROM override_logs ol
        LEFT JOIN sheets s ON s.id = ol.target_id AND ol.target_kind = 'sheet_range'
        LEFT JOIN source_files sf_sheet ON sf_sheet.id = s.source_file_id
        LEFT JOIN columns c ON c.id = ol.target_id AND ol.target_kind = 'role_assignment'
        LEFT JOIN sheets sheet_for_column ON sheet_for_column.id = c.sheet_id
        LEFT JOIN source_files sf_column ON sf_column.id = sheet_for_column.source_file_id
        WHERE ol.workspace_id = ?
        ORDER BY ol.created_at ASC, ol.target_kind ASC
        """,
        (workspace_id,),
    ).fetchall()

    overrides: list[dict[str, Any]] = []
    for row in override_rows:
        target_ref: dict[str, Any] | str
        if row["target_kind"] == "sheet_range":
            target_ref = {
                "filename_original": row["sheet_filename"],
                "sheet_name": row["sheet_name"],
            }
        elif row["target_kind"] == "role_assignment":
            target_ref = {
                "filename_original": row["column_filename"],
                "sheet_name": row["column_sheet_name"],
                "column_name": row["column_name"],
                "column_ordinal": row["column_ordinal"],
            }
        else:
            target_ref = str(row["target_id"])

        overrides.append(
            {
                "target_kind": row["target_kind"],
                "target_ref": target_ref,
                "old_value_json": row["old_value_json"],
                "new_value_json": row["new_value_json"],
                "reason": row["reason"],
                "actor": row["actor"],
                "created_at": row["created_at"],
            }
        )

    manifest_payload = {
        "version": 1,
        "workspace": {
            "name": workspace_row["name"],
            "status": workspace_row["status"],
            "manifest_version": workspace_row["manifest_version"],
        },
        "source_files": source_files,
        "sheets": sheets,
        "columns": columns,
        "profiles": profiles,
        "roles": roles,
        "overrides": overrides,
    }
    return {
        **manifest_payload,
        "manifest_hash": compute_manifest_hash(manifest_payload),
    }


def split_manifest_hash(manifest: dict[str, Any]) -> tuple[dict[str, Any], str | None]:
    payload = {key: value for key, value in manifest.items() if key != "manifest_hash"}
    return payload, manifest.get("manifest_hash")


def validate_manifest_hash(manifest: dict[str, Any]) -> None:
    payload, provided_hash = split_manifest_hash(manifest)
    if provided_hash is None:
        return

    actual_hash = compute_manifest_hash(payload)
    if provided_hash != actual_hash:
        raise ValueError("Manifest hash does not match payload")


def collect_source_hash_mismatches(
    conn: sqlite3.Connection,
    manifest: dict[str, Any],
) -> list[dict[str, str]]:
    mismatches: list[dict[str, str]] = []

    for source_file in manifest.get("source_files", []):
        filename_original = str(source_file["filename_original"])
        expected_hash = str(source_file["content_hash"])
        latest_row = conn.execute(
            """
            SELECT content_hash
            FROM source_files
            WHERE filename_original = ?
            ORDER BY uploaded_at DESC
            LIMIT 1
            """,
            (filename_original,),
        ).fetchone()

        actual_hash = "missing" if latest_row is None else str(latest_row["content_hash"])
        if actual_hash != expected_hash:
            mismatches.append(
                {
                    "filename_original": filename_original,
                    "expected_hash": expected_hash,
                    "actual_hash": actual_hash,
                }
            )

    return mismatches


def import_workspace_manifest(
    conn: sqlite3.Connection,
    manifest: dict[str, Any],
    *,
    imported_at: str,
) -> dict[str, Any]:
    workspace_id = str(uuid.uuid4())
    workspace_payload = manifest["workspace"]
    manifest_version = int(workspace_payload["manifest_version"])
    payload_without_hash, _ = split_manifest_hash(manifest)
    manifest_hash = compute_manifest_hash(payload_without_hash)

    conn.execute(
        """
        INSERT INTO workspaces (id, name, status, manifest_version, content_hash, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            workspace_id,
            workspace_payload["name"],
            workspace_payload["status"],
            manifest_version,
            manifest_hash,
            imported_at,
            imported_at,
        ),
    )

    source_ids: dict[str, str] = {}
    for source_file in manifest.get("source_files", []):
        source_id = str(uuid.uuid4())
        filename_original = str(source_file["filename_original"])
        source_ids[filename_original] = source_id
        conn.execute(
            """
            INSERT INTO source_files (
                id, workspace_id, filename_original, extension, content_hash,
                encoding_detected, parse_status, reject_reason, uploaded_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                source_id,
                workspace_id,
                filename_original,
                source_file["extension"],
                source_file["content_hash"],
                source_file.get("encoding_detected"),
                source_file["parse_status"],
                source_file.get("reject_reason"),
                source_file["uploaded_at"],
            ),
        )

    sheet_ids: dict[tuple[str, str], str] = {}
    for sheet in manifest.get("sheets", []):
        sheet_id = str(uuid.uuid4())
        sheet_key = (str(sheet["filename_original"]), str(sheet["sheet_name"]))
        sheet_ids[sheet_key] = sheet_id
        conn.execute(
            """
            INSERT INTO sheets (
                id, source_file_id, sheet_name, header_row_detected,
                header_row_effective, data_range_detected, data_range_effective,
                multi_range_warning, committed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                sheet_id,
                source_ids[sheet_key[0]],
                sheet_key[1],
                sheet["header_row_detected"],
                sheet["header_row_effective"],
                sheet["data_range_detected"],
                sheet["data_range_effective"],
                sheet["multi_range_warning"],
                sheet["committed_at"],
            ),
        )

    column_ids: dict[tuple[str, str, str, int], str] = {}
    for column in manifest.get("columns", []):
        column_id = str(uuid.uuid4())
        column_key = (
            str(column["filename_original"]),
            str(column["sheet_name"]),
            str(column["name"]),
            int(column["ordinal"]),
        )
        column_ids[column_key] = column_id
        conn.execute(
            """
            INSERT INTO columns (
                id, sheet_id, name, ordinal, inferred_type, effective_type,
                type_override_reason, is_all_null
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                column_id,
                sheet_ids[(column_key[0], column_key[1])],
                column_key[2],
                column_key[3],
                column["inferred_type"],
                column["effective_type"],
                column.get("type_override_reason"),
                column["is_all_null"],
            ),
        )

    for profile in manifest.get("profiles", []):
        column_key = (
            str(profile["filename_original"]),
            str(profile["sheet_name"]),
            str(profile["column_name"]),
            int(profile["column_ordinal"]),
        )
        conn.execute(
            """
            INSERT INTO column_profiles (
                id, column_id, null_ratio, distinct_count, uniqueness_ratio,
                duplicate_signature, numeric_min, numeric_max, date_min, date_max,
                top_k_values_json, warnings_json, sampled, sample_size, sample_seed, computed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                column_ids[column_key],
                profile["null_ratio"],
                profile["distinct_count"],
                profile["uniqueness_ratio"],
                profile["duplicate_signature"],
                profile.get("numeric_min"),
                profile.get("numeric_max"),
                profile.get("date_min"),
                profile.get("date_max"),
                profile["top_k_values_json"],
                profile["warnings_json"],
                profile["sampled"],
                profile.get("sample_size"),
                profile.get("sample_seed"),
                profile["computed_at"],
            ),
        )

    for role in manifest.get("roles", []):
        column_key = (
            str(role["filename_original"]),
            str(role["sheet_name"]),
            str(role["column_name"]),
            int(role["column_ordinal"]),
        )
        conn.execute(
            """
            INSERT INTO role_assignments (
                id, column_id, role, accepted, override_used,
                override_reason, assigned_by, assigned_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                column_ids[column_key],
                role["role"],
                role["accepted"],
                role["override_used"],
                role.get("override_reason"),
                role.get("assigned_by"),
                role["assigned_at"],
            ),
        )

    for override in manifest.get("overrides", []):
        target_kind = str(override["target_kind"])
        target_ref = override["target_ref"]
        if target_kind == "sheet_range":
            target_id = sheet_ids[
                (str(target_ref["filename_original"]), str(target_ref["sheet_name"]))
            ]
        elif target_kind == "role_assignment":
            target_id = column_ids[
                (
                    str(target_ref["filename_original"]),
                    str(target_ref["sheet_name"]),
                    str(target_ref["column_name"]),
                    int(target_ref["column_ordinal"]),
                )
            ]
        else:
            target_id = str(target_ref)

        conn.execute(
            """
            INSERT INTO override_logs (
                id, workspace_id, target_kind, target_id,
                old_value_json, new_value_json, reason, actor, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                workspace_id,
                target_kind,
                target_id,
                override["old_value_json"],
                override["new_value_json"],
                override["reason"],
                override.get("actor"),
                override["created_at"],
            ),
        )

    return {
        "id": workspace_id,
        "name": str(workspace_payload["name"]),
        "status": str(workspace_payload["status"]),
        "manifest_version": manifest_version,
        "manifest_hash": manifest_hash,
    }
