# Round 133: Extract the shared query engine

**Status**: Complete
**Date started**: 2026-07-01
**Date completed**: 2026-07-01
**Flow**: **Refactor** — behavior-preserving extraction, no contract/UI change.

## Goal

**Inherits from ← [Round_132](Round_132.md)** — before the workflows router grows a `run` endpoint
(R134) that must resolve + step-transform saved queries, extract the query resolution + step engine
out of `routers/queries.py` into a standalone `app/query_engine.py`. Workflows then reuse the engine
by **import from a shared module**, not a router→router BIZ import.

_Track: 1. Pulled by ← R134's run→materialize need + the router-layer-debt memory (routers ARE the
app layer; router→router BIZ imports are the smell). The user chose fork **(B) "consider future"** —
pay the debt now with a shared module rather than couple two routers._

## Plan

- [x] New `app/query_engine.py` holding the resolution layer (`resolve_source`, `_resolve_chain`,
      `_execute_chain`, `_resolve_plan`, `_resolved_columns`, `_to_resolved`, `_build_inner_relation`)
      + the step engine (`_step_plan`/`_plan_one_step`/`_run_steps`/`_step_output_columns`) + aggregate
      validation (`_validate_aggregate`, `_aggregate_output_columns`) — moved **verbatim**.
- [x] `routers/queries.py` imports the moved names from `app.query_engine`; its import block trimmed
      (`rows_reader` down to the two row-readers it still calls; `_compatible`/`_dtype_of` dropped —
      now internal to the engine).
- [x] No contract, model, migration, or FE change — pure move.

## Risks / unknowns

- **Silent name drift** — a moved helper that a queries endpoint still references would `NameError`
  at import. Mitigated: full backend suite (271) exercises every queries endpoint; ruff catches
  unused/undefined imports. Both green.
- **No behavior change intended** — the diff is a move + import rewire; the 271-test parity IS the
  proof, not new tests.

## Do

**Built:** `app/query_engine.py` (516 lines) — the query resolution + step-transform engine lifted
out of `routers/queries.py` (964 → 484 lines). `queries.py` now imports the twelve engine symbols it
uses; the engine depends only on `ingest.*`, `models.common`, `routers._shared`, `storage` — no
router imports, so the workflows router can reuse it (R134) without router→router coupling.

**Verification:** backend `pytest` **271 pass** (unchanged set — behavior-preserving) · `ruff` clean
on both files. No contract/model/migration/FE touched.

## Check

- [x] 271 backend tests pass (same set as R132) — the move is lossless.
- [x] `ruff` clean; no unused/undefined imports either side of the split.
- [x] `query_engine.py` imports no router module (debt-free seam for R134).

## Act

**Learnings:**

- **Extraction paid the debt cheaply because the seam already existed.** The resolution + step code
  had no router dependencies to begin with — it only *lived* in a router. Moving it was a cut, not a
  redesign; the router-layer debt here was location, not entanglement.
- **The 271-test parity is the whole safety net for a verbatim move** — no new tests earned their
  place; adding some would be ceremony.

**Promotions:** none — mechanical extraction; the [[backend-router-layer-debt]] memory already
records the doctrine this applies.

**Prune check:** removed the now-dead `_SELECT_DATASET` constant + `_compatible`/`_dtype_of` imports
from `queries.py` (they moved into the engine).

## Feeds into → Round_134

`app/query_engine.py` is a router-free seam. R134 adds `POST /workflows/{id}/run` → resolve the
source query via `resolve_source`, apply the workflow steps via `_run_steps`, then **materialize to
parquet and capture the output schema**, plus `GET /workflows/{id}/rows` reading that output.
