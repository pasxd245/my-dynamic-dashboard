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
