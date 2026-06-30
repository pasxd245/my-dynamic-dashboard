# Round 123: workflows — a filter-as-step (post-aggregate / post-derive WHERE)

**Status**: Review
**Date started**: 2026-06-30
**Date completed**:
**Flow**: **DCFBI** — backend-only; extends the R121 typed step engine.

## Goal

**Inherits from ← [Round_122](Round_122.md)** — add a **`filter`** step: keep rows matching
name-referenced predicates (AND) over the CURRENT column space. The query's `definition.filters`
already filter the SOURCE rows (pre-step); a filter STEP filters AFTER aggregate/derive — the
HAVING-like gap ("regions with total revenue > 100k", "rows where margin < 0"). This completes the
core step primitives (aggregate · derive · filter · top_n).

_Track: 1. Pulled by ← the workflow theme. Reuses the existing predicate vocabulary
(`OPS_BY_DTYPE` / `_build_aq_atom` / `build_filter_sql`) but BY column NAME (steps reference the
evolving effective space by name, not the source index). Still **DuckDB** (`WHERE`) — extend-query
holds (no wall: single-table SQL)._

## Plan

- [ ] **C:** `FilterStep` (+ a name-based `FilterStepPredicate`) in `_shared/query.yaml`; add to
      `steps` `oneOf` + discriminator.
- [ ] **B:** models (`FilterStepPredicate`, `FilterStep`) into `Step`; `_plan_filter` maps each
      predicate's col NAME → its index in the current columns and reuses `_build_aq_atom` (op-for-
      dtype + operand parse → 422); `run_steps` filter arm = `SELECT * FROM (…) WHERE <build_filter_sql>`
      (column space unchanged).
- [ ] pytest: post-aggregate filter (revenue > 100k), post-derive filter (margin < 0), multi-
      predicate AND, 422 (unknown col / bad op-for-dtype), chain order.

## Risks / unknowns

- **Param order** — the filter `WHERE` sits after `FROM (inner)`, so its params append AFTER the
  inner params (the safe order, unlike a SELECT-clause constant).
- **Predicate loc on 422** — reusing `_build_aq_atom` reports `loc=["query","aq"]`; still a clean
  422 (the status is what matters); precise loc is a cosmetic follow-up.

## Do

**Built (backend-only):**

- **Contract** — `FilterStep` + `FilterStepPredicate` (name-based); added to the `steps` union + discriminator.
- **Models** — `FilterStepPredicate`/`FilterStep` into `Step`.
- **Engine** — `run_steps` refactored to `_apply_step` (+ `_derive_expr`) to stay under the
  complexity bar; filter arm = `SELECT * FROM (…) WHERE <build_filter_sql>` (params append after the
  inner params; column space unchanged).
- **Validation** — `_plan_filter` maps each predicate's col NAME → index and reuses the PUBLIC
  `build_definition_predicates` (op-for-dtype + operand parse → 422); unknown col → 422 with a precise loc.

**Verification:** backend `pytest` **265 pass** (5 new: filter-after-aggregate HAVING-like,
filter-over-raw, multi-predicate AND, 2× bad-filter 422) · `ruff` clean · FE `tsc` clean ·
contract-validator green.

## Check

- [x] Backend pytest 265 (5 new) + no regression; ruff clean.
- [x] Post-aggregate filter ("total > 160" → APAC only) + multi-predicate AND work; bad op/col → 422.
- [x] FE tsc + contract validator green; `Step` union + `FilterStep` types added.

## Act

**Learnings:**

- **The core step set is complete on the backend.** aggregate · derive · filter · top_n — chained,
  typed, DuckDB-only. Each reused existing machinery (aggregate engine, predicate vocabulary) rather
  than new infra; the `steps`-on-the-query model absorbed every primitive.
- **STILL no wall.** Four step kinds, none needed Polars or broke the single-table query model — so
  per the agreed trigger ("once a query can't adapt → a Workflow noun"), **the Workflow-noun pull has
  not fired.** Extend-query is vindicated for the shaping primitives. (The wall, if it comes, is a
  multi-output / non-SQL transform — none demanded yet.)

**Promotions:** none — application of the workflow seam.

**Prune check:** nothing pruned. The `_apply_step` extraction tidied `run_steps` (kept it under the
cognitive-complexity bar as kinds grew).

## Feeds into → Round_124 (TBD)

Completes the backend step primitives (aggregate · derive · filter · top_n, chained, DuckDB-only).
R124 is the **FE** — making queries-with-steps user-authorable/runnable — a **feel-surface (DFCFBI)**
that wants human review; the natural checkpoint to hand back.
