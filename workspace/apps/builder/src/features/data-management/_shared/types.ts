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
  | { code: 'query_stale' } // R69 — saved query def stale vs current schema
  | { code: 'relationship_exists' } // R70 — duplicate governed edge (workspace + column pair)
  | { code: 'relationship_stale' } // R71 — join over an edge whose key column drifted
  | { code: 'composition_cycle' }; // R76 — Query × Query composition would loop (transitive self-reference)

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
    code === ERROR_CODES.RELATIONSHIP_EXISTS ||
    code === ERROR_CODES.RELATIONSHIP_STALE ||
    code === ERROR_CODES.COMPOSITION_CYCLE
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
