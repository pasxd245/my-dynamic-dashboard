import { appConfig } from '../config';
import { ApiErrorThrown, isApiError } from '@/features/data-management/_shared/types';
import type {
  CreateRelationshipRequest,
  Relationship,
} from '@/features/data-management/relationships/types';

// R70 — relationship governance API client. Mirrors queriesApi conventions
// (single appConfig base, ApiErrorThrown on structured 4xx). Four routes:
// declare / list / get / delete — governance only, no /rows (joins are R71).
// See workspace/packages/contracts/relationships/*.
const API_BASE_URL = appConfig.apiBaseUrl();

async function readJson<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    await throwApiError(resp);
  }
  return (await resp.json()) as T;
}

/** Parse a 4xx body as `ApiError` when shaped that way; otherwise a generic
 *  Error. `relationship_exists` (409) and `not_found` (404) both surface here
 *  as `ApiErrorThrown`, so callers branch on `err.body.code`. */
async function throwApiError(resp: Response): Promise<never> {
  let parsed: unknown = null;
  try {
    parsed = await resp.json();
  } catch {
    // Non-JSON 4xx (e.g. the FastAPI 422 envelope) — generic throw.
  }
  if (isApiError(parsed)) {
    throw new ApiErrorThrown(resp.status, parsed);
  }
  throw new Error(`Request failed: ${resp.status} ${resp.statusText}`);
}

export const relationshipsApi = {
  /** POST /workspaces/{id}/relationships — declare. 409 relationship_exists / 422. */
  async create(workspaceId: string, body: CreateRelationshipRequest): Promise<Relationship> {
    const resp = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/relationships`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return readJson<Relationship>(resp);
  },

  /** GET /workspaces/{id}/relationships — the workspace's edges, newest first. */
  async list(workspaceId: string): Promise<Relationship[]> {
    const resp = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/relationships`);
    return readJson<Relationship[]>(resp);
  },

  /** GET /relationships/{id} — one edge (with computed status). 404. */
  async get(id: string): Promise<Relationship> {
    const resp = await fetch(`${API_BASE_URL}/relationships/${id}`);
    return readJson<Relationship>(resp);
  },

  /** DELETE /relationships/{id} — 204 / 404. */
  async delete(id: string): Promise<void> {
    const resp = await fetch(`${API_BASE_URL}/relationships/${id}`, { method: 'DELETE' });
    if (!resp.ok) {
      await throwApiError(resp);
    }
  },
};
