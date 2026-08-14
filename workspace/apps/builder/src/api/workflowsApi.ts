import { appConfig } from '../config';
import { ApiErrorThrown, isApiError } from '@/features/data-management/_shared/types';
import type { RowsPage } from '@/features/data-management/datasets/types';
import type { CreateWorkflowRequest, Workflow } from '@/features/data-management/workflows/types';

// R132–R135 — Workflow API client. Mirrors queriesApi conventions (single
// appConfig base, ApiErrorThrown on structured 4xx). Six routes:
// create / list / get / run / rows / delete — see
// workspace/packages/contracts/workflows/*.
const API_BASE_URL = appConfig.apiBaseUrl();

async function readJson<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    await throwApiError(resp);
  }
  return (await resp.json()) as T;
}

/** Parse a 4xx body as `ApiError` when shaped that way; otherwise a generic
 *  Error. `query_stale` (409) and `not_found` (404) all
 *  surface here as `ApiErrorThrown`, so callers branch on `err.body.code`. */
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

export const workflowsApi = {
  /** POST /workspaces/{id}/workflows — save a workflow. 409 name_taken / 422. */
  async create(workspaceId: string, body: CreateWorkflowRequest): Promise<Workflow> {
    const resp = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return readJson<Workflow>(resp);
  },

  /** GET /workspaces/{id}/workflows — the workspace's workflows, newest first. */
  async list(workspaceId: string): Promise<Workflow[]> {
    const resp = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/workflows`);
    return readJson<Workflow[]>(resp);
  },

  /** GET /workflows/{id} — one saved workflow (definition + metadata). 404. */
  async get(id: string): Promise<Workflow> {
    const resp = await fetch(`${API_BASE_URL}/workflows/${id}`);
    return readJson<Workflow>(resp);
  },

  /** POST /workflows/{id}/run — MATERIALIZE: resolve + consolidate the sources,
   *  apply steps, write the frozen output. Returns the workflow with
   *  `resolvedColumns` + `materializedAt` populated. 404 / 409 query_stale /
   *  step_invalid (all throw ApiErrorThrown). */
  async run(id: string): Promise<Workflow> {
    const resp = await fetch(`${API_BASE_URL}/workflows/${id}/run`, { method: 'POST' });
    return readJson<Workflow>(resp);
  },

  /** GET /workflows/{id}/rows — page the MATERIALIZED output. 404 if absent OR
   *  not yet run (no materialized output). Same `RowsPage` shape as query rows. */
  async getRows(id: string, page: number, pageSize: number): Promise<RowsPage> {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    const resp = await fetch(`${API_BASE_URL}/workflows/${id}/rows?${params.toString()}`);
    return readJson<RowsPage>(resp);
  },

  /** PUT /workflows/{id} — edit name + definition. A definition change clears the
   *  materialized output (must re-run). 404 / 409 name_taken / 422 bad-source. */
  async update(id: string, body: CreateWorkflowRequest): Promise<Workflow> {
    const resp = await fetch(`${API_BASE_URL}/workflows/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return readJson<Workflow>(resp);
  },

  /** DELETE /workflows/{id} — 204 / 404. */
  async delete(id: string): Promise<void> {
    const resp = await fetch(`${API_BASE_URL}/workflows/${id}`, { method: 'DELETE' });
    if (!resp.ok) {
      await throwApiError(resp);
    }
  },
};
