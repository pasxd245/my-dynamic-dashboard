# Round 37: AntD chain step 3 — Feedback layer migration

**Status**: In Progress
**Date started**: 2026-05-12
**Date completed**:

**Governance**: Spec-Kit PDCA (Plan -> Do -> Check -> Act)

> **Pivot note (2026-05-12)**: Originally planned as Spec 019 (Metadata
> Extraction & Profiling). Pivoted at end of Round 36 Q&A to continue the AntD
> migration chain. Spec 019 shifts to Round 38+ and will be built on the
> migrated feedback primitives.
>
> **Round type**: UI/UX refactor. No backend changes, no new endpoints.

## Goal

Migrate the Round 33 hand-rolled feedback layer to AntD primitives:

- `UploadStageSidebar` (custom step cards) → AntD `Steps` (vertical)
- `UploadLoadingMask` (custom overlay) → AntD `Spin` indicator inside the
  existing overlay shell (keeps `scope="container"` semantics)
- `UploadToastStack` (custom toast rendering) → AntD `message` API consumed
  imperatively via `App.useApp()` (`<AntApp>` wrapper provider)

Public component APIs for `UploadStageSidebar` and `UploadLoadingMask` are
preserved so `App.tsx` callers don't need to change. `UploadToastStack` and the
underlying `feedback/ToastStack.tsx` + `feedback/LoadingMask.tsx` become unused
and are deleted (no other consumers per grep).

**Out of scope** (queue for later rounds in the chain):

- WorkspacePicker visual refit
- Full Tailwind removal sweep across remaining feature folders
- Any backend / spec work

## Plan

- [x] Grep for callers of `UploadToastStack`/`UploadLoadingMask`/`UploadStageSidebar`
      — confirmed only `App.tsx` consumes them; `feedback/*` primitives have
      no other importers
- [x] Pick API-preservation strategy: wrap AntD primitives inside the existing
      Upload\* components for `LoadingMask` + `StageSidebar`; for `ToastStack`,
      drop the component entirely and convert call sites to `messageApi`
- [x] Confirm `<AntApp>` wrapper is required in `main.tsx` for
      `App.useApp()` to expose `message` / `notification` instances
- [x] Confirm no backend / endpoint / schema changes

## Do

- 2026-05-12T17:20Z - Iteration 1 (feedback layer migration) - `apps/builder/src/main.tsx`: wrapped tree in `<AntApp>` (imported as
  `App as AntApp` from antd) under the existing `<ConfigProvider>` so
  `App.useApp()` returns real `message` / `notification` / `modal`
  instances. Component order: `StyleProvider > ConfigProvider > AntApp
    > BrowserRouter > App`. -`apps/builder/src/components/upload-flow/UploadLoadingMask.tsx`:
  rebuilt with AntD`<Spin size="large">` + `Typography.Text` for the
  title/message lines, kept the absolute-positioned overlay shell so
  `scope="container"` semantics hold. Removed dependency on the
  hand-rolled `feedback/LoadingMask.tsx`. -`apps/builder/src/components/upload-flow/UploadStageSidebar.tsx`:
  rebuilt with AntD`<Steps orientation="vertical">` (v6: `direction`
  deprecated → `orientation`); per-step`status` derived from
  active/blocked/finished state via `deriveStatus` helper;
  `items.content`carries the subtitle (`description` is deprecated in
  v6); `onChange` routes through `onBlockedSelect` when the step is
  blocked, else `onSelectStep`. Whole-component disable via
  `items[].disabled = blockNavigation`. Removed all inline
  `style={{ background, border, opacity }}` per-state hacks. - `apps/builder/src/App.tsx`: - Removed`toasts` state, `setToasts`, the 3.2 s clear-timer
  useEffect, and the`AppToast` type import. - Added `const { message: messageApi } = AntApp.useApp();`
  (renamed to avoid the existing local `message` state variable). - `pushToast(tone, text)` reduced to `messageApi?.[tone]?.(text)`;
  optional chaining hardens the call against unwrapped contexts
  (e.g. test renders that don't include`<AntApp>`). - Removed`<UploadToastStack toasts={toasts} />` from the upload
  source panel. - Deletions (no other importers per grep): - `apps/builder/src/components/feedback/` (whole directory:
  `LoadingMask.tsx`,`ToastStack.tsx`,`index.ts`). -`apps/builder/src/components/upload-flow/UploadToastStack.tsx`. -`apps/builder/src/components/**tests**/UploadToastStack.test.tsx`
  (tests a deleted component). - `apps/builder/src/components/upload-flow/index.ts`: dropped the
  `UploadToastStack` + `UploadToast` / `UploadToastTone` exports. - Test updates: - `apps/builder/src/pages/**tests**/UploadFlowPage.test.tsx`:
  replaced`data-testid="upload-step-*"` lookups with a
  `stepItem(title)` helper that resolves `.ant-steps-item` via
  the step's visible title. Active-step assertion now checks
  for class `ant-steps-item-process`; blocked nav assertion
  checks for`ant-steps-item-disabled`. -`apps/builder/src/pages/**tests**/UploadFlowFeedback.test.tsx`:
  `renderApp()` now wraps `<App />` in `<AntApp>` so the
  `useApp()` context is populated. - `apps/builder/vite.config.ts`: bumped`testTimeout` from the
  5 s default to 15 s. The AntApp + Steps + ConfigProvider
  rendering chain pushes the end-to-end App-rendering tests
  from ~3 s to ~7 s per test; 15 s caps with comfortable margin. - Verification: - `pnpm exec tsc --noEmit` → no new errors in migrated dirs. - `pnpm exec vitest run` → 10 files / 49 tests passing (was
  11/51 — −2 from the deleted `UploadToastStack` test file). - `pnpm exec vite build` → 1004 kB raw / 319 kB gzip (was 305 kB
  after Round 36; +14 kB for AntD Steps + Spin + App message
  portal). CSS bundle unchanged at 4.71 kB gzip.

## Check

- [x] `pnpm exec vitest run` → 10 files / 49 tests passing
- [x] `pnpm exec vite build` → clean (1004 kB / 319 kB gzip)
- [x] `pnpm exec tsc --noEmit` → no new errors in migrated dirs
- [x] `feedback/` directory removed; `UploadToastStack.tsx` removed; barrel
      exports updated; `UploadToastStack.test.tsx` removed
- [ ] UI bring-up: upload step sidebar renders as vertical AntD Steps;
      clicking a step works; clicking a blocked step routes through
      `onBlockedSelect`
- [ ] UI bring-up: loading mask appears with AntD spinner indicator during
      validate/upload/discover-sheets phases
- [ ] UI bring-up: success/info/error toasts appear top-right via AntD
      `message` and auto-dismiss

## Act

**Learnings**:

- AntD v6 deprecated several Steps props vs v5: `direction` → `orientation`,
  `items.description` → `items.content`. Both fire console warnings in dev
  but still render. Treat as a v5→v6 migration checklist for any future
  surface that touches `<Steps>`.
- `App.useApp()` returns the static AntD APIs when not wrapped in `<AntApp>`.
  In integration tests that mount the full `App` component, wrapping with
  `<AntApp>` is required for the real message instance to render; otherwise
  the call silently no-ops (and with optional chaining, returns undefined).
  Adding the wrapper is a one-line test-side change.
- AntD `Steps` with `onChange` doesn't natively support per-item disabled
  routing — the whole component is enabled/disabled. To preserve
  "clickable but blocked → routes through `onBlockedSelect`", we kept the
  `blockedReason` check in the parent's `onChange` handler and gated
  whole-component disable on `blockNavigation` only.
- Bundle delta of swapping hand-rolled feedback for `Steps` + `Spin` +
  `AntApp` (message portal layer) is ~14 kB gzip (305 → 319 kB). Reasonable
  cost for retiring three custom components, ~150 lines of inline styling,
  and the local toast state machine + 3.2 s clear-timer.
- happy-dom + AntD's portal-heavy components push integration test runtimes
  from ~3 s to ~7 s per test. The 5 s default vitest timeout becomes
  marginal; 15 s gives comfortable headroom without masking real hangs.

**Promotions**:

- [ ] → context/ — `App.useApp()` testing pattern: when tests render the
      full App component, wrap with `<AntApp>` so `messageApi` is real;
      otherwise guard call sites with optional chaining for resilience.
- [ ] → skills/ — none in this round.

**Next-round decision**:

- Round 38 — AntD chain step 4 candidate: **WorkspacePicker visual refit**
  (smaller scope: drop the inline `cancelButtonStyle` / `createButtonStyle`
  pill overrides; lean on theme `Button` defaults). Alternative: resume
  Spec 018 (File Upload & Sheet Discovery) now that the entire upload
  surface is on AntD primitives. Pending user Q&A at session end.
