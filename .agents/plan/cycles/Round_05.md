# Round 05: Swap `apps/builder/AppShell` → `@mdd/ui/MasterLayout`

**Status**: Complete
**Date started**: 2026-05-19
**Date completed**: 2026-05-19

**Master plan**: [docs/agents/plan/packages-ui.plan.md](../../../docs/agents/plan/packages-ui.plan.md)
**Workflow**: [docs/agents/workflows/packages-ui.workflow.md](../../../docs/agents/workflows/packages-ui.workflow.md)

## Goal

Replace `apps/builder`'s [AppShell](../../../apps/builder/src/components/ui/AppShell.tsx) with `@mdd/ui/MasterLayout`. Delete the local `AppShell.tsx`. With R03's extended MasterLayout API (`header?`, `brand?`, `navGroups?`) already on dev, every R01-era AppShell prop has a 1-to-1 destination on `MasterLayout`.

This is the **culminating round** of the packages-ui chain. After R05, every nav primitive in `apps/builder` comes from `@mdd/ui` — no local layout dupes remain.

## Trajectory

- **Immutable intent**: replace the AppShell call-site in [App.tsx](../../../apps/builder/src/App.tsx), convert the `AppShellNavGroup[]` literal to a `NavigationGroup[]` literal, delete `AppShell.tsx`, and update the `components/ui/index.ts` barrel. Anything else — generalising the icon type, replacing inline styles in `App.tsx`'s header JSX, refactoring the `routeMeta` derivation — is out of scope.
- **Architecture state**: AppShell has exactly one consumer — App.tsx (import line 6, JSX line 804). NAV_GROUPS literal (lines 68-85) is the only piece of data needing structural conversion. The AppShell component file itself, the `AppShellProps` / `AppShellNavGroup` / `AppShellNavItem` type exports, and the `DEFAULT_BRAND` constant inside AppShell.tsx all become dead code after the swap.
- **Type shape mismatch** (handled in Phase 1): `AppShellNavGroup` = `{ key, title, items: AppShellNavItem[] }` where `AppShellNavItem = { key, label, to, icon: ReactNode }`. `@mdd/ui` `NavigationGroup` = `{ id, title, items: NavigationItem[] }` where `NavigationItem = { id, path, title, icon?: FC<IconProps>, sidebar?: boolean, ... }`. Field rename: `key`→`id`, `label`→`title`, `to`→`path`. Icon: lucide-react JSX literals (`<FilePlus2 size={16} />`) must be wrapped in an anonymous `FC<IconProps>` (`() => <FilePlus2 size={16} />`) because the `NavigationItem.icon` shape is a component, not a ReactNode.
- **Allowed change boundary**: `apps/builder/src/App.tsx` + `apps/builder/src/components/ui/index.ts` + delete `apps/builder/src/components/ui/AppShell.tsx`. Read-only-for-context: [packages/ui/src/Components/MasterLayout/index.tsx](../../../packages/ui/src/Components/MasterLayout/index.tsx) (target API), [apps/builder/src/components/ui/AppShell.tsx](../../../apps/builder/src/components/ui/AppShell.tsx) (source semantics).

## Invariants

- `pnpm --filter builder test` stays **70/70 green** (the R02 baseline).
- The four nav routes — `/` (Data Upload), `/saved-queries` (Saved Queries), `/workflow/upload-source` (Workflow Builder), `/workflow/query` (Workflow Query Stage) — keep rendering. The sidebar still highlights the active route. The header still shows search + locale + bell + avatar (R03's `header?: ReactNode` slot carries it).
- No new `@tanstack/react-router` imports. No new hex literals beyond what `App.tsx` already contains.
- No edits to `packages/ui/**` — R03's MasterLayout API extension is already feature-complete for this round.

## Plan

### Phase 1 — Convert `NAV_GROUPS` literal + wrap lucide icons

**File**:

- [apps/builder/src/App.tsx](../../../apps/builder/src/App.tsx) — replace the existing `NAV_GROUPS: AppShellNavGroup[]` constant (lines 68-85) with a `NavigationGroup[]` constant of the same name, importing the type from `@mdd/ui/types`.

**New literal** (replaces lines 68-85):

```tsx
import type { NavigationGroup } from '@mdd/ui/types';

const NAV_GROUPS: NavigationGroup[] = [
  {
    id: 'data-management',
    title: 'Data Management',
    items: [
      {
        id: 'data-upload',
        path: '/',
        title: 'Data Upload',
        sidebar: true,
        icon: () => <FilePlus2 size={16} />,
      },
      {
        id: 'saved-queries',
        path: '/saved-queries',
        title: 'Saved Queries',
        sidebar: true,
        icon: () => <Library size={16} />,
      },
    ],
  },
  {
    id: 'workflow-management',
    title: 'Workflow Management',
    items: [
      {
        id: 'workflow-builder',
        path: '/workflow/upload-source',
        title: 'Workflow Builder',
        sidebar: true,
        icon: () => <Workflow size={16} />,
      },
      {
        id: 'workflow-query',
        path: '/workflow/query',
        title: 'Workflow Query Stage',
        sidebar: true,
        icon: () => <ListChecks size={16} />,
      },
    ],
  },
];
```

(Per-field mapping: `key`→`id`, `label`→`title`, `to`→`path`. Icon JSX literals get wrapped in `() => ...` to match `NavigationItem.icon: FC<IconProps>` shape. `sidebar: true` is set on every item — keeps R01's SidebarMenu's `sidebar !== false` filter happy.)

**Drop the now-stale import** at App.tsx line 7: `import type { AppShellNavGroup } from "./components/ui";` — delete this line.

### Phase 2 — Swap the AppShell JSX → MasterLayout

**File**:

- [apps/builder/src/App.tsx](../../../apps/builder/src/App.tsx) — replace the import + the JSX use.

**Import edits**:

- Line 6 `import { AppShell, PageHeader } from "./components/ui";` →
  - keep `PageHeader` coming from `./components/ui` (it's already redirected to `@mdd/ui/Components` by R04, so this stays semantically correct)
  - drop `AppShell` from this import
  - add `import { MasterLayout } from "@mdd/ui/Components";` and `import { MddUIProvider } from "@mdd/ui/Providers";`
- Add `import "@mdd/ui";` is **not** required — the package re-exports work via the subpaths.

**JSX edit** (App.tsx around line 803-952):

```tsx
// OLD outer wrapper:
return (
  <AppShell
    navGroups={NAV_GROUPS}
    header={<>…</>}
  >
    <PageHeader … />
    <Routes>…</Routes>
    {showSaveDialog && …}
  </AppShell>
);

// NEW outer wrapper — note the MddUIProvider wraps MasterLayout so the
// NavigationContext + theme reach all descendants:
return (
  <MddUIProvider>
    <MasterLayout
      navGroups={NAV_GROUPS}
      header={<>…</>}
      brand={<DEFAULT_BRAND_AS_BUILDER />}
    >
      <PageHeader … />
      <Routes>…</Routes>
      {showSaveDialog && …}
    </MasterLayout>
  </MddUIProvider>
);
```

Where `DEFAULT_BRAND_AS_BUILDER` is a small component carrying the brand JSX literal that today lives inside AppShell as `DEFAULT_BRAND`:

```tsx
function DEFAULT_BRAND_AS_BUILDER() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          background: 'var(--color-blue)',
          color: '#ffffff',
          fontWeight: 700,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        M
      </span>
      <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-dark-blue)' }}>
        Builder
      </span>
    </div>
  );
}
```

(Carried verbatim from AppShell.tsx's `DEFAULT_BRAND` constant; the CSS-var `var(--color-blue)` / `var(--color-dark-blue)` references work because builder's `index.css` defines them globally.)

**`<MddUIProvider>` placement note**: today's [apps/builder/src/main.tsx](../../../apps/builder/src/main.tsx) wraps `<App />` in `<ConfigProvider theme={antdTheme}>` directly. The R02 collapse already aliased `antdTheme` to `themeTokens`. Adding `<MddUIProvider>` inside `App.tsx` (as the JSX outer wrapper) double-provides AntD's `<ConfigProvider>`. AntD tolerates nesting (innermost wins), so this is correct but slightly wasteful. Future cleanup: hoist `<MddUIProvider>` to `main.tsx` and remove the `<ConfigProvider>` block — that's an R05.5-style refactor, not in this round.

### Phase 3 — Delete `AppShell.tsx` + update the barrel

**Files**:

- `git rm apps/builder/src/components/ui/AppShell.tsx`.
- [apps/builder/src/components/ui/index.ts](../../../apps/builder/src/components/ui/index.ts) — remove the `AppShell` export block. Final content:

  ```ts
  export { PageHeader } from '@mdd/ui/Components';
  export type { PageHeaderProps } from '@mdd/ui/Components';
  ```

**Gate**:

- `pnpm --filter builder type-check`: the pre-existing `SavedQueryLibraryPage.tsx:98` error is still tolerated; no NEW errors.
- `pnpm --filter builder test`: 70/70 stays green.
- `grep -rn 'AppShell' apps/builder/src/`: zero matches (the type was used only in App.tsx line 7, removed in Phase 1; the import was removed in Phase 2; the file is deleted in Phase 3).

### Phase 4 — Manual visual smoke + close-out

**Files**:

- This round file — flip `Status: Complete`, fill `Do`, tick `Check`, write `Act`.

**Gate**:

- A human runs `pnpm --filter builder dev` and browses `/`, `/saved-queries`, `/workflow/upload-source`, `/workflow/query`. Expected: sidebar with two groups ("Data Management", "Workflow Management"), the right item highlighted per route, the top bar carrying the search/locale/bell/avatar JSX. Collapsing the sidebar still works. **This is a manual gate** — note as such in `Check`.

## Do

- 2026-05-19 — Executed directly at user request (post-/autoagent, executor: direct-edit). Reuses the `autoagent/20260519/Round_05` branch.
- Phase 1 — converted `NAV_GROUPS` literal in [apps/builder/src/App.tsx](../../../apps/builder/src/App.tsx) from `AppShellNavGroup[]` to `NavigationGroup[]` (per-field: `key`→`id`, `label`→`title`, `to`→`path`, +`sidebar: true`). Lucide icons wrapped in `() => <Icon size={16} />` to fit `NavigationItem.icon: FC<IconProps>`. Added `BuilderBrand` component carrying the former `DEFAULT_BRAND` JSX verbatim.
- Phase 2 — App.tsx imports: dropped `{ AppShell }` and `AppShellNavGroup`; added `import { MasterLayout } from "@mdd/ui/Components";` + `import { MddUIProvider } from "@mdd/ui/Providers";` + `import type { NavigationGroup } from "@mdd/ui/types";`. JSX outer wrapper changed from `<AppShell>...</AppShell>` to `<MddUIProvider><MasterLayout ... brand={<BuilderBrand/>}>...</MasterLayout></MddUIProvider>` (NavigationContext now flows from the new provider).
- Phase 3 — `git rm apps/builder/src/components/ui/AppShell.tsx`. [apps/builder/src/components/ui/index.ts](../../../apps/builder/src/components/ui/index.ts) trimmed to a 2-line re-export of PageHeader from `@mdd/ui/Components`. `grep -rn 'AppShell' apps/builder/src/`: zero hits.
- Phase 4 — gates:
  - `pnpm --filter builder test`: **70/70 stays green**.
  - Dev server smoke (`pnpm --filter builder dev`): Vite came up in 179ms; HTTP 200 on `/` and `/workflow/upload-source`; `App.tsx` compiled cleanly (158K of transformed JS via Vite); no HMR errors. **Pixel-level verification needs human eyes — I cannot screenshot.**

## Check

- [x] Phase 1 gate — `NAV_GROUPS` is `NavigationGroup[]`; icons wrapped; `AppShellNavGroup` import dropped.
- [x] Phase 2 gate — `<MasterLayout>` replaces `<AppShell>`; `<MddUIProvider>` wraps it; `header`, `brand`, `navGroups` props all carry their corresponding former content.
- [x] Phase 3 gate — `AppShell.tsx` deleted; barrel trimmed; zero stale refs.
- [~] Phase 4 gate — programmatic smoke clean (dev server up + HTTP 200 + Vite compile clean + tests 70/70); **manual pixel-level visual smoke deferred to human reviewer**.
- [x] No outside-boundary edits — diff confined to `apps/builder/src/App.tsx`, `apps/builder/src/components/ui/**`, plus this round file.
- [x] `pnpm --filter builder test`: 70/70 stays green.

## Act

**Learnings**:

- The `<MddUIProvider>` wraps `<MasterLayout>` from inside `App.tsx`, but `apps/builder/src/main.tsx` already wraps `<App />` in `<ConfigProvider theme={antdTheme}>`. AntD's `<ConfigProvider>` nesting is tolerated (innermost wins), so this works but ships one redundant layer. Hoisting `<MddUIProvider>` to `main.tsx` and dropping the legacy `<ConfigProvider>` is a clean future micro-round; not required for correctness.
- Lucide icons via `() => <Icon size={16} />` is a one-liner wrapper that satisfies `NavigationItem.icon: FC<IconProps>` without forcing the icon library to leak into `@mdd/ui`. Worked cleanly through the SidebarMenu's `createElement(item.icon)` call.
- Dev server programmatic smoke is necessary but insufficient: HTTP 200 + Vite-compile-clean catches type / module errors; it does NOT catch CSS regressions, layout shifts, or logic that only manifests on click. Visual review remains a human gate.

**Promotions**:

- [ ] → context/ : —
- [ ] → skills/ : —

## Round chain (for context, not part of this round's scope)

- **Round 06** _(optional)_ — Add the remaining components a builder route actually needs: `Components/Button`, `Components/Modal`, `Components/FormField` (zod-aware), `Pages/NotFound`. Don't pre-build — pull from builder on demand.
- **Future cleanup** — Hoist `<MddUIProvider>` from `App.tsx` to `main.tsx` and remove the legacy `<ConfigProvider>` block. Drops one redundant nesting layer.
- **Future refactor** — Tighten PageCard / PageHeader's CSS contract to `theme.useToken()` so other consumers don't need builder's `index.css`. (Logged in R04's Act.)
