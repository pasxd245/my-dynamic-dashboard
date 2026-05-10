from __future__ import annotations

from sqlmodel import Field, SQLModel


class RelationshipRule(SQLModel, table=True):
    __tablename__ = "relationship_rules"

    id: str = Field(primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id")
    from_column_id: str = Field(foreign_key="columns.id")
    to_column_id: str = Field(foreign_key="columns.id")
    join_type: str
    rel_type: str
    status: str = Field(default="suggested")
    overlap_pct: float | None = None
    cardinality: str | None = None
    low_overlap_acknowledged: int = Field(default=0)
    override_reason: str | None = None
    actor: str | None = None
    created_at: str
    updated_at: str


class RelationshipAudit(SQLModel, table=True):
    __tablename__ = "relationship_audit"

    id: str = Field(primary_key=True)
    relationship_id: str = Field(foreign_key="relationship_rules.id")
    action: str
    old_status: str | None = None
    new_status: str
    reason: str | None = None
    actor: str | None = None
    timestamp: str
