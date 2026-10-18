"""saved copies — R193 (item 3.6b) saved workspaces + frozen dataset copies.

Additive revision on top of `0008_dataset_lineage` — no table is rebuilt
(`workspaces` and `datasets` are both parents; plain ADD COLUMN touches no child):

- `workspaces.kind TEXT NOT NULL DEFAULT 'main' CHECK (kind IN ('main', 'saved'))`
  — every existing workspace is a main one;
- `workspaces.parent_workspace_id TEXT` (NULL on a main workspace) — the main
  workspace a saved one belongs to, UNIQUE (`idx_workspaces_parent_unique`) so a
  main workspace has at most one saved workspace. No foreign key: the app refuses
  to delete a main workspace that has a saved one (409 `non_empty`), and a
  REFERENCES column could not be dropped again on downgrade;
- `datasets.saved_from_json TEXT` (NULL except on a saved copy) — the
  server-written `savedFrom` `{datasetId, datasetName, workspaceId, dataVersion,
  refreshedAt, label, savedAt}`.

Mirrors `app.db_models` so `tests/test_schema_parity.py` stays green.

Downgrade keeps every row: a saved workspace becomes an ordinary workspace and
its copies ordinary datasets (only the three columns and the index go; SQLite
>= 3.35 DROP COLUMN, which never rebuilds the table).

Revision ID: 0009_saved_copies
Revises: 0008_dataset_lineage
Create Date: 2026-10-18
"""

from __future__ import annotations

from alembic import op


revision = "0009_saved_copies"
down_revision = "0008_dataset_lineage"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE workspaces ADD COLUMN kind TEXT NOT NULL DEFAULT 'main' CHECK (kind IN ('main', 'saved'))")
    op.execute("ALTER TABLE workspaces ADD COLUMN parent_workspace_id TEXT")
    op.execute("CREATE UNIQUE INDEX idx_workspaces_parent_unique ON workspaces (parent_workspace_id)")
    op.execute("ALTER TABLE datasets ADD COLUMN saved_from_json TEXT")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_workspaces_parent_unique")
    op.execute("ALTER TABLE datasets DROP COLUMN saved_from_json")
    op.execute("ALTER TABLE workspaces DROP COLUMN parent_workspace_id")
    op.execute("ALTER TABLE workspaces DROP COLUMN kind")
