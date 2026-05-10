from __future__ import annotations

from sqlmodel import Field, SQLModel


class Workspace(SQLModel, table=True):
    __tablename__ = "workspaces"

    id: str = Field(primary_key=True)
    name: str
    status: str = Field(default="draft")
    manifest_version: int = Field(default=1)
    content_hash: str | None = None
    created_at: str
    updated_at: str


class OverrideLog(SQLModel, table=True):
    __tablename__ = "override_logs"

    id: str = Field(primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id")
    target_kind: str
    target_id: str
    old_value_json: str
    new_value_json: str
    reason: str
    actor: str | None = None
    created_at: str


class ManifestSnapshot(SQLModel, table=True):
    __tablename__ = "manifest_snapshots"

    id: str = Field(primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id")
    manifest_version: int
    manifest_json: str
    manifest_hash: str
    exported_at: str
