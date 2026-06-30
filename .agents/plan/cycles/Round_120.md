# Round 120: workflows v1 — a query gains transform `steps` (aggregate step)

**Status**: Review
**Date started**: 2026-06-30
**Date completed**:
**Flow**: **DCFBI** — backend-only (no new UI surface); the query's stored JSON definition gains an
optional `steps` list, so no migration / new noun / new router.

## Goal

**Inherits from ← [Round_119](Round_119.md)** — R119 shipped the server-side aggregate as a
one-shot, widget-driven binding (`POST /queries/{id}/aggregate`). This round begins the **workflow**
theme (the "final structural piece" — saved, chainable data **shaping**) by promoting that aggregate
into a **saved, reusable transform step on a query**: a query's definition gains an ordered `steps`
list, and its `/rows` run applies them. Step #1 = **aggregate** (`GROUP BY → measures`).

_Track: 1. Pulled by ← the workflow theme (human, 2026-06-30: "the final piece — saved shaping —
then iterate the weakest point"). Value-first, **DuckDB-first** (Polars only when a step needs it)._

## Architecture decision (theme spine — provisional, flagged for the summary)

**Extend the query/transform model with `steps`, NOT a new `Workflow` noun.** Reasons:

- The query `definition` is **stored as JSON**, so `steps` adds **no migration, no new id/table/
  router** — a query with no steps behaves exactly as today (**opt-in blast radius**).
- A Query is already "a saved, re-runnable transform over a source that produces a virtual table"
  ([[query-is-virtual-dataset]]); steps are the natural generalization (join + filter + **steps**).
  Reuse beats a parallel noun ([[design-gate-noun-vs-mode]]).
- R119's aggregate already plugs in exactly where a step belongs — over the resolved inner relation.

The **Query ∪ Workflow naming/unification** and whether a heavy pipeline ever deserves its own noun
are flagged for the end-of-arc discussion (with the Polars question).

## Plan

- [ ] **C:** `_shared/query.yaml` — `QueryDefinition.steps` (ordered) + an `AggregateStep` schema;
      `.md` note. (No response-shape change — `/rows` already returns `RowsPage`.)
- [ ] **B:** `Step` models (`AggregateStep`, discriminated by `kind`); a `apply_steps` engine over
      the resolved relation (reuses R119 `build_aggregate_select`); validate steps on save (422),
      apply on run/preview; `resolvedColumns` reflects the **post-step** output columns.
- [ ] **Scope brake (v1):** at most **one** step, kind `aggregate` (chaining = R121; the typed
      intermediate-relation work it needs is deferred). A 2nd step or unknown kind → 422.
- [ ] pytest: save+run a query with an aggregate step (grouped rows + post-step resolvedColumns);
      bad step (unknown col / >1 step) → 422; a stepless query is unchanged.

## Risks / unknowns

- **Column-space change** — an aggregate step changes a query's effective columns to the grouped
  output; `resolvedColumns` + save-time validation must reflect that. Bounded to the steps path;
  stepless queries untouched.
- **Two aggregate paths** — R119's `/aggregate` endpoint and a query aggregate step now coexist
  (different layers: ad-hoc widget binding vs saved shaping). Consolidation (widgets bind to
  pre-shaped queries, retiring `/aggregate`) is a later weakest-point fix — noted, not done.
- **Chaining deferred** — `build_aggregate_select` stringifies output, so a 2nd step can't compose
  over it yet; R121 adds typed intermediates. v1 caps at one step.

## Do

**Built (backend-only):**

- **Contract** — `_shared/query.yaml`: `AggregateStep` schema + `QueryDefinition.steps` (ordered;
  v1 item = `AggregateStep`). No response-shape change (`/rows` stays `RowsPage`).
- **Models** — `AggregateMeasure` (shared, hoisted) + `AggregateStep`; `QueryDefinition.steps: list[AggregateStep] = []`.
- **Engine reuse** — a step needs **no new `rows_reader`**: `_build_inner_relation` (the shared
  joined/single inner) + R119's `query_aggregate_rows` apply the aggregate over the resolved,
  filtered relation. Helpers: `_validate_measure`/`_validate_aggregate` (now dict-based, shared with
  the R119 endpoint), `_aggregate_output_columns`, `_step_plan` (validate → `(step, measures, output_cols)`),
  `_step_output_columns` (read-path, drift→None), `_run_step`.
- **Wired** — create/update validate steps (422); run/preview apply them (drift→409 query_stale) and
  return shaped rows; `_resolved_columns` exposes POST-step output columns (single-source too).
- **Scope brake** — `_step_plan` caps at one step, kind `aggregate`; `>1` or unknown kind → 422.

**Verification:** backend `pytest` **248 pass** (9 new in `test_workflow_steps.py`: save+run, filter-
before-step, scalar, post-step resolvedColumns, preview, 3× bad-step 422, drift 409) · `ruff` clean ·
FE `tsc` clean · `vitest` 239 pass · contract-validator green (the contract change parses/derefs) ·
`prettier` clean. No regression (full suites).

## Check

- [x] Backend pytest green (248; 9 new) + no regression; ruff clean.
- [x] Contract validates; `/rows` for a stepped query returns grouped (shaped) rows.
- [x] A stepless query is byte-for-byte unchanged (opt-in blast radius confirmed by test).
- [x] Post-step `resolvedColumns` exposed (the query's output shape is self-describing → R123 needs it).

## Act

**Learnings:**

- **The first workflow step needed zero new infra.** `steps` rides the query's JSON definition (no
  migration / noun / router), and the aggregate step **reused R119's `query_aggregate_rows` verbatim**
  over the shared `_build_inner_relation`. "Workflow" v1 = the query gaining a post-resolve transform,
  not a subsystem — the "grounding beats the brief" lesson again ([[charts-probe-data-layer]]).
- **DuckDB covered it again** — the aggregate step is pure GROUP-BY SQL; **no Polars pulled**. The
  live Polars question is now sharp: *which step kinds (if any) can't be expressed in DuckDB SQL?*
  (the end-of-arc discussion).

**Promotions:** none — application of the existing compute-ladder doctrine.

**Prune check:** nothing pruned. R119's `/aggregate` endpoint and the aggregate STEP now coexist
(ad-hoc widget binding vs saved shaping); consolidating them (widgets bind to pre-shaped queries) is
a flagged weakest-point candidate, not done.

## Feeds into → Round_121 (TBD)

The `steps` model + the `_step_plan`/`_run_step` seam. R121 adds **chaining** — a TYPED intermediate
relation so ≥2 steps compose (today `query_aggregate_rows` stringifies, so it can only be the final
step) — and a second step kind to prove the chain over a non-aggregate transform.
