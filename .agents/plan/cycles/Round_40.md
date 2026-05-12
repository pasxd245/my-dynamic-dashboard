# Round 40: Upload step-model rewrite (scaffolding)

**Status**: Complete ✅
**Date started**: 2026-05-12
**Date completed**: 2026-05-12

**Governance**: Spec-Kit PDCA (Plan -> Do -> Check -> Act)

> **Pivot note (2026-05-12)**: Slot was previously planned for Spec 020
> (Column Role Assignment). End-of-Round-39 brainstorm surfaced a deeper
> structural issue with the upload step taxonomy: today's `sheet` step
> leaks Excel-specific shape into a generic "what do you want to upload"
> flow, and the outer `query` stage doesn't belong in a data-upload
> spine. Round 40 replaces the inner step model with a source-agnostic
> 4-step taxonomy as a **scaffolding cut** — type system + step strip
> rewire only, no new features. Spec 020 (column role assignment) and
> all downstream Data Management spec rounds shift one slot.
>
> **Round type**: Internal refactor + minor user-visible label/structure
> change. No backend changes, no new endpoints, no schema migrations.

## Goal

Replace the inner upload step taxonomy
`UploadStepKey = "workspace" | "source" | "sheet" | "submit"`
with a source-agnostic 4-step model:
`UploadStepKey = "source" | "extract" | "define" | "publish"`.

Keep today's file/CSV/Excel happy-paths working end-to-end. No new
features land in this round — every later step in the upload chain
(type correction, entity/revision split, new source types, publish
action + manifest) will plug into this skeleton in its own round.

## Target step model

| Step      | Owns                                              | Round 40 content                                                                                            |
| --------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `source`  | Pick source kind + raw input                      | Existing source step (file picker + `SourceTypeSelector`)                                                   |
| `extract` | Source-specific reading params; auto-profile      | Existing Excel sheet picker (gated by `selectedSourceType === "excel"`); CSV shows an "auto-detected" card  |
| `define`  | Type correction, role assignment, entity identity | Existing submit step (upload button); after upload, navigate to outer `schema_sheet` stage as today         |
| `publish` | Commit as a revision; manifest entry              | Stub card: "Publish lands in a later round; the outer `schema_sheet`/`query` flow continues from `define`." |

**Workspace handling**: drops out of the inner step strip. Becomes a
precondition surfaced as a banner/alert at the top of the upload page
when missing, with the existing `WorkspacePicker` reachable from the
page header. This is the one intentional user-visible change in
Round 40 and is the architecturally cleaner home for a workspace gate.

## In scope

- New `UploadStepKey` union + label map + nav-item builder in
  [uploadStageModel.ts](apps/builder/src/components/upload-flow/uploadStageModel.ts)
- New `deriveUploadStep` derivation respecting the new keys
- New `getUploadStepBlockedReason` reasons for the new keys
- Rewire the four `focusedUploadStep === "..."` branches in
  [App.tsx](apps/builder/src/App.tsx) (lines ~524–620) to render the
  new step keys; collapse the existing workspace step into a top-of-page
  banner/alert + page-header action
- Update step-strip-aware tests:
  - [UploadFlowPage.test.tsx](apps/builder/src/pages/__tests__/UploadFlowPage.test.tsx)
  - [UploadFlowFeedback.test.tsx](apps/builder/src/pages/__tests__/UploadFlowFeedback.test.tsx)
- `extract` step for CSV: render an "auto-detected (no extraction
  knobs needed for CSV in this round)" info card and a Next button
- `publish` step: render a typography-only stub explaining where the
  publish action will live in a later round; no actions wired

## Out of scope (queued for later rounds)

- Round 41 (proposed): move workspace gate from banner into App-level
  redirect; tidy first-time-user flow
- Round 42 (proposed): type-correction UI + BE per-column type
  override endpoint (this is the FE+BE pair Spec 019 deferred)
- Round 43 (proposed): Entity / Revision split — stable entity
  identity separated from per-upload revision
- Round 44 (proposed): CSV encoding/delimiter/quote knobs in `extract`
- Round 45+ (proposed): new source types — text (paste), web (URL +
  selector), API (endpoint + auth)
- Round 4x: wire the `publish` step to an actual commit action +
  manifest entries + lineage
- Any backend changes in this round

## Plan

- [x] Confirm step labels with user (`source / extract / define / publish`) — confirmed end-of-Round-39
- [x] Confirm Round 40 = scaffolding-only — confirmed end-of-Round-39
- [x] Confirm Entity/Revision deferred to its own later round — confirmed end-of-Round-39
- [x] Draft the `extract`-step CSV passthrough copy ("auto-detected; no
      extraction knobs in this round")
- [x] Draft the `publish`-step stub copy that points users at the
      Define continuation
- [x] Confirm workspace banner placement (top of upload page,
      `Alert type="warning"`) with the page-header keeping a
      "Workspace: <name>" indicator and a "Change workspace" action
- [x] Confirm no backend / endpoint / schema changes
- [x] Confirm single-feature scope (taxonomy rewrite only)

## Do

- 2026-05-12T21:00Z — Iteration 1 (taxonomy + store + panels + tests)
  - Files modified:
    - [uploadStageModel.ts](apps/builder/src/components/upload-flow/uploadStageModel.ts):
      `UploadStepKey` now `"source" | "extract" | "define" | "publish"`.
      Step labels: Source (Pick source kind + raw input), Extract
      (Source-specific reading params), Define (Upload and define
      schema), Publish (Commit as a revision — coming soon).
      `getUploadStepBlockedReason` reorganised around the new order;
      single workspace-missing reason; `SHEET_REQUIRED_REASON` short
      form ("Choose an Excel sheet before continuing.");
      `PUBLISH_NOT_READY_REASON` for the future-state step.
      `deriveUploadStep` now drops to `source` when workspace missing
      (workspace step no longer exists), routes to `extract` when
      Excel requires a sheet, and lands on `define` otherwise.
    - [uploadFlowStore.ts](apps/builder/src/state/uploadFlowStore.ts):
      `defaultState.focusedStep` flipped `"workspace"` → `"source"`.
      `setSelectedSheetName` advances to `"define"` (was `"submit"`).
      `setSheetOptions` advances to `"extract"` for multi-sheet
      workbooks (was `"sheet"`) and `"define"` for single-sheet
      (was `"submit"`).
    - [App.tsx](apps/builder/src/App.tsx):
      - Added `Alert`, `Card`, `Typography` to AntD imports.
      - Removed `canAccessSourceStep`; renamed `canAccessSubmitStep`
        → `canAccessExtractStep` (gates the source→extract transition).
      - Header rebuilt as a flex row with workspace label + a
        "Change workspace" / "Select or create workspace" button.
      - New top-of-page `Alert type="warning"` banner shown when
        `workspaceId` is missing.
      - `WorkspacePicker` moved out of the workspace step body into
        a top-level mount (always present, controlled by
        `isWorkspacePickerOpen`).
      - Four `focusedUploadStep === …` branches rewired:
        - `source`: file input + `SourceTypeSelector` + Next→extract.
          File input now `disabled={!workspaceId}`. Back button
          removed (no prior step).
        - `extract`: Excel branch renders `ExcelSheetPicker`; CSV
          branch renders a Card "Auto-detected" explaining that
          CSV needs no extraction knobs this round and pointing
          users to Define.
        - `define`: Card "Define schema (transitional)" + the
          existing `Upload and continue` button + progress panel +
          Back→extract. Naming reflects the longer-term destination
          (type correction + role + entity name will land here in
          later rounds); for now this is where the upload POST
          happens, after which the existing outer `schema_sheet`
          stage hosts profile/role UI.
        - `publish` (new): Card "Publish revision (coming soon)"
          stub + Back→define. Not reachable through normal flow
          (the upload POST in `define` navigates to outer
          `schema_sheet`); reachable only by clicking the step in
          the sidebar.
      - Internal `setFocusedStep("sheet")` callsite in the upload
        handler updated to `setFocusedStep("extract")`.
    - Tests:
      - [UploadFlowPage.test.tsx](apps/builder/src/pages/__tests__/UploadFlowPage.test.tsx):
        sidebar render now asserts Source / Extract / Define /
        Publish; blocked-stage test now clicks Extract from a
        workspace-less context and asserts the new reason ("Select
        or create a workspace before continuing."); `deriveUploadStep`
        expectations updated to the new key set; in-progress
        blocked-navigation assertion now checks `Source` +
        `Define` disabled classes (was `Workspace` + `Submit`).
      - [BuilderWorkflowPage.test.tsx](apps/builder/src/pages/__tests__/BuilderWorkflowPage.test.tsx):
        two `getUploadStepBlockedReason` cases retargeted from
        `"submit"` → `"define"`, with the new shorter blocked
        reason copy.
      - [uploadFlowStore.test.ts](apps/builder/src/state/__tests__/uploadFlowStore.test.ts):
        starts-on assertion `"workspace"` → `"source"`; sheet-step
        and submit-step transitions renamed to extract/define.
  - Verification:
    - `pnpm exec tsc --noEmit` → no new errors in App.tsx,
      `components/upload-flow/`, `state/uploadFlowStore.ts`, or the
      three updated test files. 13 pre-existing errors in
      `useSavedQueries.ts`, `useWorkspace.ts`, `appConfig.ts`,
      `WorkspacePicker.test.tsx`, `SavedQueryLibraryPage.tsx` predate
      this round (carryover debt from R36 check log).
    - `pnpm exec vitest run` → 12 files / 70 tests passing
      (unchanged vs Round 39).
    - `pnpm exec vite build` → clean, 1226 kB / 389.66 kB gzip
      (essentially flat vs Round 39's 1225 / 389; no new AntD
      primitives — `Alert` / `Card` / `Typography` were already
      imported via other surfaces).
    - Grep for `"workspace" | "sheet" | "submit"` as step-key
      literals in `components/upload-flow/`, `state/uploadFlowStore.ts`,
      `App.tsx`, and the affected test files → zero hits.

## Check

- [x] `pnpm exec vitest run` → 12 files / 70 tests passing
- [x] `pnpm exec vite build` → clean (1226 kB / 389.66 kB gzip)
- [x] `pnpm exec tsc --noEmit` → no new errors in
      `components/upload-flow/`, `state/uploadFlowStore.ts`,
      `App.tsx`, or affected test files
- [x] Grep for old step-key literals in upload scope → zero hits
- [~] UI bring-up: 4-step strip renders; workspace banner appears
  when no workspace selected; Excel multi-sheet path routes
  through `extract`; single-sheet auto-advances to `define`;
  CSV path renders the "Auto-detected" card in `extract`;
  `publish` step renders as a stub — deferred manual QA (no
  dev server in CI environment)

### Check log (2026-05-12)

- All automated gates pass; no regressions vs Round 39's baseline.
- Bundle delta: +1 kB raw / +0.66 kB gzip — negligible, consistent
  with the scaffolding intent (the rewrite reused AntD primitives
  already imported by Rounds 35–39).
- Pre-existing tsc debt (13 errors across 5 files) untouched and
  unchanged; queued for a future cleanup round.
- Manual QA is deferred per the project pattern across Rounds 36–39;
  the chain accumulates one bring-up debt item per round and is a
  candidate for a dedicated visual-bring-up round.

## Act

**Learnings**:

- The current step-model rewrite is more "rename + relocate" than
  "redesign". Most of the per-source-type complexity will land in
  later rounds (CSV encoding/delimiter, web/API extraction params,
  publish action, manifest entries). Round 40 deliberately limits
  itself to the _skeleton_, which keeps the round small and means
  subsequent feature work can avoid re-touching the step taxonomy.
- Moving workspace from a step to a banner is the right architectural
  call: workspace is a precondition for the entire upload, not a
  stage within it. The banner + page-header Change-workspace action
  is the minimum surface; an app-level redirect for first-time users
  is a clean follow-up (Round 41 candidate).
- The transitional `define` step (carries today's upload button while
  the longer-term define UI — type correction + role + entity name —
  lives downstream in the outer `schema_sheet` stage) avoids a
  workflow break. Once type-correction lands (Round 42 candidate)
  the upload POST can migrate one step earlier into `extract` (the
  parse step), at which point `define` becomes pure
  schema-definition.
- Two derivation rules went _into_ the type taxonomy that previously
  lived as imperative branches in the upload handler / store side-
  effects: "no workspace → stay on `source`" (was "go to workspace")
  and "no sheet selection → stay on `extract`" (was "go to sheet").
  Centralising these in `deriveUploadStep` + the store setters made
  the taxonomy self-documenting.

**Promotions**:

- [x] → context/ — scaffolding-cut pattern. When introducing a new
      step taxonomy, define the full target shape (including
      future-state steps as stubs) in one round so subsequent
      rounds plug in without re-touching the skeleton.
- [x] → skills/ — none in this round.

**Deferred** (candidates for follow-up rounds):

- Move workspace from a banner to an app-level redirect /
  first-run flow (Round 41 candidate).
- Type-correction UI + BE per-column type override endpoint —
  reopens Spec 019 AC 5 (Round 42 candidate).
- Entity / Revision split — stable entity identity separated from
  per-upload revision (Round 43 candidate).
- CSV encoding/delimiter/quote knobs in the `extract` step.
- New source types: text (paste), web (URL + selector), API
  (endpoint + auth).
- Publish action wiring: revision commit, manifest entries, and
  lineage — this is what unlocks the `publish` step.
- Pre-existing tsc debt cleanup (13 errors across 5 files —
  `useSavedQueries.ts`, `useWorkspace.ts`, `appConfig.ts`,
  `WorkspacePicker.test.tsx`, `SavedQueryLibraryPage.tsx`).
- Manual visual bring-up of the Rounds 36–40 surfaces.

**Next-round decision**:

- Round 41 — strongest candidate: **Type-correction UI** (the user-
  facing win that follows naturally from the now-clean step taxonomy).
  Requires a small backend endpoint (per-column type override) — the
  one Spec 019 AC 5 deferred. Alternative: workspace gate refactor
  (smaller, internal, no BE work); alternative: visual-bring-up
  catch-up round. Subject to end-of-round Q&A.
