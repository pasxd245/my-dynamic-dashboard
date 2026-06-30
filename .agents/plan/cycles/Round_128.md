# Round 128: workflows — seed a demo pre-shaped (stepped) query

**Status**: Review
**Date started**: 2026-06-30
**Date completed**:
**Flow**: DCFBI — dev seed script; no product code.

## Goal

**Inherits from ← [Round_127](Round_127.md)** — make a workflow visible out-of-the-box: seed a
**single-source query that shapes its result with a transform step** ("Revenue by order status" =
`GROUP BY status → SUM(amount)` over `orders`). Its detail page shows the grouped rows directly, it
opens in the R125 step-builder (single-source), and it's a ready pre-shaped source for an R127
chart widget — the end-to-end loop, seeded.

_Track: 1. Pulled by ← the usability arc. The dashboard is user-built (only queries are seeded), so
the demo is the seeded stepped query itself._

## Plan

- [x] `defn(..., steps=None)` in `scripts/dev/seed.py` carries an optional `steps` list.
- [x] Add a "Revenue by order status" base query: one aggregate step (`status` × `SUM(amount)`).

## Risks / unknowns

- **Can't run the live seed here** (no backend up). Mitigation: the stepped single-source
  save+run shape is already verified by `tests/test_workflow_steps.py`; the seed only emits that
  validated shape, and `py_compile` + `ruff` pass.

## Do

**Built:** `defn()` gains `steps`; a new single-source `orders` base query with an aggregate step
(`dimensions: [status]`, `measures: [{col: amount, agg: sum}]`). `upsert_query` posts it through the
shipped create path (which validates steps, R120).

**Verification:** `py_compile` OK · `ruff` clean · the emitted definition shape matches the
backend-tested stepped-query contract (`test_workflow_steps`); the live run is a follow-up when a
backend is up.

## Check

- [x] Seed compiles + ruff clean; the stepped query uses real `orders` columns (`status`, `amount`).
- [ ] Live seed run (manual, when a backend is up) — the query detail shows revenue grouped by status.

## Act

**Learnings:**

- **The seed needed only the definition shape** — no new seed mechanism. The workflow rides the
  existing query create path, so seeding a shaped query is one list entry + a `steps` field.

**Promotions:** none.

**Prune check:** nothing pruned.

## Feeds into → Round_129 (TBD)

A pre-shaped single-source query is demoed end-to-end. R129 generalizes step authoring to
joined/composed queries (the column-fork: the preview returns base + result columns so the builder's
editors and the steps editor each get the right space).
