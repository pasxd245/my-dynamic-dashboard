import { appConfig } from '../config';
import { ApiErrorThrown, BatchApiErrorThrown, isApiError } from '@/features/data-management/_shared/types';
import type {
  AppendOverlapRequest,
  AppendOverlapResult,
  CommitBatchRequest,
  CommitBatchResponse,
  Dataset,
  FilterSet,
  RefreshSettings,
  RowsPage,
} from '@/features/data-management/datasets/types';
import { serializeFiltersToSearchParams } from '@/features/data-management/datasets/filters/serialize';
import { groupsToParam } from '@/features/data-management/datasets/advanced-query/serialize';
import type { PredicateGroups } from '@/features/data-management/datasets/advanced-query/types';

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

/** One entry of FastAPI's body-validation `detail` list. */
type ValidationDetail = { loc?: unknown; msg?: unknown };

/** R171 item 1 — the FE-synthesized `error` marking a pydantic body-validation
 *  rejection (a request this app should never have sent), as opposed to
 *  `unprocessable_request`, which carries guidance the router wrote FOR the
 *  user. Never sent by the server; set here, read by `UploadConfirmStep`. */
export const VALIDATION_ERROR = 'validation_error';

/** R171 item 1 — render one validation entry as `field: message`.
 *
 *  `loc` is the path FastAPI walks to the offending value, always led by the
 *  source (`"body"`), e.g. `["body", "items", 0, "sheetName"]`. The lead is
 *  dropped (every entry here is a body) and the rest joined with `.`, so the
 *  reader gets `items.0.sheetName: Extra inputs are not permitted` instead of
 *  a message that names nothing. A `loc` of only `["body"]` — the whole body
 *  rejected — leaves no path to name, so the message stands alone. */
function validationDetailLine(d: ValidationDetail): string | null {
  const msg = typeof d.msg === 'string' ? d.msg : null;
  if (msg === null) return null;
  const path = Array.isArray(d.loc)
    ? d.loc
        .filter((p, i) => !(i === 0 && p === 'body'))
        .map(String)
        .join('.')
    : '';
  return path ? `${path}: ${msg}` : msg;
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
    // R144 (dogfood): FastAPI HTTPException bodies carry `detail` with no
    // `error` key — a STRING for the router's own validation messages
    // (format_unsupported, format-required, sheet-required, …) or a LIST of
    // {msg} for pydantic body validation. Fold both into the legacy shape so
    // the wizard renders the actual guidance instead of "Request failed: 422".
    if (typeof legacy.detail === 'string') {
      throw new BatchApiErrorThrown(resp.status, { error: 'unprocessable_request', detail: legacy.detail });
    }
    if (Array.isArray(legacy.detail)) {
      // R171 item 1 — keep the `loc` PATH, not just the `msg`. A pydantic
      // `extra='forbid'` rejection reads "Extra inputs are not permitted",
      // which without its `loc` names no field at all: the one thing the
      // reader needs is the half that used to be dropped here.
      const msgs = legacy.detail
        .map((d) => (d && typeof d === 'object' ? validationDetailLine(d as ValidationDetail) : null))
        .filter((m): m is string => m !== null)
        .join(' · ');
      if (msgs) {
        // `VALIDATION_ERROR`, not `unprocessable_request`: these two arms are
        // NOT the same kind of failure, and R144's copy work depends on the
        // difference. A string `detail` is a message the ROUTER wrote for the
        // user ("…needs dtype `datetime`") — real guidance. A list `detail` is
        // pydantic refusing the body this app sent — a bug in the app, which
        // no amount of user action fixes. The wizard branches on this.
        throw new BatchApiErrorThrown(resp.status, { error: VALIDATION_ERROR, detail: msgs });
      }
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

  /** R145: GET /datasets/{id}/refresh-settings — the carry-forward snapshot a
   *  refresh wizard pre-fills from (F9). `available: false` for legacy datasets. */
  async getRefreshSettings(id: string): Promise<RefreshSettings> {
    const resp = await fetch(`${API_BASE_URL}/datasets/${id}/refresh-settings`);
    return readJson<RefreshSettings>(resp);
  },

  /** R155: POST /datasets/{id}/append-overlap — the pre-commit double-count
   *  advisory. Compares the staged upload's range on `field` against the
   *  target dataset's committed range; the wizard warns (never blocks). */
  async previewAppendOverlap(id: string, body: AppendOverlapRequest): Promise<AppendOverlapResult> {
    const resp = await fetch(`${API_BASE_URL}/datasets/${id}/append-overlap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return readJson<AppendOverlapResult>(resp);
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
    advanced?: PredicateGroups,
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
    // R51: advanced query → `aq` JSON param (DNF). Omitted when empty
    // so the BE branch stays the unfiltered / chip-only read.
    const aq = groupsToParam(advanced);
    if (aq) {
      params.set('aq', aq);
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

  /** R152 (F7): PATCH /datasets/{id}/columns — set the hidden-column set
   *  (replace semantics; presentation-only view-hint). Returns the updated
   *  Dataset; 404 / 422 unknown_column / 422 no_visible_columns throw
   *  ApiErrorThrown. */
  async setColumnVisibility(id: string, hidden: readonly string[]): Promise<Dataset> {
    const resp = await fetch(`${API_BASE_URL}/datasets/${id}/columns`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hidden }),
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
