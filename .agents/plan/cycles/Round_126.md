# Round 126: workflows — steps-aware MSW preview mock

**Status**: Review
**Date started**: 2026-06-30
**Date completed**:
**Flow**: **DCFBI** — FE mock/test infra; no product UI change.

## Goal

**Inherits from ← [Round_125](Round_125.md)** — the MSW preview handler IGNORES `steps`, so dev mode
and FE tests can't see a shaped preview (R125 flagged this gap). Make the mock **apply the steps**
(mirroring the backend `run_steps`) so a previewed stepped definition returns the shaped rows +
post-step columns — unblocking integration testing of the builder + R127's widget work.

_Track: 1. Pulled by ← the usability arc (human, 2026-06-30). Small: mock-only._

## Plan

- [ ] `applyStepsMock(columns, rows, steps)` in the mocks — aggregate (reuse `computeAggregate`),
      derive (binary op + ÷0→null), filter (name predicates), top_n (sort+limit). Mirrors `run_steps`.
- [ ] Preview handler: when the definition has `steps`, apply them → shaped rows + `resolvedColumns`.
- [ ] Test: `queriesApi.preview` with a steps definition → shaped rows (api-level, no UI driving).

## Risks / unknowns

- **Mock ≠ backend exactness** — number formatting may differ (JS vs DuckDB CAST); the test asserts
  by parsed value, not string. The mock is for dev/UX, the backend pytest is the correctness gate.

## Do

**Built:** `applyStepsMock` (+ `deriveStepMock`/`filterStepMock`/`topNStepMock`, reusing
`computeAggregate` + `cellMatches`) mirrors `run_steps` over the mock rows; `previewJson` applies a
definition's `steps` and reports post-step `resolvedColumns`; the three preview branches (composed /
joined / single) route through it. **Also fixed a latent hygiene bug:** the R119 `computeAggregate`
group key used raw control bytes (`\0` / `\x01`) that made `handlers.ts` read as a binary file — now
`JSON.stringify(keyCells)` (printable, collision-free).

**Verification:** FE `tsc` clean · `vitest` **248 pass** (2 new in `workflow-preview-mock.test.ts`:
aggregate step → shaped rows + resolvedColumns; aggregate→top_n numeric order) · contract-validator
green (shaped preview validates) · no regression · `prettier` clean.

## Check

- [x] FE `tsc` + `vitest` green (248; 2 new); contract validator green; no regression.
- [x] A stepped preview returns shaped rows + post-step `resolvedColumns`; stepless preview unchanged.
- [x] `handlers.ts` is text again (no control bytes).

## Act

**Learnings:**

- **The mock had to learn the step engine too** — the three-impl surface (YAML · Python · TS mock)
  the contract-anchor decision flagged. Kept it thin by reusing `computeAggregate`/`cellMatches`.
- **Caught a binary-byte hygiene bug** in the R119 mock key while extending it — control-char
  separators are invisible in editors but break `grep`/tooling; `JSON.stringify` is the clean key.

**Promotions:** none.

**Prune check:** nothing pruned.

## Feeds into → Round_127 (TBD)

A steps-aware mock → R127 (widget renders a pre-shaped query directly, not re-aggregate) is testable.
