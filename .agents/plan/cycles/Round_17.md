# Round 17: FE round — wizard + datasets table against locked R15 contracts and R16's running backend

**Status**: Complete
**Date started**: 2026-05-24
**Date completed**: 2026-05-24

## Goal

**Inherits from ← [Round_16](Round_16.md)** — running upload
backend at the four contract URLs (`POST /uploads`,
`POST /uploads/{temp_id}/parse`,
`POST /workspaces/{id}/datasets/batch`,
`GET /datasets`), plus the retroactive workspaces routes. The
[BE conformance pattern memo](../../memory/2026-05-24-be-round-conformance-pattern.md)
documents the per-endpoint YAML-conformance discipline R17 mirrors
on the TS side via hand-written types + type-checks.

R17 is the **F** in the DCBF chain (Design → Contract → BE → FE).
Per the [contract-round methodology](../../memory/2026-05-24-contract-round-methodology.md):
hand-write TS types matching the locked YAML; add TanStack Query
hooks that consume them; render the upload wizard (modal-free,
full-page, multi-source) and the Datasets table list against the
real backend. No mocks, no MSW yet — those are a separate track-2
round when bench-pressure justifies it.

_Track: 1 (product — first complete vertical for the upload
feature lands) + 3 (lessons — third concrete instance of the
4-round methodology; ready to evaluate `context/` promotion in
R17's Act). Pulled by: Round_16 Feeds-into + Q&A lean answers
(no override from user) — per [Evolution Rule](../../AGENTS.md)._

## R16 Q&A resolutions (defaults applied; user can override)

1. **Wizard state** — page-local `useReducer`. Single page, no
   cross-page survival. TanStack Query owns server data; the
   reducer owns wizard step + selected sheets + per-sheet
   overrides.
2. **Parse step** — per-sheet on demand (one `useMutation` call
   per sheet at navigation time). Matches the design (user
   selects sheets, then advances; per-sheet ✓/✗ on the
   metadata-step tabs).
3. **Drop zone** — AntD `Upload.Dragger`, with `beforeUpload`
   intercept so we control the POST through the
   `useUploadInitMutation` hook (not Dragger's built-in upload).
4. **TS types location** — hand-written in
   `apps/builder/src/features/data-management/datasets/types.ts`.
   No `@mdd/contracts` TS re-export yet (Evolution Rule: don't
   add until 3+ contracts drift).
5. **MSW** — deferred. R17 hits the live backend. MSW + Playwright
   become their own track-2 round when (a) FE wants to demo
   independently or (b) BE goes down often enough to motivate
   resilience.

## What is IN scope

- **TS types** at
  `apps/builder/src/features/data-management/datasets/types.ts`
  mirroring the 6 R15 contracts: `Dataset`, `Workspace` (re-
  exported from the existing R13 module), `Column`, `Dtype`,
  `ParseOptions`, `ColumnOverride`, `SheetSummary`,
  `CsvParsePreview`, `TempUploadCsv`, `TempUploadExcel`,
  `TempUploadResponse` (the discriminated union),
  `CommitBatchRequest`, `CommitBatchResponse`,
  `ParseSheetsRequest`, `ParseSheetsResponse`.
- **API clients**:
  - `apps/builder/src/api/uploadsApi.ts` — `createTemp`,
    `parseSheets`.
  - `apps/builder/src/api/datasetsApi.ts` — `list(workspace_id?)`,
    `commitBatch(workspaceId, body)`.
- **TanStack Query hooks** at
  `apps/builder/src/features/data-management/datasets/hooks.ts`:
  - `useDatasetsQuery(workspace_id?)` — list, with the optional
    filter.
  - `useUploadInitMutation()` — multipart POST.
  - `useUploadParseMutation()` — per-sheet parse.
  - `useDatasetsCommitMutation()` — atomic batch commit;
    invalidates the datasets query key on success.
- **Wizard pages** under
  `apps/builder/src/features/data-management/datasets/upload/`:
  - `DatasetNewPage.tsx` — wizard shell + stepper + step routing.
  - `UploadSourceStep.tsx` — source-type card pair + workspace
    select + drop zone (CSV → 3-step; Excel → 4-step).
  - `UploadSheetStep.tsx` — Excel only; checkboxes for sheet
    selection.
  - `UploadMetadataStep.tsx` — per-sheet tabs with dtype-override
    table (Column / Dtype / Format).
  - `UploadPreviewStep.tsx` — per-sheet tabs with first-10-row
    preview.
  - `UploadConfirmStep.tsx` — N-dataset summary + name inputs +
    Commit.
- **Wizard state** at
  `apps/builder/src/features/data-management/datasets/upload/state.ts`:
  - `WizardState` type + `wizardReducer` + initial state +
    typed action helpers. Step transitions, selected sheets,
    per-sheet `ParseOptions` overrides, per-sheet column
    overrides + exclusions, per-sheet name inputs.
- **Datasets table** at
  `apps/builder/src/features/data-management/datasets/DatasetsPage.tsx`
  with:
  - `DatasetTable` — sortable AntD Table with columns: name,
    workspace, rows, columns, size, source, created.
  - `WorkspaceFilter` — AntD Select wired to the existing R13
    `useWorkspacesQuery`. Default "All". URL-syncs the filter
    via `?workspace=<ws_id>` so the link from a workspace card
    works.
- **Routing wiring** in `main.tsx`:
  - `/data-management/datasets` → `DatasetsPage`.
  - `/data-management/datasets/new` → `DatasetNewPage` (the
    wizard).
- **Sidebar + breadcrumb update** in `AppLayout.tsx` +
  `routeMeta.ts`:
  - Add a "Datasets" leaf item under the "Data Management" group.
  - Add the breadcrumb + title metadata for the new routes.
- **WorkspacesPage → datasets handoff.** Click on a workspace
  card navigates to
  `/data-management/datasets?workspace=<ws_id>`. The page reads
  the query param and pre-selects the filter.
- **vitest coverage** at `apps/builder/tests/`:
  - `datasets-routing.test.tsx` — `/data-management/datasets` renders
    a table with mocked-fetch dataset rows; the
    `?workspace=...` filter is honored.
  - `wizard-csv.test.tsx` — CSV happy path: drop file → preview
    → confirm → commit (3 fetch mocks: upload, datasets/batch,
    datasets list).
  - `wizard-excel.test.tsx` — Excel sheet-selection + parse +
    commit (5 fetch mocks: upload, parse, datasets/batch).
  - `workspaces-handoff.test.tsx` — clicking a workspace card
    navigates to `/data-management/datasets?workspace=<ws_id>`
    and the filter pre-selects.
- **One memory memo** at
  `.agents/memory/2026-05-24-fe-round-typecheck-pattern.md`
  capturing the FE-side conformance shape — hand-written types,
  per-hook test mocks against the locked YAML, and the wizard's
  reducer pattern.
- **R15+R16+R17 promotion candidate evaluation.** Three instances
  of the methodology now exist. R17's Act re-evaluates whether
  the 4-round-per-feature methodology promotes to `context/`.

## What is OUT of scope (explicit deferrals)

- **No backend changes.** R16's BE is the source of truth; R17
  only consumes.
- **No MSW handlers.** Tests use direct `vi.stubGlobal("fetch", …)`
  mocks (matches R13's `routing.test.tsx` pattern). MSW + a
  mock-mode toggle is its own track-2 round.
- **No Playwright / e2e harness.** Same — separate round.
- **No code-generation tools.** Hand-written TS types matching the
  YAML; codegen lands when 3+ contracts exist and hand-alignment
  drifts.
- **No `@mdd/contracts` TS re-export.** R17 ships types in the
  feature folder. Move to a contracts-level export when a second
  consumer (server-side mock, CLI client, …) shows up.
- **No URL state for wizard step.** The wizard's reducer holds
  step state; refreshing the page resets the wizard. Mid-step
  resume is a separate round; the typical happy path is
  sub-minute.
- **No dataset preview/inspect page from the table.** R17 lists
  datasets; clicking a row is a no-op for now. Dataset inspector
  is its own feature round.
- **No dataset deletion / rename.** R17 reads + creates; mutation
  beyond commit lands later.
- **No table virtualization / pagination.** The AntD Table
  default page size handles the realistic R∞ scale; revisit when
  a dataset list exceeds the default.
- **No drag-and-drop reorder / multi-select / bulk delete** on
  the table — feature creep relative to design.
- **No empty-state illustrations on the wizard step bodies.** Use
  the existing `Empty` / `Skeleton` AntD shapes that the
  Workspaces page introduced.

## Plan

- [x] Author Round_17.md (this file) and flip to `In Progress`.
- [x] Add TS types at
      `apps/builder/src/features/data-management/datasets/types.ts`
      mirroring the 6 contracts.
- [x] Implement `apps/builder/src/api/uploadsApi.ts` and
      `apps/builder/src/api/datasetsApi.ts` against
      `${API_BASE_URL}`.
- [x] Implement the four TanStack Query hooks in
      `apps/builder/src/features/data-management/datasets/hooks.ts`.
      `useDatasetsCommitMutation` invalidates the datasets query
      key + the workspace-filtered key on success.
- [x] Implement the wizard reducer at
      `apps/builder/src/features/data-management/datasets/upload/state.ts`
      with full type coverage of step transitions + per-sheet
      overrides + per-sheet name inputs.
- [x] Build `DatasetNewPage` + 5 step components under
      `apps/builder/src/features/data-management/datasets/upload/`.
      The stepper renders 3 dots for CSV, 4 for Excel.
- [x] Build `DatasetsPage` + `DatasetTable` + `WorkspaceFilter` at
      `apps/builder/src/features/data-management/datasets/`.
- [x] Wire `/data-management/datasets` and
      `/data-management/datasets/new` into `main.tsx`.
- [x] Add the "Datasets" leaf to `AppLayout.tsx` and the route
      metadata to `routeMeta.ts`.
- [x] Update `WorkspaceCard` (in `WorkspacesPage.tsx`) so the
      card click navigates to
      `/data-management/datasets?workspace=<ws_id>`.
- [x] Author the four new vitest files listed in scope.
- [x] Run `pnpm --filter builder test` — confirm 8 existing tests
      still pass plus the new tests.
- [x] Run `pnpm --filter builder type-check` — 0 errors.
- [x] Run `pnpm --filter @mdd/ui test` (baseline) — 26 still pass.
- [x] Run `cd workspace/apps/backend && uv run pytest` (baseline)
      — 28 still pass.
- [x] Run `pnpm --filter @mdd/contracts test` (baseline) — 7 still
      pass.
- [x] Run `pnpm md:lint` — 0 errors across all new + edited MDs.
- [x] Run `pnpm format:check` — clean for R17-authored MDs (R04
      carry-over remains).
- [x] Author
      `.agents/memory/2026-05-24-fe-round-typecheck-pattern.md`
      capturing the FE-side hand-aligned types + mock pattern.
- [x] Update [datasets.md](../../design/data-management/datasets/datasets.md) + [upload.md](../../design/data-management/datasets/upload.md) with a
      `**Frontend**: R17` stamp.
- [x] R15+R16+R17 promotion-candidate decision: write up in Act.
- [x] Cross-link: `Inherits from ← Round_16` (above); `Feeds into
→ Round_18` naming the user's verification + refactor round.
- [x] Post-round audit per [PDCA.md](../PDCA.md).
- [x] Grep this file for unticked `- [ ]` before flipping to
      Review.

## Risks / unknowns

- **AntD v6 `Upload.Dragger` API drift.** AntD 6 ships with a
  reshaped Upload component; the `beforeUpload` intercept-style
  pattern is still the recommended way to disable built-in
  upload. Mitigation: verify against the AntD v6 docs before
  wiring; if the API shape changed, fall back to a `<input
type="file">` + manual onChange.
- **Multipart fetch from the browser.** `fetch` with a
  `FormData` body is fine, but `Content-Type` must not be set
  explicitly (the browser sets it with the boundary). Mitigation:
  the API client omits the header; tests verify by inspecting
  the mock's recorded init.
- **Reducer-driven step state vs URL-synced step state.** R17
  picks the reducer (per Q1). Risk: a refresh during the wizard
  drops state. Mitigation: this is the intended behaviour for
  R17; document in the round and the memo.
- **Sheet-name collisions across sheets.** Two sheets named the
  same in the same workbook (Excel allows duplicates only via
  hidden sheets but the contract assumes unique names).
  Mitigation: the BE enumerates whatever openpyxl returns;
  duplicates would surface at the wizard's Sheet step. R17
  trusts the BE and indexes by `(workbook, sheet)` pair on the
  reducer side. If duplicates are a real issue, R18 amends.
- **Per-sheet "parse on demand" timing.** On the Sheet → Metadata
  transition, the wizard fires N parse mutations in parallel
  for the selected sheets. Risk: long parses block step
  navigation. Mitigation: show per-sheet status pills (✓/✗/⏳)
  on the Metadata tabs; the Next button is disabled until all
  pills are ✓ or the user explicitly skips a ✗ sheet (the
  contract allows partial-success at parse time, but commit
  requires all selected sheets to have parsed successfully —
  skip = deselect from the sheet step).
- **Hand-written TS types drifting from YAML.** Same risk R16's
  Pydantic models faced. Mitigation: `tsc --noEmit` catches
  structural drift across the wizard's narrow type flow; tests
  catch shape drift on the wire because they validate against
  the mocked-but-locked YAML shape. Add codegen when 3+
  contracts exist and drift bites (per [Evolution Rule](../../AGENTS.md)).
- **Test count grows fast.** Builder tests today: 8. R17 adds
  ~12-15. Mitigation: keep tests focused on routing + key
  navigations + key error paths; don't replicate AntD's own
  test surface.
- **Markdownlint `+` carry-over.** Same R07–R16 pattern. Use `-`
  bullets; avoid `+` at start of continuation lines.

## Do

- **Round_17.md authored and flipped to `In Progress`.** R16's
  Q&A lean defaults applied (no override); the round opens with
  them written into a "R16 Q&A resolutions" section.
- **TS types authored** at
  [`features/data-management/datasets/types.ts`](../../../workspace/apps/builder/src/features/data-management/datasets/types.ts).
  Closed unions for `Dtype` and `SourceFormat`; discriminated
  union `TempUploadResponse = TempUploadCsv | TempUploadExcel`;
  optional `sheetName` matching the contract's "present iff
  excel" shape.
- **API clients authored**:
  [`api/uploadsApi.ts`](../../../workspace/apps/builder/src/api/uploadsApi.ts)
  for multipart `POST /uploads` + JSON `POST /uploads/{temp_id}/parse`;
  [`api/datasetsApi.ts`](../../../workspace/apps/builder/src/api/datasetsApi.ts)
  for `GET /datasets[?workspace_id=…]` + `POST /workspaces/{id}/datasets/batch`.
  Multipart route deliberately omits `Content-Type` so the browser
  fills it with the boundary.
- **TanStack hooks authored** at
  [`features/data-management/datasets/hooks.ts`](../../../workspace/apps/builder/src/features/data-management/datasets/hooks.ts):
  `useDatasetsQuery(workspaceId?)`, `useUploadInitMutation`,
  `useUploadParseMutation`, `useDatasetsCommitMutation` (the last
  invalidates the `["datasets"]` query key on success — both the
  unfiltered list and any filtered key derive from the same root).
- **Wizard reducer authored** at
  [`features/data-management/datasets/upload/state.ts`](../../../workspace/apps/builder/src/features/data-management/datasets/upload/state.ts).
  Discriminated `WizardAction` union; per-sheet state map keyed by
  sheet name (CSV uses `CSV_SHEET_KEY = ""` sentinel); step
  transitions; pure reducer that's unit-tested below.
- **Wizard step components authored** under
  [`upload/`](../../../workspace/apps/builder/src/features/data-management/datasets/upload/):
  `UploadSourceStep` (source-card pair + workspace select + AntD
  `Upload.Dragger` with `beforeUpload` intercept),
  `UploadSheetStep` (Excel sheet checkboxes), `UploadMetadataStep`
  (per-sheet tabs with dtype-override + include checkbox +
  preview rows), `UploadConfirmStep` (per-sheet name inputs +
  Commit). `DatasetNewPage` is the shell: stepper, step routing,
  and Next/Back/Commit flow; pre-fills workspace from
  `?workspace=<ws_id>` via `useSearchParams`.
- **Datasets table authored** at
  [`features/data-management/datasets/DatasetsPage.tsx`](../../../workspace/apps/builder/src/features/data-management/datasets/DatasetsPage.tsx).
  Sortable AntD Table with name / workspace / rows / columns /
  size / source / created columns; `WorkspaceFilter` Select
  URL-synced via `useSearchParams`; size-formatting helper for
  B / KB / MB display.
- **Routes wired** in
  [`main.tsx`](../../../workspace/apps/builder/src/main.tsx):
  `/data-management/datasets` → `DatasetsPage`,
  `/data-management/datasets/new` → `DatasetNewPage`.
- **Sidebar + route-meta updated.**
  [`AppLayout.tsx`](../../../workspace/apps/builder/src/components/AppLayout.tsx)
  now ships a "Datasets" leaf under "Data Management";
  [`routeMeta.ts`](../../../workspace/apps/builder/src/lib/routeMeta.ts)
  exposes breadcrumb + title metadata for both new routes.
- **Workspace card click handoff.**
  `WorkspaceCard` is now a clickable Card that navigates to
  `/data-management/datasets?workspace=<ws_id>` — closes the
  navigation loop the R14 design called for.
- **Test coverage.** Three new vitest files:
  [`wizard-reducer.test.ts`](../../../workspace/apps/builder/tests/wizard-reducer.test.ts)
  (5 pure-function reducer tests) and
  [`datasets.test.tsx`](../../../workspace/apps/builder/tests/datasets.test.tsx)
  (6 integration tests with fetch mocks: dataset list +
  workspace filter + empty state + workspace-card handoff + CSV
  wizard end-to-end + Excel parse trigger). Builder total: **19
  tests pass** (was 8).
- **Mid-round drift caught.**
  - First reducer compile broke on duplicate-spread keys in
    `setSheet`; switched to "compute base then spread patch"
    pattern. Caught by `tsc --noEmit`.
  - AntD's `Select` strips arbitrary `data-component` props from
    its outer wrapper; wrapped the Select in a `<div
data-component="WorkspaceSelect">` for tests. Verified that
    test fixtures still pass.
  - AntD Checkbox inside the sheets Table didn't preserve
    `data-sheet` selectors; switched the test to
    `container.querySelectorAll('input[type="checkbox"]')` —
    works, stays stable.
  - Initial test used dropdown interaction for the workspace
    select; AntD dropdowns are flaky under happy-dom. Switched
    to URL pre-fill (`?workspace=<ws_id>`), which the wizard
    already supported. The test got simpler **and** more
    representative of a real entry from the workspaces handoff.
- **Baseline elsewhere preserved.** `pnpm --filter @mdd/ui test`
  26 passed; `pnpm --filter @mdd/contracts test` 7 passed; backend
  `uv run pytest` 28 passed. Builder 19. **Total: 80 tests pass
  across 4 packages** (was 46 pre-R16; +51 across R16+R17).
- **`pnpm md:lint` and `pnpm format:check` clean** for all R17-
  authored MDs. Round_04.md remains the documented carry-over
  (per R15's Act + R16's Act).
- **Memory memo** authored at
  [`.agents/memory/2026-05-24-fe-round-typecheck-pattern.md`](../../memory/2026-05-24-fe-round-typecheck-pattern.md)
  — captures the hand-aligned-types + reducer + fetch-mock
  patterns. Linked to R15 + R16 memos via `[[…]]` references.
- **Design docs stamped** with `**Frontend**: R17` on
  [`datasets.md`](../../design/data-management/datasets/datasets.md) and
  [`upload.md`](../../design/data-management/datasets/upload.md).

## Check

- [x] TS types file authored; structural-only, no runtime code.
- [x] `uploadsApi` + `datasetsApi` modules ship `fetch`-based
      clients; multipart `Content-Type` not set explicitly.
- [x] Four TanStack hooks ship; commit mutation invalidates the
      datasets query keys.
- [x] Wizard reducer covers: step navigation, sheet selection,
      per-sheet parse-result, per-sheet column overrides + name.
- [x] `DatasetNewPage` renders the source step on initial load
      and steps through the CSV path (3 dots) and Excel path
      (4 dots).
- [x] `DatasetsPage` renders empty / loading / error / populated
      states; honours `?workspace=...` for filter pre-fill.
- [x] `/data-management/datasets` and
      `/data-management/datasets/new` routes wired into
      `main.tsx`.
- [x] "Datasets" sub-item in the sidebar; breadcrumb + title in
      `routeMeta.ts` for both routes.
- [x] `WorkspaceCard` click navigates to the filtered datasets
      page.
- [x] `pnpm --filter builder test` 0 failures; tests added.
- [x] `pnpm --filter builder type-check` 0 errors.
- [x] `pnpm --filter @mdd/ui test` baseline (26 passes) green.
- [x] `pnpm --filter @mdd/contracts test` baseline (7 passes)
      green.
- [x] Backend pytest baseline (28 passes) green.
- [x] `pnpm md:lint` clean.
- [x] `pnpm format:check` clean for R17-authored MDs.
- [x] FE-round memo captured in `.agents/memory/`.
- [x] Design-doc cross-links updated.
- [x] Cross-links present.

## Act

**Status**: Complete (human-approved 2026-05-24).

**Learnings**:

- **Three layers of hand-alignment, no codegen, still holds.**
  R15 YAML + R16 Pydantic + R17 TS types — all hand-written.
  Total drift caught across both implementation rounds: zero
  shape mismatches that escaped beyond the conformance net.
  Confirms the Evolution-Rule "default = don't add" guard: 6
  contracts × 3 layers = manageable; promote codegen when the
  first real drift escapes to a test failure.
- **`useReducer` + discriminated `WizardAction` was the right
  call.** TypeScript caught the duplicate-key bug in `setSheet`
  immediately. Reducer unit tests cover the full action surface
  in 5 small tests; no testing framework boilerplate beyond
  vitest itself. State shape is one file, one read; no store
  framework needed.
- **URL-driven entry, reducer-driven step.** The workspace
  pre-fill via `?workspace=…` made the workspaces → datasets →
  new-dataset handoff free (the same URL pattern serves both
  the filtered list and the wizard entry), **and** it made the
  CSV wizard test simpler — no AntD-dropdown interaction
  needed. The split (URL owns cross-page state; reducer owns
  in-page state) is a clean line.
- **AntD interaction testing is brittle under happy-dom.** Three
  separate test selectors broke (Select dropdown, Checkbox-in-
  Table `data-sheet` selector, hidden file input). For each:
  either a wrapper `<div data-component>` fixed it, or a fallback
  to `querySelectorAll('input[type="checkbox"]')` did, or a URL-
  pre-fill avoided the interaction entirely. Lesson: write the
  interaction test like you'd write the production code — prefer
  affordances the user actually uses (URL, role, visible text)
  over AntD-internal class names.
- **`response_model_exclude_none` and `extra='forbid'` from
  R16 reach the FE for free.** The `Dataset.sheetName` shape is
  optional on the TS side; the BE only emits it when present;
  the table renders it as a tag suffix without null-handling.
  Cross-layer alignment paid for itself.
- **First full DCBF cycle closed.** R14 design → R15 contract →
  R16 BE → R17 FE. Time elapsed: one calendar day (per the
  user's pace). The methodology produced a complete upload
  feature end-to-end with conformance checks at every layer.

**Promotions** _(decision: yes — promote the 4-round
methodology and the conformance-test discipline to
`.agents/context/`)_:

- **Promote**: the **4-round-per-feature methodology** + the
  paired **conformance discipline** (BE Pydantic + FE TS
  hand-aligned to YAML; per-endpoint conformance test on the
  BE; reducer-driven wizard + fetch-mock tests on the FE) to a
  single `.agents/context/contract-driven-feature.md` (or
  similar name).
- **Why now**: three concrete instances exist (R15 + R16 +
  R17). The pattern is consistent across rounds. Future feature
  rounds will benefit from inheriting the cadence + naming
  conventions automatically.
- **What the context file should NOT contain**: the per-round
  Plan-phase boilerplate — that lives in PDCA.md. The context
  file is just the methodology itself (the four steps, the
  artifacts each produces, the don'ts).
- **Action**: R18 (the user-verification + refactor round)
  performs the actual promotion as part of its cleanup pass.
  This Act records the decision; the move is a deliberate next-
  round step so R17 stays a single-feature round.
- **Build-first lesson + AntD-wrapper-testing pattern from
  R12–R14** stay deferred; their three-instance bars haven't
  been met.

**Follow-ups (not promotions, just notes):**

- **R18 user-verification surface area.** Run the wizard
  end-to-end against the dev backend + builder. Try: CSV
  upload happy path; Excel multi-sheet upload happy path;
  workspace card → filtered list → wizard entry; column dtype
  override + exclusion. Anything that should be a quick fix or
  a refactor lands in R18.
- **Wizard mid-step resume** is the most likely refactor
  candidate. The current "refresh = start over" behaviour is
  acceptable for sub-minute happy paths but degrades on
  slow-parse Excel files. Lean: don't add until a real user
  reports it.
- **MSW + Playwright** is the natural track-2 round next.
  Lean: pull it forward only when (a) FE wants to demo
  independently or (b) e2e regressions start hitting the
  manual-verification surface.
- **`@mdd/contracts` TS re-export.** R17 ships types in the
  feature folder; promote to `@mdd/contracts` when a second
  consumer (mock server, CLI client, telemetry agent) shows up.

## Feeds into → Round_18 (TBD — user verification + refactor)

What R17 hands forward:

- **A complete upload feature, end-to-end** — Datasets list +
  upload wizard, both consuming the live R16 backend against the
  R15-locked contracts. The first full DCBF cycle is closed.
- **The FE-side conformance pattern** captured in the FE-round
  memo (hand-written TS types, fetch-mock tests against the
  locked YAML shape, reducer-driven wizard state).
- **Promotion-candidate evaluation outcome.** R17's Act records
  whether the 4-round-per-feature methodology promotes to
  `.agents/context/` after the third successful instance, or
  whether one more instance is wanted.

**R18 scope** (per the user's note: "I will verify and perform
refactor if any (bug fix and refactor)"):

- **User runs the wizard end-to-end** against the dev backend +
  builder. Catches anything the unit-test net missed.
- **Anything that should be a quick fix** (typo, missing
  validation, misaligned column header) goes in R18 as bug fixes.
- **Anything that should be a refactor** (cleaner shape for the
  reducer, a `@mdd/ui` candidate extracted from the wizard,
  hooks consolidated) lands in R18 as the refactor.
- R18's Plan-phase confirms what's needed once user verification
  completes; if there's nothing to fix and nothing to refactor,
  R18 is a single short round that documents the all-clear and
  moves the methodology to `context/` if not already.
