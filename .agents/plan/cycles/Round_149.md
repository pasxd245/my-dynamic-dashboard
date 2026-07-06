# Round 149: Multi-range wizard — one sheet → N named ranges (F8)

**Status**: Review — built, gates green; awaiting human Integration walk (2026-07-06)
**Date started**: 2026-07-06
**Flow**: **DCFBI** — set at the Design gate via flow-selector (0 of 5 fired); recorded in the
Do log. No F1/F2 gates; human verification at Integration.

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

### D-gate — design draft (2026-07-06, awaiting human sign-off)

Design-corpus draft (the D deliverable, per `d-gate-artifact-in-design-corpus`), onto the
R148-synced current-state upload.md:

- [upload.md § Multi-range extraction (F8)](../../design/data-management/datasets/upload.md#multi-range-extraction-n-ranges-from-one-sheet-f8)
  — **build home ARGUED**: extend the existing per-dataset **unit** (one tab = one dataset-to-be),
  not a new wizard step (rejected: duplicates the tab model, adds a state-machine branch for no new
  capability). The load-bearing FE change is the **unit re-key** — `sheets: Record<unitId,
  SheetState>` keyed by a synthetic unit id + `SheetState.sheetName`, replacing today's key-by-sheet-name
  1:1 assumption; contained (reducer + tabs + Confirm + commit map) but the bulk of the round.
  **Wire unchanged** (N units = N items sharing `sheet`, differing `parse_options.range` — backend
  already accepts). UX: Sheet step unchanged (each sheet seeds one full-range unit); Metadata step
  gains `+ Add range from this sheet` → sibling tab; Confirm shows one row per unit with Sheet · Range.
  **Refresh untouched** (single-unit; re-key must preserve it).

**❓ Domain/UX decisions D1–D3 tabled for the human** (each with a recommendation, none decided):
D1 add-range affordance placement (rec: Metadata step) · D2 per-range naming default (rec: first
unit `<stem>_<sheet>`, additional `<stem>_<sheet>_<range>`, editable, dup-validation catches
collisions) · D3 override/column ownership (rec: per-unit by construction). **Hard stop here for
the human before C/B/F.**

Doc gates on the draft: `design:lint` 0 · `design:tokens` 0 · `md:lint` 0 · `check:links` clean.

### D-gate — CLOSED (human, 2026-07-06)

**"pls proceed"** — D1–D3 all resolved to the tabled recommendations (D1 = Metadata-step
affordance; D2 = first-unit `<stem>_<sheet>` / additional `<stem>_<sheet>_<range>`; D3 = per-unit
ownership). Spec banner flipped to SIGNED OFF in upload.md.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification |
| ------------------------------------ | ------ | ------------- |
| 1. >3 independent states/branches    | no     | Wizard state machine unchanged (Source→[Sheet]→Metadata→Preview→Confirm); F8 is a state re-key (sheet-name → unit-id) + an add-item affordance over the existing dynamic-tab model — no new state-machine branch. |
| 2. New interaction pattern           | no     | Composes existing primitives: dynamic per-sheet tabs, the typed Range field (parse-options disclosure), and an add-another-item affordance — prior art in the filters surface's "add filter" chips. No new pattern class. |
| 3. High user-error risk              | no     | Create-mode, not live-data mutation; the Preview step shows the parsed range before commit and datasets are freely deletable, so a wrong range is low-cost to redo (unlike R147's irreversible merge, which fired this). |
| 4. Contract depends on unresolved UI | no     | Wire unchanged — N units = N existing batch items sharing `sheet`, differing `parse_options.range`; the YAML is already written; D1–D3 resolved. |
| 5. UX confidence below threshold     | no     | D-gate closed with D1–D3 resolved and no open UX questions; the UX reuses reviewed primitives. Closest call (two-same-sheet-tab labeling is a minor detail); the multi-unit feel is verified at the DCFBI human Integration check. |

Result: **Flow: DCFBI** (0 conditions fired). No F1/F2 gates; human verification at Integration.

### C/B/F/I — built (2026-07-06)

- **C (contracts):** no change — each batch item already carries its own `sheet`,
  `parse_options.range`, and `name`, and `items` has no `uniqueItems`, so N same-`sheet` items
  with distinct ranges are already valid ([batch-post.contract.yaml](../../../workspace/packages/contracts/datasets/batch-post.contract.yaml)).
- **B (backend):** no code change — the create loop maps each item to a fresh `_new_ds_id()` via
  `_parse_and_target` (own `parse_options.range`), no per-sheet dedup
  ([datasets.py:602-623](../../../workspace/apps/backend/app/routers/datasets.py)). Added
  `test_two_ranges_from_one_sheet_commit_to_distinct_datasets` — two items on the same `Deals`
  sheet (full + `A1:B3`) → two datasets, distinct ids, 3 vs 2 columns.
- **F (frontend, the bulk):** the **unit re-key** —
  [state.ts](../../../workspace/apps/builder/src/features/data-management/datasets/upload/state.ts):
  `sheets: Record<unitKey, SheetState>` (initial unit keys by sheet name for backward-compat;
  added ranges get a synthetic `${sheet}:${seq}` key — `:` is Excel-forbidden so no collision),
  `SheetState.sheetName` + `nameEdited`, `unitOrder` + `nextUnitSeq`, actions `ADD_RANGE_UNIT` /
  `REMOVE_RANGE_UNIT`, the `sheet`→`unit` action-field rename on the seven per-dataset actions,
  and `units()` / `sheetHasMultipleUnits()` selectors + D2 range-derived naming. Components:
  parse is now **per-unit** (one `/parse` call per unit reading `results[0]` — the old batch
  matched by `result.sheet`, which collides when two units share a sheet); commit maps
  `units(state)` → items with `sheet = unit.sheetName` (N units of one sheet = N items sharing
  `sheet`, differing `range`); Metadata gains the `+ Add range from this sheet` affordance +
  Remove on added units + range-bearing tab labels; Confirm gains a Range column + one row per
  unit; advance guard = `units().every(status==='ok')`. Refresh untouched (single-unit; re-key
  preserves it).
- **I (i18n):** en+vi `upload.metadata.addRange` / `removeRange`, `upload.confirm.rangeColumn` /
  `rangeFull` — VN "vùng" (reuses `upload.metadata.range`), "(toàn bộ)"; parity OK.

**Gates:** BE `pytest` 350 (incl. the new multi-range test) · `ruff` clean · FE `tsc` 0 ·
`vitest` 299/299 (incl. 8 new F8 reducer tests) · `design:lint`/`design:tokens`/`plan:lint`/
`md:lint` 0 · i18n parity OK.

## Check

- [x] D signed off before C/B/F (incl. the slice boundary + naming/override/affordance
      decisions). _Human, 2026-07-06 — "pls proceed"._
- [x] One sheet with two adjacent tables → two datasets, each correct columns/rows, in one pass.
      _Automated: `test_two_ranges_from_one_sheet_commit_to_distinct_datasets` (Deals full +
      `A1:B3` → 2 datasets, distinct ids, 3 vs 2 cols); the in-app real-file walk is the human
      verification below._
- [x] Single-range and multi-sheet paths unregressed; single-unit refresh path unregressed.
      _BE pytest 350 (create/refresh/merge suites) + FE vitest 299 (incl. refresh-wizard)._
- [x] Backend pytest + ruff green; FE tsc + vitest green; design/plan/markdown lints clean.
- [~] Human feel-review of the multi-range walk (Integration — DCFBI human gate). _Handed over
      2026-07-06; pending an in-app run (carve two ranges from one sheet → two datasets; check the
      add/remove-range affordance, the range-bearing tab labels, and the Confirm Range column)._

## Act

_(Learnings / promotions / prune check at close.)_

## Feeds into → Round_150 (TBD)

Per the signed-off R142 order, after F8: **UI-batch** — F7 (column show/hide default), F3, F4,
F12, F13, plus the R140 list. **Carried**: R145 slice 1b + AI-propose-key. Re-rank at open.
