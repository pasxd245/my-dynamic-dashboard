"""Relationship rule service: compute overlap/cardinality, lifecycle, audit."""
from __future__ import annotations

import json
import sqlite3
import uuid
from typing import Any

import duckdb


VALID_JOIN_TYPES = {"inner", "left", "right", "full"}
VALID_REL_TYPES = {"exact_key", "normalized_key", "date_window"}
VALID_STATUSES = {"suggested", "reviewed", "approved", "rejected"}


def compute_overlap_pct(
    conn: sqlite3.Connection,
    from_column_id: str,
    to_column_id: str,
) -> float:
    """Compute overlap using DuckDB distinct intersection / distinct source.

    Falls back to 0.0 when top-k data is unavailable.
    Uses top_k_values_json from column_profiles for fast MVP path.
    """
    from_row = conn.execute(
        "SELECT top_k_values_json FROM column_profiles WHERE column_id = ? ORDER BY computed_at DESC LIMIT 1",
        (from_column_id,),
    ).fetchone()
    to_row = conn.execute(
        "SELECT top_k_values_json FROM column_profiles WHERE column_id = ? ORDER BY computed_at DESC LIMIT 1",
        (to_column_id,),
    ).fetchone()

    if not from_row or not to_row:
        return 0.0

    from_values = [
        item["value"] for item in json.loads(from_row[0]) if item["value"] is not None
    ]
    to_values = [item["value"] for item in json.loads(to_row[0]) if item["value"] is not None]

    if not from_values:
        return 0.0

    duck = duckdb.connect()
    duck.execute("CREATE TEMP TABLE src_vals(v VARCHAR)")
    duck.executemany("INSERT INTO src_vals VALUES (?)", [[str(v)] for v in from_values])
    duck.execute("CREATE TEMP TABLE tgt_vals(v VARCHAR)")
    duck.executemany("INSERT INTO tgt_vals VALUES (?)", [[str(v)] for v in to_values])

    result = duck.execute(
        """
        WITH src AS (SELECT DISTINCT v FROM src_vals),
             tgt AS (SELECT DISTINCT v FROM tgt_vals),
             src_count AS (SELECT COUNT(*) AS c FROM src),
             intersect_count AS (SELECT COUNT(*) AS c FROM src INNER JOIN tgt USING (v))
        SELECT CASE WHEN src_count.c = 0 THEN 0.0
                    ELSE CAST(intersect_count.c AS DOUBLE) / CAST(src_count.c AS DOUBLE)
               END AS overlap_pct
        FROM src_count, intersect_count
        """
    ).fetchone()
    duck.close()

    return float(result[0]) if result else 0.0


def compute_cardinality(
    conn: sqlite3.Connection,
    from_column_id: str,
    to_column_id: str,
) -> str:
    """Derive cardinality from uniqueness_ratio in column_profiles."""
    from_row = conn.execute(
        "SELECT uniqueness_ratio FROM column_profiles WHERE column_id = ? ORDER BY computed_at DESC LIMIT 1",
        (from_column_id,),
    ).fetchone()
    to_row = conn.execute(
        "SELECT uniqueness_ratio FROM column_profiles WHERE column_id = ? ORDER BY computed_at DESC LIMIT 1",
        (to_column_id,),
    ).fetchone()

    from_ratio = float(from_row[0]) if from_row else 0.0
    to_ratio = float(to_row[0]) if to_row else 0.0

    if from_ratio >= 0.99 and to_ratio >= 0.99:
        return "1:1"
    if from_ratio >= 0.99:
        return "1:N"
    if to_ratio >= 0.99:
        return "N:1"
    return "N:N"


def is_broken(conn: sqlite3.Connection, rule: sqlite3.Row) -> bool:
    """Check if a relationship rule references missing or incompatible columns."""
    from_col = conn.execute(
        "SELECT effective_type FROM columns WHERE id = ?", (rule["from_column_id"],)
    ).fetchone()
    to_col = conn.execute(
        "SELECT effective_type FROM columns WHERE id = ?", (rule["to_column_id"],)
    ).fetchone()

    if from_col is None or to_col is None:
        return True

    return str(from_col[0]) != str(to_col[0])


def write_audit(
    conn: sqlite3.Connection,
    *,
    relationship_id: str,
    action: str,
    old_status: str | None,
    new_status: str,
    reason: str | None = None,
    actor: str | None = None,
    timestamp: str,
) -> None:
    conn.execute(
        """INSERT INTO relationship_audit
           (id, relationship_id, action, old_status, new_status, reason, actor, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            str(uuid.uuid4()),
            relationship_id,
            action,
            old_status,
            new_status,
            reason,
            actor,
            timestamp,
        ),
    )


def create_relationship_rule(
    conn: sqlite3.Connection,
    *,
    workspace_id: str,
    from_column_id: str,
    to_column_id: str,
    join_type: str,
    rel_type: str,
    low_overlap_acknowledged: bool,
    actor: str | None = None,
    now: str,
) -> dict[str, Any]:
    overlap = compute_overlap_pct(conn, from_column_id, to_column_id)
    cardinality = compute_cardinality(conn, from_column_id, to_column_id)
    rule_id = str(uuid.uuid4())

    conn.execute(
        """INSERT INTO relationship_rules
           (id, workspace_id, from_column_id, to_column_id, join_type, rel_type,
            status, overlap_pct, cardinality, low_overlap_acknowledged, actor, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'suggested', ?, ?, ?, ?, ?, ?)""",
        (
            rule_id,
            workspace_id,
            from_column_id,
            to_column_id,
            join_type,
            rel_type,
            overlap,
            cardinality,
            int(low_overlap_acknowledged),
            actor,
            now,
            now,
        ),
    )
    write_audit(
        conn,
        relationship_id=rule_id,
        action="created",
        old_status=None,
        new_status="suggested",
        actor=actor,
        timestamp=now,
    )
    return get_rule_dict(conn, rule_id)


def get_rule_dict(conn: sqlite3.Connection, rule_id: str) -> dict[str, Any]:
    row = conn.execute("SELECT * FROM relationship_rules WHERE id = ?", (rule_id,)).fetchone()
    if row is None:
        return {}
    data = dict(row)
    data["broken"] = is_broken(conn, row)
    data["low_overlap_acknowledged"] = bool(data["low_overlap_acknowledged"])
    return data


def list_rules(conn: sqlite3.Connection, workspace_id: str) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT * FROM relationship_rules WHERE workspace_id = ? ORDER BY created_at ASC",
        (workspace_id,),
    ).fetchall()

    result: list[dict[str, Any]] = []
    for row in rows:
        data = dict(row)
        data["broken"] = is_broken(conn, row)
        data["low_overlap_acknowledged"] = bool(data["low_overlap_acknowledged"])
        result.append(data)
    return result


def get_rule_detail(conn: sqlite3.Connection, rule_id: str) -> dict[str, Any] | None:
    row = conn.execute("SELECT * FROM relationship_rules WHERE id = ?", (rule_id,)).fetchone()
    if row is None:
        return None

    data = dict(row)
    data["broken"] = is_broken(conn, row)
    data["low_overlap_acknowledged"] = bool(data["low_overlap_acknowledged"])
    audit_rows = conn.execute(
        "SELECT * FROM relationship_audit WHERE relationship_id = ? ORDER BY timestamp ASC",
        (rule_id,),
    ).fetchall()
    data["audit"] = [dict(r) for r in audit_rows]
    return data


def review_rule(
    conn: sqlite3.Connection,
    *,
    rule_id: str,
    workspace_id: str,
    action: str,
    reason: str | None = None,
    override_reason: str | None = None,
    actor: str | None = None,
    now: str,
) -> dict[str, Any]:
    row = conn.execute(
        "SELECT * FROM relationship_rules WHERE id = ? AND workspace_id = ?",
        (rule_id, workspace_id),
    ).fetchone()
    if row is None:
        raise ValueError("not_found")

    current_status = str(row["status"])

    if action == "reviewed" and current_status != "suggested":
        raise ValueError("invalid_transition")
    if action in ("approved", "rejected") and current_status != "reviewed":
        raise ValueError("invalid_transition")

    overlap = float(row["overlap_pct"] or 0.0)
    if action == "approved" and overlap < 0.05 and not override_reason:
        raise ValueError("overlap_too_low")

    conn.execute(
        "UPDATE relationship_rules SET status = ?, override_reason = ?, actor = ?, updated_at = ? WHERE id = ?",
        (action, override_reason, actor, now, rule_id),
    )
    write_audit(
        conn,
        relationship_id=rule_id,
        action=action,
        old_status=current_status,
        new_status=action,
        reason=reason,
        actor=actor,
        timestamp=now,
    )
    return get_rule_dict(conn, rule_id)


def update_rule(
    conn: sqlite3.Connection,
    *,
    rule_id: str,
    workspace_id: str,
    from_column_id: str,
    to_column_id: str,
    join_type: str,
    rel_type: str,
    actor: str | None = None,
    now: str,
) -> dict[str, Any]:
    row = conn.execute(
        "SELECT status FROM relationship_rules WHERE id = ? AND workspace_id = ?",
        (rule_id, workspace_id),
    ).fetchone()
    if row is None:
        raise ValueError("not_found")

    old_status = str(row["status"])
    overlap = compute_overlap_pct(conn, from_column_id, to_column_id)
    cardinality = compute_cardinality(conn, from_column_id, to_column_id)

    conn.execute(
        """UPDATE relationship_rules SET
           from_column_id = ?, to_column_id = ?, join_type = ?, rel_type = ?,
           status = 'suggested', overlap_pct = ?, cardinality = ?,
           low_overlap_acknowledged = 0, override_reason = NULL, actor = ?, updated_at = ?
           WHERE id = ?""",
        (
            from_column_id,
            to_column_id,
            join_type,
            rel_type,
            overlap,
            cardinality,
            actor,
            now,
            rule_id,
        ),
    )
    write_audit(
        conn,
        relationship_id=rule_id,
        action="edited",
        old_status=old_status,
        new_status="suggested",
        actor=actor,
        timestamp=now,
    )
    return get_rule_dict(conn, rule_id)


def delete_rule(
    conn: sqlite3.Connection,
    *,
    rule_id: str,
    workspace_id: str,
    actor: str | None = None,
    now: str,
) -> None:
    row = conn.execute(
        "SELECT status FROM relationship_rules WHERE id = ? AND workspace_id = ?",
        (rule_id, workspace_id),
    ).fetchone()
    if row is None:
        raise ValueError("not_found")

    old_status = str(row["status"])
    write_audit(
        conn,
        relationship_id=rule_id,
        action="deleted",
        old_status=old_status,
        new_status=old_status,
        actor=actor,
        timestamp=now,
    )
    conn.execute("DELETE FROM relationship_rules WHERE id = ?", (rule_id,))
