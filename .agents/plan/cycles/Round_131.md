# Round 131: Plan gate — the Workflow noun (`queries ⇒ workflows`)

**Status**: Review
**Date started**: 2026-07-01
**Date completed**:
**Flow**: **DCFBI** — Plan/Design gate (docs only); the arc's later FE round (R135) is DFCFBI.

## Goal

**Inherits from ← [Round_130](Round_130.md)** — the query-steps engine is shipped; the human pulls a
**concrete Workflow module** (ref: `hg_code`; brainstorm
[2026-07-01-queries-to-workflows-module](../brainstorms/2026-07-01-queries-to-workflows-module.md)).
This round locks the design of a **new `Workflow` noun** — the first real noun this arc adds — before
building it across R132–R135.

_Track: 1. Pulled by ← the human ("build a concrete workflows module, then link with existing") +
`hg_code` prior-art + R124's wall. **This is the pull that finally crosses the wall** — extend-query
held to its edge ([[workflows-extend-query-duckdb-first]]); materialization needs a noun._

## Plan

- [x] Lock the noun's design decisions (below).
- [x] State the arc's acceptance criteria (R132–R135 build target, below).
- [ ] R132 begins the build (`wf_` id + migration + model + CRUD).

## Locked decisions (delegated; confirm at review)

1. **A new `Workflow` noun (`wf_`).** Justified now (needs-driven): materialization + multi-input +
   the output-loop can't live in the live-query model (R124's wall). Raw-SQLite persistence + a
   `workflows` table (migration), mirroring the query noun's storage.
2. **Input = queries.** A workflow's sources are **saved queries** (`qr_`) — it stands on the
   structured layer, not raw Excel (the `queries ⇒ workflows` progressive-structuring insight). v1:
   **one** source query; **multi-query consolidation = R134**.
3. **Transforms = the shipped steps engine.** Reuse the `Step` union (aggregate/derive/filter/top_n)
   - `run_steps`; **no new transform vocabulary**. **DuckDB-first; Polars RESERVED** (probe before
   pulling — even fuzzy may be `levenshtein`/`jaro_winkler` SQL).
4. **Output = MATERIALIZED** (the defining feature + the wall): a **run** writes the stepped result to
   **parquet + captures the output schema**; downstream binds to the *captured* schema (stable),
   not a live re-derivation. A re-run refreshes; staleness-flag deferred (v1 = explicit run).
5. **Output-as-source (the link).** The materialized output surfaces as a **readable source the chain
   consumes** — a `wf_` source the unified resolver reads (like `ds_`/`qr_`), so a query or widget can
   bind to a workflow's output. Wiring = **R134**.
6. **UX = ease-first.** Reuse `StepsEditor`; **no YAML** (that's the deferred #3 power path). FE =
   **R135**. Keeps the module #1-aligned even though it crosses the wall.

## Acceptance criteria (the arc's build target, R132–R135)

1. `wf_` noun: `POST/GET/DELETE /workspaces/{id}/workflows` + `GET /workflows/{id}`; a Workflow =
   `{ id, workspaceId, name, definition: { sources: [qr_…], steps: [...] } }`. Save validates the
   source query exists in-workspace + the steps against its columns (422). **[R132]**
2. `POST /workflows/{id}/run` → materializes the stepped result to parquet + persists the captured
   output columns; idempotent (re-run replaces). **[R133]**
3. `GET /workflows/{id}/rows` → the materialized rows (+ the captured schema as `resolvedColumns`);
   404 if never run. **[R133]**
4. Multi-query input: a workflow consolidates ≥1 query (union of same-schema sources). **[R134]**
5. Output-as-source: a `wf_` id resolves as a source (`resolve_source`) so a query/widget binds to a
   workflow's output — the loop closes. **[R134]**
6. FE: a Workflows catalog + a builder (reuse `StepsEditor`) + **Excel export** of the materialized
   output (the produced artifact). **[R135]**
7. Contract + tests at every gate; DuckDB-only unless a step provably needs Polars (then flag it).

## Risks / unknowns

- **First real migration this arc** — a `workflows` table. Verify the alembic setup at R132; keep it
  additive (no change to existing tables).
- **Output identity** — a `wf_` source vs minting a produced `ds_`. Locked: a **`wf_` source** the
  resolver reads (avoids faking a dataset); revisit if widgets need a true `ds_`.
- **Materialization staleness** — a source query changing after a run leaves the output stale. v1:
  explicit re-run; a stale-flag (like `query_stale`) is a follow-up.
- **Polars** — may still not be needed (DuckDB `union` + fuzzy fns). Don't add the dep speculatively.

## Do

_(design gate — no code; the decisions above ARE the deliverable. R132 begins the build.)_

## Check

- [x] Decisions locked (delegated; flagged for review).
- [x] Acceptance criteria stated (R132–R135 targets).
- [x] Grounded in the brainstorm + code reality (reuses `run_steps` / `resolve_source`; new table only).
- [ ] (Build-gate verification is R132–R135's.)

## Act

**Learnings:**

- **The wall pulled the noun — on schedule.** Ten rounds of extend-query (R120–R130) deferred the
  `Workflow` noun until a real pull (materialization + multi-input, via `hg_code`); the deferral let
  us reuse the whole steps engine + the source resolver, so the noun is mostly *identity + storage +
  wiring*, not a new engine.

**Promotions:** none — applies [[workflows-extend-query-duckdb-first]] (its predicted wall is now the work).

**Prune check:** nothing pruned.

## Feeds into → Round_132

The locked noun design → R132 builds the `wf_` entity (id + migration + model + CRUD + contract +
tests), single-query passthrough, reusing `resolve_source` for the query input.
