from __future__ import annotations

from sqlalchemy import CheckConstraint
from sqlmodel import Field, SQLModel


class ColumnMapping(SQLModel, table=True):
    __tablename__ = "column_mappings"
    __table_args__ = (
        CheckConstraint("confidence >= 0.0 AND confidence <= 1.0", name="ck_column_mappings_confidence"),
        CheckConstraint("to_version >= from_version", name="ck_column_mappings_version_order"),
    )

    id: str = Field(primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id")
    source_file_id: str | None = Field(default=None, foreign_key="source_files.id")
    from_column_name: str
    to_column_name: str
    from_version: int
    to_version: int
    confidence: float
    accepted_by: str | None = None
    created_at: str
