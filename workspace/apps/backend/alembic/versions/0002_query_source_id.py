"""query source_id rename cleanup — backfill + drop dataset_id (R79).

Completes the `dataset_id → source_id` rename R76 designed (R79). The
driving source becomes the single, canonical `source_id`:

1. **Backfill** `source_id = dataset_id` for every dataset-rooted query that
   still stores `NULL` (NULL meant "the source is `dataset_id`"). The values
   are `ds_…`, which satisfy `source_id`'s `^(ds_|qr_)…` shape.
2. **Drop** the `idx_queries_dataset_id` index and the `dataset_id` column
   (with its FK), and **set `source_id` NOT NULL**. SQLite has no native
   `DROP COLUMN` / `ALTER COLUMN`, so this rides R78's `render_as_batch=True`
   (env.py) — batch mode recreates the table with the new shape.

The dataset-delete → query cascade that `dataset_id`'s `ON DELETE CASCADE`
expressed moves to the app (R79 J-1, `routers/datasets.py`) — a polymorphic
`source_id` can't carry a DB FK.

Revision ID: 0002_query_source_id
Revises: 0001_baseline
Create Date: 2026-06-16
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import (
    CheckConstraint,
    Column,
    ForeignKey,
    Index,
    MetaData,
    Table,
    Text,
)


revision = '0002_query_source_id'
down_revision = '0001_baseline'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Backfill the canonical source for dataset-rooted queries.
    op.execute(
        "UPDATE queries SET source_id = dataset_id WHERE source_id IS NULL"
    )
    # 2. Drop the legacy dataset_id (column + index + FK) and lock source_id NOT NULL.
    #    SQLite has no DROP/ALTER COLUMN, so this rides batch mode (recreate). SQLite
    #    reflection silently drops the UNNAMED `CHECK` and downgrades FK `ON DELETE`
    #    to NO ACTION, so we DON'T reflect — `copy_from` gives batch the exact pre-R79
    #    table (matching 0001), and the batch ops transform it. Dropping `dataset_id`
    #    removes its column + FK + (already-dropped) index; the workspace_id CASCADE FK,
    #    the name CHECK, and the surviving indexes are carried verbatim.
    queries_pre_r79 = Table(
        'queries',
        MetaData(),
        Column('id', Text, primary_key=True),
        Column('workspace_id', Text, ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False),
        Column('dataset_id', Text, ForeignKey('datasets.id', ondelete='CASCADE'), nullable=False),
        Column('source_id', Text, nullable=True),
        Column('name', Text, nullable=False),
        Column('definition_json', Text, nullable=False),
        Column('created_at', Text, nullable=False),
        CheckConstraint('length(name) BETWEEN 1 AND 120'),
        Index('idx_queries_workspace_id', 'workspace_id'),
        Index('idx_queries_dataset_id', 'dataset_id'),
        Index('idx_queries_name_unique', 'workspace_id', 'name', unique=True),
    )
    with op.batch_alter_table('queries', schema=None, copy_from=queries_pre_r79) as batch_op:
        batch_op.drop_index('idx_queries_dataset_id')
        batch_op.alter_column('source_id', existing_type=sa.Text(), nullable=False)
        batch_op.drop_column('dataset_id')


def downgrade() -> None:
    # Best-effort reverse (lossy for composed `qr_` queries — their original
    # dataset_id root leaf is not recoverable; backfilled from source_id, which
    # for a composed query is a `qr_` and won't satisfy the datasets FK).
    with op.batch_alter_table('queries', schema=None) as batch_op:
        batch_op.add_column(sa.Column('dataset_id', sa.Text(), nullable=True))
        batch_op.alter_column('source_id', existing_type=sa.Text(), nullable=True)
    op.execute("UPDATE queries SET dataset_id = source_id")
    with op.batch_alter_table('queries', schema=None) as batch_op:
        batch_op.alter_column('dataset_id', existing_type=sa.Text(), nullable=False)
        batch_op.create_foreign_key(
            None, 'datasets', ['dataset_id'], ['id'], ondelete='CASCADE'
        )
        batch_op.create_index('idx_queries_dataset_id', ['dataset_id'], unique=False)
