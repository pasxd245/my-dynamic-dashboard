"""dataset data identity — R185 (W-4) `refreshed_at` + `data_version`.

Additive revision on top of `0005_metadata_entries`: two columns appended to
`datasets`, both stamped by the server only.

- `data_version INTEGER NOT NULL DEFAULT 1` — existing datasets start at 1; every
  refresh (replace / merge / append) bumps it in the same UPDATE that swaps the
  rows in.
- `refreshed_at TEXT` — when the rows last changed. Backfilled from
  `created_at` (an existing dataset's rows are, as far as the database knows,
  the ones it was created with — a refresh before this revision left no stamp).
  Nullable only because SQLite's ADD COLUMN cannot add NOT NULL without a
  constant default; every write path sets it.

Mirrors `app.db_models.Dataset` exactly so `tests/test_schema_parity.py` stays
green. Downgrade drops both columns (SQLite >= 3.35 DROP COLUMN, via batch).

Revision ID: 0006_dataset_data_version
Revises: 0005_metadata_entries
Create Date: 2026-10-15
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = '0006_dataset_data_version'
down_revision = '0005_metadata_entries'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('datasets', sa.Column('refreshed_at', sa.Text(), nullable=True))
    op.add_column(
        'datasets',
        sa.Column('data_version', sa.Integer(), nullable=False, server_default=sa.text('1')),
    )
    op.execute("UPDATE datasets SET refreshed_at = created_at WHERE refreshed_at IS NULL")


def downgrade() -> None:
    with op.batch_alter_table('datasets') as batch:
        batch.drop_column('data_version')
        batch.drop_column('refreshed_at')
