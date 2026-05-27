import { appConfig } from '../config';
import { ApiErrorThrown, BatchApiErrorThrown, isApiError } from '@/features/data-management/_shared/types';
import type {
  CommitBatchRequest,
  CommitBatchResponse,
  Dataset,
  FilterSet,
  RowsPage,
} from '@/features/data-management/datasets/types';
import { serializeFiltersToSearchParams } from '@/features/data-management/datasets/filters/serialize';

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

  /** R36: GET /datasets/{id} — single dataset by id. 404 throws ApiErrorThrown. */
  async get(id: string): Promise<Dataset> {
    const resp = await fetch(`${API_BASE_URL}/datasets/${id}`);
    return readJson<Dataset>(resp);
  },

  /** R36: GET /datasets/{id}/rows — paged rows with optional substring
   *  filter + R40 per-column `f<N>_*` filters. Mirrors
   *  workspace/packages/contracts/datasets/rows-get.contract.yaml.
   *  `q` is omitted when empty/undefined; `filters` is omitted when
   *  empty so the BE branch is the unfiltered paged read. */
  async getRows(
    id: string,
    page: number,
    pageSize: number,
    q?: string,
    filters?: FilterSet,
  ): Promise<RowsPage> {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
    });
    if (q) {
      params.set('q', q);
    }
    if (filters && filters.length > 0) {
      serializeFiltersToSearchParams(params, filters);
    }
    const resp = await fetch(`${API_BASE_URL}/datasets/${id}/rows?${params.toString()}`);
    return readJson<RowsPage>(resp);
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
