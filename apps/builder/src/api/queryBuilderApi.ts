import type {
  QueryConfig,
  QueryExecutionResponse,
  QueryPreviewResponse,
  ValidateQueryResponse,
} from "./queryBuilderTypes";
import { throwApiRequestError } from "./httpErrors";
import { appConfig } from "../config";

function requireWorkspaceId(workspaceId: string): string {
  const trimmed = workspaceId.trim();
  if (!trimmed || trimmed === "default") {
    throw new Error("Active workspace is required before query actions.");
  }
  return trimmed;
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    await throwApiRequestError(response, `Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function validateQuery(
  workspaceId: string,
  config: QueryConfig,
): Promise<ValidateQueryResponse> {
  const resolvedWorkspaceId = requireWorkspaceId(workspaceId);
  const response = await fetch(`${appConfig.apiBaseUrl()}/workspaces/${resolvedWorkspaceId}/queries/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  return parseJson<ValidateQueryResponse>(response);
}

export async function previewQuery(
  workspaceId: string,
  config: QueryConfig,
): Promise<QueryPreviewResponse> {
  const resolvedWorkspaceId = requireWorkspaceId(workspaceId);
  const response = await fetch(`${appConfig.apiBaseUrl()}/workspaces/${resolvedWorkspaceId}/queries/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  return parseJson<QueryPreviewResponse>(response);
}

export async function executeQuery(
  workspaceId: string,
  config: QueryConfig,
): Promise<QueryExecutionResponse> {
  const resolvedWorkspaceId = requireWorkspaceId(workspaceId);
  const response = await fetch(`${appConfig.apiBaseUrl()}/workspaces/${resolvedWorkspaceId}/queries/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  return parseJson<QueryExecutionResponse>(response);
}

export async function exportQuery(
  workspaceId: string,
  config: QueryConfig,
  format: "excel" | "csv",
): Promise<Blob> {
  const resolvedWorkspaceId = requireWorkspaceId(workspaceId);
  const response = await fetch(
    `${appConfig.apiBaseUrl()}/workspaces/${resolvedWorkspaceId}/queries/export?format=${encodeURIComponent(format)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    },
  );

  if (!response.ok) {
    await throwApiRequestError(response, `Request failed with status ${response.status}`);
  }
  return response.blob();
}
