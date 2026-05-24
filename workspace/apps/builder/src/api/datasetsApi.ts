import type {
  CommitBatchRequest,
  CommitBatchResponse,
  Dataset,
} from "../features/data-management/datasets/types";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function readJson<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    throw new Error(`Request failed: ${resp.status} ${resp.statusText}`);
  }
  return (await resp.json()) as T;
}

export const datasetsApi = {
  async list(workspaceId?: string): Promise<Dataset[]> {
    const url = workspaceId
      ? `${API_BASE_URL}/datasets?workspace_id=${encodeURIComponent(workspaceId)}`
      : `${API_BASE_URL}/datasets`;
    const resp = await fetch(url);
    return readJson<Dataset[]>(resp);
  },

  async commitBatch(
    workspaceId: string,
    body: CommitBatchRequest,
  ): Promise<CommitBatchResponse> {
    const resp = await fetch(
      `${API_BASE_URL}/workspaces/${workspaceId}/datasets/batch`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    return readJson<CommitBatchResponse>(resp);
  },
};
