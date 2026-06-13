# Round 38: Contract — `GET /datasets/{id}/rows` filter-params extension

**Status**: Complete
**Date started**: 2026-05-27
**Date completed**: 2026-05-27

## Goal

**Inherits from ← [Round_37](Round_37.md)** — R37 locked the
per-column filter design in
[`dataset-filters.md`](../../design/data-management/datasets/dataset-filters.md)
and prose-shaped the rows-GET contract extension in two
flavors: primary (encoded params `f<N>_op` / `f<N>_val` /
`f<N>_min` / `f<N>_max`) and fallback (`POST :search` JSON
body). End-of-R37 Q&A picked filter contracts as R38 (over
MSW, which slips to R41+ per
[`decisions/2026-05-27-verification-stack-queue.md`](../../decisions/2026-05-27-verification-stack-queue.md)).

R38 mechanizes the encoded-params shape into the existing
[`rows-get.contract.yaml`](../../../workspace/packages/contracts/datasets/rows-get.contract.yaml)
and extends the sibling
[`rows-get.contract.md`](../../../workspace/packages/contracts/datasets/rows-get.contract.md)
rationale. R38 is **contract-only** — no BE handler code, no
FE client code, no schemas. The YAML extension is what R39
(BE) and R40 (FE) implement against. Follows the existing
contract-round pattern (every contract YAML has a sibling
`.contract.md`; every change passes
[`openapi-validity.test.ts`](../../../workspace/packages/contracts/tests/openapi-validity.test.ts)).

_Track: 1 (product — contracts are the BE/FE handshake for
the filter feature designed in R37). Pulled by: R37
`Feeds into` naming this round + the rows-GET as the contract
to extend; existing convention that every BE-route change has
an OpenAPI update before it lands. Per
[Evolution Rule](../../AGENTS.md)._

**Reasonable defaults under [auto mode]; user redirects via
end-of-round Q&A:**

1. **Encoded-params shape, not `POST :search` JSON body.**
   R37 named encoded params as primary; this round commits.
   URL-debuggable, share-by-URL works, no parallel endpoint
   to maintain. The fallback `:search` POST stays parked in
   `dataset-filters.md` for promotion if a future round
   sees ≥ 8 active filters become routine.
2. **N is a 0-based column index, not column name.** Names
   can contain spaces, slashes, unicode; indices are stable
   (the schema is fixed post-commit per R14 Read/write
   boundary) and match the `col_0`, `col_1`, … convention
   R36 already uses for AntD dataIndex collision avoidance.
3. **OpenAPI param declaration uses illustrative `f0_*`
   params + prose convention.** OpenAPI 3.1 has no native way
   to express "param key parameterized by N." The contract
   YAML declares the four shape variants (`f0_op`,
   `f0_val`, `f0_min`, `f0_max`) as concrete parameters with
   detailed `description` blocks explaining the
   N-parameterization; the rationale doc spells the rule.
   Validation at the contract level is best-effort; full
   per-dtype operator/value enforcement lives at the BE
   (R39).
4. **Operator enum carried in `description`, not `schema.enum`.**
   The valid operator set depends on the column's dtype, which
   the rows endpoint doesn't know without first looking up
   `Dataset.columns[]`. A static `enum` would either reject
   valid ops (if narrowed per a single dtype) or accept invalid
   ones (if union'd). Prose + the R37 vocabulary table is the
   honest contract; BE returns 422 for dtype-mismatch.
5. **422 dtype-mismatch reuses the FastAPI envelope.** Same
   shape as the existing `page < 1` / `page_size off-enum` 422. New error codes (`filter_op_dtype_mismatch`,
   `filter_value_unparseable`, `filter_col_out_of_range`) are
   communicated via `detail[].msg` strings, not a new error-
   envelope schema. Matches the discipline of the existing
   422 path.
6. **`total` semantics extend straightforwardly.** When ≥ 1
   filter is active, `total` reflects the filter-matched count
   (same rule as `?q=`). When both `?q=` and filters are
   active, `total` reflects the AND-composed count. The FE
   uses `Dataset.rowCount` for "matched X / Y" copy
   regardless.
7. **No `additionalProperties` tightening on query.** OpenAPI
   doesn't enforce query-param closure (request body, yes;
   query, not really). FastAPI's `extra='forbid'` discipline
   applies to body params, not query. Documented in the
   rationale that unknown `f<N>_*` keys for N beyond
   `columnCount` return 422 (not silently ignored) — the BE
   enforces.

## What is IN scope

### 1. Extend `rows-get.contract.yaml`

- File:
  [`workspace/packages/contracts/datasets/rows-get.contract.yaml`](../../../workspace/packages/contracts/datasets/rows-get.contract.yaml).
- Update `info.description` — note the new filter-params
  extension (R38) alongside the existing `?q=` substring
  (R34-amend).
- Add four `parameters` entries (illustrative `f0_*`):
  - `f0_op` — operator key. Prose description names the full
    vocabulary per dtype (per the R37 predicate-vocabulary
    table); `schema.type: string` (no `enum` per decision 4).
  - `f0_val` — single-operand value. `schema.type: string`
    (lexical envelope; BE parses per column dtype). Description
    spells out the per-dtype parse rule (int → signed int64,
    float → double, date → ISO `YYYY-MM-DD`, datetime →
    ISO `YYYY-MM-DDTHH:MM:SS`, bool → unused, string → utf-8).
  - `f0_min` / `f0_max` — range-operator bounds (`between`).
    Same `schema.type: string` + per-dtype parse rule.
- Add a top-of-parameters prose block (via `description` on
  the first `f0_op` param) explaining the N-parameterization:
  "Parameters `f<N>_op` / `f<N>_val` / `f<N>_min` / `f<N>_max`
  define per-column filter predicates where `<N>` is the
  0-based index into `Dataset.columns[]`. Multiple columns
  compose with implicit AND; per-column the filter has one
  operator. AND-composes with `?q=`."
- Extend the 422 `description` to add the dtype-mismatch and
  out-of-range-column cases.
- Extend the response 200 `description` to clarify the
  `total` semantics: matched-row count under filters (and
  under filters AND `?q=`).
- Add three illustrative examples to the 200 response
  `examples` block:
  - `filtered_per_column_string_equals` — `?f3_op=equals&f3_val=won`
    returns the won-rows subset (parallel to the existing
    `filtered_subset` example for `?q=`).
  - `filtered_per_column_numeric_between` —
    `?f1_op=between&f1_min=10000&f1_max=50000` returns a
    range-bound subset.
  - `filtered_compose_q_and_filter` —
    `?q=renewal&f3_op=equals&f3_val=won` returns the
    AND-composed subset.
- Add one 422 example for dtype-mismatch
  (`f1_op=contains&f1_val=foo` on an `integer` column).

### 2. Extend `rows-get.contract.md`

- File:
  [`workspace/packages/contracts/datasets/rows-get.contract.md`](../../../workspace/packages/contracts/datasets/rows-get.contract.md).
- New section "Per-column filters via `f<N>_*` params"
  immediately after the existing `?q=` behavior section,
  covering:
  - Why per-column index keys (not names): URL-debuggable,
    stable, matches `col_N` convention.
  - Predicate vocabulary reference — point to
    [dataset-filters.md § Predicate vocabulary
    table](../../../.agents/design/data-management/dataset-filters.md#predicate-vocabulary-table)
    as the authoritative cross-stack spec.
  - AND-compose with `?q=`: filters run first (DuckDB WHERE
    clause), `?q=` runs over the filtered result. `total`
    reflects the post-AND count.
  - Why no per-param `enum` for `op`: operator validity is
    dtype-dependent; the BE does the per-dtype check and
    returns 422 with `detail[].msg` naming the mismatch.
  - Why no JSON body: encoded params chosen as primary in
    R37; `POST :search` parked as fallback if URL bloat
    bites.
- New section "Filter-related 422 cases" under the existing
  error semantics section, listing the new `detail[].msg`
  strings the BE will surface (cross-references R39 BE
  scope).
- One new HTTP-trace example pair (filter + 422 dtype
  mismatch) added to the Examples section, mirroring the
  existing `?q=` examples.

### 3. Stamp the design doc

- [`dataset-filters.md`](../../design/data-management/datasets/dataset-filters.md)
  § Data contract: replace the "R38 picks" prose with the
  committed shape (encoded params) and link the now-
  authoritative YAML + rationale files. Keep the
  `POST :search` paragraph as a documented fallback for
  future promotion.

### 4. Pipeline

- `pnpm --filter @mdd/contracts test` — all existing contract-
  validity tests stay green + the extended `rows-get.yaml`
  still validates as OpenAPI 3.1 (SwaggerParser passes).
- `npx markdownlint-cli2` — 0 errors repo-wide.
- Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- Grep this file for unticked `- [ ]` before flipping Status.

## What is OUT of scope

- **No BE handler code.** R39 lands the DuckDB WHERE-clause
  builder + per-dtype value parser.
- **No FE client code.** R40 lands `datasetsApi.getRows`
  with the filter argument, the `useFiltersState` hook, the
  filter trigger + popover + chip row.
- **No `_shared/filter-predicate.yaml` extraction.** Single
  consumer (this rows endpoint). Per the
  [Evolution Rule](../../AGENTS.md): _default = don't add._
  A `_shared/` schema lands when a second filter-accepting
  endpoint actually arrives (e.g. saved-query results,
  cross-dataset catalog filtering).
- **No `_shared/filter-error.yaml` envelope.** The 422 dtype-
  mismatch reuses FastAPI's existing request-validation
  envelope (same shape as `page < 1` 422). New error
  codes communicate via `detail[].msg` strings, not a new
  envelope schema.
- **No `POST :search` parallel endpoint.** Parked as
  fallback in `dataset-filters.md`; promotion requires a
  future-round pull (e.g. ≥ 8 active filters becomes
  routine and URL bloat becomes a real problem).
- **No sort params (`?order_by=&direction=`).** Sort is
  deferred to its own DCBF chain after R40 lands filters
  (user confirmed split, not bundle, at end-of-R37).
- **No advanced-query syntax (`stage:won AND amount>10000`).**
  Per-column predicates only this round. Advanced query is
  a separate concept and gets its own DCBF chain when
  filters prove the demand.

## Plan

- [x] Confirm scope at planning review (decisions 1-7 above;
      user redirects any via end-of-round Q&A).
- [x] Extend `rows-get.contract.yaml` with the four `f0_*`
      illustrative params, the N-parameterization prose,
      the extended 422 description, the 3 + 1 new examples,
      and the `total` clarification.
- [x] Extend `rows-get.contract.md` with the
      "Per-column filters" + "Filter-related 422 cases"
      sections + four new HTTP-trace example pairs (per-
      column equals, AND-compose with q, dtype-mismatch 422,
      numeric range).
- [x] Stamp `dataset-filters.md` § Data contract — replace
      "R38 picks" prose with the committed shape, link the
      authoritative YAML + rationale.
- [x] Run
      `pnpm --filter @mdd/contracts test` — 13/13 green
      (existing + the extended `rows-get.contract.yaml`
      still validates as OpenAPI 3.1).
- [x] `npx markdownlint-cli2` — 0 errors over 96 files.
- [x] Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- [x] Grep this file for unticked `- [ ]` before flipping
      to Review.

## Risks / unknowns

- **OpenAPI's lack of "param key parameterized by N" support
  is a real cliff.** The contract declares the shape via 4
  illustrative `f0_*` params + prose. Generators (`openapi-
typescript`, etc.) downstream may not generate the right
  types for arbitrary N. Mitigation: the FE doesn't read
  generated types for query params today (it builds the
  query string manually via `URLSearchParams`); when codegen
  arrives in a future round, the team revisits whether to
  promote the `POST :search` shape or hand-roll a custom
  type for this endpoint. Documented in the rationale.
- **`schema.type: string` for `f<N>_val` looks weak.** A
  more typed declaration would use `oneOf` with per-dtype
  schemas, but the dtype lookup happens in the BE, not in
  contract validation. Mitigation: prose names the per-
  dtype parse rule + 422 envelope on parse failure. The
  rationale doc explicitly states "lexical envelope, BE
  parses." This is the same discipline `page` / `page_size`
  use (typed `integer` only because the FastAPI request
  validator can parse them up-front).
- **Multiple `f<N>_*` for the same N (e.g. `f0_op` +
  `f0_min` + `f0_max` for `between` and a stray `f0_val`).**
  The BE picks the right fields per the operator and
  returns 422 if the operator/field combination is
  inconsistent (`between` with `val` instead of `min`/`max`,
  or `equals` with `min`/`max` instead of `val`).
  Documented in the rationale.
- **URL length at 12 columns × 4 params = 48 keys.** A
  worst-case dataset with a filter on every column writes
  ~48 params. URLs stay legible up to ~2000 chars; even at
  the max we're well under (~1500 chars for typical
  values). Mitigation: design doc names a UX guideline of
  8 active filters; if it ever bites, the `POST :search`
  fallback promotes.
- **`f0_op` parameter `description` becomes the canonical
  contract for the operator vocabulary.** The R37
  predicate-vocabulary table in `dataset-filters.md` is
  the authoritative cross-stack spec; the YAML
  `description` mirrors it concisely. Mitigation: prose
  in both files cross-links to the design doc as the
  single source of truth; the YAML description is a
  reading aid, not a separate spec.
- **Contract-validity test scope.** `SwaggerParser.validate`
  checks structural validity (OpenAPI 3.1 conformance,
  `$ref` resolution); it does not exercise the prose
  description, the operator vocabulary, or the per-dtype
  parse rule. R39 BE tests cover those semantic constraints.
  R38 only verifies the YAML still parses as OpenAPI 3.1.

## Do

**YAML extension.**

- [`rows-get.contract.yaml`](../../../workspace/packages/contracts/datasets/rows-get.contract.yaml)
  `info.description` extended to name the R38 `f<N>_*`
  extension alongside the R34-amend `?q=` substring filter.
  New paragraph cross-links to the R37 predicate vocabulary
  table for the authoritative cross-stack spec.
- Four new `parameters` entries (`f0_op`, `f0_val`,
  `f0_min`, `f0_max`) appended after `q`. `f0_op` carries the
  full N-parameterization convention + per-dtype operator
  vocabulary in its `description` block; `f0_val` /
  `f0_min` / `f0_max` carry the per-dtype parse rules. All
  four use `schema.type: string` (lexical envelope; BE
  parses).
- `200` `description` clarified: `total` now reflects the
  AND-composed matched count across the (optional) `q` and
  (optional) `f<N>_*` predicates. Schema `total` field's
  `description` matches.
- Three new 200 `examples`:
  `filtered_per_column_string_equals` (column 3 `stage` =
  "won"),
  `filtered_per_column_numeric_between` (column 1 `amount`
  in [10000, 50000]),
  `filtered_compose_q_and_filter` (`?q=renewal` AND
  `f3_op=equals&f3_val=won`).
- `422` `description` extended to enumerate the four new
  filter-related error codes (`filter_op_dtype_mismatch`,
  `filter_value_unparseable`, `filter_col_out_of_range`,
  `filter_operand_shape`) with their trigger conditions and
  `detail[].msg` shape. New `filter_dtype_mismatch` example
  shows the wire envelope.

**Rationale extension.**

- [`rows-get.contract.md`](../../../workspace/packages/contracts/datasets/rows-get.contract.md)
  gained the "Per-column filters via `f<N>_*` params (R38)"
  section between the existing `?q=` behavior and the cell-
  stringification section. Covers: why column index (not
  name), why no `schema.enum` on `op`, why `schema.type:
string` on `val` / `min` / `max`, AND-compose with `?q=`,
  operator vs operand shape (with table), why no JSON-body
  parallel, why no `_shared/filter-predicate.yaml` extraction.
- Existing "Page resets on `q` change" bullet updated to
  also cover filter changes (any `f<N>_*` add / change /
  remove resets `page`).
- New "Filter-related 422 cases (R38)" sub-section under
  error semantics. Four-row table mapping each `msg` prefix
  to its trigger. Explicit note that filter-empty (matches
  the predicate set but returns zero rows) is 200, not 422
  — same shape as the `?q=` no-match case.
- Four new HTTP-trace examples appended to the Examples
  section: per-column `equals`, AND-compose with `?q=`,
  dtype-mismatch 422, numeric `between`.
- Cross-links section gained
  [`dataset-filters.md`](../../design/data-management/datasets/dataset-filters.md)
  as the authoritative design spec.

**Design doc stamp.**

- [`dataset-filters.md`](../../design/data-management/datasets/dataset-filters.md)
  § Data contract: "Target shape for R38" header replaced
  with an "R38 update" callout that points to the now-
  authoritative YAML + rationale files. Sub-section retitled
  "Committed shape (R38): encoded params"; the OpenAPI-3.1-
  no-N-parameterization-support note updated from "R38
  picks" to past-tense "R38 mechanized via four illustrative
  `f0_*` parameter entries." `POST :search` fallback
  paragraph stays unchanged (still parked).

**Lint + test pipeline.**

- `pnpm --filter @mdd/contracts test` — **13/13 green**
  (every contract YAML still validates as OpenAPI 3.1 via
  SwaggerParser; the extended `rows-get.contract.yaml`
  parses cleanly including the four new parameters, the new
  examples, and the extended 422 envelope).
- `npx markdownlint-cli2` — **0 errors over 96 files**. One
  MD049 emphasis-style nit caught mid-round
  (`*malformed*` / `*empty-result*` → `_malformed_` /
  `_empty-result_` to satisfy the underscore-emphasis rule);
  fixed in place. R37's preview HTML chip-anchoring fix
  (popovers moved from a stale absolute-positioned overlay
  to per-`<th>` children with `overflow: visible` on the
  table wrap) is unrelated to R38 but rolled into the same
  working tree.

## Check

- [x] YAML validates as OpenAPI 3.1 via SwaggerParser
      (the contract-validity test suite passes).
- [x] Four `f0_*` parameter entries declared with concrete
      `name`, `in: query`, `required: false`,
      `schema.type: string`, and prose `description`
      blocks naming the N-parameterization + per-dtype rules.
- [x] `info.description`, `200.description`, and `total`
      field description all updated to reflect the new
      AND-composed `total` semantics.
- [x] `422.description` enumerates the four new
      filter-related error codes with their triggers and
      `detail[].msg` shapes; one 422 wire example.
- [x] Three new 200 examples present
      (`filtered_per_column_string_equals`,
      `filtered_per_column_numeric_between`,
      `filtered_compose_q_and_filter`).
- [x] Rationale `.contract.md` gained "Per-column filters"
      section, "Filter-related 422 cases" sub-section, and
      four new HTTP-trace examples.
- [x] `dataset-filters.md` § Data contract stamped — points
      to the now-authoritative YAML + rationale.
- [x] `pnpm --filter @mdd/contracts test` — 13/13.
- [x] `npx markdownlint-cli2` — 0 errors over 96 files.
- [x] Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- [x] Grep this file for unticked `- [ ]` — 0 unticked.

## Act

**Learnings**:

- **OpenAPI 3.1 + parameter-key-parameterization-by-N is
  fundamentally limited.** The illustrative-`f0_*` +
  prose-description approach is the cleanest available
  path; `oneOf` schemas, `x-` extensions, or `allOf` games
  would buy nothing for a contract that's read by humans
  more than by codegen. The mitigation that _does_ work is
  the BE owning the per-dtype check and surfacing
  descriptive `detail[].msg` strings — the contract
  documents the convention, the BE enforces it.
- **`schema.type: string` for a lexical envelope is a
  legitimate pattern, not a code smell.** The existing
  `page` / `page_size` use typed `integer` only because the
  request validator can parse them up-front without
  context-dependent rules. `f<N>_val` / `_min` / `_max`
  _need_ the column dtype to parse correctly, and the
  dtype lookup is the BE's job. Documenting the parse rule
  in the YAML `description` + the rationale doc + the
  design doc covers the three audiences (contract reader,
  BE implementer, FE implementer).
- **Cross-stack truth via cross-links beats schema
  duplication.** The predicate vocabulary table lives once
  in `dataset-filters.md`; the YAML and rationale each
  point at it. If we had inlined the table in the YAML, the
  three would drift. Same discipline as `dataset-detail.md`
  § Data contract pointing to the YAML (vs the prose
  serving as a second source of truth).
- **Per-column index keys keep the URL pattern open for
  share-by-link.** A user can paste `?f3_op=equals&f3_val=won`
  to a colleague and it works for the same dataset. The
  column-name alternative (`?stage_op=equals&stage_val=won`)
  would have been more readable but breaks under rename
  (which isn't a feature today but might be eventually) and
  carries URL-escaping fragility for names with spaces or
  unicode. Index wins on stability + simplicity.

**Promotions** _(none — contract round; the schema patterns
that emerged stay inline in this one contract until a second
filter-accepting endpoint creates a real pull for
`_shared/filter-predicate.yaml`)_:

**Follow-ups (not promotions, just notes):**

- **Codegen impact (when codegen lands).** Tools like
  `openapi-typescript` will generate types only for the
  literal `f0_*` parameters; arbitrary N is invisible. When
  codegen arrives in a future round, the team picks one of:
  (a) hand-roll a typed query-builder for this endpoint
  (~30 lines), (b) promote the `POST :search` JSON-body
  shape so the predicate set is a real schema, or (c) live
  with the limitation. Today the FE builds the query string
  manually via `URLSearchParams` so none of this bites.
- **Multiple filters on the same column.** The contract
  enforces at most one predicate per column. A future
  request like "between 100 and 1000 OR > 10000 on the
  same column" needs OR-composition, which is reserved for
  the advanced-query feature. Documented in
  `dataset-filters.md` deferrals.
- **Operator names already include unicode-friendly
  variants.** `ne` (not `≠`), `gte` (not `≥`), `lte` (not
  `≤`) are the URL-safe forms; the FE renders the unicode
  glyphs in the popover operator dropdown and chip text.
  Documented in the design doc's operator-vs-display column
  in the vocabulary table.
- **422 envelope vs new `_shared/filter-error.yaml`.**
  Today the FastAPI request-validation envelope is enough
  because the error codes ride in `detail[].msg`. If a
  future surface ever needs to _consume_ these errors
  programmatically (e.g. surface a per-column error chip
  in the popover), promote a `_shared/filter-error.yaml`
  envelope with a `code` field instead of msg-string
  parsing. Not pulled yet.

## Feeds into → Round_39 (B — filter handler)

R38 closes the contract phase for the per-column-filter
feature. Implementation chain continues:

- **R39** (B): extend the BE rows handler at
  `../../../apps/backend/` to parse
  `f<N>_*` params, validate per-column dtype via
  `Dataset.columns[]`, build the DuckDB WHERE clause
  (push-down before pagination), and surface the four 422
  cases (`filter_op_dtype_mismatch`,
  `filter_value_unparseable`, `filter_col_out_of_range`,
  `filter_operand_shape`) with the `detail[].msg` shapes
  this contract names. BE unit tests cover each operator,
  AND-compose with `?q=`, and each 422 path.
- **R40** (F): `datasetsApi.getRows(id, page, pageSize,
q?, filters?)`, `useFiltersState` URL ↔ predicate-set
  hook, `FilterTrigger` / `FilterPopover` / per-dtype
  editors / `ActiveFilterChips` per the R37 design,
  TanStack cache-key extension, i18n keys, vitest cases
  per dtype + combined `q + filters` + no-match.

The verification-stack queue's MSW item (queue #1) stays
parked until the next available Track-2 slot — earliest
candidate is R41 after R40 closes filter F.
