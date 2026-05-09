import type {
  QueryConfig,
  QueryExecutionResponse,
  QueryPreviewResponse,
  ValidateQueryResponse,
} from "./queryBuilderTypes";

const API_BASE = "/api/v1";

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function validateQuery(
  workspaceId: string,
  config: QueryConfig,
): Promise<ValidateQueryResponse> {
  const response = await fetch(`${API_BASE}/workspaces/${workspaceId}/queries/validate`, {
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
  const response = await fetch(`${API_BASE}/workspaces/${workspaceId}/queries/preview`, {
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
  const response = await fetch(`${API_BASE}/workspaces/${workspaceId}/queries/execute`, {
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
  const response = await fetch(
    `${API_BASE}/workspaces/${workspaceId}/queries/export?format=${encodeURIComponent(format)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  return response.blob();
}
