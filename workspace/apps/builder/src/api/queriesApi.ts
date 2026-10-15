import { appConfig } from '../config';
import { ApiErrorThrown, isApiError } from '@/features/data-management/_shared/types';
import type { RowsPage } from '@/features/data-management/datasets/types';
import type {
  AggregateRequest,
  ExportRequest,
  TotalsRequest,
  TotalsResult,
  AggregateResult,
  CreateQueryRequest,
  PreviewQueryRequest,
  Query,
  QueryPreview,
  UpdateQueryRequest,
} from '@/features/data-management/queries/types';

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

  /** R107 — GET /queries/{id}/rows?unpaged=true — single-request run for
   *  dashboard widgets: returns the rows in ONE response, capped server-side at
   *  `dashboard_max_rows`. `pageSize` echoes the returned row count; `total` is
   *  the full matched count (so `total > rows.length` ⇒ partial). Replaces the
   *  paged-at-100 fetch-all loop. 404 / 409 query_stale (both throw). */
  async getUnpagedRows(id: string): Promise<RowsPage> {
    const resp = await fetch(`${API_BASE_URL}/queries/${id}/rows?unpaged=true`);
    return readJson<RowsPage>(resp);
  },

  /** R119 — POST /queries/{id}/aggregate — server-side GROUP BY over a saved
   *  query (the dashboard aggregate path). Returns grouped rows + output columns,
   *  computed over the whole result (no row cap). 404 / 409 query_stale /
   *  relationship_stale (all throw ApiErrorThrown); 422 on a
   *  bad aggregate spec. */
  /** R182 — POST /queries/{id}/export: the file as a Blob + the server's file
   *  name (from Content-Disposition). 422 `export_too_large` / 404 / 409 throw. */
  async exportFile(id: string, body: ExportRequest): Promise<{ blob: Blob; filename: string }> {
    const resp = await fetch(`${API_BASE_URL}/queries/${id}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      await throwApiError(resp);
    }
    const disposition = resp.headers.get('content-disposition') ?? '';
    const m = /filename="([^"]+)"/.exec(disposition);
    const filename = m?.[1] ?? `export.${body.format}`;
    return { blob: await resp.blob(), filename };
  },

  /** R181 — POST /queries/{id}/totals: Σ of numeric columns over the WHOLE
   *  (post-step, filtered) result; the table footer's source of truth. */
  async totals(id: string, body: TotalsRequest): Promise<TotalsResult> {
    const resp = await fetch(`${API_BASE_URL}/queries/${id}/totals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return readJson<TotalsResult>(resp);
  },

  async aggregate(id: string, body: AggregateRequest): Promise<AggregateResult> {
    const resp = await fetch(`${API_BASE_URL}/queries/${id}/aggregate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return readJson<AggregateResult>(resp);
  },

  /** R72 — POST /workspaces/{id}/queries/preview — run an UNSAVED working-copy
   *  definition (the live preview), paged. Returns the `RowsPage` shape plus
   *  `resolvedColumns` when the definition joins. 409 query_stale /
   *  relationship_stale (a drifted predicate / edge); 422 (a structurally bad
   *  definition). Never persists. */
  async preview(workspaceId: string, body: PreviewQueryRequest, page: number, pageSize: number): Promise<QueryPreview> {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    const resp = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/queries/preview?${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return readJson<QueryPreview>(resp);
  },

  /** R72 — PUT /queries/{id} — persist an edited DEFINITION (join + predicates;
   *  name unchanged this round). Same validate-on-save guards as create
   *  (422 unknown/cross-workspace/stale edge or bad atom). 404 if absent. */
  async update(id: string, body: UpdateQueryRequest): Promise<Query> {
    const resp = await fetch(`${API_BASE_URL}/queries/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return readJson<Query>(resp);
  },

  /** DELETE /queries/{id} — 204 / 404. */
  async delete(id: string): Promise<void> {
    const resp = await fetch(`${API_BASE_URL}/queries/${id}`, { method: 'DELETE' });
    if (!resp.ok) {
      await throwApiError(resp);
    }
  },
};
