import { appConfig } from '../config';
import { ApiErrorThrown, isApiError } from '@/features/data-management/_shared/types';
import type {
  CreateDashboardRequest,
  DashboardWire,
  UpdateDashboardRequest,
} from '@/features/dashboard/wire';

// R101 — Dashboard API client. Mirrors queriesApi conventions (single
// appConfig base, ApiErrorThrown on structured 4xx). Five routes:
// create / list / get / update / delete — see
// workspace/packages/contracts/dashboards/*.
const API_BASE_URL = appConfig.apiBaseUrl();

async function readJson<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    await throwApiError(resp);
  }
  return (await resp.json()) as T;
}

/** Parse a 4xx body as `ApiError` when shaped that way; otherwise a generic
 *  Error. `name_taken` / `slug_taken` (409) and `not_found` (404) surface here
 *  as `ApiErrorThrown`, so callers branch on `err.body.code`. */
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

export const dashboardsApi = {
  /** POST /workspaces/{id}/dashboards — create. 409 name_taken / slug_taken / 422. */
  async create(workspaceId: string, body: CreateDashboardRequest): Promise<DashboardWire> {
    const resp = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/dashboards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return readJson<DashboardWire>(resp);
  },

  /** GET /workspaces/{id}/dashboards — the workspace's dashboards, newest first. */
  async list(workspaceId: string): Promise<DashboardWire[]> {
    const resp = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/dashboards`);
    return readJson<DashboardWire[]>(resp);
  },

  /** GET /dashboards/{id} — one dashboard (definition + metadata). 404. */
  async get(id: string): Promise<DashboardWire> {
    const resp = await fetch(`${API_BASE_URL}/dashboards/${id}`);
    return readJson<DashboardWire>(resp);
  },

  /** PUT /dashboards/{id} — full-representation update (name + slug + widgets).
   *  409 name_taken / slug_taken; 422 (cross-workspace widget / bad shape); 404. */
  async update(id: string, body: UpdateDashboardRequest): Promise<DashboardWire> {
    const resp = await fetch(`${API_BASE_URL}/dashboards/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return readJson<DashboardWire>(resp);
  },

  /** DELETE /dashboards/{id} — 204 / 404. */
  async delete(id: string): Promise<void> {
    const resp = await fetch(`${API_BASE_URL}/dashboards/${id}`, { method: 'DELETE' });
    if (!resp.ok) {
      await throwApiError(resp);
    }
  },
};
