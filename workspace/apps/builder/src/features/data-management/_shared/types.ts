// R26 — CRUD hygiene shared TS types.
//
// Hand-aligned to packages/contracts/_shared/api-error.yaml (introduced in R24).
// Lives in `_shared/` because both workspaces and datasets features consume the
// same shapes — neither feature folder is the natural owner.

/** Discriminated union for code-first error responses on R23 endpoints
 *  (PATCH/DELETE on workspaces and datasets, plus tightened POST /workspaces). */
export type ApiError =
  | { code: 'not_found' }
  | { code: 'name_taken' }
  | { code: 'non_empty'; datasetCount: number }
  | { code: 'query_stale' } // R69 — saved query def stale vs current schema (a PREDICATE drifted)
  | { code: 'step_invalid' } // R165 — a transform STEP can't run on the columns at its position
  | { code: 'relationship_exists' } // R70 — duplicate governed edge (workspace + column pair)
  | { code: 'relationship_stale' } // R71 — join over an edge whose key column drifted
  | { code: 'slug_taken' } // R101 — dashboard slug collides within its workspace
  | {
      // R143 — commit-time dtype cast failed (batch aborted; first-5 cells)
      code: 'coercion_failed';
      sheet?: string;
      /** R188 — multi-file refresh: the file whose values did not fit. */
      file?: string;
      column: string;
      dtype: string;
      cells: { row: number; value: string }[];
      totalFailed: number;
    }
  | {
      // R147 — merge refresh: incoming file has >1 row per declared key
      // (D2 loud stop; the batch aborted, the dataset is untouched)
      code: 'merge_duplicate_keys';
      key: string[];
      duplicateKeyCount: number;
      sampleKeys: string[];
    }
  // R152 — column-visibility PATCH: a name is not a column of this dataset
  | { code: 'unknown_column'; column: string }
  // R152 — column-visibility PATCH would hide every column (guarded client-side too)
  | { code: 'no_visible_columns' }
  // R192 — a workflow publish refused; nothing was written
  | {
      code: 'not_publishable';
      reason: 'never_run' | 'stale' | 'reads_itself';
      staleSources?: { sourceId: string; name?: string; reason: string }[];
    }
  // R193 — a write inside a saved (frozen) workspace; nothing was changed
  | { code: 'read_only_workspace' }
  | { code: 'export_too_large'; rows: number; max: number } // R182 / R196 — over EXPORT_MAX_ROWS
  // R194 — a query parameter with no value at any level (a workflow run also names the source)…
  | {
      code: 'param_unbound';
      param: string;
      label?: string;
      sourceId?: string;
      missing?: readonly { param: string; label?: string }[];
    }
  // …or a supplied value of the wrong type, and which level supplied it.
  | {
      code: 'param_invalid';
      param: string;
      label?: string;
      expected: 'date' | 'number' | 'string';
      source: 'viewer' | 'dashboard' | 'default';
      reason?: 'range_reversed';
    };

/** The batch-commit endpoint's 409 carries a `oneOf` over the legacy
 *  `{ error, detail }` envelope and the new `ApiError` variants. The FE
 *  branches on whether `code` is present. */
export type LegacyApiError = {
  error: string;
  detail?: string;
};

export type ApiErrorFromBatch = ApiError | LegacyApiError;

import { ERROR_CODES } from '@/_generated/constants';

export function isApiError(body: unknown): body is ApiError {
  if (typeof body !== 'object' || body === null) return false;
  const code = (body as { code?: unknown }).code;
  return (
    code === ERROR_CODES.NOT_FOUND ||
    code === ERROR_CODES.NAME_TAKEN ||
    code === ERROR_CODES.NON_EMPTY ||
    code === ERROR_CODES.QUERY_STALE ||
    code === ERROR_CODES.STEP_INVALID ||
    code === ERROR_CODES.RELATIONSHIP_EXISTS ||
    code === ERROR_CODES.RELATIONSHIP_STALE ||
    code === ERROR_CODES.SLUG_TAKEN ||
    code === ERROR_CODES.COERCION_FAILED ||
    code === ERROR_CODES.MERGE_DUPLICATE_KEYS ||
    code === ERROR_CODES.UNKNOWN_COLUMN ||
    code === ERROR_CODES.NO_VISIBLE_COLUMNS ||
    code === ERROR_CODES.NOT_PUBLISHABLE ||
    code === ERROR_CODES.READ_ONLY_WORKSPACE ||
    code === ERROR_CODES.PARAM_UNBOUND ||
    code === ERROR_CODES.PARAM_INVALID ||
    code === ERROR_CODES.EXPORT_TOO_LARGE
  );
}

/** Thrown by the API clients when a 4xx response carries a structured
 *  `ApiError` body. Callers (mutations, components) inspect `.body.code`
 *  to branch. */
export class ApiErrorThrown extends Error {
  readonly status: number;
  readonly body: ApiError;

  constructor(status: number, body: ApiError) {
    super(`ApiError ${status}: ${body.code}`);
    this.name = 'ApiErrorThrown';
    this.status = status;
    this.body = body;
  }
}

/** Like `ApiErrorThrown` but accepts the wider batch-commit shape. */
export class BatchApiErrorThrown extends Error {
  readonly status: number;
  readonly body: ApiErrorFromBatch;

  constructor(status: number, body: ApiErrorFromBatch) {
    super(`BatchApiError ${status}: ${'code' in body ? body.code : body.error}`);
    this.name = 'BatchApiErrorThrown';
    this.status = status;
    this.body = body;
  }
}
