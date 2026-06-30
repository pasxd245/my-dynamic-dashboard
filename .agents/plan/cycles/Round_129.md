# Round 129: workflows — steps for joined/composed queries (the column fork)

**Status**: Review
**Date started**: 2026-06-30
**Date completed**:
**Flow**: **DCFBI** — small contract + backend + FE; resolves R125's deferred fork.

## Goal

**Inherits from ← [Round_128](Round_128.md)** — R125 limited the step-builder to single-source
queries because the builder's `columns` is the PRE-step space (join/filter editors need it) while a
stepped preview returns POST-step columns. This round has the **preview report BOTH**: `baseColumns`
(pre-step) alongside `resolvedColumns` (post-step), so the editors use the base and the steps editor

+ preview table use the result — unlocking steps for **joined / composed** queries too.

_Track: 1. Pulled by ← the usability arc; closes R125's single-source restriction._

## Plan

+ [x] **C:** preview 200 response gains optional `baseColumns` ({name, dtype}).
+ [x] **B:** the stepped preview branch returns `baseColumns` = the PRE-step effective columns
      (`plan["columns"]`).
+ [x] **FE:** `QueryPreview.baseColumns`; `useQueryBuilder.columns` prefers `preview.baseColumns`
      when present; drop the single-source `canUseSteps` gate (the Transform editor renders for all
      shapes). MSW preview mock returns `baseColumns`.
+ [x] Tests: backend preview asserts `baseColumns`; FE mock asserts it.

## Risks / unknowns

+ **Transient column space** — adding the first step to a joined query: until the debounced preview
  returns `baseColumns`, `columns` reads the prior (no-steps) effective space, which equals the base
  → no flicker. After, `baseColumns` (= effective). Consistent.

## Do

**Built:** preview returns `baseColumns` (backend + contract + MSW); `useQueryBuilder.columns` uses
it (editors author against the pre-step base for ALL shapes); `canUseSteps` removed (steps everywhere)
— `TransformSection` always renders `StepsEditor`; the now-dead joined-note branch pruned.

**Verification:** backend `pytest` **265 pass** (preview asserts `baseColumns`) · `ruff` clean · FE
`tsc` clean · `vitest` **249 pass** (mock asserts `baseColumns`) · contract-validator green (the
optional field validates) · no regression · `prettier` clean.

## Check

+ [x] Backend 265 + FE 249 green; ruff/tsc/contract/prettier clean; no regression.
+ [x] A stepped preview reports pre-step `baseColumns` + post-step `resolvedColumns`; the builder's
      editors use the base, the steps editor renders for joined/composed too.

## Act

**Learnings:**

+ **The fork closed with one field, not a redesign.** The preview already computed the pre-step
  effective columns (`plan["columns"]`); reporting them as `baseColumns` was the whole fix — the
  builder consumes base (editors) vs result (table/steps) without two preview calls.
+ **Prune as you generalize** — the single-source `canUseSteps` gate + its note earned removal once
  the fork was resolved.

**Promotions:** none — extends [[workflows-extend-query-duckdb-first]] (steps now author over any shape).

**Prune check:** removed `canUseSteps` + the joined-only note (superseded). The unused
`queries.builder.steps.joinedNote` i18n key is left (harmless; a sweep can drop it).

## Feeds into → Round_130 (TBD)

The query-steps workflows are now usable end-to-end across all query shapes. R130 closes the arc:
`design-sync` the `data-management/queries` design doc to the shipped steps engine + builder, and a
prune sweep (the leftover i18n key).
