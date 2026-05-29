# Round 34: Contract — GET /datasets/{id} + GET /datasets/{id}/rows (with `?q=` filter)

**Status**: Complete
**Date started**: 2026-05-26
**Date completed**: 2026-05-26

## Goal

**Inherits from ← [Round_33](Round_33.md)** — R33 locked the
dataset-detail page design and prose-shaped two new GET routes in
`../../design/data-management/dataset-detail.md#data-contract-target-shape-for-r34`.
R34 mechanizes that prose into OpenAPI 3.1 YAML files under
[`workspace/packages/contracts/datasets/`](../../../workspace/packages/contracts/datasets/),
sibling `.contract.md` rationale files, and gets the new files
green under the existing `openapi-validity.test.ts` suite.

R34 is **contract-only** — no BE handler code, no FE client code,
no schemas/migrations. The YAML files are what R35 (BE) and R36
(FE) implement against. Follows the existing R15/R23/R24 contract-
round pattern (every contract YAML has a sibling `.contract.md`).

_Track: 1 (product — contracts are the BE/FE handshake for the
dataset-detail surface designed in R33). Pulled by: R33
`Feeds into` naming the two routes; R33 `dataset-detail.md`
§ Data contract prose-shape; existing convention that every BE
route has an OpenAPI contract before it lands. Per
[Evolution Rule](../../AGENTS.md)._

**Mid-round scope amendment**: while R34 was in Review, the
user flagged row-scale friction (2,481 rows ÷ 50 page-size
= 50 pages). R33's design was amended in-place to add a
`?q=` substring search bar (post-Complete append per PDCA
governance — see
[Round_33.md § Appending to Complete rounds](Round_33.md#appending-to-complete-rounds)).
R34's contract scope accordingly expanded to include the
`q` query param on `rows-get.contract.yaml` before flipping
to Complete.

**Reasonable defaults under [auto mode]; user redirects via
end-of-round Q&A if any miss:**

1. **File naming**: `detail-get.contract.{yaml,md}` for
   `GET /datasets/{id}` and `rows-get.contract.{yaml,md}` for
   `GET /datasets/{id}/rows`. The existing `get.contract.yaml`
   already owns the collection-GET; the new files use
   domain-leading prefixes to match the R33 "dataset detail"
   noun (`dataset-detail.md` and `dataset-detail.preview.html`).
2. **422 vs 200 for out-of-range page.** When `page > ceil(total /
page_size)`, return **200 with `rows: []`** — matches the
   existing
   [`get.contract.md` precedent](../../../workspace/packages/contracts/datasets/get.contract.md)
   ("the filter expression is well-formed even if it matches
   nothing"). 422 is reserved for malformed requests (page < 1,
   page_size not in `{25, 50, 100}`, id pattern mismatch). R33's
   prose said 422 here; tightening to 200-empty in this round
   for consistency with sibling contracts.
3. **`pageSize` casing.** Path/query param is snake_case
   (`page_size`) per existing convention (`workspace_id` in
   `get.contract.yaml`). Response body uses camelCase
   (`pageSize`) per the existing `Dataset` shape (`workspaceId`,
   `rowCount`, `columnCount`, `sourceFormat`, `sheetName`,
   `createdAt`). Mixed casing is intentional and already in the
   codebase.
4. **`RowsPage` lives inline in `rows-get.contract.yaml`.** No
   `_shared/rows-page.yaml` extraction — single consumer, no
   second pull yet. Per [Evolution Rule](../../AGENTS.md):
   "default = don't add."
5. **Reuse `ApiErrorNotFound` from
   [`_shared/api-error.yaml`](../../../workspace/packages/contracts/_shared/api-error.yaml).**
   Both routes' 404s use the existing envelope. No new error
   codes.

## What is IN scope

### 1. `detail-get.contract.yaml` + `.contract.md`

- New file
  [`workspace/packages/contracts/datasets/detail-get.contract.yaml`](../../../workspace/packages/contracts/datasets/detail-get.contract.yaml).
- OpenAPI 3.1; `operationId: getDataset`; `summary: Get a single
dataset by id`.
- Path param `id` with pattern `^ds_[0-9a-f]{8}$` (matches
  `_shared/dataset.yaml`).
- 200 response → `$ref:
'../_shared/dataset.yaml#/components/schemas/Dataset'`. Same
  shape as the list-GET; no new fields.
- 404 response → `$ref:
'../_shared/api-error.yaml#/components/schemas/ApiErrorNotFound'`.
- One or two response `examples` (an Excel dataset + a CSV
  dataset) — matches the existing `get.contract.yaml` style.
- New file `detail-get.contract.md` (rationale): purpose,
  behavior (idempotent, pure read), error semantics, examples,
  cross-links to `_shared/dataset.yaml`, R33's design doc, and
  the sibling list-GET.

### 2. `rows-get.contract.yaml` + `.contract.md`

- New file
  [`workspace/packages/contracts/datasets/rows-get.contract.yaml`](../../../workspace/packages/contracts/datasets/rows-get.contract.yaml).
- OpenAPI 3.1; `operationId: getDatasetRows`; `summary: Get a
paged slice of a dataset's rows`.
- Path param `id` with pattern `^ds_[0-9a-f]{8}$`.
- Query params:
  - `page`: `integer`, `minimum: 1`, `default: 1`. 1-indexed.
  - `page_size`: `integer`, `enum: [25, 50, 100]`, `default: 50`.
- 200 response → inline `RowsPage` object with `rows` (array of
  arrays of `[string, 'null']`), `page` (integer ≥ 1),
  `pageSize` (integer ∈ enum), `total` (integer ≥ 0).
- 404 response → `$ref:
'../_shared/api-error.yaml#/components/schemas/ApiErrorNotFound'`.
- 422 response → existing FastAPI `{ detail: [...] }` shape
  (consistent with R15 contracts which use FastAPI's default
  envelope for request-level validation). Used only for
  malformed `page` / `page_size` / `id` pattern. Out-of-range
  `page > ceil(total / page_size)` is **200 with empty rows**,
  not 422 (per decision 2 above).
- Two response `examples`: page 1 of 50 with 50 rows (full
  page), page 50 of 50 with partial trailing rows, and an
  empty-rows example for the out-of-range case.
- `additionalProperties: false` on the response body to mirror
  the BE's `extra='forbid'` Pydantic discipline (per the R16
  conformance pattern).
- Sibling `rows-get.contract.md` rationale: cell-stringification
  rationale (carries forward R33's BE-renders / FE-display-
  formats line), pagination semantics, why page > total returns
  200 not 422, why `RowsPage` is inline not `_shared/`, examples.

### 3. Stamp `dataset-detail.md`

- Update the **Data contract (target shape for R34)** section
  to reference the now-canonical YAML files; keep the inline
  YAML blocks as prose because they're useful as a reading aid,
  but add a callout that
  [`detail-get.contract.yaml`](../../../workspace/packages/contracts/datasets/detail-get.contract.yaml)
  and
  [`rows-get.contract.yaml`](../../../workspace/packages/contracts/datasets/rows-get.contract.yaml)
  are now authoritative.
- Update the **Read/write boundary** R34+ list to mark the
  contract-row landed.

### 4. Round file + checks

- This Round_34.md.
- `pnpm --filter @mdd/contracts test` — the existing
  `openapi-validity.test.ts` auto-discovers `*.contract.yaml`
  files and validates them via `@apidevtools/swagger-parser`.
  Two new contracts → two new test cases pass.
- `npx markdownlint-cli2` repo-wide returns 0 errors.
- Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- Grep this file for unticked `- [ ]` before flipping Status.

## What is OUT of scope

- **No BE code.** No FastAPI route handler, no `pyarrow` paged
  reader, no router-test additions. R35 (B-round) does that.
- **No FE code.** No `datasetsApi.get(id)` / `.getRows(...)`,
  no TanStack hooks, no page component. R36 (F-round).
- **No `_generated/` constant changes.** R29's cross-language
  constants cover IDs (`ws_*`, `ds_*`, `tmp_*`) and error codes
  (`not_found`, `name_taken`, `non_empty`). R34 introduces no
  new IDs or error codes — both routes' 404s reuse `not_found`.
  Page-size enum values (`25 / 50 / 100`) live only in the
  contract; no constants channel pulls them yet.
- **No `_shared/rows-page.yaml` extraction.** Single consumer;
  default = don't add. Promote if a second paged-rows endpoint
  appears.
- **No new error codes.** Both routes use the existing
  `ApiErrorNotFound` envelope. New codes require a memory
  update + cross-language constants regeneration.
- **No append-mode / sort / filter contract surface.** Those
  are R∞ per `dataset-detail.md` deferral list.
- **No DELETE /datasets/{id}/rows or PATCH** — datasets are
  immutable post-commit; row-level mutation contracts don't
  exist yet.

## Plan

- [x] Confirm scope at planning review (decisions 1-5 above;
      user redirects any via end-of-round Q&A).
- [x] Author
      `workspace/packages/contracts/datasets/detail-get.contract.yaml`
      with operationId, path param, 200 (Dataset $ref), 404
      (ApiErrorNotFound $ref), examples.
- [x] Author `detail-get.contract.md` rationale (purpose,
      behavior, examples, cross-links).
- [x] Author `rows-get.contract.yaml` with operationId, path +
      query params, inline `RowsPage` 200 shape, 404 + 422
      responses, examples (full page, partial trailing,
      out-of-range empty).
- [x] Author `rows-get.contract.md` rationale (cell
      stringification, pagination semantics, why 200-empty for
      out-of-range, why no `_shared/` extraction).
- [x] Stamp `dataset-detail.md` — link the new YAML files as
      authoritative; mark contract-row landed in Read/write
      boundary.
- [x] `pnpm --filter @mdd/contracts test` — 13/13 tests green
      (was 11; two new cases auto-discovered).
- [x] `npx markdownlint-cli2` — 0 errors repo-wide.
- [x] Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- [x] Grep this file for unticked `- [ ]` before flipping to
      Review.

## Risks / unknowns

- **OpenAPI nullable arrays of nullable strings.** The cell
  shape is `(string | null)[][]`. In OpenAPI 3.1 the canonical
  spelling is `type: [string, 'null']` (JSON-Schema-style
  union). `swagger-parser` should handle this; if it chokes,
  fall back to `type: string, nullable: true` (OpenAPI 3.0
  style, still accepted by 3.1 parsers in practice).
- **`additionalProperties: false` interaction with
  swagger-parser.** Some validators warn when 3.1 schemas use
  3.0-isms; the existing contracts (`_shared/api-error.yaml`)
  use `additionalProperties: false` without issue, so the
  pattern is proven. Mitigation: copy the exact pattern.
- **Example-row content quality.** The examples carry forward
  R33's preview data shape (dtype-mixed columns). Acceptable to
  hand-craft; production should not derive from examples
  (R29's `_generated/` constants are the channel for that).
- **Should `total` be `rowCount` to match `Dataset`?** R33's
  prose says `total`. `rowCount` would match the parent
  `Dataset` field name but conflates "total in this filter" with
  "total in this dataset" — same number here, but if filtering
  ever lands the names diverge. Keep `total` to leave room for
  a filtered-row count later. (Document the rationale in the
  contract.md.)
- **`pageSize` echo in response.** Technically redundant — the
  client already knows what it asked for. But it makes the
  response self-describing and matches the AntD `<Pagination>`
  data shape the FE will pass through verbatim. Keep.

## Do

**Detail-GET contract.**

- [`detail-get.contract.yaml`](../../../workspace/packages/contracts/datasets/detail-get.contract.yaml)
  authored against `_shared/dataset.yaml` (200) and
  `_shared/api-error.yaml` (404). Two response examples: an
  Excel dataset with `sheetName`, and a CSV dataset without —
  proves both branches of the `sourceFormat` enum exercise the
  shape correctly.
- [`detail-get.contract.md`](../../../workspace/packages/contracts/datasets/detail-get.contract.md)
  documents shape parity with the list-GET (FE can hydrate
  TanStack cache from either source), no detail-only fields, no
  `?expand=` query params, and the 410-vs-404 decision (404 for
  deleted to match delete + patch contracts).

**Rows-GET contract.**

- [`rows-get.contract.yaml`](../../../workspace/packages/contracts/datasets/rows-get.contract.yaml)
  defines the inline `RowsPage` response object with
  `additionalProperties: false`, OpenAPI 3.1 nullable cells via
  `type: [string, 'null']`. Six response examples cover:
  full-first-page, partial-last-page, out-of-range-empty,
  zero-rows-dataset, filtered-subset (`?q=won` matching a
  1,204-row subset), and filtered-no-match (`?q=ZZZZZ`
  returning empty with `total: 0`). The `pageSize` field is
  documented as a deliberate redundant echo (self-describing
  response feeds AntD `<Pagination>` verbatim).
- [`rows-get.contract.md`](../../../workspace/packages/contracts/datasets/rows-get.contract.md)
  carries the cell-stringification rationale forward from
  R33's `dataset-detail.md` § Data contract (BE renders to
  string per dtype; FE display-formats from
  `Dataset.columns[].dtype`). Documents why `total` instead of
  `rowCount` (room for a future `?filter=` that would scope
  the count — now partially realized by `?q=`'s matched-row
  semantics), why no `_shared/rows-page.yaml` extraction
  (single consumer; default = don't add), and the `?q=`
  semantics (case-insensitive substring across any cell, page
  resets to 1 on q-change, zero-match returns 200-empty not
  422).

**Tightened from R33 prose.**

- **Out-of-range page → 200-empty, not 422.** R33 prose-shaped
  this as 422; R34 tightened to 200 with `rows: []` to match
  the
  [list-GET precedent](../../../workspace/packages/contracts/datasets/get.contract.md)
  ("the filter expression is well-formed even if it matches
  nothing"). 422 is reserved for malformed requests (page < 1,
  page_size off-enum, id pattern mismatch). Decision documented
  in both `rows-get.contract.md` § Behavior and § Error
  semantics so R35 doesn't accidentally implement 422.

**Sibling stamp.**

- [`dataset-detail.md`](../../design/data-management/dataset-detail.md)
  § Data contract gains a callout block linking the two new
  YAML files as authoritative (prose YAML stays as a reading
  aid). § Read/write boundary's R34+ list grows a ticked
  `✅ R34` entry with a link to this round.

**Check pipeline.**

- `pnpm --filter @mdd/contracts test`: **13/13 green** (was
  11/11; two new cases `detail-get` + `rows-get` auto-
  discovered by `openapi-validity.test.ts` and validated via
  `@apidevtools/swagger-parser`; the post-amendment re-run
  after adding `?q=` + 2 new examples stays at 13/13).
- `git diff --stat`: only contracts + design doc + this round
  file touched; zero BE/FE code, zero shared-schema edits.
- `npx markdownlint-cli2` repo-wide: 0 errors.

## Check

- [x] Two new `*.contract.yaml` files exist under
      `workspace/packages/contracts/datasets/`.
- [x] Two new `*.contract.md` files exist alongside the YAMLs.
- [x] `pnpm --filter @mdd/contracts test` reports all
      contract-discovery tests green: 13/13 (was 11; two new
      cases `detail-get` + `rows-get` auto-discovered).
- [x] `dataset-detail.md` references the new YAML files as
      authoritative.
- [x] No BE / FE / shared-schema files changed this round
      (verified via `git diff --stat` — only
      `workspace/packages/contracts/datasets/` +
      `.agents/design/data-management/dataset-detail.md` +
      `.agents/plan/cycles/Round_34.md` paths touched).
- [x] `npx markdownlint-cli2` returns 0 errors.
- [x] Post-round audit per [PDCA.md § Post-round audit](../PDCA.md)
      passes.
- [x] All Plan + Check checkboxes flipped before Status flips
      to Review.

## Act

**Learnings**:

- **R33 prose was right to be tightened in R34.** The
  out-of-range-page → 422 prose in R33's design doc would have
  made the FE branch on "user requested a page, server said no"
  vs "row count just changed under me" — different failure
  modes, same code. Returning 200-with-empty-rows lets the FE
  treat any non-2xx as a real error and any 2xx as "render what
  came back." The list-GET set this precedent in R15; sticking
  with it across the dataset family keeps FE error-branching
  uniform. **Lesson**: a C-round is the right place to second-
  guess D-round prose against actual sibling contracts — that's
  what the C-round is for.
- **`additionalProperties: false` on response bodies survives
  swagger-parser 3.1.** The pattern was already proven in
  `_shared/api-error.yaml`; copied verbatim and `swagger-parser`
  validated without complaint. No fallback needed.
- **OpenAPI 3.1 union types (`type: [string, 'null']`) work in
  examples without coaxing.** The 4 rows-GET examples include
  rows with null cells inline; `@apidevtools/swagger-parser`
  validated them. Confirms 3.1's JSON-Schema-style unions are
  the cleaner spelling vs 3.0's `nullable: true` for new
  contracts.
- **Two contracts is the right granularity, not one.** I
  considered putting both routes in a single `detail-routes.contract.yaml`
  (OpenAPI supports multiple paths per file). The existing
  one-file-per-route convention (`delete.contract.yaml`,
  `patch.contract.yaml`, `get.contract.yaml`) won out because
  the `openapi-validity` test discovers per-file and the
  contract-md rationale split is cleaner — each route's
  semantics get its own document. Stayed with the convention.
- **`total` over `rowCount` is a 30-second decision that buys
  contract evolution.** Naming the response field `total`
  instead of `rowCount` looks redundant today (they're always
  equal). But the moment a `?filter=` query lands, the names
  diverge — and renaming a wire field is expensive. Two-letter
  decisions like this are where contract rounds earn their
  keep.

**Promotions** _(none — implementation round's-worth of
contract work; the YAMLs live in
[workspace/packages/contracts/datasets/](../../../workspace/packages/contracts/datasets/)
and the rationale lives in their sibling `.contract.md` files)_:

**Follow-ups (not promotions, just notes):**

- **`_shared/rows-page.yaml` extraction trigger**: the moment a
  second paged-rows endpoint appears (saved-query results,
  audit-log slices, BE-side paginated workspace list at large
  scale). Document the trigger as a one-liner in the rationale
  once a second consumer is in flight.
- **Cell-typing reconsideration trigger**: if the FE ends up
  re-parsing strings to numbers/dates on every cell render, the
  CPU cost may justify typed cells. Profile in R36; revisit if
  the dataset detail page feels sluggish at 100 rows × 12 cols.
  Today's bet: `Intl.NumberFormat` + `Intl.DateTimeFormat` are
  fast enough.
- **AntD `<Pagination>` "showSizeChanger" defaults**: the FE
  will pass `pageSizeOptions={['25', '50', '100']}` to match
  the contract's enum exactly. Document as part of R36's
  Plan so the contract-FE binding stays explicit.
- **`getDataset` operationId style consistency**: existing
  operationIds are camelCase (`listDatasets`,
  `commitDatasetsBatch`, `deleteDataset`). New ones follow:
  `getDataset`, `getDatasetRows`. Codegen (if it ever lands)
  will produce TypeScript symbol names of the same shape —
  matches the existing `datasetsApi.list()` / `.delete()`
  surface.

## Feeds into → Round_35 (BE: GET /datasets/{id} + GET /datasets/{id}/rows handlers)

R34 hands forward:

- **Two locked OpenAPI 3.1 contracts** that R35's FastAPI
  routes implement against. SwaggerParser validation passes.
- **Pagination semantics**: `page` 1-indexed, `page_size`
  enum-restricted, out-of-range returns 200-with-empty-rows
  (not 422).
- **Row filter (`?q=`)**: optional substring (1-200 chars,
  case-insensitive across all cells). `total` reflects matched
  count when present; full rowCount otherwise. Zero-match
  returns 200-empty.
- **Cell stringification**: BE renders `(string | null)[][]`
  using pyarrow → python-string conversion per dtype. FE
  re-applies display formatting from
  `Dataset.columns[].dtype`.
- **404 reuse**: both routes reuse `ApiErrorNotFound`. No new
  error codes; no `_generated/` regeneration needed.

R35 picks up the **BE handler round** (B in DCBF):

- FastAPI route handlers in
  `apps/backend/app/routers/datasets.py`.
- `pyarrow.parquet` paged reader for `rows-get` (page
  slice via `read_row_group` or `read_table` + `slice`).
- `?q=` substring filter: scan rows, stringify cells per
  dtype, lowercased `in` check; apply before paginating so
  `total` is the matched count. Naive O(rows × cols) scan
  is fine at POC scale; promote to indexed search if a real
  user hits 1M+ row latency.
- pytest cases for both routes (happy path + 404 +
  out-of-range + page_size enum + `?q=` matched subset +
  `?q=` zero-match + `?q=` too-long-422 + parquet-not-found
  edge).
- Backend `Dataset` Pydantic model already exists from R16 —
  no schema/migration changes.

R36 (F-round) follows R35 with the FE page + hooks against
R33's design.
