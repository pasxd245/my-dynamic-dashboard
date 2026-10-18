"""metadata anchor — R197 (item 3.8) triple anchor + cascade.

Additive revision on top of `0009_saved_copies`:

- `metadata_entries.anchor_json TEXT` (NULL on every rc.2 entry) — the server-built
  `{definitionVersion, dataVersions?, queryVersions?, runId?, params?, assumedParams?}`.
  An entry without it reads as `{definitionVersion}` only.
- `metadata_entries_swept` — where an entry goes when its noun is deleted (a
  dataset, column-owning dataset, relationship, query, workflow, dashboard, a widget
  removed from its dashboard). Archived, never dropped: the downgrade puts every
  swept row back.

The upgrade sweeps the orphans that exist today (rows no read path could reach)
with the same rule the app uses (`app.metadata.sweep`).

Mirrors `app.db_models` so `tests/test_schema_parity.py` stays green.

Revision ID: 0010_metadata_anchor
Revises: 0009_saved_copies
Create Date: 2026-10-18
"""

from __future__ import annotations

from datetime import datetime, timezone

from alembic import op


revision = "0010_metadata_anchor"
down_revision = "0009_saved_copies"
branch_labels = None
depends_on = None

_COLS = "kind, noun_id, namespace, md, source, author, written_at, definition_version, anchor_json"

# Keep identical to app.metadata.ORPHAN_WHERE (a migration must not import the app).
_ORPHAN_WHERE = """
    (kind = 'dataset' AND noun_id NOT IN (SELECT id FROM datasets))
 OR (kind = 'column' AND substr(noun_id, 1, instr(noun_id, ':') - 1) NOT IN (SELECT id FROM datasets))
 OR (kind = 'relationship' AND noun_id NOT IN (SELECT id FROM relationships))
 OR (kind = 'query' AND noun_id NOT IN (SELECT id FROM queries))
 OR (kind = 'workflow' AND noun_id NOT IN (SELECT id FROM workflows))
 OR (kind = 'dashboard' AND noun_id NOT IN (SELECT id FROM dashboards))
 OR (kind = 'widget' AND NOT EXISTS (
        SELECT 1 FROM dashboards d, json_each(d.definition_json, '$.widgets') w
         WHERE d.id = substr(metadata_entries.noun_id, 1, instr(metadata_entries.noun_id, ':') - 1)
           AND json_extract(w.value, '$.id') = substr(metadata_entries.noun_id, instr(metadata_entries.noun_id, ':') + 1)))
"""


def upgrade() -> None:
    op.execute("ALTER TABLE metadata_entries ADD COLUMN anchor_json TEXT")
    op.execute(
        """CREATE TABLE metadata_entries_swept (
             id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
             kind TEXT NOT NULL,
             noun_id TEXT NOT NULL,
             namespace TEXT NOT NULL,
             md TEXT NOT NULL,
             source TEXT NOT NULL,
             author TEXT NOT NULL,
             written_at TEXT NOT NULL,
             definition_version TEXT NOT NULL,
             anchor_json TEXT,
             swept_at TEXT NOT NULL
           )"""
    )
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    op.execute(
        f"INSERT INTO metadata_entries_swept ({_COLS}, swept_at) "  # noqa: S608 — constants only
        f"SELECT {_COLS}, '{now}' FROM metadata_entries WHERE {_ORPHAN_WHERE}"
    )
    op.execute(f"DELETE FROM metadata_entries WHERE {_ORPHAN_WHERE}")  # noqa: S608 — constants only


def downgrade() -> None:
    # Every swept row comes back (the newest sweep of a key wins; a live row is kept).
    cols = "kind, noun_id, namespace, md, source, author, written_at, definition_version"
    op.execute(
        f"INSERT OR IGNORE INTO metadata_entries ({cols}) "  # noqa: S608 — constants only
        f"SELECT {cols} FROM metadata_entries_swept ORDER BY id DESC"
    )
    op.execute("DROP TABLE metadata_entries_swept")
    op.execute("ALTER TABLE metadata_entries DROP COLUMN anchor_json")
