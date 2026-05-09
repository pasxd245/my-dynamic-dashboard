from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class ApiErrorModel(BaseModel):
    code: str
    message: str
    details: dict[str, Any] | None = None


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


class CreateRelationshipRuleRequest(BaseModel):
    from_column_id: str
    to_column_id: str
    join_type: str
    rel_type: str
    low_overlap_acknowledged: bool = False


class ReviewRelationshipRuleRequest(BaseModel):
    action: str
    reason: str | None = None
    override_reason: str | None = None


class UpdateRelationshipRuleRequest(BaseModel):
    from_column_id: str
    to_column_id: str
    join_type: str
    rel_type: str


class RelationshipAuditEvent(BaseModel):
    id: str
    relationship_id: str
    action: str
    old_status: str | None
    new_status: str
    reason: str | None
    actor: str | None
    timestamp: str


class RelationshipRuleResponse(BaseModel):
    id: str
    workspace_id: str
    from_column_id: str
    to_column_id: str
    join_type: str
    rel_type: str
    status: str
    overlap_pct: float | None
    cardinality: str | None
    low_overlap_acknowledged: bool
    override_reason: str | None
    actor: str | None
    broken: bool
    created_at: str
    updated_at: str


class RelationshipRuleDetailResponse(RelationshipRuleResponse):
    audit: list[RelationshipAuditEvent]


class RelationshipRuleListResponse(BaseModel):
    items: list[RelationshipRuleResponse]


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


class RoleAssignmentResponse(BaseModel):
    assignments: list[RoleAssignmentResult]


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


FilterOperator = Literal["=", "!=", "<", ">", "<=", ">=", "IN", "LIKE", "IS NULL", "IS NOT NULL"]
AggregationFunction = Literal["SUM", "COUNT", "AVG", "MAX", "MIN"]
JoinType = Literal["INNER", "LEFT", "RIGHT", "FULL"]
ExecutionState = Literal["QUEUED", "RUNNING", "COMPLETED", "TIMEOUT", "FAILED"]


class SelectedColumn(BaseModel):
    table_id: str
    column_name: str
    alias: str | None = None


class FilterSpec(BaseModel):
    column_id: str
    operator: FilterOperator
    value: Any | None = None


class AggregationSpec(BaseModel):
    column_id: str
    function: AggregationFunction
    alias: str


class JoinSpec(BaseModel):
    relationship_rule_id: str
    join_type: JoinType
    joined_table_id: str


class QueryConfig(BaseModel):
    base_table_id: str
    selected_columns: list[SelectedColumn]
    filters: list[FilterSpec] = Field(default_factory=list)
    aggregations: list[AggregationSpec] = Field(default_factory=list)
    group_by_columns: list[str] = Field(default_factory=list)
    joins: list[JoinSpec] = Field(default_factory=list)
    result_limit: int | None = None
    execution_timeout_seconds: int = 5
    saved_query_id: str | None = None
    saved_query_version_id: str | None = None


class ValidationIssue(BaseModel):
    code: str
    message: str
    field: str | None = None
    severity: Literal["error", "warning"] = "error"


class SourceTableMetadata(BaseModel):
    table_id: str
    table_name: str
    row_count_at_execution: int | None = None


class RelationshipRuleMetadata(BaseModel):
    rule_id: str
    rule_name: str | None = None
    rule_type: str | None = None
    approval_status: str | None = None


class LineageMetadata(BaseModel):
    source_tables: list[SourceTableMetadata] = Field(default_factory=list)
    relationship_rules_used: list[RelationshipRuleMetadata] = Field(default_factory=list)
    filters_applied: list[FilterSpec] = Field(default_factory=list)
    aggregations_applied: list[AggregationSpec] = Field(default_factory=list)
    group_by_columns: list[str] = Field(default_factory=list)
    query_config_hash: str | None = None
    execution_timestamp: str | None = None
    execution_time_ms: int | None = None


class ValidateQueryResponse(BaseModel):
    valid: bool
    issues: list[ValidationIssue] = Field(default_factory=list)
    sql_preview: str | None = None


class QueryPreviewResponse(BaseModel):
    rows: list[dict[str, Any]]
    estimated_total_rows: int | None = None
    execution_time_ms: int
    lineage: LineageMetadata


class QueryExecutionResponse(BaseModel):
    rows: list[dict[str, Any]]
    total_rows: int
    execution_time_ms: int
    state: ExecutionState
    lineage: LineageMetadata


class SavedQueryRequest(BaseModel):
    name: str
    description: str | None = None
    config: QueryConfig


class SavedQueryResponse(BaseModel):
    query_id: str
    workspace_id: str
    name: str
    description: str | None = None
    config_hash: str
    config: QueryConfig
    created_at: str
    updated_at: str
    last_executed_at: str | None = None


class SavedQueryListResponse(BaseModel):
    items: list[SavedQueryResponse]


# ── Spec 004: Saved Queries ────────────────────────────────────────────────────

class ValidationIssueType(str):
    column_deleted = "column_deleted"
    column_type_drift = "column_type_drift"
    relationship_downgraded = "relationship_downgraded"
    base_table_missing = "base_table_missing"


class SavedQueryValidationIssue(BaseModel):
    type: str
    field_id: str | None = None
    message: str


class SavedQueryVersionResponse(BaseModel):
    version_id: str
    query_id: str
    version_number: int
    parent_version_id: str | None = None
    builder_snapshot: dict[str, Any]
    sql_snapshot: str | None = None
    validation_state: str
    created_at: str
    created_by: str | None = None
    change_summary: str | None = None


class SaveQueryRequest(BaseModel):
    name: str
    description: str | None = None
    builder_snapshot: dict[str, Any]
    tags: list[str] = Field(default_factory=list)
    created_by: str | None = None
    change_summary: str | None = None


class SaveQueryResponse(BaseModel):
    query_id: str
    workspace_id: str
    name: str
    description: str | None = None
    tags: list[str] = Field(default_factory=list)
    version_id: str
    version_number: int
    created_at: str
    updated_at: str
    created_by: str | None = None


class SavedQuerySummary(BaseModel):
    query_id: str
    workspace_id: str
    name: str
    description: str | None = None
    tags: list[str] = Field(default_factory=list)
    version_count: int
    execution_count: int
    created_at: str
    updated_at: str
    last_executed_at: str | None = None
    created_by: str | None = None
    deleted_at: str | None = None
    recoverable_until: str | None = None


class SavedQueryLibraryResponse(BaseModel):
    items: list[SavedQuerySummary]
    total: int
    limit: int
    offset: int
    next_offset: int | None = None


class SavedQueryDetailResponse(BaseModel):
    query_id: str
    workspace_id: str
    name: str
    description: str | None = None
    tags: list[str] = Field(default_factory=list)
    version_count: int
    execution_count: int
    created_at: str
    updated_at: str
    last_executed_at: str | None = None
    created_by: str | None = None
    deleted_at: str | None = None
    recoverable_until: str | None = None
    latest_version: SavedQueryVersionResponse | None = None
    versions: list[SavedQueryVersionResponse] = Field(default_factory=list)


class LoadSavedQueryResponse(BaseModel):
    query_id: str
    version_id: str
    version_number: int
    builder_snapshot: dict[str, Any]
    validation_issues: list[SavedQueryValidationIssue] = Field(default_factory=list)
    can_load: bool = True


class UpdateSavedQueryRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    tags: list[str] | None = None
    builder_snapshot: dict[str, Any] | None = None
    change_summary: str | None = None
    updated_by: str | None = None


class DuplicateSavedQueryRequest(BaseModel):
    name: str
    description: str | None = None
    tags: list[str] | None = None
    created_by: str | None = None


class RecoveryWindowResponse(BaseModel):
    query_id: str
    is_deleted: bool
    deleted_at: str | None = None
    recoverable_until: str | None = None
    expires_in_seconds: int | None = None


class ExecutionHistoryItem(BaseModel):
    execution_id: str
    query_id: str
    version_id: str | None = None
    version_number: int | None = None
    executed_at: str
    executed_by: str | None = None
    status: str
    row_count: int | None = None
    execution_ms: int | None = None
    error_message: str | None = None


class ExecutionHistoryResponse(BaseModel):
    items: list[ExecutionHistoryItem]
    total: int
    limit: int
    offset: int


# ── Spec 005: Dashboards & Visualizations ─────────────────────────────────────

DashboardCadence = Literal["manual", "15min", "60min"]
DashboardRunStatus = Literal["pending", "running", "completed", "failed"]
PanelRunStatus = Literal["pending", "running", "completed", "failed", "timeout"]
ChartType = Literal["line", "bar", "scatter", "pie", "heatmap", "table_only"]
DashboardErrorType = Literal["validation", "schema_drift", "broken_relationship", "timeout", "unexpected"]


class DashboardPanel(BaseModel):
    panel_id: str
    dashboard_id: str
    saved_query_id: str
    panel_name: str | None = None
    panel_order: int
    is_visible: bool
    chart_config_json: dict[str, Any] | None = None
    parameter_overrides_json: dict[str, Any] | None = None
    created_at: str
    updated_at: str


class Dashboard(BaseModel):
    dashboard_id: str
    workspace_id: str
    owner_user_id: str
    dashboard_name: str
    description: str | None = None
    refresh_cadence: DashboardCadence
    last_refreshed_at: str | None = None
    current_run_id: str | None = None
    created_at: str
    updated_at: str


class DashboardDetail(Dashboard):
    panels: list[DashboardPanel] = Field(default_factory=list)


class DashboardRun(BaseModel):
    run_id: str
    dashboard_id: str
    run_number: int
    triggered_by: str
    status: DashboardRunStatus
    parameters_json: dict[str, Any] = Field(default_factory=dict)
    created_at: str
    started_at: str | None = None
    completed_at: str | None = None
    total_duration_ms: int | None = None


class DashboardRunSummary(BaseModel):
    run_id: str
    run_number: int
    status: DashboardRunStatus
    triggered_by: str
    created_at: str
    completed_at: str | None = None
    total_duration_ms: int | None = None


class DashboardRunPanel(BaseModel):
    run_panel_id: str
    panel_id: str
    status: PanelRunStatus
    started_at: str | None = None
    completed_at: str | None = None
    duration_ms: int | None = None
    row_count: int | None = None
    is_aggregated: bool = False
    error_type: DashboardErrorType | None = None
    error_message: str | None = None
    chart_suggestion_type: ChartType | None = None
    chart_suggestion_reason: str | None = None
    kpi_value: float | None = None
    kpi_label: str | None = None


class DashboardRunDetail(DashboardRun):
    panels: list[DashboardRunPanel] = Field(default_factory=list)


class PanelDataColumn(BaseModel):
    name: str
    dataType: str


class PanelDataResponse(BaseModel):
    panel_id: str
    row_count: int
    is_aggregated: bool
    columns: list[PanelDataColumn] = Field(default_factory=list)
    rows: list[list[Any]] = Field(default_factory=list)
    has_more: bool


class ChartSuggestion(BaseModel):
    chart_type: ChartType
    reason: str
    axes: dict[str, str] | None = None


class CreateDashboardRequest(BaseModel):
    dashboard_name: str
    description: str | None = None
    refresh_cadence: DashboardCadence = "manual"


class UpdateDashboardRequest(BaseModel):
    dashboard_name: str | None = None
    description: str | None = None
    refresh_cadence: DashboardCadence | None = None


class AddPanelRequest(BaseModel):
    saved_query_id: str
    panel_name: str | None = None
    chart_config_json: dict[str, Any] | None = None
    parameter_overrides_json: dict[str, Any] | None = None


class UpdatePanelRequest(BaseModel):
    panel_order: int | None = None
    panel_name: str | None = None
    is_visible: bool | None = None
    chart_config_json: dict[str, Any] | None = None
    parameter_overrides_json: dict[str, Any] | None = None


class RunDashboardRequest(BaseModel):
    parameters: dict[str, Any] = Field(default_factory=dict)


class SetRefreshCadenceRequest(BaseModel):
    refresh_cadence: DashboardCadence


class ExportDashboardRequest(BaseModel):
    format: Literal["png", "pdf"]


class ExportPanelRequest(BaseModel):
    format: Literal["xlsx", "csv"]
