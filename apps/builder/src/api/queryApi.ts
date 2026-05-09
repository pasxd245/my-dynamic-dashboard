/**
 * Query API Client for Saved Queries (Spec 004)
 * 
 * This module provides async functions for all saved query operations:
 * - Create/Save new queries
 * - List/Search saved queries
 * - Load/Inspect query details
 * - Duplicate and create new versions
 * - Soft delete and restore
 * - Retrieve execution history
 */

import { throwApiRequestError } from "./httpErrors";

function requireWorkspaceId(workspaceId: string): string {
  const trimmed = workspaceId.trim();
  if (!trimmed || trimmed === "default") {
    throw new Error("Active workspace is required before saved-query actions.");
  }
  return trimmed;
}

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export interface SaveQueryRequest {
  name: string;
  description?: string | null;
  builder_snapshot: Record<string, unknown>;
  tags?: string[];
  created_by?: string | null;
  change_summary?: string | null;
}

export interface SaveQueryResponse {
  query_id: string;
  workspace_id: string;
  name: string;
  description?: string | null;
  tags: string[];
  version_id: string;
  version_number: number;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
}

export interface SavedQuerySummary {
  query_id: string;
  workspace_id: string;
  name: string;
  description?: string | null;
  tags: string[];
  version_count: number;
  execution_count: number;
  created_at: string;
  updated_at: string;
  last_executed_at?: string | null;
  created_by?: string | null;
  deleted_at?: string | null;
  recoverable_until?: string | null;
}

export interface SavedQueryLibraryResponse {
  items: SavedQuerySummary[];
  total: number;
  limit: number;
  offset: number;
  next_offset?: number | null;
}

export interface SavedQueryVersionResponse {
  version_id: string;
  query_id: string;
  version_number: number;
  parent_version_id?: string | null;
  builder_snapshot: Record<string, unknown>;
  sql_snapshot?: string | null;
  validation_state: string;
  created_at: string;
  created_by?: string | null;
  change_summary?: string | null;
}

export interface SavedQueryValidationIssue {
  type: string;
  field_id?: string | null;
  message: string;
}

export interface LoadSavedQueryResponse {
  query_id: string;
  version_id: string;
  version_number: number;
  builder_snapshot: Record<string, unknown>;
  validation_issues: SavedQueryValidationIssue[];
  can_load: boolean;
}

export interface SavedQueryDetailResponse {
  query_id: string;
  workspace_id: string;
  name: string;
  description?: string | null;
  tags: string[];
  version_count: number;
  execution_count: number;
  created_at: string;
  updated_at: string;
  last_executed_at?: string | null;
  created_by?: string | null;
  deleted_at?: string | null;
  recoverable_until?: string | null;
  latest_version?: SavedQueryVersionResponse | null;
  versions: SavedQueryVersionResponse[];
}

export interface UpdateSavedQueryRequest {
  name?: string | null;
  description?: string | null;
  tags?: string[] | null;
  builder_snapshot?: Record<string, unknown> | null;
  change_summary?: string | null;
  updated_by?: string | null;
}

export interface DuplicateSavedQueryRequest {
  name: string;
  description?: string | null;
  tags?: string[] | null;
  created_by?: string | null;
}

export interface RecoveryWindowResponse {
  query_id: string;
  is_deleted: boolean;
  deleted_at?: string | null;
  recoverable_until?: string | null;
  expires_in_seconds?: number | null;
}

export interface ExecutionHistoryItem {
  execution_id: string;
  query_id: string;
  version_id?: string | null;
  version_number?: number | null;
  executed_at: string;
  executed_by?: string | null;
  status: string;
  row_count?: number | null;
  execution_ms?: number | null;
}

export interface ExecutionHistoryResponse {
  items: ExecutionHistoryItem[];
  total: number;
  limit: number;
  offset: number;
  next_offset?: number | null;
}

// ─────────────────────────────────────────────────────────────────────
// Query API Functions
// ─────────────────────────────────────────────────────────────────────

export async function createSavedQuery(
  workspaceId: string,
  request: SaveQueryRequest,
): Promise<SaveQueryResponse> {
  const resolvedWorkspaceId = requireWorkspaceId(workspaceId);
  const response = await fetch(
    `/api/v1/workspaces/${resolvedWorkspaceId}/saved-queries`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
  );

  if (!response.ok) {
    await throwApiRequestError(response, "Failed to save query");
  }

  return response.json() as Promise<SaveQueryResponse>;
}

export async function listSavedQueries(
  workspaceId: string,
  state: "active" | "deleted" = "active",
  tags?: string[],
  limit: number = 50,
  offset: number = 0,
): Promise<SavedQueryLibraryResponse> {
  const resolvedWorkspaceId = requireWorkspaceId(workspaceId);
  const params = new URLSearchParams();
  params.set("state", state);
  params.set("limit", limit.toString());
  params.set("offset", offset.toString());

  if (tags && tags.length > 0) {
    tags.forEach((tag) => params.append("tags", tag));
  }

  const response = await fetch(
    `/api/v1/workspaces/${resolvedWorkspaceId}/saved-queries?${params.toString()}`,
  );

  if (!response.ok) {
    await throwApiRequestError(response, "Failed to list saved queries");
  }

  return response.json() as Promise<SavedQueryLibraryResponse>;
}

export async function searchSavedQueries(
  workspaceId: string,
  query: string,
  state: "active" | "deleted" = "active",
  tags?: string[],
  limit: number = 50,
  offset: number = 0,
): Promise<SavedQueryLibraryResponse> {
  const resolvedWorkspaceId = requireWorkspaceId(workspaceId);
  const params = new URLSearchParams();
  params.set("q", query);
  params.set("state", state);
  params.set("limit", limit.toString());
  params.set("offset", offset.toString());

  if (tags && tags.length > 0) {
    tags.forEach((tag) => params.append("tags", tag));
  }

  const response = await fetch(
    `/api/v1/workspaces/${resolvedWorkspaceId}/saved-queries/search?${params.toString()}`,
  );

  if (!response.ok) {
    await throwApiRequestError(response, "Failed to search saved queries");
  }

  return response.json() as Promise<SavedQueryLibraryResponse>;
}

export async function getSavedQuery(
  workspaceId: string,
  queryId: string,
): Promise<SavedQueryDetailResponse> {
  const resolvedWorkspaceId = requireWorkspaceId(workspaceId);
  const response = await fetch(
    `/api/v1/workspaces/${resolvedWorkspaceId}/saved-queries/${queryId}`,
  );

  if (!response.ok) {
    await throwApiRequestError(response, "Failed to get saved query");
  }

  return response.json() as Promise<SavedQueryDetailResponse>;
}

export async function loadSavedQuery(
  workspaceId: string,
  queryId: string,
  versionId?: string,
): Promise<LoadSavedQueryResponse> {
  const resolvedWorkspaceId = requireWorkspaceId(workspaceId);
  const params = new URLSearchParams();
  if (versionId) {
    params.set("version_id", versionId);
  }

  const response = await fetch(
    `/api/v1/workspaces/${resolvedWorkspaceId}/saved-queries/${queryId}/load?${params.toString()}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    await throwApiRequestError(response, "Failed to load saved query");
  }

  return response.json() as Promise<LoadSavedQueryResponse>;
}

export async function updateSavedQuery(
  workspaceId: string,
  queryId: string,
  request: UpdateSavedQueryRequest,
): Promise<SavedQueryDetailResponse> {
  const resolvedWorkspaceId = requireWorkspaceId(workspaceId);
  const response = await fetch(
    `/api/v1/workspaces/${resolvedWorkspaceId}/saved-queries/${queryId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
  );

  if (!response.ok) {
    await throwApiRequestError(response, "Failed to update saved query");
  }

  return response.json() as Promise<SavedQueryDetailResponse>;
}

export async function duplicateSavedQuery(
  workspaceId: string,
  queryId: string,
  request: DuplicateSavedQueryRequest,
): Promise<SaveQueryResponse> {
  const resolvedWorkspaceId = requireWorkspaceId(workspaceId);
  const response = await fetch(
    `/api/v1/workspaces/${resolvedWorkspaceId}/saved-queries/${queryId}/duplicate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
  );

  if (!response.ok) {
    await throwApiRequestError(response, "Failed to duplicate saved query");
  }

  return response.json() as Promise<SaveQueryResponse>;
}

export async function deleteSavedQuery(
  workspaceId: string,
  queryId: string,
): Promise<RecoveryWindowResponse> {
  const resolvedWorkspaceId = requireWorkspaceId(workspaceId);
  const response = await fetch(
    `/api/v1/workspaces/${resolvedWorkspaceId}/saved-queries/${queryId}`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    await throwApiRequestError(response, "Failed to delete saved query");
  }

  return response.json() as Promise<RecoveryWindowResponse>;
}

export async function restoreSavedQuery(
  workspaceId: string,
  queryId: string,
): Promise<SavedQueryDetailResponse> {
  const resolvedWorkspaceId = requireWorkspaceId(workspaceId);
  const response = await fetch(
    `/api/v1/workspaces/${resolvedWorkspaceId}/saved-queries/${queryId}/restore`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    await throwApiRequestError(response, "Failed to restore saved query");
  }

  return response.json() as Promise<SavedQueryDetailResponse>;
}

export async function getExecutionHistory(
  workspaceId: string,
  queryId: string,
  limit: number = 50,
  offset: number = 0,
): Promise<ExecutionHistoryResponse> {
  const resolvedWorkspaceId = requireWorkspaceId(workspaceId);
  const params = new URLSearchParams();
  params.set("limit", limit.toString());
  params.set("offset", offset.toString());

  const response = await fetch(
    `/api/v1/workspaces/${resolvedWorkspaceId}/saved-queries/${queryId}/executions?${params.toString()}`,
  );

  if (!response.ok) {
    await throwApiRequestError(response, "Failed to get execution history");
  }

  return response.json() as Promise<ExecutionHistoryResponse>;
}
