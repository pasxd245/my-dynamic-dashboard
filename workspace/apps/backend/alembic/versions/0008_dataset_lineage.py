"""published datasets — R192 (item 3.6a) `source_format` 'workflow' + lineage.

`datasets` is rebuilt (SQLite cannot alter a CHECK in place):

- `source_format` CHECK widens to `('csv', 'excel', 'workflow')` — a dataset
  published from a workflow's output;
- `lineage_json TEXT` (NULL except on a published dataset) — the server-written
  lineage `{workflowId, workflowName, runId, runNumber, runAt, definitionHash,
  sources, publishedAt}`;
- `published_workflow_id TEXT` (NULL except on a published dataset) — internal,
  never on the wire: the workflow that publishes into this dataset, UNIQUE per
  workspace (`idx_datasets_published_unique`) so a re-publish has exactly one
  target and a racing first publish cannot create a second.

**`datasets` is a parent.** `relationships` references it with `ON DELETE
CASCADE`, and queries / metadata / workflow stamps name dataset ids. The rebuild
therefore never renames the live table (with SQLite ≥ 3.26 a rename re-points the
children's REFERENCES at the old name): it builds `_datasets_new`, copies the
rows, drops `datasets` and renames the new table INTO the name the children
already reference. Alembic's connection runs with `PRAGMA foreign_keys` off (the
SQLite default; only `app.db.get_conn` turns it on), so the drop cascades
nowhere. `tests/test_migration_0008.py` proves relationships, queries and
metadata rows survive both ways and `PRAGMA foreign_key_check` stays clean.

Downgrade keeps every row: a published dataset becomes a plain `csv` dataset
(its lineage and publisher link are dropped with the columns) — the old CHECK
cannot hold `workflow`.

Mirrors `app.db_models.Dataset` so `tests/test_schema_parity.py` stays green.

Revision ID: 0008_dataset_lineage
Revises: 0007_workflow_runs
Create Date: 2026-10-18
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = '0008_dataset_lineage'
down_revision = '0007_workflow_runs'
branch_labels = None
depends_on = None


_BASE_COLS = (
    "id, workspace_id, name, size_bytes, row_count, column_count, columns_json, "
    "source_format, sheet_name, created_at, refreshed_at, data_version"
)


def _new_table(name: str, formats: str, with_lineage: bool) -> None:
    cols = [
        sa.Column('id', sa.Text(), nullable=False),
        sa.Column('workspace_id', sa.Text(), nullable=False),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('size_bytes', sa.Integer(), nullable=False),
        sa.Column('row_count', sa.Integer(), nullable=False),
        sa.Column('column_count', sa.Integer(), nullable=False),
        sa.Column('columns_json', sa.Text(), nullable=False),
        sa.Column('source_format', sa.Text(), nullable=False),
        sa.Column('sheet_name', sa.Text(), nullable=True),
        sa.Column('created_at', sa.Text(), nullable=False),
        sa.Column('refreshed_at', sa.Text(), nullable=True),
        sa.Column('data_version', sa.Integer(), nullable=False, server_default=sa.text('1')),
    ]
    if with_lineage:
        cols += [
            sa.Column('lineage_json', sa.Text(), nullable=True),
            sa.Column('published_workflow_id', sa.Text(), nullable=True),
        ]
    op.create_table(
        name,
        *cols,
        sa.CheckConstraint('length(name) BETWEEN 1 AND 120'),
        sa.CheckConstraint('size_bytes >= 0'),
        sa.CheckConstraint('row_count >= 0'),
        sa.CheckConstraint('column_count >= 1'),
        sa.CheckConstraint(f'source_format IN ({formats})'),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )


def _swap(select_sql: str, cols: str, *, with_lineage: bool, formats: str) -> None:
    _new_table('_datasets_new', formats, with_lineage)
    op.execute(f"INSERT INTO _datasets_new ({cols}) {select_sql}")
    op.drop_table('datasets')
    op.rename_table('_datasets_new', 'datasets')
    with op.batch_alter_table('datasets', schema=None) as batch_op:
        batch_op.create_index('idx_datasets_name_unique', ['workspace_id', 'name'], unique=True)
        batch_op.create_index('idx_datasets_workspace_id', ['workspace_id'], unique=False)
        if with_lineage:
            batch_op.create_index(
                'idx_datasets_published_unique', ['workspace_id', 'published_workflow_id'], unique=True
            )


def upgrade() -> None:
    _swap(
        f"SELECT {_BASE_COLS} FROM datasets",
        _BASE_COLS,
        with_lineage=True,
        formats="'csv', 'excel', 'workflow'",
    )


def downgrade() -> None:
    select = (
        "SELECT id, workspace_id, name, size_bytes, row_count, column_count, columns_json, "
        "CASE WHEN source_format = 'workflow' THEN 'csv' ELSE source_format END, "
        "sheet_name, created_at, refreshed_at, data_version FROM datasets"
    )
    _swap(select, _BASE_COLS, with_lineage=False, formats="'csv', 'excel'")
