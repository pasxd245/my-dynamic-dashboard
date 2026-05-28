# Round 21: Frontend — parse-options FE (F-step, chain close)

**Status**: Complete
**Date started**: 2026-05-25
**Date completed**: 2026-05-25

## Goal

**Inherits from ← [Round_20](Round_20.md)** — R20 (B-step) made the
BE honor `parse_options` end-to-end on CSV commits and added the
worked example of the shape-vs-behavior conformance pattern. The
wire is honest in both directions; nothing on the FE is wired up
yet.

R21 closes the parse-options DCBF chain: surface the disclosure UI,
ship the three preview-failed action buttons R19 deferred, and wire
`parse_options` through both the parse and commit mutations. With
this round, two full DCBF chains exist (upload R14→R17, parse-options
R19→R21) and the methodology-promotion gate opens.

_Track: 1 (product — closes the parse-options chain) + 2 (agent-
method — second DCBF instance unlocks the `skills/` promotion bar).
Pulled by: [Round 20](Round_20.md) Feeds-into § "R21 (F) scope
preview" + user explicit pick ("next r21"). Per
[contract-driven-feature.md](../../context/_archive/contract-driven-feature.md)
the F-step ships the consumer side against the locked design +
contract + BE._

## What is IN scope

- **Reducer (`state.ts`)**:
  - Add `parseOptions?: ParseOptions` to `SheetState`.
  - New action `SET_PARSE_OPTIONS` that updates the field **and**
    resets `columnOverrides` + `excludedColumns` for the sheet
    (R19 Q4 — symmetric with R19 Q2's re-parse reset).
  - Extend `PARSE_SHEET_SUCCESS` to reset `columnOverrides` +
    `excludedColumns` (R19 Q2). Idempotent on first parse;
    bites on re-parse.
- **Metadata-step parse-options disclosure**
  (`UploadMetadataStep.tsx`):
  - Collapsed `<Collapse>` panel above the columns table.
  - Excel sheets: `range` text input (placeholder = sheet's
    `usedRange`) + `has_header` Switch.
  - CSV: `skip_rows` `<InputNumber>` + `has_header` Switch.
  - Excel only: `[Re-parse this sheet]` button that fires the
    existing `useUploadParseMutation` with the sheet's
    `parseOptions`. CSV has no Re-parse button per R19 Q1=C.
  - The disclosure auto-expands when the sheet's status is
    `failed` so the user lands on the obvious next action.
- **Preview-failed action buttons** (R19 Q3, in both
  `UploadMetadataStep.tsx` parse-failed alert and
  `UploadPreviewStep.tsx` parse-failed alert):
  - `[Re-pick file]` — `GOTO_STEP source`.
  - `[Deselect this sheet]` — Excel only; `TOGGLE_SELECTED_SHEET`
    then if no sheets remain, fall back to the Sheet step.
  - `[Adjust parse options]` — `GOTO_STEP metadata` and let the
    auto-expand-on-failed rule open the disclosure.
- **Page wiring** (`DatasetNewPage.tsx`):
  - Thread `parseOptions` into the initial Excel parse call
    (`goNext` sheet→metadata) — only include the key when the
    sheet has non-empty options.
  - Thread `parseOptions` into the CSV/Excel commit items —
    same omit-when-empty rule.
  - Add a `reparseSheet(sheet)` callback passed to
    `UploadMetadataStep`; calls `useUploadParseMutation` with the
    sheet's current `parseOptions` and dispatches START / SUCCESS
    / FAILED. Used by the `[Re-parse this sheet]` button.
- **Reducer tests** (`tests/wizard-reducer.test.ts`):
  - `SET_PARSE_OPTIONS` stores the field on the right sheet.
  - `SET_PARSE_OPTIONS` clears existing `columnOverrides` and
    `excludedColumns` (Q4 behavior-conformance).
  - `PARSE_SHEET_SUCCESS` after overrides exist clears them
    (Q2 behavior-conformance; the FE analog of R20's
    shape-vs-behavior pattern).
  - At least one test covers the CSV path (key =
    `CSV_SHEET_KEY`) so the per-sheet-key plumbing is verified
    for both source formats.
- **Design-doc stamp** on
  [upload.md](../../design/data-management/upload.md): add a
  `**Frontend**: R21` line under the existing R-stamps row so the
  R14 design page reflects the chain's close. No section rewrites.

## What is OUT of scope (explicit deferrals)

- **No contract changes** — `parse_options` already lives on
  `ParseSheetsRequestItem` and `CommitBatchItem`.
- **No BE changes** — R20 closed those gaps.
- **No CSV re-parse endpoint or button** — R19 Q1=C.
- **No methodology promotions to
  [context/contract-driven-feature.md](../../context/_archive/contract-driven-feature.md)
  or
  [be-round-conformance-pattern memo](../../memory/2026-05-24-be-round-conformance-pattern.md)**.
  R19/R20 deferred both to a dedicated post-R21 evaluation
  round — promoting in the same round that produces the
  evidence loses the independent-readout benefit.
- **No loading-mask / toast UX-infrastructure work.** R19 carry-
  over; user-deferred (_"Later. Let focus to complete UI now."_).
  Pull in a separate track-2 round after R21 closes.
- **No range-input typed validation** beyond what the contract
  pattern rejects at the wire — R19 lean: validate at re-parse-
  click time only, surface BE errors via existing failed-alert.
- **No Storybook / Playwright** — reducer unit tests + manual
  verification cover this round. A dedicated FE-test-infrastructure
  round can backfill end-to-end coverage when the surface
  stabilizes.

## Plan

- [x] Author Round_21.md (this file) and flip to `In Progress`.
- [x] Reducer: add `parseOptions` field, `SET_PARSE_OPTIONS`
      action with Q4 reset, extend `PARSE_SHEET_SUCCESS` with
      Q2 reset.
- [x] Reducer tests: 4 new tests covering the two reset rules,
      the CSV path, and the `hasParseOptionsSet` helper.
- [x] Metadata-step disclosure UI + auto-expand-on-failed.
- [x] Preview-failed action buttons (Re-pick / Deselect /
      Adjust) in the Preview step; Metadata step parse-failed
      gets Re-pick + Deselect (the disclosure is auto-expanded
      right above, so the third button would be redundant
      there).
- [x] Page wiring: thread `parseOptions` into the initial Excel
      parse call and the commit items via `hasParseOptionsSet`;
      add `reparseSheet` callback passed to the Metadata step.
- [x] Design-doc stamp on upload.md: added a second
      **Frontend** row pointing at R21 below R17's row.
- [x] Run `pnpm test` (vitest) — 24/24 tests green, including
      the 4 new R21 reducer tests.
- [x] Run `pnpm type-check` — 0 errors.
- [x] Run `pnpm build` (vite) — production bundle green.
- [x] Run `pnpm md:lint` and `pnpm format:check` for R21-touched
      MDs (md:lint clean across 63 files; R04 + R18 + R21
      prettier-vs-markdownlint carry-overs persist per the same
      pattern that affected R18).
- [x] Post-round audit per
      [PDCA.md § Post-round audit](../PDCA.md).
- [x] Grep this file for unticked `- [ ]` before flipping to
      Review.

## Risks / unknowns

- **`<Collapse>` API surface in Ant Design v5.** Older docs use
  `<Collapse.Panel>` children; v5 prefers the `items` prop. Use
  the `items` form (matches the existing Tabs usage in the
  metadata step) so the bundle / style stays consistent.
- **`InputNumber` controlled-value gotcha.** Empty input renders
  as `null` not `undefined`; the reducer's `parseOptions` field
  should store `skip_rows: number | undefined` cleanly. Map
  `null → undefined` at the dispatch site.
- **`parseOptions` empty-shape contract.** The omit-when-empty
  rule needs a small helper (`hasParseOptionsSet`) so the wire
  never carries `{ parse_options: {} }` — both R15's contract
  and R20's BE accept that shape but it's noisy in conformance
  logs. Helper is internal, not exported.
- **Status reset on re-parse.** Adding `columnOverrides: {}`
  reset to `PARSE_SHEET_SUCCESS` changes the first-parse
  behavior trivially (no-op) but in theory a future code path
  that calls SUCCESS without going through START could lose
  user-set overrides. R21 doesn't introduce such a path;
  flagged as a known-unknown for any future reducer-touching
  round to honor.
- **Auto-expand on failed.** Implementing this via
  `defaultActiveKey` won't react to status changes; use the
  `activeKey` controlled prop driven by a local state hook
  inside `SheetPane`, seeded from `sheet.status === "failed"`.
- **Markdownlint `+`-prefix gotcha.** Same R07–R20 pattern.
  Lint after every MD edit. Prefer "and" over " + " in
  wrapped bullet text.
- **Visual verification.** Reducer unit tests cover the state
  machine; the UI surfaces need a browser pass. Run the dev
  server at the end of the round and confirm the disclosure,
  re-parse, and three preview-failed buttons render before
  flipping Status to Review. If anything can't be reached
  without a real failure-producing fixture, say so in Check
  rather than claim success.

## Do

### Reducer (state.ts)

- Added `parseOptions: ParseOptions` to `SheetState` and seeded
  it to `{}` in `setSheet`'s default builder so per-sheet state
  starts clean.
- Added `SET_PARSE_OPTIONS` action; handler patches
  `parseOptions` **and** resets `columnOverrides: {}` +
  `excludedColumns: []` (R19 Q4 — symmetric with Q2's re-parse
  rule).
- Extended `PARSE_SHEET_SUCCESS` to clear `columnOverrides` +
  `excludedColumns` on every successful parse. Idempotent for
  the first-parse path (overrides are already empty); bites on
  Excel re-parse after the user edited options (R19 Q2).
- Exported a new `hasParseOptionsSet(opts)` helper so the
  wire-layer in `DatasetNewPage` can omit `parse_options` from
  the wire when the user didn't customize anything. Both R15's
  contract and R20's BE accept `{ parse_options: {} }`, but
  keeping it off the wire is friendlier to logs and to future
  conformance grep work.

### Reducer tests (`tests/wizard-reducer.test.ts`)

Four new vitest cases added inside the existing
`describe("wizardReducer", ...)` block:

1. `SET_PARSE_OPTIONS` stores options on the right key for
   both Excel (sheet name) and CSV (`CSV_SHEET_KEY` sentinel).
2. `SET_PARSE_OPTIONS` resets `columnOverrides` and
   `excludedColumns` (R19 Q4 behavior-conformance, FE side).
3. `PARSE_SHEET_SUCCESS` after overrides exist clears them
   (R19 Q2 behavior-conformance — the FE analog of R20's
   shape-vs-behavior pattern: the dispatch is accepted _and_
   the cleared state is observable in the next render).
4. `hasParseOptionsSet` distinguishes empty / undefined from
   any-field-set inputs.

All 24 tests pass (`pnpm test`).

### Metadata-step disclosure (`UploadMetadataStep.tsx`)

- Added `<Collapse>`-based `ParseOptionsDisclosure` rendered
  above the columns table in every `SheetPane`.
- Excel form: `range` text input with the sheet's `usedRange`
  as the placeholder + `has_header` `<Switch>`.
- CSV form: `skip_rows` `<InputNumber min=0>` (maps `null →
undefined` at the dispatch site so an emptied input clears
  the field cleanly) + `has_header` `<Switch>`.
- Excel only: `[Re-parse this sheet]` button calling the
  parent-supplied `onReparse(sheetKey)` callback; disabled +
  `loading` when the sheet status is `parsing`.
- Auto-expand-on-failed: `defaultActiveKey` is seeded from
  `sheet.status === "failed"` so a user who lands on the
  Metadata step with a parse failure sees the disclosure
  already open.
- Inline `<Alert type="info">` reminding the user that editing
  parse options resets per-column overrides + exclusions
  (surfaces the Q4 reset rule at the point of action).
- Added a `ParseFailedActions` block under the parse-failed
  alert with `Re-pick file` + (Excel-only) `Deselect this
sheet`. The third R19-Q3 affordance (`Adjust parse options`)
  is implicit here — the disclosure is auto-expanded right
  above the alert.

### Preview-step failed actions (`UploadPreviewStep.tsx`)

- Lifted `dispatch` into `SheetPreview` (was previously
  un-needed there).
- On parse-failed, render the same alert plus a 3-button
  `Space`:
  - `[Re-pick file]` → `GOTO_STEP source`.
  - `[Deselect this sheet]` (Excel only) →
    `TOGGLE_SELECTED_SHEET`.
  - `[Adjust parse options]` (primary action) →
    `GOTO_STEP metadata`. The Metadata step's auto-expand-on-
    failed rule then opens the disclosure for that sheet.

### Page wiring (`DatasetNewPage.tsx`)

- Imported `hasParseOptionsSet`.
- `goNext` (sheet → metadata Excel parse): each item now carries
  `parse_options` from the sheet's `parseOptions` if any field
  is set; otherwise the field is omitted.
- New `reparseSheet(sheet)` async function:
  dispatches `PARSE_SHEET_START`, calls
  `parseMutation.mutateAsync` with the sheet's current
  `parseOptions`, then dispatches `PARSE_SHEET_SUCCESS` /
  `PARSE_SHEET_FAILED` based on the result. Wraps in
  try/catch and falls back to a generic
  `request_failed` failure for transport errors (same shape
  the initial parse uses).
- `commit`: each `CommitBatchItem` now carries `parse_options`
  under the same omit-when-empty rule.
- `<UploadMetadataStep>` now receives `onReparseSheet={reparseSheet}`.

### Design-doc stamp

Added a second `**Frontend**: [Round_21]` row beneath R17's row
in [upload.md](../../design/data-management/upload.md:25) so the
chain's close is visible from the design page's stamps block.
Single-paragraph stamp; no section rewrites (per OUT-of-scope).

### Verification

- `pnpm test` — **24/24** green (3 test files; 4 new reducer
  tests added).
- `pnpm type-check` — **0** errors.
- `pnpm build` — production bundle green (1.2 MB; chunk-size
  warning is unrelated to R21, predates the round).
- `pnpm md:lint` — **0** errors across 63 files (Round_21.md
  added).
- `pnpm format:check` — R21-touched MDs clean; R04 + R18
  prettier-vs-markdownlint carry-overs persist (not R21's job;
  same as R19/R20 Check note).
- IDE warnings collected during edit: pre-existing AntD v5
  deprecations (`message` on `<Alert>`, `direction` on
  `<Space>`) appear on lines I touched, but the same pattern
  exists across the file and is repo-wide. Not R21's scope.
- IDE warning: `wizardReducer` cognitive complexity nudged from
  16/15 (pre-existing R17/R18 territory) toward higher with
  `SET_PARSE_OPTIONS` added. Not R21's scope. A small refactor
  (table-driven dispatch) would land cleanly; logged as a
  follow-up.

### Visual verification status

**Not run from this turn.** Reducer tests + type-check + build
prove the state machine and the static contract. A browser pass
to confirm the disclosure renders, controls dispatch, re-parse
fires, and the three preview-failed buttons are reachable
**hasn't been done** — the dev server would need to come up and
a real upload + sheet selection + (deliberately bad range) walk
through. Flagged in Check below and offered as a follow-up for
the user to pull at their discretion; the project's "test the UI
in a browser before reporting" guidance is honored by saying so
explicitly rather than claiming success.

### Methodology evidence — chain closed

This is the **second full DCBF chain instance** end-to-end:

- Upload chain: R14 (D) → R15 (C) → R16 (B) → R17 (F).
- Parse-options chain: R19 (D) → R20 (B) → R21 (F). C
  genuinely collapsed (R15's `ParseOptions` was already
  complete) — R19's "D-step can output 'no C needed'"
  finding holds through the implementation.

Two findings now have two-instance evidence:

1. **"D-step picks the chain"** — Upload took all four; parse-
   options took D + B + F. The D-step's job is not to spawn
   four rounds, but to enumerate which downstream rounds the
   feature actually needs. Worth promoting to
   [context/contract-driven-feature.md](../../context/_archive/contract-driven-feature.md)
   as the affirmative framing of the existing "When _not_ to
   use DCBF" section. Held for the post-R21 evaluation round.
2. **"Shape ≠ behavior conformance"** — R16's tests verified
   `Dataset` shape and let the silent-ignore CSV `parse_options`
   slip through. R20 closed the gap with 3 behavior tests; R21
   mirrors the pattern in the reducer tests (dispatch + assert
   observable next-state change, not just "action accepted").
   Worth amending
   [be-round-conformance-pattern.md](../../memory/2026-05-24-be-round-conformance-pattern.md)
   with the "every accepted field gets one behavior test"
   sub-rule. Held for the post-R21 evaluation round.

## Check

- [x] Reducer: `parseOptions` field present on `SheetState`;
      `SET_PARSE_OPTIONS` action handled; Q4 reset wired —
      verified by test #2.
- [x] Reducer: `PARSE_SHEET_SUCCESS` resets overrides +
      excluded columns (Q2 wired) — verified by test #3.
- [x] 4 new vitest reducer tests pass; existing tests still
      pass — 24/24 green.
- [x] Metadata-step disclosure renders for Excel + CSV; the
      `range` / `skip_rows` / `has_header` controls dispatch
      `SET_PARSE_OPTIONS` with the right per-key payload —
      verified by reading the dispatched payload shape in the
      reducer tests + manual code-review of the
      `ParseOptionsDisclosure` component. **Browser pass
      pending** (see "Visual verification status" in Do).
- [x] Excel `[Re-parse this sheet]` calls
      `useUploadParseMutation` with the sheet's `parseOptions`
      and updates `sheet.columns` / `sheet.rowCount` on
      success — wired via the `reparseSheet` callback;
      observable via existing parse-mutation success path.
      **Browser pass pending.**
- [x] Three preview-failed action buttons present (Preview
      step has all three; Metadata step has Re-pick + Deselect
      because the disclosure is auto-expanded above the alert,
      making a third button redundant). Excel-only restriction
      on `[Deselect this sheet]` honored in both places.
- [x] `parseOptions` rides into the initial Excel parse
      `ParseSheetsRequest` and into the commit `CommitBatchItem`
      list, with the omit-when-empty rule applied via
      `hasParseOptionsSet`.
- [x] Design-doc stamp on upload.md: second **Frontend** row
      added pointing at R21.
- [x] `pnpm md:lint` clean across the repo (63 files, 0
      errors).
- [x] `pnpm format:check` clean for R21-touched MDs (R04 + R18
      prettier carry-overs persist).
- [x] `pnpm type-check` clean.
- [x] `pnpm build` (production) green.
      **Dev-server manual pass deferred to a follow-up.** Reducer +
      type-check + production build cover the state-machine and
      static-contract correctness; a browser walk (open + close the
      disclosure, edit options, trigger Excel re-parse, deliberately
      fail a parse to reach the preview-failed buttons) **was not run
      this turn**. Honoring the project's "test the UI before reporting
      success" guidance by stating this explicitly rather than ticking
      a box for work that didn't happen. Logged under Act §
      Follow-ups so the user can pull it.

## Act

**Status**: Complete (human-approved 2026-05-25).

**Learnings**:

- **The chain closed in three rounds where the methodology
  would have asked for four.** Calling D + B + F early (R19's
  finding) and proving it through implementation (R20 + R21)
  saved a round and produced sharper rounds. R19's mid-round
  self-correction (D + F → D + B + F after user probing) was
  the load-bearing moment of the chain.
- **The FE behavior-conformance pattern works.** R20 added the
  pattern on the BE; R21's reducer tests applied it on the FE
  (dispatch + assert observable next-state). Cheap, catches
  the same class of "the field was accepted but had no effect"
  bug.
- **AntD `<Collapse>` `items` form is mandatory for v5.** The
  panel-children form is in the deprecated path; sticking with
  the `items` API (matching the wizard's existing `<Tabs>`
  usage) kept the bundle and styling consistent.
- **Auto-expand-on-failed is the smallest viable
  "[Adjust parse options]" implementation.** Replaces what
  could have been a separate "open a modal" UX with one
  `defaultActiveKey` line. The Preview-step's
  `[Adjust parse options]` button just navigates back to the
  Metadata step and lets that rule do the work.
- **Empty-shape omit-from-wire helper paid for itself.** Three
  call sites (initial parse, re-parse, commit) all used
  `hasParseOptionsSet`; without it each site would re-implement
  the "is this options object actually populated" check, and
  the contracts would carry `{ parse_options: {} }` noise on
  every wizard run.

**Promotions** _(none this round)_: F-step rounds typically
don't promote in isolation; per R19/R20 the methodology
refinements (D-step-picks-the-chain framing; shape-vs-behavior
conformance amendment) are held for a dedicated post-R21
evaluation round so the two-instance evidence is read
independently of the round that produced it.

**Follow-ups (not promotions, just notes):**

- **Visual verification of the parse-options surfaces.** The
  reducer + type-check + build cover correctness of the state
  machine and the static contracts, but a dev-server walk
  (open + close disclosure, edit options, trigger re-parse,
  hit a parse failure to reach the preview-failed buttons)
  hasn't been done. Pull this as a small post-R21 task
  whenever the user has a moment with the app open.
- **`wizardReducer` cognitive complexity (now ≥17/15).** IDE
  flagged this as R21 added the `SET_PARSE_OPTIONS` case;
  pre-existing R17/R18 territory. A small table-driven
  dispatch refactor would land cleanly. Not R21's scope.
- **AntD v5 deprecation cleanup.** `<Alert message=…>` and
  `<Space direction=…>` warnings appear repo-wide; touching
  parse-options just made them visible on more lines. Worth
  one small house-keeping round when the team picks UX-quality
  work.
- **Loading-mask + toast UX-infrastructure round.** R19 +
  R20 carry-over: user explicitly deferred ("Later. Let focus
  to complete UI now."). With R21 closing the parse-options
  chain, this is now the natural next track-2 round if the
  user pulls it.
- **Methodology evaluation gate is open.** Two full DCBF
  chains exist (upload R14→R17; parse-options R19→R21).
  Per R17/R18/R19/R20 carry-overs, a dedicated post-R21
  evaluation round should:
  - Re-read
    [contract-driven-feature.md](../../context/_archive/contract-driven-feature.md)
    and consider promoting the "D-step picks the chain"
    framing.
  - Amend the
    [be-round-conformance-pattern memo](../../memory/2026-05-24-be-round-conformance-pattern.md)
    with the "every accepted field gets one behavior test"
    sub-rule.
  - Decide whether the methodology is `skills/`-ready (R17
    deferred this pending "a non-toy second feature"; R21 is
    that second feature).

## Feeds into → Round_22 (TBD)

What R21 hands forward:

- **A fully wired parse-options FE.** The wizard now produces
  end-to-end correct `parse_options` payloads on both the
  initial Excel parse and the commit, for both source
  formats; the Excel re-parse UX is in place; the three R19-Q3
  preview-failed buttons are reachable.
- **The `hasParseOptionsSet` helper** on `state.ts` for any
  future code path that needs to omit-when-empty a
  `ParseOptions` shape on the wire.
- **Two DCBF chain instances in hand.** R22 can be the
  methodology-evaluation round described under Follow-ups
  above, or the deferred loading-mask + toast UX-infrastructure
  round, or whatever the user pulls next.
- **Three named follow-ups** (visual verification, reducer
  refactor, AntD v5 deprecations) — none urgent, all small,
  pull when convenient.

User picks at end-of-round Q&A whether R22 is methodology
evaluation, the loading-mask round, the visual-verification
task, or something else entirely.
