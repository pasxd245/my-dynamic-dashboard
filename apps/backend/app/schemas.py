from __future__ import annotations

from pydantic import BaseModel


class ApiErrorModel(BaseModel):
    code: str
    message: str
    details: dict[str, str] | None = None


class ErrorResponse(BaseModel):
    error: ApiErrorModel


class WorkspaceCreateRequest(BaseModel):
    name: str


class WorkspaceResponse(BaseModel):
    id: str
    name: str
    status: str
    manifest_version: int


class SheetResponse(BaseModel):
    id: str
    name: str
    header_row_effective: int
    data_range_effective: str


class SourceUploadResponse(BaseModel):
    source_id: str
    warnings: list[str]
    sheets: list[SheetResponse]


class ColumnSchema(BaseModel):
    name: str
    data_type: str
    is_nullable: bool


class UploadTableResponse(BaseModel):
    file_id: str
    table_id: str
    filename: str
    version: int
    row_count: int
    parquet_path: str
    schema_changed: bool
    schema: list[ColumnSchema]


class TableSummary(BaseModel):
    file_id: str
    table_id: str
    filename: str
    version: int
    row_count: int
    schema_changed: bool
    schema: list[ColumnSchema]


class RelationshipCreateRequest(BaseModel):
    from_table_id: str
    from_column: str
    to_table_id: str
    to_column: str
    join_type: str = "inner"


class RelationshipResponse(BaseModel):
    id: str
    from_table_id: str
    from_column: str
    to_table_id: str
    to_column: str
    join_type: str
    is_broken: bool
    created_at: str


class SheetOverrideRequest(BaseModel):
    header_row: int | None = None
    data_range: str | None = None
    reason: str | None = None


class ColumnProfileResponse(BaseModel):
    column_id: str
    column_name: str
    effective_type: str
    null_ratio: float
    distinct_count: int
    uniqueness_ratio: float
    warnings: list[str]
    sampled: bool
    sample_size: int | None = None
    sample_seed: int | None = None


class WorkspaceProfileResponse(BaseModel):
    columns: list[ColumnProfileResponse]


class RoleAssignmentRequest(BaseModel):
    roles: list[str]
    override_reason: str | None = None


class RoleAssignmentResult(BaseModel):
    column_id: str
    role: str
    accepted: bool
    override_used: bool
    override_reason: str | None = None
    assigned_at: str


class ReadinessStatusResponse(BaseModel):
    complete: bool
    missing_required_roles: list[str]
    unresolved_critical_warnings: list[str]
    surface_role: str


class ManifestImportRequest(BaseModel):
    manifest: dict


class ManifestResponse(BaseModel):
    version: int
    workspace: dict
    source_files: list[dict]
    sheets: list[dict]
    columns: list[dict]
    profiles: list[dict]
    roles: list[dict]
    overrides: list[dict]
    manifest_hash: str
