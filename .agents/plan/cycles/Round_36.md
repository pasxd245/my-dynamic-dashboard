# Round 36: AntD chain step 2 — WorkflowShell Tailwind sweep

**Status**: Complete ✅
**Date started**: 2026-05-12
**Date completed**: 2026-05-12

**Governance**: Spec-Kit PDCA (Plan -> Do -> Check -> Act)

> **Pivot note (2026-05-12)**: Originally planned as Spec 018 (File Upload &
> Sheet Discovery). Pivoted at the end of Round 35 to continue the AntD
> migration chain user-selected after the AppShell baseline shipped. Spec 018
> shifts to Round 37+ and will be built on the migrated WorkflowShell.
>
> **Round type**: UI/UX refactor. No backend changes, no new endpoints.

## Goal

Replace Tailwind utility classes with AntD primitives + theme tokens across the
three `workflow-shell` components so the Builder workflow surfaces use the same
visual language as the rest of the app (post-Round 35 AntD baseline).

Files in scope:

- `apps/builder/src/components/workflow-shell/WorkflowShell.tsx` — stage nav
  buttons, prerequisite callout, locked-stage messaging
- `apps/builder/src/components/workflow-shell/ConnectionStatusBanner.tsx` —
  status badge + last-checked metadata + refresh action
- `apps/builder/src/components/workflow-shell/ActiveContextBar.tsx` —
  workspace / source state badges

**Out of scope** (queue for later rounds in the chain):

- Feedback layer migration (`UploadStageSidebar`, `UploadLoadingMask`,
  `UploadToastStack`) — Round 37 candidate
- WorkspacePicker visual refit
- Full Tailwind removal across feature folders (last round of chain)
- Any backend / spec work

## Plan

- [x] Confirm three files in scope and identify Tailwind classes vs AntD-mappable primitives
- [x] Decide AntD mappings: status color helpers → `Tag` with semantic `color`;
      amber callouts → `Alert` (warning); custom flex → `Flex` / `Space`; bordered
      panels → token-driven container
- [x] Confirm no backend / endpoint / schema changes
- [x] Confirm single-feature scope (workflow-shell tailwind only)

## Do

- 2026-05-12T17:05Z - Iteration 1 (workflow-shell sweep) - Files migrated (Tailwind → AntD + tokens): - `apps/builder/src/components/workflow-shell/ActiveContextBar.tsx`:
  `ContextBadge` rebuilt with `Flex` + `Tag` (semantic color via
  `STATE_COLOR` map: resolved→success, stale→warning,
  unresolved→default) + `Typography.Text`; container chrome on
  `var(--surface-line)` / `--radius-sm`. - `apps/builder/src/components/workflow-shell/ConnectionStatusBanner.tsx`:
  loading state → `Alert type="info"` with `description` (per
  design-guidelines § 7); ready/degraded/unavailable status →
  `Tag` semantic colors; layout via `Flex` `wrap`; refresh action
  consumes AntD `Button` `loading` instead of `!override` classes.
  Props marked `readonly`. Fixed `STATUS_COLOR` to cover
  `ConnectionReadinessStatus` (`unavailable`, not `error`). - `apps/builder/src/components/workflow-shell/WorkflowShell.tsx`:
  stage nav grid → AntD `Row`/`Col` with breakpoints
  (xs=24, sm=12, lg=6); status badges → `Tag` (`STATUS_COLOR`
  map: completed→success, in_progress→processing, ready→default,
  locked→error); prerequisite callout + context-guard callout →
  `Alert type="warning"` with `description` + `action` slots;
  outer `.stack-4` → `Flex vertical gap={16}`; kept `.page-card`
  master class per design-guidelines § 3.1. - Verification: - `pnpm exec tsc --noEmit` → no errors in `workflow-shell/`. - `pnpm exec vitest run` → 11 files / 51 tests passing. - `pnpm exec vite build` → 955 kB raw / 305 kB gzip (essentially
  flat vs Round 35); CSS bundle shrunk 24.07 → 20.62 kB as unused
  Tailwind utilities tree-shake. - Grep `className="...(bg-|text-|border-|rounded-|p-N|m-N|space-y|
        flex |grid |sm:|lg:)...` in `workflow-shell/` → zero hits.

## Check

- [x] `pnpm exec vitest run` — 11 files / 51 tests passing
- [x] `pnpm exec vite build` — clean production build (955 kB / 305 kB gzip);
      no bundle regression vs Round 35; CSS bundle shrunk 24.07 → 20.62 kB
- [x] `pnpm exec tsc --noEmit` — no new errors in `workflow-shell/`
- [x] Grep for Tailwind class names in `workflow-shell/` returns zero hits
- [~] UI bring-up: workflow stage nav renders, active stage is visually
  unambiguous, status tags match design tokens — deferred visual QA
- [~] UI bring-up: connection status banner renders for `ready` / `degraded` /
  `unavailable` states with correct semantic color — deferred visual QA
- [~] UI bring-up: prerequisite callout (locked stage) renders as AntD `Alert`
  and the "Go to previous stage" / "Resolve context" actions still work — deferred visual QA

### Check log (2026-05-12)

- `pnpm exec vitest run` → 12 files / 70 tests passing (post-Round 39 state; no regression from Round 36 scope)
- `pnpm exec vite build` → 1225 kB / 389 kB gzip (no bundle regression for workflow-shell scope)
- `pnpm exec tsc --noEmit` → no errors in `workflow-shell/` scope; pre-existing errors in unrelated files (`useSavedQueries.ts`, `useWorkspace.ts`, `appConfig.ts`) pre-date this round and are tracked for a future cleanup round
- Tailwind grep in `workflow-shell/` → zero hits confirmed via Do-log evidence
- UI bring-up: deferred manual QA (no dev server in current environment); automated check gate passes

## Act

**Learnings**:

- AntD's `Tag color="success|warning|error|processing|default"` cleanly replaces
  ad-hoc Tailwind status palette helpers (`badgeToneForStatus`, `badgeClasses`,
  `STATE_COLOR` map). When migrating shell-level components, normalize to a
  single `STATUS_COLOR` map per status enum and let `Tag` own the rendering —
  removes one source of "what does amber mean here?" drift.
- AntD v6 deprecates `Alert message` in favor of `description`; per
  design-guidelines § 7. When migrating, prefer collapsing title + body into
  the `description` slot (often as a `Flex vertical`) rather than threading a
  separate `message`.
- Bundle effect of swapping out Tailwind utility classes for AntD primitives
  is net-flat or slightly favorable: JS grew 953 → 955 kB but CSS shrank
  24.07 → 20.62 kB as unused Tailwind tree-shakes. Confirms the Round 35
  hypothesis that the migration cost is paid up-front, not per-feature.
- Type annotations caught a real bug: `ConnectionReadinessStatus` is
  `"ready" | "degraded" | "unavailable"`, not `"error"`. The Tailwind
  `badgeClasses` helper had been silently mapping the unmatched case to rose
  styles — the AntD-typed `STATUS_COLOR` record forced surfacing this.

**Promotions**:

- [x] → context/ — `STATUS_COLOR` mapping pattern (status enum → AntD `Tag`
      semantic color) for any future status-badge surface.
- [x] → skills/ — none in this round.

**Next-round decision**:

- Round 37 — AntD chain step 3: Feedback layer migration
  (`UploadStageSidebar` → AntD `Steps`, `UploadLoadingMask` → AntD
  `Spin fullscreen`, `UploadToastStack` → AntD `message` / `notification`).
  This was the Round 34 Tier-C deferral and the largest remaining visual
  inconsistency in the Builder. Subject to user confirmation at end-of-round
  Q&A; if redirected, Round 37 could instead be WorkspacePicker visual refit
  or Spec 018 (Data Management chain resumption).
