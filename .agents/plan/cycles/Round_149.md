# Round 149: Multi-range wizard — one sheet → N named ranges (F8)

**Status**: Planning — blocked on [Round_148](Round_148.md) (design-sync); D-gate opens once
upload.md is current-state (2026-07-06)
**Date started**: TBD (after R148 closes)
**Flow**: TBD — set at the Design gate via flow-selector, recorded in the Do log.

## Goal

**Inherits from ← [Round_147](Round_147.md) "Feeds into"** and the signed-off
[R142 dogfood ranking](../brainstorms/2026-07-03-r142-dogfood-findings.md) (rank **4 — F8**).
Originally opened as R148; re-numbered to R149 when the F8 design-gate pre-flight found upload.md
OUT OF SYNC and the human made the sync its own round ([Round_148](Round_148.md)).

With the ⑥ refresh theme closed (R145 replace + R147 merge-on-key), the next ranked friction is
**F8 — a single sheet can hold more than one table, but the wizard can only carve one.**

The real exports have **side-by-side blocks on one sheet** (the `Hot line` dimension block next
to the main call log; the CRM `Master`). The backend already reads a sub-range per item — the
A1 `range` param flows through parse and commit today
([excel_parser.py `parse_sheet(range_=…)`](../../../workspace/apps/backend/app/ingest/excel_parser.py),
[parquet_writer.py](../../../workspace/apps/backend/app/ingest/parquet_writer.py), threaded at
[datasets.py](../../../workspace/apps/backend/app/routers/datasets.py)) — but the wizard exposes
**at most one range per sheet**, so a sheet with two tables forces two separate uploads of the
same file (or loses the second table entirely). F8 is a **UX gap over a capability that exists**,
which is why R142 ranked it a *cheap win*: the wire and the parser don't change shape; the wizard
learns to declare **N ranges → N datasets from one sheet**.

After this round: a user who exports a sheet with two adjacent tables carves each into its own
dataset in a single pass, without re-uploading.

_Track: 1. Pulled by ← [Round_147](Round_147.md) Feeds-into + the signed-off ranking in
[2026-07-03-r142-dogfood-findings](../brainstorms/2026-07-03-r142-dogfood-findings.md) (rank 4,
"backend already supports; unblocks clean dimension extraction"). D-gate first per the
`d-gate-artifact-in-design-corpus` lesson, on the R148-synced upload.md. Re-rank was checked at
open — no new evidence; F8 stands as the ranked next._

## Slice — LOCKED at open (human, 2026-07-06)

Three scoping questions answered before drafting; all landed on the lowest-risk option, keeping
F8 the cheap win the ranking assumed:

1. **Scope = N ranges within a single sheet** (not the full N-sheets × M-ranges cross-product —
   that defers with a named trigger, to avoid ballooning the wizard state machine).
2. **Range entry = typed A1** (e.g. `B2:F100`) — reuse the existing `range` param exactly as the
   backend regex reads it; no new parsing. Visual/derive-from-preview deferred to a later slice.
3. **Refresh untouched** — slice 1 is new-datasets-only. Whether a range participates in refresh
   identity is named as a boundary and deferred (R145/R147 refresh identity just stabilized).

## Known design fact (from the R148 pre-flight)

The FE state is keyed **per dataset-to-be by sheet name** — [state.ts](../../../workspace/apps/builder/src/features/data-management/datasets/upload/state.ts)
`sheets: Record<sheetKey, SheetState>` (Excel = sheet name, CSV = `CSV_SHEET_KEY=""` sentinel).
That is a hard **1 sheet = 1 dataset** assumption (tabs, Confirm rows, `SET_DATASET_NAME; sheet`,
commit item construction all key off it). F8 makes one sheet spawn N units, so the per-dataset
unit must be re-keyed by a **synthetic unit id** instead of the sheet name. The refactor is
contained (reducer + tab render + Confirm table + commit map) but is the bulk of the round — F8
stays rank-4 (no backend/contract/refresh change), but the cost lives here, not in new parsing.

## Plan (draft — the D step refines)

> Do not build before the D-gate is signed off. Requires R148's upload.md sync complete first.

- [ ] **D**: design-corpus draft onto the R148-synced [upload.md](../../design/data-management/datasets/upload.md).
      Noun-vs-mode first: N-ranges-per-sheet as an extension of the existing Sheet/Metadata tab
      model vs a new step (lean: extend the tab model, add-range affordance in the Metadata step
      where the Range field already lives). Then: the **synthetic-unit-id re-key** (above), how N
      ranges map to the Confirm step's "one row per dataset" invariant, per-range dataset **naming**
      (`<stem>_<sheet>` no longer unique — rec: append a range disambiguator, editable at Confirm,
      existing duplicate-name validation catches collisions), and per-range **override ownership**
      (rec: per-unit by construction — each range parses to its own schema, same as today's
      per-tab model).
- [ ] **Domain / UX decisions at D (human)**: (1) add-range affordance placement (Metadata step
      vs Sheet step); (2) per-range naming default; (3) per-range override ownership. (Recs above.)
- [ ] **Flow selector** at D exit; record the table in Do.
- [ ] **C**: confirm the batch item's `range` (in `parse_options`) + per-item `name` already carry
      what's needed (they do per code); add a wire field only if D surfaces a genuine gap. Expect
      little/no contract change.
- [ ] **B**: expected **thin or none** — parser/commit read `range` today. Confirm N same-file +
      same-sheet items with distinct ranges commit correctly (staging, atomicity, distinct dataset
      ids); add tests. If B turns non-trivial, that contradicts the cheap-win rank — flag + re-scope.
- [ ] **F**: the unit-id re-key + the add-range affordance + per-range name; Confirm shows N
      dataset rows from one file. The bulk of the round.
- [ ] **I**: i18n en+vi per the R146/R147 method — grep corpus before coining ("tập dữ liệu",
      "sheet" loanword kept, VN for "range/vùng"); value-framed hints. Design-sync at close.
- [ ] Tests: one sheet with two ranges → two datasets, right columns/rows each · adjacent ranges
      don't bleed · malformed range → typed 422 (existing path) · per-range names distinct ·
      single-range path unregressed · multi-sheet path unregressed.

## Risks / unknowns

- **Cheap-win assumption is load-bearing** — ranked cheap *because the backend already supports it*.
  The real cost is the FE unit-id re-key (above). If D/C reveals the wire can't carry per-item name
  or per-range overrides cleanly, cost moves and the rank should be re-checked. Flag at the gate.
- **Scope creep to N-sheets × M-ranges** — the cross-product balloons the state machine
  (flow-selector cond-1). Held out by the locked slice; visual range-picking also deferred.
- **Per-range naming vs dataset identity** — N names from one sheet must not reopen the refresh
  identity seam (R145/R147); refresh is out of slice 1.
- **Confirm-step invariant** — "one row per dataset" must hold with N ranges (N ranges = N rows);
  verify Confirm rendering + batch-item construction agree.
- **Carried, not this round**: R145 slice 1b (drift blast-radius preview); AI-propose-key (parked,
  #2 additive). Re-rank only on evidence.

## Do

_(D-gate work lands here, after R148 closes.)_

## Check

- [ ] D signed off before C/B/F (incl. the slice boundary + naming/override/affordance decisions).
- [ ] One sheet with two adjacent tables → two datasets, each correct columns/rows, in one pass.
- [ ] Single-range and multi-sheet paths unregressed.
- [ ] Backend pytest + ruff green; FE tsc + vitest green; design/plan/markdown lints clean.
- [ ] Human feel-review of the multi-range walk.

## Act

_(Learnings / promotions / prune check at close.)_

## Feeds into → Round_150 (TBD)

Per the signed-off R142 order, after F8: **UI-batch** — F7 (column show/hide default), F3, F4,
F12, F13, plus the R140 list. **Carried**: R145 slice 1b + AI-propose-key. Re-rank at open.
