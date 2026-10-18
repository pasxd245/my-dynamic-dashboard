import { appConfig } from '../config';
import { ApiErrorThrown, isApiError } from '@/features/data-management/_shared/types';
import type {
  CreateRelationshipRequest,
  Relationship,
  RelationshipCheck,
} from '@/features/data-management/relationships/types';

// R70 — relationship governance API client. Mirrors queriesApi conventions
// (single appConfig base, ApiErrorThrown on structured 4xx). Five routes:
// declare / list / get / delete / check (R183) — no /rows (joins are R71).
// See workspace/packages/contracts/relationships/*.
const API_BASE_URL = appConfig.apiBaseUrl();

async function readJson<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    await throwApiError(resp);
  }
  return (await resp.json()) as T;
}

/** R191 — the declare route refuses a bad edge with the FastAPI 422 envelope,
 *  its `msg` led by a code (`routers/relationships.py`). Lifted into a typed
 *  error so the modal can say WHY instead of "Request failed: 422". */
export type RelationshipDeclareCode = 'self_join' | 'unknown_dataset' | 'unknown_column' | 'incompatible_join_keys';

export class RelationshipDeclareError extends Error {
  readonly code: RelationshipDeclareCode;
  readonly detail: string;

  constructor(code: RelationshipDeclareCode, detail: string) {
    super(`${code}: ${detail}`);
    this.name = 'RelationshipDeclareError';
    this.code = code;
    this.detail = detail;
  }
}

const DECLARE_MSG = /^(self_join|unknown_dataset|unknown_column|incompatible_join_keys): (.*)$/s;

function declareError(parsed: unknown): RelationshipDeclareError | null {
  const detail = (parsed as { detail?: unknown } | null)?.detail;
  if (!Array.isArray(detail) || detail.length === 0) return null;
  const msg = (detail[0] as { msg?: unknown }).msg;
  const m = typeof msg === 'string' ? DECLARE_MSG.exec(msg) : null;
  return m ? new RelationshipDeclareError(m[1] as RelationshipDeclareCode, m[2] ?? '') : null;
}

/** Parse a 4xx body as `ApiError` when shaped that way; otherwise a generic
 *  Error. `relationship_exists` (409) and `not_found` (404) both surface here
 *  as `ApiErrorThrown`, so callers branch on `err.body.code`. */
async function throwApiError(resp: Response): Promise<never> {
  let parsed: unknown = null;
  try {
    parsed = await resp.json();
  } catch {
    // Non-JSON 4xx — generic throw.
  }
  if (isApiError(parsed)) {
    throw new ApiErrorThrown(resp.status, parsed);
  }
  const declare = resp.status === 422 ? declareError(parsed) : null;
  if (declare) throw declare;
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

  /** R183 — GET /relationships/{id}/check: the edge measured against the data.
   *  409 `relationship_stale` / 404 throw. */
  async check(id: string): Promise<RelationshipCheck> {
    const resp = await fetch(`${API_BASE_URL}/relationships/${id}/check`);
    return readJson<RelationshipCheck>(resp);
  },

  /** DELETE /relationships/{id} — 204 / 404. */
  async delete(id: string): Promise<void> {
    const resp = await fetch(`${API_BASE_URL}/relationships/${id}`, { method: 'DELETE' });
    if (!resp.ok) {
      await throwApiError(resp);
    }
  },
};
