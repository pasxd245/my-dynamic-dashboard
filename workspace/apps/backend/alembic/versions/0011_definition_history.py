"""definition history — R200 (item 4.4).

Additive revision on top of `0010_metadata_anchor`: one new table,
`definition_history`, holding one row per DEFINITION change of a query, a
dashboard or a workflow (written by `app.history.record` in the same transaction
as the change).

The upgrade seeds one `baseline` row per noun that exists now — `seq 1`, its
current `definition_json`, the version hash computed exactly as the app does
(`app.metadata.definition_version`; a migration must not import the app, so the
hash is copied below and `tests/test_definition_history.py` pins the copy), the
upgrade time, no writer. Without it the first change after the upgrade would
record only the NEW definition and the one the noun had would be lost.

The downgrade drops the table: every noun keeps its current definition (nothing
of the 0010 schema is touched); the history itself is lost — the 0010 schema has
nowhere to keep it. Upgrading again seeds fresh baselines.

Mirrors `app.db_models.DefinitionHistory` so `tests/test_schema_parity.py` stays
green.

Revision ID: 0011_definition_history
Revises: 0010_metadata_anchor
Create Date: 2026-10-19
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone

import sqlalchemy as sa
from alembic import op


revision = "0011_definition_history"
down_revision = "0010_metadata_anchor"
branch_labels = None
depends_on = None

_KINDS = (("query", "queries"), ("dashboard", "dashboards"), ("workflow", "workflows"))


# Keep identical to app.metadata._strip_none / _version.
def _strip_none(v: object) -> object:
    if isinstance(v, dict):
        return {k: _strip_none(x) for k, x in v.items() if x is not None}
    if isinstance(v, list):
        return [_strip_none(x) for x in v]
    return v


def _version(payload: object) -> str:
    raw = json.dumps(_strip_none(payload), sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:12]


def upgrade() -> None:
    op.execute(
        """CREATE TABLE definition_history (
             kind TEXT NOT NULL,
             noun_id TEXT NOT NULL,
             seq INTEGER NOT NULL,
             version TEXT NOT NULL,
             definition_json TEXT NOT NULL,
             change TEXT NOT NULL,
             changed_at TEXT NOT NULL,
             changed_by TEXT,
             changed_source TEXT,
             PRIMARY KEY (kind, noun_id, seq),
             CHECK (kind IN ('query', 'dashboard', 'workflow')),
             CHECK (seq >= 1),
             CHECK (change IN ('create', 'update', 'baseline')),
             CHECK (changed_source IN ('ai', 'human', 'system'))
           )"""
    )
    bind = op.get_bind()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    insert = sa.text(
        "INSERT INTO definition_history (kind, noun_id, seq, version, definition_json, change, changed_at) "
        "VALUES (:kind, :noun_id, 1, :version, :definition_json, 'baseline', :changed_at)"
    )
    for kind, table in _KINDS:
        rows = bind.execute(sa.text(f"SELECT id, definition_json FROM {table} ORDER BY id")).fetchall()  # noqa: S608 — table from a closed tuple
        for noun_id, definition_json in rows:
            bind.execute(
                insert,
                {
                    "kind": kind,
                    "noun_id": noun_id,
                    "version": _version(json.loads(definition_json)),
                    "definition_json": definition_json,
                    "changed_at": now,
                },
            )


def downgrade() -> None:
    op.execute("DROP TABLE definition_history")
