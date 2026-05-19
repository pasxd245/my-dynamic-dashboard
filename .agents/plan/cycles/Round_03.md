# Round 03: Extend `@mdd/ui/MasterLayout` API additively

**Status**: Planning
**Date started**: 2026-05-19
**Date completed**: —

**Master plan**: [docs/agents/plan/packages-ui.plan.md](../../../docs/agents/plan/packages-ui.plan.md)
**Workflow**: [docs/agents/workflows/packages-ui.workflow.md](../../../docs/agents/workflows/packages-ui.workflow.md)

## Goal

Extend `MasterLayout` / `Sidebar` / `SidebarMenu` so they can host `apps/builder`'s current `AppShell` shape without code-loss in R05. Three additive optional props on `MasterLayout`: `header?: ReactNode` (full top-bar slot), `brand?: ReactNode` (sidebar brand slot, alternative to `Logo: FC<IconProps>`), and `navGroups?: NavigationGroup[]` (2-level group → items nav, alternative to the existing flat `navigation: NavigationItem[]`). No R01 prop changes — every R01 consumer keeps working byte-identically.

This round is the **prerequisite for R05** (AppShell → MasterLayout swap). Decision rationale lives in [packages-ui.plan.md § Decisions § Signed off 2026-05-19 #5](../../../docs/agents/plan/packages-ui.plan.md).

## Trajectory

- **Immutable intent**: three optional props (`header`, `brand`, `navGroups`) added to the R01 API. Anything else — moving Sidebar styling away from inline styles, generalising the dark-theme assumption, adding tests for builder-specific routes — is out of scope for this round.
- **Architecture state**: post-R02, `packages/ui` ships [MasterLayout](../../../packages/ui/src/Components/MasterLayout/index.tsx) (takes `navigation`, `title`, `Logo`, `buildVersion`, `children`), [Sidebar](../../../packages/ui/src/Components/Sidebar/index.tsx) (takes `navigation`, `Logo`, `buildVersion`), [SidebarMenu](../../../packages/ui/src/Components/SidebarMenu/index.tsx) (takes `items`, `expanded`). All three are consumed only by `MasterLayout` itself today; `apps/builder` doesn't import any of them yet (R05 will).
- **Allowed change boundary**: `packages/ui/**` only. Read-only-for-context: [apps/builder/src/components/ui/AppShell.tsx](../../../apps/builder/src/components/ui/AppShell.tsx) — the consumer R05 targets, which informs what shape the new props need.

## Invariants

- **R01 prop compatibility**: every existing R01 prop on `MasterLayout` / `Sidebar` / `SidebarMenu` keeps its current name, type, and behavior. The R01 vitest specs at [packages/ui/src/Components/MasterLayout/**tests**/MasterLayout.test.tsx](../../../packages/ui/src/Components/MasterLayout/__tests__/MasterLayout.test.tsx) and [packages/ui/src/Contexts/NavigationContext/**tests**/NavigationContext.test.tsx](../../../packages/ui/src/Contexts/NavigationContext/__tests__/NavigationContext.test.tsx) MUST continue to pass unchanged.
- **No new hex literals**; no `@tanstack/react-router` imports; no new runtime `dependencies` in `packages/ui/package.json` (tier-2 trigger).
- **`apps/builder` byte-identical** — this round does not touch it. (`pnpm --filter builder test` should stay 70/70.)
- All three new props are **optional**. `header` falls back to today's `title`-rendering behavior when absent; `brand` falls back to today's `Logo` behavior; `navGroups` is mutually-exclusive-via-precedence with `navigation` (see § Precedence below).

## Precedence rules (so backwards-compat is unambiguous)

When both the old and new prop are supplied, the new one wins, with a one-line console.warn in dev mode only (gated on `process.env.NODE_ENV !== 'production'`):

| Old (R01)    | New (R03)   | Behavior when both supplied                                   | Behavior when neither supplied                            |
| ------------ | ----------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| `navigation` | `navGroups` | `navGroups` wins; `navigation` ignored (dev warn)             | TypeScript error (one is required)                        |
| `title`      | `header`    | `header` wins (rendered verbatim); `title` ignored (dev warn) | Header bar renders, with empty title span                 |
| `Logo`       | `brand`     | `brand` wins (rendered verbatim); `Logo` ignored (dev warn)   | Brand slot empty (height preserved to avoid layout shift) |

Type-level: `MasterLayoutProps` becomes a discriminated union on `navigation` XOR `navGroups` — exactly one of those two is required. `header`, `brand`, `title`, `Logo` stay independent optionals.

## Plan

### Phase 1 — Add `NavigationGroup` type

**File**:

- `packages/ui/src/types/index.ts` — append the new type.

**New content** (appended after `NavigationItem`):

```ts
export type NavigationGroup = {
  id: string;
  title: string;
  items: NavigationItem[];
};
```

No edits to `NavigationItem` (R01 invariant).

**Gate**:

- `pnpm --filter @mdd/ui type-check` green.

### Phase 2 — Extend `SidebarMenu` to accept either flat items or groups

**File**:

- `packages/ui/src/Components/SidebarMenu/index.tsx` — extend props with `groups?: NavigationGroup[]`, render AntD `Menu` items as group rows when `groups` is supplied.

**Props shape**:

```ts
export type SidebarMenuProps =
  | { items: NavigationItem[]; groups?: never; expanded?: boolean }
  | { items?: never; groups: NavigationGroup[]; expanded?: boolean };
```

(Discriminated union — either `items` or `groups`, not both.)

**Render logic**:

- If `groups` is supplied, build `antdItems` as a list of `{ key, type: 'group', label: expanded ? group.title : null, children: <group items mapped to {key, icon, label, disabled}> }`.
- Selection logic (`pathPrefix` / `isActive` / `selectedKey`) flattens groups via `groups.flatMap(g => g.items)` then uses the same comparison.
- Filtering by `sidebar !== false` applies inside each group's items.
- `onClick={({ key }) => navigate(key as string)}` keeps working — AntD `Menu`'s `onClick` fires on the leaf item key regardless of nesting.

**Gate**:

- `pnpm --filter @mdd/ui type-check` green.
- A new vitest spec at `packages/ui/src/Components/SidebarMenu/__tests__/SidebarMenu.test.tsx` covers: (a) flat-items rendering matches R01 behavior (smoke-asserting one `ant-menu-item` exists per nav item); (b) groups rendering produces one `ant-menu-item-group` per group + nested items; (c) selection works across groups (selecting an item that's inside a group correctly highlights it).

### Phase 3 — Extend `Sidebar` with `brand`/`navGroups` slots

**File**:

- `packages/ui/src/Components/Sidebar/index.tsx` — extend props; render `brand` if supplied, else fall back to today's `Logo`-render block; forward `navGroups` to `SidebarMenu` when present, else `navigation`.

**New props**:

```ts
export type SidebarProps = {
  navigation?: NavigationItem[];
  navGroups?: NavigationGroup[];
  Logo?: FC<IconProps>;
  brand?: ReactNode;
  buildVersion?: string;
};
```

**Render logic**:

- Brand slot: if `brand` is supplied, render `{brand}`. Else if `Logo` is supplied, render today's `createElement(Logo, ...)` block. Else: nothing (height preserved by the `minHeight: 56` wrapper, R01-unchanged).
- Menu: if `navGroups` is supplied, render `<SidebarMenu groups={navGroups} expanded={expanded} />`. Else if `navigation` is supplied, render `<SidebarMenu items={navigation} expanded={expanded} />`. Else: nothing (defensive; in practice MasterLayout always supplies one).

**Gate**: `pnpm --filter @mdd/ui type-check` green.

### Phase 4 — Extend `MasterLayout` with `header`/`brand`/`navGroups` + the precedence rules

**File**:

- `packages/ui/src/Components/MasterLayout/index.tsx` — extend props as a discriminated union; render the new header / brand paths.

**New props**:

```ts
type MasterLayoutBaseProps = {
  title?: ReactNode;
  header?: ReactNode;
  Logo?: FC<IconProps>;
  brand?: ReactNode;
  buildVersion?: string;
  children: ReactNode;
};

export type MasterLayoutProps =
  | (MasterLayoutBaseProps & { navigation: NavigationItem[]; navGroups?: never })
  | (MasterLayoutBaseProps & { navigation?: never; navGroups: NavigationGroup[] });
```

**Render logic**:

- Sidebar gets `Logo` / `brand` / `buildVersion` AND either `navigation` or `navGroups` — pass through `navGroups ?? undefined` and `navigation ?? undefined` (TypeScript narrows them per the discriminated union).
- Header: if `header` is supplied, render `{header}` verbatim inside `Layout.Header` (between the collapse button and the right edge — collapse button stays). Else: today's `title`-rendering span. The collapse button stays in both cases (it's not optional).
- Dev warnings: at the top of the component, if `process.env.NODE_ENV !== 'production'`:
  - both `header` and `title` supplied → `console.warn('[@mdd/ui] MasterLayout: both`header`and`title`were supplied;`header`wins.')`
  - both `Logo` and `brand` supplied → `console.warn('[@mdd/ui] MasterLayout: both`Logo`and`brand`were supplied;`brand`wins.')`
  - (the `navigation`/`navGroups` overlap is prevented by the discriminated union at compile time — no runtime warn needed)

**Gate**:

- `pnpm --filter @mdd/ui type-check` green.
- R01's `MasterLayout.test.tsx` keeps passing **unchanged** — the R01 invocation `<MasterLayout navigation={NAV} title="Test">…</MasterLayout>` still works.
- Add one new spec to `MasterLayout.test.tsx` (or a sibling test file) exercising the new shape: `<MasterLayout navGroups={GROUPS} header={<Search/Locale/Avatar>}>...</MasterLayout>` renders the custom header content AND the grouped sidebar without throwing, and selection still works.

### Phase 5 — Close-out

**Files**:

- `packages/ui/README.md` — add a short "Two ways to feed nav" subsection showing flat-items vs grouped, and a "Custom header" example with `<MasterLayout header={...}>`. Mention `brand?: ReactNode` as the alternative to `Logo: FC<IconProps>`.
- This round file — flip `Status: Complete`, fill `Do`, tick `Check`, write `Act`.

**Gate**:

- `pnpm md:lint` passes for `packages/ui/README.md`.
- `pnpm --filter @mdd/ui test` all green (R01 specs + new specs).
- `pnpm --filter @mdd/ui type-check` green.

## Do

_(progress log — updated as each phase lands)_

## Check

- [ ] Phase 1 gate — `NavigationGroup` type added; typecheck green.
- [ ] Phase 2 gate — `SidebarMenu` accepts either `items` or `groups`; new vitest spec passes (flat + grouped + selection-across-groups).
- [ ] Phase 3 gate — `Sidebar` accepts `brand` (preferring it over `Logo`) and forwards `navGroups`.
- [ ] Phase 4 gate — `MasterLayout` exposes `header` / `brand` / `navGroups` as optional props; discriminated union enforces XOR on nav; dev warnings on precedence; R01 specs still pass unchanged; new spec for the extended shape passes.
- [ ] Phase 5 gate — README documents both shapes; `pnpm md:lint` clean; full type-check + test green.
- [ ] No outside-boundary edits (`git diff --name-only` stays inside `packages/ui/**` plus this round file).
- [ ] `apps/builder` byte-identical pre/post.

## Act

**Learnings**: —

**Promotions**:

- [ ] → context/ : —
- [ ] → skills/ : —

## Round chain (for context, not part of this round's scope)

- **Round 04** — Promote `PageCard` + `PageHeader` from `apps/builder` into `@mdd/ui/Components`. Independent of R03; could parallelise if it weren't for the single-feature-per-round rule.
- **Round 05** — Swap `apps/builder/src/components/ui/AppShell.tsx` → `MasterLayout` using R03's extended API. Pass the existing top-bar JSX through `header={…}`, pass `navGroups={NAV_GROUPS}` (the existing `AppShellNavGroup[]` shape lines up exactly with R03's `NavigationGroup[]`), pass `brand={DEFAULT_BRAND}`. Delete the local `AppShell.tsx`.
