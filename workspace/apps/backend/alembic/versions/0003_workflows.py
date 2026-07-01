"""workflows — add the Workflow noun (R132).

Additive revision on top of `0002_dashboards`: creates the `workflows` table
mirroring `queries`/`dashboards` (workspace FK + ON DELETE CASCADE, a
per-workspace name-unique index). The sources (`qr_` ids) + steps live in the
opaque `definition_json` blob; the materialized output's captured schema +
timestamp are nullable columns filled on RUN (R133). Parity with the
`app.db_models.Workflow` model is pinned by `tests/test_schema_parity.py`.

Revision ID: 0003_workflows
Revises: 0002_dashboards
Create Date: 2026-07-01
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = '0003_workflows'
down_revision = '0002_dashboards'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('workflows',
    sa.Column('id', sa.Text(), nullable=False),
    sa.Column('workspace_id', sa.Text(), nullable=False),
    sa.Column('name', sa.Text(), nullable=False),
    sa.Column('definition_json', sa.Text(), nullable=False),
    sa.Column('output_columns_json', sa.Text(), nullable=True),
    sa.Column('materialized_at', sa.Text(), nullable=True),
    sa.Column('created_at', sa.Text(), nullable=False),
    sa.CheckConstraint('length(name) BETWEEN 1 AND 120'),
    sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('workflows', schema=None) as batch_op:
        batch_op.create_index('idx_workflows_name_unique', ['workspace_id', 'name'], unique=True)
        batch_op.create_index('idx_workflows_workspace_id', ['workspace_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('workflows', schema=None) as batch_op:
        batch_op.drop_index('idx_workflows_workspace_id')
        batch_op.drop_index('idx_workflows_name_unique')

    op.drop_table('workflows')
