"""Add column_mappings table.

Revision ID: 0002_column_mappings
Revises: 0001_baseline
Create Date: 2026-05-10
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0002_column_mappings"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "column_mappings",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("workspace_id", sa.Text(), sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("source_file_id", sa.Text(), sa.ForeignKey("source_files.id"), nullable=True),
        sa.Column("from_column_name", sa.Text(), nullable=False),
        sa.Column("to_column_name", sa.Text(), nullable=False),
        sa.Column("from_version", sa.Integer(), nullable=False),
        sa.Column("to_version", sa.Integer(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("accepted_by", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.CheckConstraint("confidence >= 0.0 AND confidence <= 1.0", name="ck_column_mappings_confidence"),
        sa.CheckConstraint("to_version >= from_version", name="ck_column_mappings_version_order"),
    )
    op.create_index("idx_column_mappings_workspace", "column_mappings", ["workspace_id"])
    op.create_index("idx_column_mappings_source", "column_mappings", ["source_file_id"])


def downgrade() -> None:
    op.drop_index("idx_column_mappings_source", table_name="column_mappings")
    op.drop_index("idx_column_mappings_workspace", table_name="column_mappings")
    op.drop_table("column_mappings")
