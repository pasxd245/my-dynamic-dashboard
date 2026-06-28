"""dashboards — add the persisted dashboard noun (R101).

Additive revision on top of the collapsed `0001_baseline`: creates the
`dashboards` table mirroring `queries` (workspace FK + ON DELETE CASCADE, a
per-workspace name-unique index) plus a second per-workspace slug-unique index
and a slug-length CHECK. The widgets live inside the opaque `definition_json`
blob (no `dashboard_widgets` table), so there is no further DDL. Parity with the
`app.db_models.Dashboard` model is pinned by `tests/test_schema_parity.py`.

Revision ID: 0002_dashboards
Revises: 0001_baseline
Create Date: 2026-06-27
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = '0002_dashboards'
down_revision = '0001_baseline'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('dashboards',
    sa.Column('id', sa.Text(), nullable=False),
    sa.Column('workspace_id', sa.Text(), nullable=False),
    sa.Column('name', sa.Text(), nullable=False),
    sa.Column('slug', sa.Text(), nullable=False),
    sa.Column('definition_json', sa.Text(), nullable=False),
    sa.Column('created_at', sa.Text(), nullable=False),
    sa.CheckConstraint('length(name) BETWEEN 1 AND 120'),
    sa.CheckConstraint('length(slug) BETWEEN 1 AND 120'),
    sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('dashboards', schema=None) as batch_op:
        batch_op.create_index('idx_dashboards_name_unique', ['workspace_id', 'name'], unique=True)
        batch_op.create_index('idx_dashboards_slug_unique', ['workspace_id', 'slug'], unique=True)
        batch_op.create_index('idx_dashboards_workspace_id', ['workspace_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('dashboards', schema=None) as batch_op:
        batch_op.drop_index('idx_dashboards_workspace_id')
        batch_op.drop_index('idx_dashboards_slug_unique')
        batch_op.drop_index('idx_dashboards_name_unique')

    op.drop_table('dashboards')
