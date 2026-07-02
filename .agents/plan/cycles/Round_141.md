# Round 141: Deliverable shaping steps — sort · select/rename/reorder

**Status**: Planning
**Date started**: 2026-07-02
**Date completed**:
**Flow**: TBD — run `flow-selector` at Design exit (expected DCFBI: two new step kinds mirror the
R120 `top_n`/`derive` pattern; UI = two more StepsEditor bodies, low F1-discovery risk — confirm at
the gate).

## Goal

**Inherits from ← [Round_140](Round_140.md) "Feeds into" + the
[step-model brainstorm](../brainstorms/2026-07-01-step-model-extensibility.md) roadmap ③** — add the
two deliverable-shaping step kinds: **`sort`** (order without limit; `top_n` minus the limit) and
**`select`** (select / rename / reorder columns). Together they let a shaped output carry specific,
friendly, ordered columns — the prerequisite the "consolidated Excel out" value-out deliverable
(roadmap ④) needs. Also retires the R140 naming wart: `count_distinct(product)` can finally be
renamed instead of shipping a column confusingly named `product`.

_Track: 1. Pulled by ← the human's R139 ask ("more steps") via the brainstorm's value/cost table
(select/rename = high value / small cost; sort = medium value / tiny cost), selected by the human at
R141 open. D-gate first per the d-gate-artifact-in-design-corpus lesson._

## Plan

- [ ] **D**: [queries.md](../../design/data-management/queries/queries.md) §Transform steps — spec
      both kinds: `sort` (multi-key? asc/desc per key; NULL ordering; dtype-agnostic) and `select`
      (projection list + rename map + implicit reorder; unknown-column and duplicate-output-name
      rules; effect on resolved output columns). Decide one step or two (brainstorm leans two small
      kinds). Sign off before code.
- [ ] **C**: `query.yaml` step union + request schemas; contract prose for 200/422; MSW mirror
      contract untouched elsewhere.
- [ ] **B**: engine — models + validators + `build_*_select` SQL + output-column resolution;
      endpoint parity (ad-hoc + saved-step + workflow inherits via the `Step` union).
- [ ] **F**: FE step types + `steps.ts` output mirror + two StepsEditor bodies + MSW compute mirror.
- [ ] **I**: i18n en/vi labels.
- [ ] Tests: backend per-kind happy + 422 specs; FE vitest contract/mirror.

## Risks / unknowns

- **`select` semantics need a real decision** (D-gate): is it projection-only, or
  projection+rename+reorder in one body? Duplicate output names, renaming a group key mid-chain, and
  downstream-step column references all need rules.
- **`sort` guarantees** — SQL ORDER BY on an intermediate step doesn't survive later steps; spec
  honestly where ordering is meaningful (final step / deliverable boundary) instead of implying a
  stable pipeline-wide order.
- **Scope brake**: no `compute` step, no function catalog, no export — those are roadmap ② and ④.

## Do

_(pending)_

## Check

- [ ] Design doc section signed off (D-gate) before C/B/F.
- [ ] Backend pytest green incl. new specs; ruff clean.
- [ ] FE tsc + vitest green; editor offers both kinds with sane column pools.
- [ ] count_distinct-rename path works end-to-end (the R140 wart is closed).

## Act

**Learnings:** _(pending)_

**Promotions:** _(pending)_

**Prune check:** _(pending)_

## Feeds into → Round_142

Roadmap ④ **value-out deliverable (Excel/CSV export)** is now unblocked once shaping lands.
Alternatives when pulled: roadmap ② (lock fork: `compute` step + catalog, then `date_trunc`) or the
batched UI/UX bug round (carrying the R140-noted issues).
