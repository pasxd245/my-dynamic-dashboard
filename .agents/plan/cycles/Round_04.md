# Round 04: Promote `PageCard` + `PageHeader` to `@mdd/ui/Components`

**Status**: Planning
**Date started**: 2026-05-19
**Date completed**: —

**Master plan**: [docs/agents/plan/packages-ui.plan.md](../../../docs/agents/plan/packages-ui.plan.md)
**Workflow**: [docs/agents/workflows/packages-ui.workflow.md](../../../docs/agents/workflows/packages-ui.workflow.md)

## Goal

Move `apps/builder`'s [PageCard](../../../apps/builder/src/components/layout/PageCard.tsx) and [PageHeader](../../../apps/builder/src/components/ui/PageHeader.tsx) into `@mdd/ui/Components`. Redirect the builder barrels to re-export from `@mdd/ui/Components`; delete the local source files. The single consumer call-site ([apps/builder/src/App.tsx](../../../apps/builder/src/App.tsx)) keeps working unchanged — same import path, same props, same render.

## Trajectory

- **Immutable intent**: relocate two components, byte-near-identical render. Anything else — replacing the components' CSS-var contract with `theme.useToken()` references, generalising the breadcrumb hardcoded "Builder" root, supporting variants beyond `default`/`flush` — is out of scope. Those are follow-up refactor rounds.
- **Architecture state**: PageCard has exactly one consumer in builder — [App.tsx:26](../../../apps/builder/src/App.tsx). PageHeader has exactly one — [App.tsx:6](../../../apps/builder/src/App.tsx) (importing from the `components/ui` barrel) + [App.tsx:838](../../../apps/builder/src/App.tsx) (the JSX use). No other importers anywhere in `apps/builder/src/`.
- **CSS contract** (intentional carry-over from the in-builder version, **not** introduced by this round): `PageCard` reads the `.page-card` and `.page-card--flush` classes from the consumer's global CSS. `PageHeader` reads CSS custom properties — `--color-white`, `--surface-line`, `--radius-xl`, `--shadow-card`, `--color-gray-4` — from the consumer's `:root`. Both contracts are already satisfied by [apps/builder/src/index.css](../../../apps/builder/src/index.css); this round preserves the contract verbatim. **Documented as a known soft coupling**; tightening it (move to `theme.useToken()`) is a future round.
- **Allowed change boundary**: `packages/ui/**` + `apps/builder/src/components/layout/**` + `apps/builder/src/components/ui/**`. Read-only-for-context: [apps/builder/src/App.tsx](../../../apps/builder/src/App.tsx), [apps/builder/src/index.css](../../../apps/builder/src/index.css).

## Invariants

- `apps/builder` keeps building, type-checking, and rendering every route unchanged. The consumer call-site `import { PageCard } from "./components/layout"` and `import { ..., PageHeader } from "./components/ui"` keep resolving — builder's barrels are redirected, not deleted.
- `pnpm --filter builder test`: stays **70/70 green** (R02 baseline).
- The PageCard and PageHeader components export the same `PageCardProps` / `PageHeaderProps` types with the same field names. R05 (AppShell swap) does not re-touch these; this round must leave them feature-complete.
- No new `dependencies` in `packages/ui/package.json` (tier-2 trigger).
- No new hex literals; no `@tanstack/react-router`.

## Plan

### Phase 1 — Land `PageCard` in `@mdd/ui/Components`

**Files** (new):

- `packages/ui/src/Components/PageCard/index.tsx` — full content **byte-identical** to [apps/builder/src/components/layout/PageCard.tsx](../../../apps/builder/src/components/layout/PageCard.tsx), with one edit: the comment block `See \`docs/agents/design/design-guidelines.md § Layout\` for the rule of one`is preserved (still valid — the doc is repo-relative). The named export pattern stays`export default function PageCard(...)`.

**`Components/index.ts` append** — add re-exports:

```ts
export { default as PageCard } from './PageCard/index.tsx';
export type { PageCardProps } from './PageCard/index.tsx';
```

**Gate**:

- `pnpm --filter @mdd/ui type-check` green.
- `diff packages/ui/src/Components/PageCard/index.tsx apps/builder/src/components/layout/PageCard.tsx` shows zero substantive difference (allowed: import-path adjustments, the file header may differ).

### Phase 2 — Land `PageHeader` in `@mdd/ui/Components`

**Files** (new):

- `packages/ui/src/Components/PageHeader/index.tsx` — full content **byte-identical** to [apps/builder/src/components/ui/PageHeader.tsx](../../../apps/builder/src/components/ui/PageHeader.tsx). All CSS-var references (`var(--color-white)`, `var(--surface-line)`, `var(--radius-xl)`, `var(--shadow-card)`, `var(--color-gray-4)`) are preserved verbatim — the soft CSS-var contract is carried.

**`Components/index.ts` append**:

```ts
export { default as PageHeader } from './PageHeader/index.tsx';
export type { PageHeaderProps } from './PageHeader/index.tsx';
```

**Gate**:

- `pnpm --filter @mdd/ui type-check` green.
- A new vitest at `packages/ui/src/Components/PageHeader/__tests__/PageHeader.test.tsx` (happy-dom): render `<PageHeader section="Data Management" title="Test" subtitle="sub" />` inside `<MddUIProvider>`; assert (a) the breadcrumb contains "Builder", "Data Management", "Test"; (b) the `<h2>` text is "Test"; (c) the subtitle paragraph has text "sub". A new vitest at `packages/ui/src/Components/PageCard/__tests__/PageCard.test.tsx` (happy-dom): render `<PageCard><div>body</div></PageCard>`; assert (a) outer element is a `<section>` with class `page-card`; (b) `variant="flush"` adds `page-card--flush`; (c) extra `className` prop composes after.

### Phase 3 — Redirect builder barrels (zero-touch for the consumer)

**Files**:

- [apps/builder/src/components/layout/index.ts](../../../apps/builder/src/components/layout/index.ts) — replace the body with re-exports from `@mdd/ui/Components`:

  ```ts
  export { PageCard } from '@mdd/ui/Components';
  export type { PageCardProps } from '@mdd/ui/Components';
  ```

- [apps/builder/src/components/ui/index.ts](../../../apps/builder/src/components/ui/index.ts) — replace the `PageHeader` block (lines 6-8 in current source) with a re-export, **leaving `AppShell` export untouched** (R05 will replace it). New content of that block:

  ```ts
  export { PageHeader } from '@mdd/ui/Components';
  export type { PageHeaderProps } from '@mdd/ui/Components';
  ```

**Gate**:

- `pnpm --filter builder type-check`: the pre-existing `SavedQueryLibraryPage.tsx:98` error is still tolerated; no NEW errors.
- `pnpm --filter builder test`: 70/70 stays green.
- `grep -n PageCard apps/builder/src/App.tsx` and `grep -n PageHeader apps/builder/src/App.tsx` resolve through the redirected barrels.

### Phase 4 — Delete the in-app source files

**Files** (deleted):

- `apps/builder/src/components/layout/PageCard.tsx` — `git rm`.
- `apps/builder/src/components/ui/PageHeader.tsx` — `git rm`.

**Gate**:

- `pnpm --filter builder test`: 70/70 stays green (proves the redirect actually works at runtime, not just at types).
- `git diff --name-only` on this phase shows only the two deletes + the barrels from Phase 3.

### Phase 5 — Close-out

**Files**:

- `packages/ui/README.md` — under "Subpath imports", add `PageCard` and `PageHeader` to the list. Add a one-line note that both components currently rely on the consumer providing the `.page-card` class + CSS custom properties (`--color-white`, `--surface-line`, `--radius-xl`, `--shadow-card`, `--color-gray-4`); tightening to `theme.useToken()` is a future round.
- This round file — flip `Status: Complete`, fill `Do`, tick `Check`, write `Act`.

**Gate**:

- `pnpm md:lint` green.
- `pnpm --filter @mdd/ui test`: full suite green.
- `pnpm --filter builder test`: 70/70 stays green.

## Do

_(progress log — updated as each phase lands)_

## Check

- [ ] Phase 1 gate — `PageCard` lives at `packages/ui/src/Components/PageCard/index.tsx`; `Components/index.ts` re-exports it.
- [ ] Phase 2 gate — `PageHeader` lives at `packages/ui/src/Components/PageHeader/index.tsx`; vitests for both components pass.
- [ ] Phase 3 gate — builder's `components/layout/index.ts` and `components/ui/index.ts` redirect to `@mdd/ui/Components`; `App.tsx` resolves; builder test suite stays 70/70.
- [ ] Phase 4 gate — the two in-app source files are deleted; tests still 70/70 green (proves runtime resolution).
- [ ] Phase 5 gate — README mentions both components + the known CSS-contract caveat; lint clean.
- [ ] No outside-boundary edits — diff stays inside `packages/ui/**`, `apps/builder/src/components/layout/**`, `apps/builder/src/components/ui/**`, plus this round file.

## Act

**Learnings**: —

**Promotions**:

- [ ] → context/ : —
- [ ] → skills/ : —

## Round chain (for context, not part of this round's scope)

- **Round 05** — Swap `apps/builder/src/components/ui/AppShell.tsx` → `@mdd/ui/MasterLayout` using R03's extended API. After R04, the only thing left in `components/ui/` is `AppShell` (PageHeader already re-exported); R05 deletes that file and updates the barrel one last time.
- **Future bugfix round** — fix the pre-existing TS error in [apps/builder/src/pages/SavedQueryLibrary/SavedQueryLibraryPage.tsx:98](../../../apps/builder/src/pages/SavedQueryLibrary/SavedQueryLibraryPage.tsx#L98) so `pnpm --filter builder type-check` re-greens. Logged as openObservation `builderTypecheckPreExistingRegression`.
- **Future refactor round** — tighten PageCard / PageHeader's CSS contract to use `theme.useToken()` and inline styles instead of consumer CSS classes + vars. Would let other consumers (future React apps) use them without copying builder's `index.css`.
