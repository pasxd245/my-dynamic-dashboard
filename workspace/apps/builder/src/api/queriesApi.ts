import { appConfig } from '../config';
import { ApiErrorThrown, isApiError } from '@/features/data-management/_shared/types';
import type { RowsPage } from '@/features/data-management/datasets/types';
import type { CreateQueryRequest, Query } from '@/features/data-management/queries/types';

// R69 — Saved Query API client. Mirrors datasetsApi conventions (single
// appConfig base, ApiErrorThrown on structured 4xx). Five routes:
// create / list / get / run (rows) / delete — see
// workspace/packages/contracts/queries/*.
const API_BASE_URL = appConfig.apiBaseUrl();

async function readJson<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    await throwApiError(resp);
  }
  return (await resp.json()) as T;
}

/** Parse a 4xx body as `ApiError` when shaped that way; otherwise a generic
 *  Error. `query_stale` (409) and `not_found` (404) both surface here as
 *  `ApiErrorThrown`, so callers branch on `err.body.code`. */
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

export const queriesApi = {
  /** POST /workspaces/{id}/queries — save a query. 409 name_taken / 422. */
  async create(workspaceId: string, body: CreateQueryRequest): Promise<Query> {
    const resp = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/queries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return readJson<Query>(resp);
  },

  /** GET /workspaces/{id}/queries — the workspace's queries, newest first. */
  async list(workspaceId: string): Promise<Query[]> {
    const resp = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/queries`);
    return readJson<Query[]>(resp);
  },

  /** GET /queries/{id} — one saved query (definition + metadata). 404. */
  async get(id: string): Promise<Query> {
    const resp = await fetch(`${API_BASE_URL}/queries/${id}`);
    return readJson<Query>(resp);
  },

  /** GET /queries/{id}/rows — RUN: live re-run of the saved definition,
   *  paged. Same `RowsPage` shape as the dataset rows-GET. 404 / 409
   *  query_stale (both throw ApiErrorThrown). */
  async getRows(id: string, page: number, pageSize: number): Promise<RowsPage> {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    const resp = await fetch(`${API_BASE_URL}/queries/${id}/rows?${params.toString()}`);
    return readJson<RowsPage>(resp);
  },

  /** DELETE /queries/{id} — 204 / 404. */
  async delete(id: string): Promise<void> {
    const resp = await fetch(`${API_BASE_URL}/queries/${id}`, { method: 'DELETE' });
    if (!resp.ok) {
      await throwApiError(resp);
    }
  },
};
