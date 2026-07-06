"""many_to_one cardinality — widen the relationships CHECK (F12).

Additive-label revision on top of `0003_workflows`: the relationship cardinality
vocabulary gains `many_to_one` (the truthful label for a fact→dimension join —
left-FK → right-PK; the directional inverse of `one_to_many`). Cardinality is
ADVISORY metadata — it does not change join SQL — so this migration only widens
the `relationships.cardinality` CHECK constraint.

SQLite cannot ALTER a CHECK in place, so the table is rebuilt: rename the old
table aside, create a fresh `relationships` with the widened CHECK, copy the rows
over, drop the old table (its indexes go with it), then recreate both indexes.
The resulting CHECK is EXACTLY
`cardinality IN ('one_to_one', 'one_to_many', 'many_to_one', 'many_to_many')`
so `tests/test_schema_parity.py` (which compares the CHECK-clause set across the
legacy string, the SQLModel DDL, and `upgrade head`) stays green.

Revision ID: 0004_many_to_one_cardinality
Revises: 0003_workflows
Create Date: 2026-07-06
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = '0004_many_to_one_cardinality'
down_revision = '0003_workflows'
branch_labels = None
depends_on = None


_COLS = (
    "id, workspace_id, left_dataset_id, left_column, "
    "right_dataset_id, right_column, cardinality, created_at"
)


def _rebuild(check: str) -> None:
    """Rebuild `relationships` with the given cardinality CHECK clause."""
    op.rename_table('relationships', '_relationships_old')
    op.create_table(
        'relationships',
        sa.Column('id', sa.Text(), nullable=False),
        sa.Column('workspace_id', sa.Text(), nullable=False),
        sa.Column('left_dataset_id', sa.Text(), nullable=False),
        sa.Column('left_column', sa.Text(), nullable=False),
        sa.Column('right_dataset_id', sa.Text(), nullable=False),
        sa.Column('right_column', sa.Text(), nullable=False),
        sa.Column('cardinality', sa.Text(), nullable=False),
        sa.Column('created_at', sa.Text(), nullable=False),
        sa.CheckConstraint(check),
        sa.ForeignKeyConstraint(['left_dataset_id'], ['datasets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['right_dataset_id'], ['datasets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.execute(
        f"INSERT INTO relationships ({_COLS}) "
        f"SELECT {_COLS} FROM _relationships_old"
    )
    op.drop_table('_relationships_old')
    with op.batch_alter_table('relationships', schema=None) as batch_op:
        batch_op.create_index(
            'idx_relationships_pair_unique',
            ['workspace_id', 'left_dataset_id', 'left_column', 'right_dataset_id', 'right_column'],
            unique=True,
        )
        batch_op.create_index('idx_relationships_workspace_id', ['workspace_id'], unique=False)


def upgrade() -> None:
    _rebuild("cardinality IN ('one_to_one', 'one_to_many', 'many_to_one', 'many_to_many')")


def downgrade() -> None:
    _rebuild("cardinality IN ('one_to_one', 'one_to_many', 'many_to_many')")
