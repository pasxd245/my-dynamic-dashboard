from __future__ import annotations

from sqlmodel import Field, SQLModel


class SourceFile(SQLModel, table=True):
    __tablename__ = "source_files"

    id: str = Field(primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id")
    filename_original: str
    extension: str
    content_hash: str
    encoding_detected: str | None = None
    parse_status: str
    reject_reason: str | None = None
    uploaded_at: str


class Sheet(SQLModel, table=True):
    __tablename__ = "sheets"

    id: str = Field(primary_key=True)
    source_file_id: str = Field(foreign_key="source_files.id")
    sheet_name: str
    header_row_detected: int
    header_row_effective: int
    data_range_detected: str
    data_range_effective: str
    multi_range_warning: int = Field(default=0)
    committed_at: str


class Column(SQLModel, table=True):
    __tablename__ = "columns"

    id: str = Field(primary_key=True)
    sheet_id: str = Field(foreign_key="sheets.id")
    name: str
    ordinal: int
    inferred_type: str
    effective_type: str
    type_override_reason: str | None = None
    is_all_null: int = Field(default=0)


class ColumnProfile(SQLModel, table=True):
    __tablename__ = "column_profiles"

    id: str = Field(primary_key=True)
    column_id: str = Field(foreign_key="columns.id")
    null_ratio: float
    distinct_count: int
    uniqueness_ratio: float
    duplicate_signature: str | None = None
    numeric_min: float | None = None
    numeric_max: float | None = None
    date_min: str | None = None
    date_max: str | None = None
    top_k_values_json: str
    warnings_json: str
    sampled: int = Field(default=0)
    sample_size: int | None = None
    sample_seed: int | None = None
    computed_at: str


class RoleAssignment(SQLModel, table=True):
    __tablename__ = "role_assignments"

    id: str = Field(primary_key=True)
    column_id: str = Field(foreign_key="columns.id")
    role: str
    accepted: int
    override_used: int
    override_reason: str | None = None
    assigned_by: str | None = None
    assigned_at: str
