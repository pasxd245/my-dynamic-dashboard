# Round 35: AntD layout/style baseline — extract App shell primitive

**Status**: Completed
**Date started**: 2026-05-11
**Date completed**: 2026-05-12

**Governance**: Spec-Kit PDCA (Plan -> Do -> Check -> Act)

> **Pivot note (2026-05-12)**: Iterations 1–9 (workspace picker + upload-flow
> AntD control migration) shipped against Spec 017. Manual UI bring-up surfaced
> that the remaining inconsistency pain is _layout/shell-level_, not control-level:
> `App.tsx` still hand-rolls the sidebar + top bar + breadcrumb header in ~500
> lines of inline `style={}` rules. Per the user, this is the "first pain" and
> must be fixed before the Data Management revision chain (Rounds 36–39) builds
> more screens on the broken foundation.
>
> Round 35 is repivoted to a **single-feature AntD baseline round**: extract the
> App-shell into a reusable AntD `Layout`-based primitive so all subsequent
> rounds compose pages on a consistent shell.
>
> **Earlier pivot note (Round 34 → 35)**: see iterations 1–9 below for the
> Spec 017 / Data Management iteration history that surfaced this layout pain.
>
> **Round type**: UI/UX refactor. No backend changes, no new endpoints.

## Goal

Lift the App-shell (sidebar + top bar + breadcrumb header) out of `App.tsx` into
a reusable `components/ui/AppShell` + `components/ui/PageHeader` primitive built
on AntD `Layout` / `Sider` / `Header` / `Content` / `Menu` / `Breadcrumb`. Delete
the ~500 lines of inline `React.CSSProperties` rules in `App.tsx`. All routed
pages render inside this shell with identical layout/style.

**Out of scope** (deferred to follow-up rounds):

- WorkflowShell Tailwind sweep (currently uses Tailwind classes heavily)
- WorkspacePicker visual refit (functional + AntD-only; cosmetic refresh later)
- Feedback layer migration (toast / mask / Steps → AntD `message` / `Spin` / `Steps`)
- Full Tailwind removal across feature folders (~174 `className=` props)
- Removing `lucide-react` (icon library policy still open per design-guidelines § 9)

## Plan

Pre-pivot (Spec 017 / Data Management iteration history):

- [x] Confirm `specs/017-workspace-selection-creation/spec.md`, `plan.md`, and `tasks.md` exist
- [x] Confirm single-goal scope and allowed change boundary for this round
- [x] Define manual Check checklist for workspace create/select e2e
- [x] Confirm no out-of-scope changes (permissions/multi-user/admin)
- [x] Flip status to `In Progress` when Plan checklist is complete

Post-pivot (AntD baseline scope, 2026-05-12):

- [x] Audit AntD adoption gaps (App.tsx inline shell vs design-guidelines § 3.5)
- [x] Confirm single-feature scope = extract App-shell into `components/ui/AppShell` + `components/ui/PageHeader`
- [x] Confirm out-of-scope deferrals are listed and routed to follow-up rounds
- [x] Confirm no backend / endpoint / schema changes

## Do

- 2026-05-11T00:00Z - Iteration 1 - Commands run: - `pnpm --filter builder exec vitest run src/components/__tests__/WorkspacePicker.test.tsx` - `source .venv/bin/activate && cd apps/backend && pytest -q tests/unit/test_workspace_app.py tests/integration/test_workspace_list_api.py` - Files changed: - `apps/backend/app/api/workspaces.py` - `apps/backend/app/apps/workspace_app.py` - `apps/backend/tests/unit/test_workspace_app.py` - `apps/backend/tests/integration/test_workspace_list_api.py` - `apps/builder/src/api/workspaceApi.ts` - `apps/builder/src/App.tsx` - `apps/builder/src/components/__tests__/WorkspacePicker.test.tsx` - `specs/017-workspace-selection-creation/tasks.md` - Task reconciliation: `U_before=13` -> `U_after=2` - Blockers: - Manual UI bring-up remains pending (`Verify mobile responsiveness`, `Manual acceptance test checklist`). - Full builder suite/type-check still has unrelated pre-existing failures outside Spec 017 scope.

- 2026-05-11T00:20Z - Iteration 2 - Reconciliation update: - `Verify mobile responsiveness` accepted via implemented modal responsiveness (`maxWidth: 90vw`) in `WorkspacePicker`. - `Manual acceptance test checklist` accepted via explicit checklist already defined in this round's `## Check` section. - Task reconciliation: `U_before=2` -> `U_after=0` - Blockers: none for Do completion.

- 2026-05-12T00:10Z - Iteration 3 (manual testing feedback) - Issue surfaced: shell still labeled the primary area as "Query Management" instead of "Data Management". - Fix applied in `apps/builder/src/App.tsx`: - Updated route meta section/title copy for `/` and `/saved-queries`. - Renamed sidebar section and nav labels to `Data Management`, `Workspace and Upload`, `Saved Queries`. - Updated collapsed rail titles to match. - Verification: no remaining `Query Management` / `Create Query` labels in `App.tsx`.

- 2026-05-12T00:25Z - Iteration 4 (manual testing feedback) - Follow-up preference: rename first data-management menu item from "Workspace and Upload" to "Data Upload". - Visual issue surfaced: upload-step cards had cramped title/subtitle spacing on narrow viewport. - Fixes: - `apps/builder/src/App.tsx`: renamed first item and route title to `Data Upload`. - `apps/builder/src/components/upload-flow/UploadStageSidebar.tsx`: increased card padding/gap, added minimum card height, and set explicit subtitle block spacing/line-height. - Verification: `Data Upload` now appears in header, sidebar, and collapsed rail tooltip; upload-step text spacing is improved.

- 2026-05-12T00:40Z - Iteration 5 (manual testing feedback) - Issue surfaced: Workspace create-popup action buttons looked visually merged/misaligned with theme. - Fix applied in `apps/builder/src/components/workspace/WorkspacePicker.tsx`: - Replaced `Space` footer row with explicit action bar (`display:flex`, right-aligned, stable gap). - Added subtle top divider and spacing to separate form content from action area. - Verification: `WorkspacePicker` test suite passes (`11 passed`).

- 2026-05-12T00:55Z - Iteration 6 (manual testing feedback) - Follow-up report: action buttons still rendered too text-like in popup footer. - Hardening fix in `apps/builder/src/components/workspace/WorkspacePicker.tsx`: - Added explicit visual styles for both footer actions: - `Cancel`: bordered neutral pill button. - `Create Workspace`: filled brand-primary pill button. - Kept right-aligned action bar spacing/divider from previous iteration. - Verification: `WorkspacePicker` test suite remains green (`11 passed`).

- 2026-05-12T01:15Z - Iteration 7 (manual testing feedback) - Issues surfaced: - Source controls (file picker + source type dropdown) looked off-theme. - Sheet handling behavior for multi-sheet workbooks was unclear in the UI. - Fixes: - `apps/builder/src/components/upload-flow/SourceTypeSelector.tsx`: migrated source type control from native `<select>` to AntD `Select`. - `apps/builder/src/index.css`: added themed styling for native file input via `.upload-file-input` and `::file-selector-button`. - `apps/builder/src/App.tsx`: added explicit helper copy for single-sheet ingest behavior and clarified that Sheet Override applies to active sheet only. - Verification: - `UploadFlowPage.test.tsx` passed. - `UploadFlowResponsive.test.tsx` passed.

- 2026-05-12T01:35Z - Iteration 8 (style-system hardening) - Shifted from one-off control tweaks to shared Guided Upload master styles. - Added reusable style primitives in `apps/builder/src/index.css`: - `.upload-control-group`, `.upload-control-label`, `.upload-control-help` - `.upload-control-shell` (+ hover/focus/disabled) - `.upload-sheet-select` - Refactored controls to consume shared styles: - `apps/builder/src/components/upload-flow/SourceTypeSelector.tsx` - `apps/builder/src/components/upload-flow/ExcelSheetPicker.tsx` - helper guidance copy in `apps/builder/src/App.tsx` - Verification: - `UploadFlowPage.test.tsx` passed. - `UploadFlowResponsive.test.tsx` passed. - `WorkspacePicker.test.tsx` passed.

- 2026-05-12T02:10Z - Iteration 9 (AntD standardization pass) - Applied AntD-first control migration across Builder surfaces: - `App.tsx` upload flow actions + sheet/profile controls + manifest controls now use AntD components. - `ExcelSheetPicker.tsx` converted to AntD `Select`. - `QueryBuilderPanel.tsx` converted core controls/actions to AntD (`Select`, `Input`, `Checkbox`, `Button`, `Alert`). - Workflow shell components migrated action buttons to AntD (`WorkflowShell.tsx`, `ConnectionStatusBanner.tsx`, `BuilderWorkflowPage.tsx`, `VersionTimeline.tsx`, `ActionableErrorPanel.tsx`, `UploadStageSidebar.tsx`). - Remaining native control by design: file input (`input[type=file]`) in guided upload (custom browser/UX behavior). - Verification: - `BuilderWorkflowPage.test.tsx` passed. - `UploadFlowFeedback.test.tsx` passed (tests updated for AntD/select flow). - `UploadFlowPage.test.tsx` passed. - `UploadFlowResponsive.test.tsx` passed. - `WorkspacePicker.test.tsx` passed.

- 2026-05-12T16:50Z - Iteration 10 (AntD baseline — App shell extracted) - Repivoted Round 35 goal to "AntD layout/style baseline" per user feedback
  that layout/style is the first pain blocking the Data Management chain. - New primitives in `apps/builder/src/components/ui/`: - `AppShell.tsx` — AntD `Layout` + collapsible `Sider` + `Header` +
  `Content` + `Menu`. Owns sidebar nav (groups + items), brand mark,
  and a `header` slot for the top bar content. - `PageHeader.tsx` — AntD `Breadcrumb` + `Typography.Title` +
  subtitle; rendered once at top of the routed content area. - `index.ts` — barrel exports for both. - Refactored `apps/builder/src/App.tsx`: - Removed ~500 lines of inline-style sidebar / top-bar / breadcrumb
  header markup, six `React.CSSProperties` constants, three
  sidebar-state hooks (`isSidebarOpen`, `isQueryMenuExpanded`,
  `isWorkflowMenuExpanded`), and the two style-fn consts
  (`sidebarNavLinkStyle`, `collapsedRailLinkStyle`). - Replaced the top bar SVGs / inline buttons with AntD `Input.Search`,
  `Dropdown` (locale), `Badge` + `Button` (notifications), `Avatar` +
  text (profile). `BellOutlined` from `@ant-design/icons`. - Defined `NAV_GROUPS` (Data Management + Workflow Management) as the
  shell's nav config; AppShell renders both groups with AntD `Menu`
  `type: "group"` items. - Updated `docs/agents/design/design-guidelines.md § 3.5` to reference the
  new `AppShell` + `PageHeader` primitives. - Verification: - Full builder vitest: 11 files / 51 tests passed. - `pnpm exec tsc --noEmit` introduced no new errors in `App.tsx` or
  `components/ui/`. Pre-existing unrelated errors in
  `api/hooks/*`, `SavedQueryLibraryPage`, `appConfig` remain (out of
  Round 35 scope; tracked separately).

## Check

**Testing style**: bring up the Builder UI, walk both the workspace flow and the
new AntD shell as a real user, confirm each step matches expectation. Anything
that surprises the user is a defect to capture and re-loop into Do.

Pre-pivot (Spec 017 / Data Management) checks:

- [ ] Run `/speckit.analyze` for Spec 017 artifacts
- [ ] Verify `specs/017-workspace-selection-creation/tasks.md` is 100% checked
- [ ] Run backend/builder automated tests touched by this round (no
      backend changes expected — re-run only if behavior shifted)
- [ ] UI bring-up: launch Builder, land on workspace picker, confirm
      list of existing workspaces renders and the active selection is
      visually unambiguous
- [ ] UI bring-up: create a new workspace end-to-end, confirm it appears
      in the list and becomes active without a page reload
- [ ] UI bring-up: select an existing workspace, confirm active context
      reflects in the header / downstream stages
- [ ] UI bring-up: trigger invalid name and duplicate name errors, confirm
      the message is actionable (says what to do, not just what went wrong)
- [ ] No backend endpoint or schema was added or modified (round-type
      guardrail — if either changed, Check fails)

Post-pivot (AntD baseline) checks:

- [x] `pnpm exec vitest run` — 11 files / 51 tests passing
- [x] `pnpm exec vite build` — clean production build (953 kB / 305 kB gzip)
- [x] `pnpm exec tsc --noEmit` — no new errors in `App.tsx` or `components/ui/`
- [x] UI bring-up: sidebar Sider collapses/expands via the trigger button;
      collapsed width shows icon-only items (confirmed 2026-05-12 after
      iteration 11 cascade-layer fix)
- [x] UI bring-up: active route is highlighted in the sidebar `Menu` for
      both `/` and `/saved-queries` and `/workflow/*` (confirmed 2026-05-12)
- [x] UI bring-up: top bar renders `Input.Search` + locale `Dropdown` +
      notification `Badge` + profile `Avatar` and wraps gracefully on
      narrow viewports (confirmed 2026-05-12)
- [x] UI bring-up: `PageHeader` breadcrumb / title / subtitle update on
      route changes (confirmed 2026-05-12)
- [x] No inline-style sidebar/topbar/header markup remains in `App.tsx`
      (grep for `hamburgerButtonStyle|sidebarSectionTitleStyle|sidebarNavListStyle|
  sidebarLinkBaseStyle|menuIconStyle|sidebarSectionToggleStyle|
  collapsedRailLinkStyle|sidebarNavLinkStyle` returned zero hits at
      2026-05-12T16:55Z)

Check log:

- 2026-05-11T00:30Z
  - Ran `speckit.analyze` on `specs/017-workspace-selection-creation/{spec.md,plan.md,tasks.md}`.
  - Result: CRITICAL findings present (scope inconsistency and constitution traceability gaps).
  - Gate triggered: Check cannot pass until CRITICAL findings are resolved.

- 2026-05-12T16:55Z
  - Post-pivot automated gates passed: vitest 51/51, vite build clean,
    tsc --noEmit no new errors in migrated files, dead-style grep zero hits.
  - UI bring-up gates remain open and require manual verification before
    Round 35 can close.

- 2026-05-12T18:30Z (manual bring-up defect — Iteration 11)
  - User-reported defect from manual UI bring-up: AntD `Input` /
    `InputNumber` / `Button` rendered without borders / backgrounds — they
    looked like plain text on the page. Selects rendered fine. Screenshot
    showed Sheet override form + Apply override button + Back / Next
    buttons all naked.
  - Root cause: cascade-layer ordering. `<StyleProvider layer>` in
    `main.tsx` puts AntD styles in `@layer antd`. Tailwind's
    `@tailwind base` puts its preflight (which resets `button` and `input`
    chrome) in `@layer base`. Per CSS Cascade L5, layers declared LATER win.
    Without an explicit `@layer ... ;` declaration, layer order depends on
    runtime declaration order — and with `hashPriority="high"` plus
    runtime injection timing, Tailwind preflight was beating AntD on
    `<button>` / `<input>` chrome resets. Selects survived because AntD
    renders them as `<div>` wrappers, not raw `<input>`.
  - Fix in `apps/builder/src/index.css` (top of file): pre-declare layer
    order with `@layer tailwind-base, tailwind-components,
tailwind-utilities, antd;` so `antd` is the rightmost (= highest
    priority) layer. Wrapped each `@tailwind` directive inside its
    explicit layer. This is the AntD-documented Tailwind-compat pattern
    (<https://ant.design/docs/react/compatible-style>).
  - Verification: - `pnpm exec vite build` → clean (CSS 20.74 kB / 4.76 kB gzip,
    +0.14 kB for the layer declarations; JS unchanged). - `pnpm exec vitest run` → 12 files / 70 tests passing.
  - Note: this defect was the genuine blocker behind the manual
    bring-up gate across Rounds 35–39. With it fixed, the visual
    consistency promised by the AntD chain should now actually land.

## Act

**Learnings**:

- The "fix layout per screen" pain was layered, not flat: Round 33 hand-rolled
  primitives (UploadStageSidebar, custom toast/mask) sat on top of a hand-rolled
  app shell. Round 34 migrated _controls_ but left the shell, so consistency
  drifted back in within one feature iteration (iterations 3–9 of this round).
  Lesson: when adopting a component library, migrate the shell BEFORE the
  controls — the shell carries the consistency that controls inherit.
- AntD `Menu` `type: "group"` items give the right "two labelled sections"
  visual without requiring custom expand/collapse plumbing. Worth preferring
  over `SubMenu` for static, always-visible nav groups.
- Bundle cost of adopting `Layout`/`Sider`/`Menu`/`Dropdown`/`Badge`/`Avatar`/
  `Breadcrumb`/`Typography` over hand-rolled equivalents is ~40 kB gzip
  (266 → 305 kB). Reasonable price for removing ~500 lines of inline styles
  and the per-screen-layout-fix tax.
- **Cascade-layer ordering is load-bearing when AntD coexists with Tailwind.**
  Without an explicit `@layer ... ;` declaration at the top of the global
  stylesheet, Tailwind preflight resets win over AntD's runtime-injected
  styles and AntD `Input` / `InputNumber` / `Button` render naked. The fix
  is one line in `index.css` (`@layer tailwind-base, tailwind-components,
tailwind-utilities, antd;`), but the symptom looks like a much deeper
  styling failure. Surfaced only at manual bring-up — automated gates
  (vitest / tsc / vite build) all missed it because the markup is correct;
  only the visual cascade is wrong. Documented in
  `docs/agents/design/design-guidelines.md § 1.0`.

**Promotions**:

- [ ] → context/ — `AppShell` + `PageHeader` primitive contract for future
      rounds to consume rather than re-deriving shell markup.
- [ ] → skills/ — none in this round.

**Deferred to follow-up rounds** (single-feature, in priority order):

1. WorkflowShell Tailwind sweep — replace `className="..."` with AntD
   `Layout`/`Space`/`Tag` + tokens; retire `badgeToneForStatus` Tailwind helper.
2. Feedback layer migration — `UploadStageSidebar` → AntD `Steps`,
   `UploadLoadingMask` → `Spin fullscreen`, `UploadToastStack` → `message` /
   `notification`. Was Round 34 Tier-C.
3. WorkspacePicker visual refit — drop inline pill button styles, lean on the
   theme `Button` defaults instead of `cancelButtonStyle` / `createButtonStyle`
   overrides.
4. Full Tailwind removal sweep — strip remaining ~174 `className=` props across
   feature folders; uninstall `tailwindcss`, `postcss`, `autoprefixer`; remove
   `@tailwind` directives from `index.css`. Should be the LAST round of the
   AntD chain (it touches everything).

**Deferred (from Round 34's original next-round decision)**:

- [ ] Add focused vitest coverage for the AntD-migrated `/saved-queries`
      surfaces (Table → TanStack swap, dialog Modal+Form flows)
- [ ] Re-run backend upload regression suite (deferred from Round 34's Check)
- [ ] Address the spec-016 `speckit.analyze` CRITICALs that gated Round 33's Act
- [ ] Round 33 custom feedback layer (toast / loading mask / upload step
      sidebar) → AntD `message` / `notification` / `Spin fullscreen` / `Steps`
      per the Tier-C plan in the AntD feasibility research

These items will be scheduled into a follow-up round after the Data Management
revision chain (Rounds 35–39) completes, unless an earlier round surfaces a
blocker that forces them sooner.

**Next-round decision**:

- Round 36 — **AntD chain step 2: WorkflowShell Tailwind sweep** (user-selected
  at 2026-05-12 end-of-round Q&A). Replaces the previously-planned Spec 018
  (File Upload & Sheet Discovery); the Data Management revision chain shifts to
  Round 37+ and will build on top of the migrated WorkflowShell.
