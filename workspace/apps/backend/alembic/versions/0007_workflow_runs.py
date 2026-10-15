"""workflow run stamps — R187 (W-7) `run_id`, `run_number`, `run_json`.

Additive revision on top of `0006_dataset_data_version`: three columns appended
to `workflows`, written only by `POST /workflows/{id}/run`.

- `run_id TEXT` — `run_<8 hex>`, new on every run; NULL before the first run and
  after a definition change (which clears the materialized output).
- `run_number INTEGER NOT NULL DEFAULT 0` — a per-workflow counter, +1 per run,
  never reset (a definition change keeps it).
- `run_json TEXT` — what the run read: the workflow's definition hash and, per
  source, its definition hash + leaf dataset versions (a query) or run id (a
  workflow). Read back to flag the output stale when a source moves.

Existing materialized workflows keep their output and carry no stamp until their
next run (their freshness cannot be judged retroactively). Mirrors
`app.db_models.Workflow` so `tests/test_schema_parity.py` stays green.

Revision ID: 0007_workflow_runs
Revises: 0006_dataset_data_version
Create Date: 2026-10-15
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = '0007_workflow_runs'
down_revision = '0006_dataset_data_version'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('workflows', sa.Column('run_id', sa.Text(), nullable=True))
    op.add_column(
        'workflows',
        sa.Column('run_number', sa.Integer(), nullable=False, server_default=sa.text('0')),
    )
    op.add_column('workflows', sa.Column('run_json', sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('workflows') as batch:
        batch.drop_column('run_json')
        batch.drop_column('run_number')
        batch.drop_column('run_id')
