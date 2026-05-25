# Round 25: Backend — CRUD hygiene handlers (DCBF B-step)

**Status**: Complete
**Date started**: 2026-05-25
**Date completed**: 2026-05-25

## Goal

**Inherits from ← [Round_24](Round_24.md)** — R24 locked the four
CRUD hygiene contracts plus the shared `ApiError` envelope. R25
implements the BE handlers against those locked YAMLs, following
the R16 BE-round conformance pattern (per-endpoint
`validate_response` calls + cross-cutting smoke test). Two
named back-fill tasks flow through from R24's follow-ups.

R25 ships four new route handlers, four new Pydantic models for
`ApiError` + `RenameBody`, a schema migration adding two unique
indexes, and a startup-time back-fill that auto-resolves the
existing-data duplicates implied by the new uniqueness rules.

_Track: 1 (product — POC/MVP CRUD chain). Pulled by R24's chain
declaration. Per
[2026-05-24-be-round-conformance-pattern.md](../../memory/2026-05-24-be-round-conformance-pattern.md):
"every accepted field gets one behavior test" — the R22 sub-rule
applies here, so each endpoint's response gets shape conformance
AND each error code gets a behavior test asserting the right
state results._

## What is IN scope

- **Four route handlers** in
  [`apps/backend/app/routers/workspaces.py`](../../../workspace/apps/backend/app/routers/workspaces.py)
  and
  [`apps/backend/app/routers/datasets.py`](../../../workspace/apps/backend/app/routers/datasets.py):
  - `PATCH /workspaces/{id}` — rename; 200/404/409/422 per contract.
  - `DELETE /workspaces/{id}` — delete; 204/404/409 (with
    `datasetCount`). **Pre-check** dataset count and 409 BEFORE
    issuing DELETE — the existing schema's
    `ON DELETE CASCADE` is a belt-and-braces, not the design
    intent (R23 says block, not cascade).
  - `PATCH /datasets/{id}` — rename; 200/404/409/422 per contract.
  - `DELETE /datasets/{id}` — delete; 204/404. Atomic
    cleanup: validate exists → delete DB row → `rmtree` the
    dataset directory. Same atomic-commit discipline as the
    R16 upload-commit pattern in reverse.
- **Pydantic models** in
  [`apps/backend/app/models/common.py`](../../../workspace/apps/backend/app/models/common.py):
  - `RenameBody` — shared by both PATCH endpoints' request
    bodies. `name: str = Field(min_length=1)`. The max-length
    bound differs per resource (80 vs 120), so the validator
    is enforced **at the route level** via per-endpoint
    `Annotated[..., Field(max_length=N)]` wrappers, not on
    the shared model.
  - `ApiErrorNotFound`, `ApiErrorNameTaken`, `ApiErrorNonEmpty`
    — match the
    [`_shared/api-error.yaml`](../../../workspace/packages/contracts/_shared/api-error.yaml)
    shapes one-for-one. All use `model_config = ConfigDict(extra="forbid")`
    per the R16 conformance discipline. Return via FastAPI's
    `JSONResponse(status_code=…, content=model.model_dump())`
    because `HTTPException(detail=…)` wraps in
    `{ detail: … }` which conflicts with the code-first shape.
- **Schema migration** in
  [`apps/backend/app/db.py`](../../../workspace/apps/backend/app/db.py):
  - `CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_name_unique
ON workspaces(name)`.
  - `CREATE UNIQUE INDEX IF NOT EXISTS idx_datasets_name_unique
ON datasets(workspace_id, name)`.
  - Run inside `bootstrap_schema` — `IF NOT EXISTS` makes
    repeat-boot safe.
- **Startup duplicate-name back-fill** in
  [`apps/backend/app/db.py`](../../../workspace/apps/backend/app/db.py):
  - Run BEFORE the unique-index creation. For each duplicate
    group, keep the oldest row's `name` as-is and rename the
    rest to `<name> (2)`, `<name> (3)`, etc. Log each rename
    to stdout so the operator can see what changed.
  - Same logic for both `workspaces(name)` and
    `datasets(workspace_id, name)`.
  - Idempotent: if no duplicates exist (which is the expected
    state on a fresh boot), the back-fill is a no-op + zero
    log lines.
- **Tighten existing `POST /workspaces`** to return 409
  `name_taken` on collision (was: accept duplicates silently).
  Same behavior as `PATCH /workspaces/{id}`. The contract for
  POST stays at its current shape — the 422 envelope still
  covers validation failures; the new 409 path is documented
  by amending
  [`workspaces/post.contract.{yaml,md}`](../../../workspace/packages/contracts/workspaces/post.contract.yaml).
- **Conformance helper**:
  [`tests/_conformance.py`](../../../workspace/apps/backend/tests/_conformance.py)
  works as-is (it generically resolves `$ref`s and validates
  via `Draft202012Validator`). The cross-cutting smoke test
  [`tests/test_conformance.py`](../../../workspace/apps/backend/tests/test_conformance.py)
  gets four new entries: one canonical response per new
  endpoint.
- **Per-endpoint tests** for each new route:
  - `tests/test_workspaces_patch.py` — happy path,
    `name_taken`, `not_found`, 422.
  - `tests/test_workspaces_delete.py` — happy path (empty
    workspace), `non_empty` (with `datasetCount` body), 404.
  - `tests/test_datasets_patch.py` — happy path,
    `name_taken`, `not_found`, 422.
  - `tests/test_datasets_delete.py` — happy path (verify
    parquet directory is gone after), 404.
  - Each file calls `validate_response(...)` on at least one
    happy-path body.
  - Per the R22 behavior-conformance sub-rule, every error
    code gets a behavior test asserting the observable state
    change (or non-change in the case of 409).
- **Stamp**
  [crud-hygiene.md](../../design/data-management/crud-hygiene.md)
  with a `**Backend**: R25` row alongside the existing
  `**Contract**: R24`.
- **Update**
  [workspaces/post.contract.md](../../../workspace/packages/contracts/workspaces/post.contract.md)
  and the paired yaml — add a `409 name_taken` response and
  note the behavior change in the rationale. OpenAPI test
  count stays at 11 (file count unchanged; one existing
  contract gains a response).

## What is OUT of scope (explicit deferrals)

- **No FE implementation.** R26's job.
- **No new contracts** beyond the POST /workspaces amendment.
  The four new contracts shipped in R24; R25 implements them.
- **No `?cascade=true` opt-in** on workspace delete. Future
  round per
  [crud-hygiene.md § Out of scope](../../design/data-management/crud-hygiene.md).
- **No soft-delete / trash bin.** Same.
- **No audit log** of mutations. Same.
- **No cross-workspace dataset move.** Same.
- **No migrations framework.** Single schema-change for R25
  uses the same `executescript` approach as the existing
  `bootstrap_schema`. A proper migrations framework lands
  when (a) a schema change can't be expressed as
  `IF NOT EXISTS` or (b) we need to roll back.
- **No methodology amendments.** Track-2/3 freeze.
- **No autopilot-readiness work.** Queued post-R26 per the
  R23 follow-up.

## Plan

- [x] Author Round_25.md (this file) and flip to `In Progress`.
- [x] Add Pydantic models (`RenameBody`, `ApiErrorNotFound`,
      `ApiErrorNameTaken`, `ApiErrorNonEmpty`) to
      `app/models/common.py`. All closed; all match the YAML
      one-for-one.
- [x] Implement schema migration + back-fill in `app/db.py`.
      Back-fill runs BEFORE the unique-index creation; both
      land in `bootstrap_schema`.
- [x] Implement `PATCH /workspaces/{id}` and
      `DELETE /workspaces/{id}` in `app/routers/workspaces.py`.
- [x] Implement `PATCH /datasets/{id}` and
      `DELETE /datasets/{id}` in `app/routers/datasets.py`.
- [x] Tighten `POST /workspaces` to return 409 `name_taken`
      on collision. Update its contract YAML + MD to reflect
      the new response. Also tighten the batch-post for the
      `(workspace_id, name)` unique-index path.
- [x] Add four per-endpoint test files + extend the
      cross-cutting smoke test with four canonical responses.
- [x] Run `pnpm --filter @mdd/contracts test` — 11/11 still
      passing. Backend `uv run pytest` — 54/54.
- [x] Stamp [crud-hygiene.md](../../design/data-management/crud-hygiene.md)
      with `**Backend**: R25`.
- [x] `pnpm md:lint` 0 errors; `pnpm format:check` clean for
      R25-touched files after applying prettier.
- [x] Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- [x] Grep this file for unticked `- [ ]` before flipping to
      Review.

## Risks / unknowns

- **`ON DELETE CASCADE` on the existing FK.** The schema in
  `app/db.py` has
  `workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE`.
  That means a naive `DELETE FROM workspaces` cascades and
  silently kills the datasets — exactly what R23 says NOT
  to do. R25 keeps the cascade (defensive) but **gates every
  workspace-delete on a pre-check** of the dataset count.
  The cascade only fires if something slips through, in
  which case the FE has already seen a 409 anyway.
- **The duplicate-name back-fill is destructive in spirit.**
  Renaming `Marketing` → `Marketing (2)` is visible to the
  user. For a POC with no real production data, this is the
  safest non-blocking path. Log every rename to stdout so the
  operator sees what changed. If a future round wants a less-
  destructive approach (refuse to start; require human
  resolution), that's a follow-up round, not R25's call.
- **PATCH no-op.** What if the user PATCHes with the SAME
  name the resource already has? Lean: return 200 with the
  existing row (idempotent, no DB write needed). If we DO
  write, the unique index forbids self-collision because the
  `name` is unchanged — but the `UPDATE` succeeds anyway
  because SQLite doesn't error on update-to-self. Either
  path is safe; pick "always write, return updated row" for
  simplicity.
- **Concurrent deletes (workspace race).** User A deletes
  workspace W; user B simultaneously creates dataset D in W.
  Pre-check by A sees `datasetCount = 0`; A proceeds to
  delete; B's INSERT now violates the FK. Acceptable —
  single-user POC. The FE always treats 404 as success on
  re-fetch.
- **JSONResponse vs HTTPException.** FastAPI's
  `HTTPException(detail=…)` wraps the body in
  `{ detail: … }`. The R24 contract is `{ code, ... }` —
  not `{ detail: { code, ... } }`. So we MUST use
  `JSONResponse(status_code=409, content=…)` directly for
  the new error envelopes. Old endpoints' 404/422 stay on
  `HTTPException` because they keep their FastAPI-default
  envelopes.
- **The R16 batch-commit name-uniqueness behavior.** The
  upload-commit (`POST /workspaces/{id}/datasets/batch`) does
  NOT currently check for in-workspace name collisions; it
  trusts the wizard to set unique names. After R25 adds the
  unique index, the batch insert will violate-and-rollback
  on a duplicate within the same workspace. R25 should
  catch the `IntegrityError`, map it to a 409 response on
  the batch endpoint, and update the batch contract if the
  shape changes. Lean: 409 with `{ code: "name_taken",
conflicts: [name1, name2] }` — but that's a new schema
  shape, so it requires a contract update. Surface this as
  R25's load-bearing question in Do.
- **Markdownlint `+`-prefix gotcha**. Same R07–R23 carry-
  over. Lint after every MD edit.
- **R24 stamp on crud-hygiene.md already exists**. R25 just
  adds the next row.

## Do

### Pydantic models

Added four new closed models to
[`app/models/common.py`](../../../workspace/apps/backend/app/models/common.py):

- `RenameBody` — shared (lower-bound only); per-resource
  route handlers wrap in `Annotated[str, Field(max_length=N)]`
  for the resource-correct limit (80 vs 120).
- `ApiErrorNotFound`, `ApiErrorNameTaken`,
  `ApiErrorNonEmpty` — one-for-one with the
  [`_shared/api-error.yaml`](../../../workspace/packages/contracts/_shared/api-error.yaml)
  variants. All `extra='forbid'` per the R16 conformance
  discipline.

### Schema migration + back-fill

[`app/db.py`](../../../workspace/apps/backend/app/db.py) gains:

- `_R25_UNIQUE_INDEXES` script — `idx_workspaces_name_unique`
  and `idx_datasets_name_unique(workspace_id, name)`.
- `_backfill_duplicate_names(con)` — runs BEFORE the index
  creation. Older row keeps the name; later rows get
  `<name> (2)`, `<name> (3)`, etc. Logs each rename to
  stdout. Idempotent on fresh DBs.
- `bootstrap_schema` ordering: tables → back-fill → unique
  indexes. The back-fill ensures the unique index creation
  succeeds even on a DB with pre-existing duplicates.

### Route handlers

`apps/backend/app/routers/workspaces.py`:

- **POST tightened** — wrap `INSERT` in `try/except
sqlite3.IntegrityError`, return 409 `name_taken` on the
  unique-violation.
- **`PATCH /workspaces/{id}`** — pre-check existence (404);
  `UPDATE` may also violate the index (409 `name_taken`).
- **`DELETE /workspaces/{id}`** — pre-check existence;
  pre-count `COUNT(*) FROM datasets WHERE workspace_id = ?`;
  return 409 `non_empty` with `datasetCount` if any datasets
  reference it. The existing `ON DELETE CASCADE` is left in
  place as a belt-and-braces — it would only fire if the
  pre-check were ever bypassed.

`apps/backend/app/routers/datasets.py`:

- **`PATCH /datasets/{id}`** — pre-check existence; `UPDATE`
  may violate the per-workspace unique index (409
  `name_taken`); re-read for the response body.
- **`DELETE /datasets/{id}`** — atomic: validate exists →
  delete DB row → `rmtree` the dataset directory. If the
  rmtree fails after the DB commit, the row is gone but the
  directory leaks (acceptable for POC).
- **Batch-commit tightened** — the existing `commit_datasets_batch`
  gains a `sqlite3.IntegrityError` catch that maps the
  unique-index violation to `ApiErrorNameTaken` (alongside the
  existing FS-rollback).

`_is_unique_violation(err, table_index_substr)` is the shared
helper in `workspaces.py` (re-imported by `datasets.py`) so
both handlers branch on the same shape.

### Contract amendments (R24 follow-up tasks resolved)

- [`workspaces/post.contract.yaml`](../../../workspace/packages/contracts/workspaces/post.contract.yaml)
  gains a `409 name_taken` response referencing the shared
  envelope. The paired MD documents the behavior change.
- [`datasets/batch-post.contract.yaml`](../../../workspace/packages/contracts/datasets/batch-post.contract.yaml)
  promotes its 409 response to a `oneOf` over the existing
  `{ error, detail }` shape and the new
  `ApiErrorNameTaken`. The paired MD documents both shapes
  and how the FE branches.

### Tests

- Extended existing
  [`test_workspaces.py`](../../../workspace/apps/backend/tests/test_workspaces.py)
  with one new test for POST 409.
- Added four new per-endpoint test files:
  - [`test_workspaces_patch.py`](../../../workspace/apps/backend/tests/test_workspaces_patch.py)
    — 7 tests (happy path, 404, 409 with state-unchanged
    behavior assertion, rename-to-self idempotency, 422
    boundaries × 3).
  - [`test_workspaces_delete.py`](../../../workspace/apps/backend/tests/test_workspaces_delete.py)
    — 4 tests (204 happy, 404 missing, 404 already-deleted,
    409 non_empty with `datasetCount` body + state-unchanged
    behavior assertion).
  - [`test_datasets_patch.py`](../../../workspace/apps/backend/tests/test_datasets_patch.py)
    — 7 tests (happy path, 404, 409 with behavior assertion,
    cross-workspace name re-use allowed, 422 × 2, 120-char
    boundary).
  - [`test_datasets_delete.py`](../../../workspace/apps/backend/tests/test_datasets_delete.py)
    — 4 tests (204 + parquet-directory-gone behavior
    assertion, 404 missing, 404 already-deleted, workspace
    is unaffected).
- Extended
  [`test_conformance.py`](../../../workspace/apps/backend/tests/test_conformance.py)
  with four additional canonical responses (PATCH ws, PATCH
  ds, DELETE ds, DELETE ws).

### Verification

- Backend `uv run pytest` — **54 / 54 passing** (was 25
  pre-R25). All new tests + the extended conformance smoke
  test green.
- Contracts `pnpm --filter @mdd/contracts test` — **11 / 11
  passing**. The amendments to `post.contract.yaml` and
  `batch-post.contract.yaml` validate (the `oneOf` 409 on
  batch-post resolves through `$ref` cleanly).
- One pre-existing R16 carry-over warning persists
  (`commit_datasets_batch` cognitive complexity, now 40 from
  34 because of the new IntegrityError branch). Not R25's
  scope; logged as a follow-up.
- One IDE warning fixed mid-round: `from pathlib import Path`
  shadowed `from fastapi import Path` in `datasets.py`,
  causing `Path(pattern=…)` to call `pathlib.PurePath` (which
  Python 3.14 will deprecate). Aliased to `FastApiPath`.

## Check

- [x] Four new Pydantic models exist in
      `app/models/common.py` with `extra="forbid"`.
- [x] Schema migration adds the two unique indexes; back-fill
      logic runs before index creation; both inside
      `bootstrap_schema`.
- [x] `PATCH /workspaces/{id}` returns 200 with `Workspace`,
      404 `not_found`, 409 `name_taken`, 422 on bad body.
- [x] `DELETE /workspaces/{id}` returns 204, 404
      `not_found`, 409 `non_empty` with `datasetCount`.
- [x] `PATCH /datasets/{id}` returns 200 with `Dataset`,
      404 `not_found`, 409 `name_taken`, 422 on bad body.
- [x] `DELETE /datasets/{id}` returns 204, 404
      `not_found`. Parquet directory removed on success (test
      asserts `target.exists()` is False after delete).
- [x] `POST /workspaces` returns 409 `name_taken` on dup.
- [x] Per-endpoint tests + cross-cutting smoke updates all
      pass; behavior tests assert observable state changes
      for each error code.
- [x] `pnpm --filter @mdd/contracts test` — 11/11 passing.
- [x] Backend pytest suite passes end-to-end — 54/54.
- [x] `crud-hygiene.md` gains `**Backend**: R25` stamp.
- [x] `pnpm md:lint` 0 errors; `pnpm format:check` clean
      for R25-touched MDs.
- [x] All Plan + Check checkboxes flipped before Status
      flips to Review.

## Act

**Status**: Complete (human-approved 2026-05-25).

**Learnings**:

- **The `ON DELETE CASCADE` discovery was the highest-leverage
  finding of R25.** R23's design said "block non-empty", but the
  existing schema would have silently cascaded a workspace delete
  through all its datasets — exactly opposite of the design. The
  fix is small (pre-count + early-return 409), but missing it
  would have been a data-loss bug. The lesson: a B-round must
  read the existing schema in addition to the new contract;
  pre-existing constraints can contradict the design intent.
- **JSONResponse vs HTTPException for code-first envelopes.**
  FastAPI's `HTTPException(detail=…)` wraps the body in
  `{ detail: … }` — incompatible with R23's `{ code, ... }`
  shape. Routes returning code-first errors must use
  `JSONResponse(status_code=…, content=…)` directly. Mixed
  routers (some HTTPException, some JSONResponse) work fine; the
  decision is per-endpoint based on which envelope the contract
  specifies.
- **The R22 behavior-conformance sub-rule transferred cleanly.**
  Every error code in the four new endpoints got a behavior test
  asserting observable state change (or non-change for 409). The
  tests caught one real bug in my own draft (the "behavior
  unchanged" assertion was attempted across two TestClient
  blocks, which I fixed). Two-instance evidence (R20 BE; R25 BE)
  → third instance (R26 FE reducer) ahead. Per R23 Act follow-up
  on the methodology candidate.
- **Catching the pathlib/fastapi `Path` shadow mid-round.** The
  IDE caught the Python 3.14 deprecation warning early; aliasing
  to `FastApiPath` is the fix. Low-stakes, but a good cue: when
  the route module imports both `pathlib` and `fastapi`, alias
  one. Worth a small note for R26 if it has the same import
  pattern (unlikely — FE has no pathlib).

**Promotions** _(none this round)_: standard B-round.

**Follow-ups (not promotions, just notes):**

- **`commit_datasets_batch` cognitive complexity now ≥ 40
  (allowed 15)**. Up from 34 pre-R25 because of the new
  IntegrityError branch and the rollback split. The function
  is the natural seam for a refactor; pulling out a per-item
  `_stage_item(...)` helper would knock the complexity down
  meaningfully. R∞ — not blocking, not user-facing.
- **`response_model` parameter is redundant on annotated routes**
  (IDE warning S8409). Pre-existing R16 noise on two routes
  (`commit_datasets_batch`, `list_datasets`). A pure-cleanup
  round can remove them.
- **No conftest cleanup needed for the new tests** — they all
  use the existing `_isolated_backend_data` autouse fixture.
- **Operator note**: a back-fill rename produces a one-line log
  entry per dup. If a deployment ever shows lines starting with
  `[db.backfill]`, the operator needs to know the back-fill
  renamed user-visible data. The "rename to (2)" approach is
  the safest non-blocking default; if a future round wants a
  different policy (refuse-to-start, manual resolution), that's
  a focused infra round.

## Feeds into → Round_26 (Frontend — CRUD hygiene FE)

What R25 hands forward to R26:

- **Four live endpoints** matching the R24 contracts exactly,
  with `validate_response(...)` assertions baked into the BE
  test suite. R26 implements the FE side against the same
  contracts (hand-aligned TS types per the R17 F-step pattern).
- **The new `ApiError` envelope shape** to mirror on the FE
  side as a discriminated TS union:

  ```ts
  type ApiError = { code: 'not_found' } | { code: 'name_taken' } | { code: 'non_empty'; datasetCount: number };
  ```

  Plus an `ApiErrorFromBatch = ApiError | { error: string; detail?: string }`
  for the batch-commit's `oneOf` 409 (FE branches on whether
  `code` is present).

- **The behavior-conformance sub-rule, third instance pending.**
  R26 reducer tests apply the same rule: dispatch the action
  and assert the next-state shows the effect (R20 BE behavior;
  R21 FE reducer behavior; R25 BE behavior). A third FE-side
  instance would meet the Evolution Rule's 3-instance bar for
  promoting the sub-rule from the memo into the `context/`
  doc — held for the post-POC/MVP evaluation round.
- **Two existing endpoints with new error paths** for the FE
  to handle:
  - `POST /workspaces` now returns 409 `name_taken` — the
    create modal needs the same inline-error pattern as the
    rename modal (R23 modal state 3).
  - `POST /workspaces/{id}/datasets/batch` now returns 409
    with a `oneOf` body — the wizard's Confirm step needs
    to branch on whether `code === 'name_taken'` is present.
- **The atomic dataset-delete discipline as a reference**
  for any future "delete a resource with side-effects" handler.
