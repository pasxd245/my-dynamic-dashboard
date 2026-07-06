# Round 152: Column show/hide — a `hidden?` view-hint + column-metadata PATCH (F7)

**Status**: Planning — D-gate pending; R140 an open input (2026-07-06)
**Date started**: 2026-07-06
**Flow**: TBD — set at the Design gate via flow-selector. F7 adds a new interaction (a
column-visibility editor) + a new endpoint, so DFCFBI is plausible; the selector decides at D exit.

## Goal

**Inherits from ← [Round_151](Round_151.md)** — F7 split out of the rank-5 UI/diagnosability batch
(it's a design-gated mini-feature, not a background-friction fix). Per the signed-off
[R142 dogfood ranking](../brainstorms/2026-07-03-r142-dogfood-findings.md) (F7, Medium — UI/UX + model).

**The problem (F7):** wide tables are unreadable — `PagedRowsView` renders **every** column in one
horizontal scroll, with no show/hide. Real CRM exports have many columns; the user can't focus on
what matters. The proposal (from the R142 finding): a **`hidden?` view-hint on column metadata**,
editable **after** upload, honored as the **default** by row-preview surfaces so "we can show more"
of what matters.

**Why this is the right home (and doctrine-safe):** unlike dtype (F2, which wrongly stopped at
metadata), visibility **should** stay metadata-only — a view hint must **never** touch the stored
parquet, so the presentation/compute separation is satisfied, not violated. It's complementary to
the compute-level narrowing (the R141 `select` step): this is the **presentation-level default**,
not a substitute. Two new capabilities are implied:

- **(a)** a `hidden` view-hint on column metadata;
- **(b)** **post-upload column-metadata edit** — a column-level `PATCH`, which does **not** exist
  today (dataset rename is name-only; column overrides are upload-time).

## Open design questions (the D-gate — hard-stop for the human)

1. **"Default for WHOM"** (the load-bearing one) — scope the hint as an **overridable row-preview
   default**, NOT a hard projection: the Datasets row-preview / dataset-detail table hide `hidden`
   columns by default (with a "show all" escape), but **query-builder / join-key pickers still see
   ALL columns** (a hidden column must remain joinable/selectable). Confirm the exact surface list
   that honors vs ignores the hint.
2. **Where `hidden` lives + the PATCH shape** — `hidden?: boolean` on the column model
   (`columns_json`); the `PATCH` target (per-column? whole column-list?) and its wire/contract.
   Presentation-only → never re-reads/rewrites the parquet (only `columns_json`).
3. **Editing surface** — where the user toggles visibility (dataset-detail column header menu? a
   dedicated "columns" editor?). This is the new-interaction bit the flow-selector weighs.

## Plan (draft — the D step refines; do NOT build before D sign-off)

- [ ] **D-gate pre-flight** — `design-sync --check` the **dataset-detail** design corpus
      (`.agents/design/data-management/datasets/dataset-detail.md` + `datasets.md` column model)
      before designing on it (the R148 lesson: don't design on a drifted doc).
- [ ] **D**: design-corpus draft — the `hidden?` view-hint + the column-metadata `PATCH` +
      which surfaces honor the default (Q1). Resolve Q1–Q3; table any domain decisions. Then
      flow-selector at D exit.
- [ ] **C**: `Column` gains `hidden?: boolean`; a new column-metadata `PATCH` contract
      (+ `values.yaml`/constants if a code/enum is introduced).
- [ ] **B**: the `PATCH` writes `columns_json` only (never the parquet); validation (unknown
      column, can't-hide-all?, at-least-one-visible?). Atomicity per the existing dataset writes.
- [ ] **F**: the row-preview surfaces default-hide `hidden` columns (with a show-all escape); the
      editing affordance; query-builder/join pickers explicitly keep ALL columns (Q1).
- [ ] **I**: i18n en+vi for the visibility affordance + any hint copy.
- [ ] Tests: PATCH round-trips `hidden`; parquet untouched; row-preview hides by default + show-all;
      query-builder still lists hidden columns; per D decisions.

## Risks / unknowns

- **Presentation-vs-compute doctrine** — the hint MUST stay metadata-only (never touch parquet). A
  slip that filters stored data would violate the separation and silently drop columns from queries.
- **Hard-projection vs default (Q1)** — if a hidden column stops being joinable/selectable, F7
  breaks query construction. The hint is a row-preview DEFAULT, not a projection — verify every
  consumer.
- **New PATCH capability** — first column-level mutation; keep it scoped to view-hints (not a
  general column editor) unless D pulls more.
- **Flow** — the visibility editor may be a new interaction (flow-selector cond-2) → possibly
  DFCFBI (F1 feel-review before contract). Let the selector decide at D exit.
- **Carried, open input**: the **R140 UI/UX list** (never enumerated — enumerate-and-fold here, or
  formally drop). **Parked**: R145 slice 1b (blast-radius preview); AI-propose-key (#2). ④ export parked.

## Do

_(D-gate pre-flight + design draft land here.)_

## Check

- [ ] R140 decision recorded (enumerate-and-fold, or drop).
- [ ] D signed off before C/B/F (Q1 surface list + PATCH shape + editing surface).
- [ ] `hidden` PATCH round-trips; parquet untouched; row-preview default-hides + show-all;
      query-builder/join pickers still see hidden columns.
- [ ] Backend pytest + ruff green; FE tsc + vitest green; design/plan/markdown lints clean.
- [ ] Human review of the visibility walk.

## Act

_(Learnings / promotions / prune check at close.)_

## Feeds into → Round_153 (TBD)

Re-rank at open. **Carried**: R140 list (if still open), R145 slice 1b, AI-propose-key. ④ export parked.
