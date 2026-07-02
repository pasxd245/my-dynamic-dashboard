# Round 134: Workflow run → materialize + rows

**Status**: Complete
**Date started**: 2026-07-01
**Date completed**: 2026-07-01
**Flow**: **DCFBI** — Contract + Backend (no UI); the noun gains behavior.

## Goal

**Inherits from ← [Round_133](Round_133.md)** — the `wf_` noun has CRUD; now give it its verb.
`POST /workflows/{id}/run` resolves the workflow's (v1: single) source query through the shared
`app.query_engine`, applies the workflow's transform steps, writes the **TYPED** result to parquet,
and **captures the output schema** (`resolvedColumns` + `materializedAt`). `GET /workflows/{id}/rows`
pages that materialized output.

_Track: 1. Pulled by ← the R131 Workflow-noun design (materialized output is the R124 "wall"
construct). Reuses the R133-extracted engine (`_resolve_plan`/`_build_inner_relation`/`_step_plan`) +
the step folder (`_apply_step`) — no new engine, no router→router import._

## Plan

- [x] `materialize_steps` in `rows_reader.py` — fold TYPED steps over the inner relation, `COPY` the
      TYPED final relation to parquet (types survive → readable as a source in R135).
- [x] `storage.py` — `workflows_dir()` / `workflow_dir(ws, wf)` (output tree: `output.parquet`).
- [x] `run_workflow` — resolve source query (shared engine) → apply steps → materialize → persist
      `output_columns_json` + `materialized_at` → return the materialized workflow.
- [x] `workflow_rows` — page the materialized parquet (`RowsPage`; `unpaged=true` widget path).
- [x] Contracts: `workflows/run-post` (200 Workflow · 404 · 409 stale/cycle) + `rows-get` (RowsPage).
- [x] pytest (`test_workflows_run.py`).

## Risks / unknowns

- **Materialize writes TYPED parquet, not stringified rows** — deliberately: `run_steps` stringifies
  for a response, but a materialized output must keep native types so R135 can read `wf_` output back
  as a typed source. `materialize_steps` reuses the same `_apply_step` fold, then `CREATE TABLE … AS`
  - `COPY … (FORMAT PARQUET)` (DuckDB won't parameterize a COPY path; the target is a server-built
  literal from validated ids).
- **`rows` before `run` → 404** — the materialized output is the rows resource; it doesn't exist
  until run. Reuses `not_found` rather than minting a new error code (thin).
- **Source query's own filters are already baked** into the sub-relation the engine resolves, so the
  workflow layer runs with no extra predicates — only its steps (avoids double-filtering).

## Do

**Built:** the workflow verb. `POST /workflows/{id}/run` materializes (`resolvedColumns` +
`materializedAt` now populated); `GET /workflows/{id}/rows` pages the frozen output. Run reuses the
R133 shared engine end-to-end — resolve the `qr_` source as a composed relation, fold the workflow's
steps, write typed parquet, capture the post-step schema. Stale/cycle map to 409 exactly as the query
run path does; a passthrough (no steps) materializes the source columns verbatim.

**Verification:** backend `pytest` **277 pass** (6 new: run+schema+contract, rows+contract, passthrough
unpaged, rows-before-run 404, run-unknown 404, run-after-source-deleted 409) · `ruff` clean · FE
vitest **249 pass** (contract loader dereferences the two new YAMLs; step `$ref`s resolve).

## Check

- [x] Backend 277 (6 new); ruff clean; no regression.
- [x] Run materializes typed parquet + captures schema; rows pages it; before-run 404.
- [x] Contracts dereference (FE validator green); 409 stale/cycle mirror the query run path.

## Act

**Learnings:**

- **The R133 extraction paid off immediately** — run is `_resolve_plan` + `_build_inner_relation` +
  `_step_plan` + the `_apply_step` fold, all imported, zero duplication, zero router→router coupling.
  The only genuinely new code is "keep types + COPY to parquet" — the materialize seam.
- **Materialized vs live is the whole point of the noun** — a query re-runs live; a workflow FREEZES
  its output. That is what lets R135 treat a `wf_` as a stable typed source (the loop-closing move).

**Promotions:** none — applies the R131 design on the R133 seam.

**Prune check:** nothing pruned.

## Feeds into → Round_135

The output is typed parquet with a captured schema. R135 makes a `wf_` resolvable **as a source**
(`resolve_source` reads the materialized output like a dataset leaf) + accepts **multiple** source
queries (consolidation) — closing the queries ⇒ workflows ⇒ (source again) loop.
