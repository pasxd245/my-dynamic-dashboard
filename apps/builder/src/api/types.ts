// API types for workspace operations
export interface ApiError {
  error: {
    message: string;
    details?: {
      mismatches?: Array<Record<string, unknown>>;
    };
  };
}

export interface WorkspaceCreateRequest {
  name: string;
}

export interface WorkspaceResponse {
  id: string;
  name: string;
}

export interface UploadResponse {
  sheets: Array<{
    id: string;
    data_range_effective: string;
    header_row_effective: number;
  }>;
}

export interface OverridePayload {
  header_row: number;
  data_range: string;
  reason: string;
}

export interface ProfileColumn {
  column_id: string;
  column_name: string;
  effective_type?: string;
  top_k_values_json?: Record<string, number>;
}

export interface ProfileResponse {
  columns: ProfileColumn[];
}

export interface AssignRolePayload {
  roles: string[];
  override_reason?: string | null;
}

export interface ReadinessResponse {
  [key: string]: unknown;
}

export interface ManifestResponse {
  [key: string]: unknown;
}

export interface ImportManifestPayload {
  manifest: ManifestResponse;
}

export type ConnectionReadinessStatus = "ready" | "degraded" | "unavailable";
export type DependencyReadinessStatus = "ok" | "degraded" | "failed";
export type ActiveContextState = "resolved" | "unresolved" | "stale";
export type WorkflowStageKey = "upload_source" | "schema_sheet" | "query" | "results_saved";
export type WorkflowStageStatus = "locked" | "ready" | "in_progress" | "completed";
export type ActionableErrorStage = WorkflowStageKey | "global";

export interface DependencyStatus {
  name: string;
  status: DependencyReadinessStatus;
  detail?: string;
}

export interface ConnectionStatus {
  status: ConnectionReadinessStatus;
  last_checked_at_utc: string;
  summary: string;
  guidance: string;
  dependencies: DependencyStatus[];
  degraded_capabilities?: string[];
  correlation_id?: string;
}

export interface ActiveWorkspaceContext {
  state: ActiveContextState;
  workspace_id?: string;
  workspace_name?: string;
  selected_at_utc?: string;
  resolved_at_utc?: string;
}

export interface ActiveSourceContext {
  state: ActiveContextState;
  source_id?: string;
  source_name?: string;
  workspace_id?: string;
  selected_at_utc?: string;
  resolved_at_utc?: string;
}

export interface WorkflowStage {
  stage_key: WorkflowStageKey;
  title: string;
  order_index: number;
  status: WorkflowStageStatus;
  prerequisites: string[];
  missing_prerequisites?: string[];
  next_stage_key?: WorkflowStageKey;
  previous_stage_key?: WorkflowStageKey;
}

export interface BuilderSessionState {
  connection_status: ConnectionStatus;
  active_workspace: ActiveWorkspaceContext;
  active_source: ActiveSourceContext;
  current_stage: WorkflowStageKey;
  stages: WorkflowStage[];
}

export interface ActionableError {
  error_code: string;
  stage: ActionableErrorStage;
  user_message: string;
  next_steps: string[];
  technical_details?: Record<string, unknown>;
  show_technical_by_default?: boolean;
  correlation_id: string;
  occurred_at_utc: string;
}
