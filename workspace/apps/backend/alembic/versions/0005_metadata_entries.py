"""metadata_entries — R180 read-only metadata on seven noun kinds.

Additive revision on top of `0004_many_to_one_cardinality`: creates the
`metadata_entries` table (one row per noun × namespace; composite PK). Mirrors
`app.db_models.MetadataEntry` exactly so `tests/test_schema_parity.py` stays
green. No FK to the noun tables — the seven kinds live in five tables and the
write path resolves the noun before writing.

Revision ID: 0005_metadata_entries
Revises: 0004_many_to_one_cardinality
Create Date: 2026-10-15
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = '0005_metadata_entries'
down_revision = '0004_many_to_one_cardinality'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'metadata_entries',
        sa.Column('kind', sa.Text(), nullable=False),
        sa.Column('noun_id', sa.Text(), nullable=False),
        sa.Column('namespace', sa.Text(), nullable=False),
        sa.Column('md', sa.Text(), nullable=False),
        sa.Column('source', sa.Text(), nullable=False),
        sa.Column('author', sa.Text(), nullable=False),
        sa.Column('written_at', sa.Text(), nullable=False),
        sa.Column('definition_version', sa.Text(), nullable=False),
        sa.CheckConstraint(
            "kind IN ('dataset', 'column', 'relationship', 'query', 'workflow', 'dashboard', 'widget')"
        ),
        sa.CheckConstraint("source IN ('ai', 'human', 'system')"),
        sa.CheckConstraint('length(namespace) BETWEEN 1 AND 32'),
        sa.PrimaryKeyConstraint('kind', 'noun_id', 'namespace'),
    )
    with op.batch_alter_table('metadata_entries', schema=None) as batch_op:
        batch_op.create_index('idx_metadata_entries_noun', ['kind', 'noun_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('metadata_entries', schema=None) as batch_op:
        batch_op.drop_index('idx_metadata_entries_noun')
    op.drop_table('metadata_entries')
