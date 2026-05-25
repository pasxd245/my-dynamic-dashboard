import { appConfig } from '../config';
import { ApiErrorThrown, BatchApiErrorThrown, isApiError } from '../features/data-management/_shared/types';
import type { CommitBatchRequest, CommitBatchResponse, Dataset } from '../features/data-management/datasets/types';

// R28: was hardcoded `import.meta.env.VITE_API_BASE_URL ?? "..."`.
const API_BASE_URL = appConfig.apiBaseUrl();

async function readJson<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    await throwApiError(resp);
  }
  return (await resp.json()) as T;
}

async function throwApiError(resp: Response): Promise<never> {
  let parsed: unknown = null;
  try {
    parsed = await resp.json();
  } catch {
    // Non-JSON 4xx — fall through to the generic throw.
  }
  if (isApiError(parsed)) {
    throw new ApiErrorThrown(resp.status, parsed);
  }
  throw new Error(`Request failed: ${resp.status} ${resp.statusText}`);
}

/** Batch-commit 409 has a `oneOf` body: either `ApiErrorNameTaken` or the
 *  legacy `{ error, detail }` shape. Surface both via `BatchApiErrorThrown`
 *  so the wizard can branch on `body.code` vs `body.error`. */
async function throwBatchApiError(resp: Response): Promise<never> {
  let parsed: unknown = null;
  try {
    parsed = await resp.json();
  } catch {
    // Non-JSON — generic throw.
  }
  if (parsed && typeof parsed === 'object') {
    if (isApiError(parsed)) {
      throw new BatchApiErrorThrown(resp.status, parsed);
    }
    const legacy = parsed as { error?: unknown; detail?: unknown };
    if (typeof legacy.error === 'string') {
      throw new BatchApiErrorThrown(resp.status, {
        error: legacy.error,
        detail: typeof legacy.detail === 'string' ? legacy.detail : undefined,
      });
    }
  }
  throw new Error(`Request failed: ${resp.status} ${resp.statusText}`);
}

export const datasetsApi = {
  async list(workspaceId?: string): Promise<Dataset[]> {
    const url = workspaceId
      ? `${API_BASE_URL}/datasets?workspace_id=${encodeURIComponent(workspaceId)}`
      : `${API_BASE_URL}/datasets`;
    const resp = await fetch(url);
    return readJson<Dataset[]>(resp);
  },

  async commitBatch(workspaceId: string, body: CommitBatchRequest): Promise<CommitBatchResponse> {
    const resp = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/datasets/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      await throwBatchApiError(resp);
    }
    return (await resp.json()) as CommitBatchResponse;
  },

  async patch(id: string, body: { name: string }): Promise<Dataset> {
    const resp = await fetch(`${API_BASE_URL}/datasets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return readJson<Dataset>(resp);
  },

  async delete(id: string): Promise<void> {
    const resp = await fetch(`${API_BASE_URL}/datasets/${id}`, {
      method: 'DELETE',
    });
    if (!resp.ok) {
      await throwApiError(resp);
    }
  },
};
