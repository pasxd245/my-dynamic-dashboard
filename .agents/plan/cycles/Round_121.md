# Round 121: workflows — step chaining (typed engine) + a top-N step

**Status**: Complete
**Date started**: 2026-06-30
**Date completed**: 2026-06-30
**Flow**: **DCFBI** — backend-only; extends the R120 `steps` seam.

## Goal

**Inherits from ← [Round_120](Round_120.md)** — R120 capped `steps` at one (the aggregate step
stringifies, so nothing can compose after it). This round makes steps **chain**: a TYPED step engine
threads a typed relation through each step and only stringifies the FINAL output, plus a **`top_n`**
step (`ORDER BY col → LIMIT n`) so the canonical post-aggregate shape — **"top 5 regions by
revenue"** (`aggregate` → `top_n`) — works end-to-end.

_Track: 1. Pulled by ← the workflow theme. Still **DuckDB-first** — top-N is `ORDER BY … LIMIT`,
no Polars. Extend-query holds (no wall hit: a single-table SQL transform fits the query model)._

## Plan

- [ ] **C:** `_shared/query.yaml` — `TopNStep` schema; `QueryDefinition.steps` items → `oneOf`
      [`AggregateStep`, `TopNStep`] discriminated by `kind`.
- [ ] **B:** `build_aggregate_select(..., stringify=True)` (typed when False); `run_steps` engine
      (typed fold over the inner relation → final CAST). `TopNStep` model + a `kind`-discriminated
      `Step` union on `QueryDefinition.steps`. `_step_plan` folds the list, threading the column
      space (aggregate reshapes; top_n preserves); raise 422 on a bad step; cap at 8 steps.
- [ ] pytest: `aggregate → top_n` (top-N by measure, ordered + capped), `top_n` alone, chaining
      order, validation (top_n unknown col, >8 steps), drift → 409, stepless unchanged.

## Risks / unknowns

- **Type preservation across steps** — a stringified intermediate would sort lexically (`"100" <
  "50"`); the typed engine keeps the measure numeric so `top_n DESC` is correct. The whole point.
- **Discriminated union on the wire** — `steps` items become a `kind` union; the contract validator
  (responses only; mocks carry no steps) is unaffected, but keep the Python model a real
  `Field(discriminator="kind")` union so a bad `kind` is a clean 422.

## Do

**Built (backend-only):**

- **Contract** — `TopNStep` schema; `QueryDefinition.steps` items → `oneOf` [`AggregateStep`,
  `TopNStep`] with a `kind` discriminator.
- **Models** — `TopNStep` + a `Step = Annotated[AggregateStep | TopNStep, Field(discriminator="kind")]`
  union; `QueryDefinition.steps: list[Step]`. A bad `kind` is a clean pydantic 422.
- **Engine** — `build_aggregate_select(..., stringify=False)` for a non-final aggregate (typed
  output) + `run_steps` (rows_reader): folds a TYPED relation through each step, stringifying only
  the final output. `top_n` = `ORDER BY col [DESC] LIMIT ?`.
- **Validation** — `_step_plan` now FOLDS the list, threading the evolving column space
  (`_plan_one_step`: aggregate reshapes, top_n preserves + checks `col` exists at that point); cap
  `_MAX_STEPS = 8`. Lifts R120's 1-step cap.

**Verification:** backend `pytest` **253 pass** (5 new: aggregate→top_n numeric-ordered+capped,
top_n-only, 3× bad-chain 422 incl. col-dropped-by-aggregate + >8) · `ruff` clean · FE `tsc` clean ·
contract-validator green. The R120 ">1 step → 422" case was updated (now valid chaining).

## Check

- [x] Backend pytest 253 (5 new) + no regression; ruff clean.
- [x] `aggregate → top_n` returns the correctly-ordered, capped top-N — **numeric** sort (APAC 200
      before EMEA 150), proving the typed intermediate (a stringified one would sort lexically).
- [x] FE tsc + contract validator green; types updated to the `Step` union.

## Act

**Learnings:**

- **Chaining hinged on type preservation.** Stringifying the aggregate early (R119/R120's path) made
  it terminal; deferring the `VARCHAR` cast to the final relation let any step compose — the typed
  engine is the whole unlock. Small change (`stringify` flag + a fold), big capability.
- **Still no wall, still no Polars.** top_n is `ORDER BY … LIMIT`; the chain is nested SQL. Extend-
  query holds — a single-table SQL transform fits the query model (the [[query-is-virtual-dataset]]
  "once a query can't adapt → a Workflow noun" trigger has not fired).

**Promotions:** none — application of the workflow seam + compute-ladder doctrine.

**Prune check:** nothing pruned. (`query_aggregate_rows` is still the R119 `/aggregate` endpoint's
path; `run_steps` is the saved-query chain path — distinct consumers, both earning their place.)

## Feeds into → Round_122 (TBD)

The typed `run_steps` engine. R122 adds a **formula-free derived-column step** (the real Excel-escape
lever) — the first step that ADDS a column, testing the column-threading for a non-aggregate reshape.
