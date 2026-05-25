// R26 — CRUD hygiene shared TS types.
//
// Hand-aligned to packages/contracts/_shared/api-error.yaml (introduced in R24).
// Lives in `_shared/` because both workspaces and datasets features consume the
// same shapes — neither feature folder is the natural owner.

/** Discriminated union for code-first error responses on R23 endpoints
 *  (PATCH/DELETE on workspaces and datasets, plus tightened POST /workspaces). */
export type ApiError = { code: 'not_found' } | { code: 'name_taken' } | { code: 'non_empty'; datasetCount: number };

/** The batch-commit endpoint's 409 carries a `oneOf` over the legacy
 *  `{ error, detail }` envelope and the new `ApiError` variants. The FE
 *  branches on whether `code` is present. */
export type LegacyApiError = {
  error: string;
  detail?: string;
};

export type ApiErrorFromBatch = ApiError | LegacyApiError;

export function isApiError(body: unknown): body is ApiError {
  if (typeof body !== 'object' || body === null) return false;
  const code = (body as { code?: unknown }).code;
  return code === 'not_found' || code === 'name_taken' || code === 'non_empty';
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
