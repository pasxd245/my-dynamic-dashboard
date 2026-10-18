"""R197 (D7) — which data a plan reads, and at which versions.

One helper for the three places that ask: a read's `dataVersions` (R196, 3.2c),
a workflow run's source stamp (R187) and a metadata entry's anchor (R197, 3.8).
"""

from __future__ import annotations

import sqlite3


def plan_dataset_ids(plan: dict | None) -> list[str]:
    """The `ds_` ids a resolved plan reads (a join: every dataset of it), sorted."""
    if not plan:
        return []
    if plan.get("kind") == "single":
        return [plan["ds"]["id"]]
    return sorted(i for i in plan.get("payload", {}).get("dataset_ids", set()) if str(i).startswith("ds_"))


def versions(con: sqlite3.Connection, ids: list[str]) -> dict[str, int]:
    """`{dataset id: data_version}` for the ids that exist, by id."""
    if not ids:
        return {}
    marks = ",".join("?" * len(ids))
    rows = con.execute(
        f"SELECT id, data_version FROM datasets WHERE id IN ({marks}) ORDER BY id",  # noqa: S608 — placeholders only
        ids,
    ).fetchall()
    return {r["id"]: r["data_version"] for r in rows}


def query_versions(con: sqlite3.Connection, query_id: str, workspace_id: str) -> dict[str, int]:
    """The versions of every dataset a saved query reads now ({} when it no longer
    resolves — a drifted query reads nothing). Resolved from the query's own
    source, joins and relationships — exactly as `/rows` plans it — so a parameter
    without a value does not hide its data (R197 QA P1-1)."""
    import json

    from app.query_engine import _chain_of, _rels_of, _resolve_plan  # local: heavy, imports routers

    row = con.execute("SELECT source_id, definition_json FROM queries WHERE id = ?", (query_id,)).fetchone()
    if row is None:
        return {}
    definition = json.loads(row["definition_json"])
    plan, _reason = _resolve_plan(con, row["source_id"], _chain_of(definition), _rels_of(definition), workspace_id)
    return versions(con, plan_dataset_ids(plan))
