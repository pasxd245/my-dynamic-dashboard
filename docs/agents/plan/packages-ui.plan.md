# Master Plan — `@mdd/ui` (reusable master-layout package)

**Owner**: pasxd245 · **Drafted**: 2026-05-18 · **Status**: Approved — R01 cleared to start

## End state

A workspace-internal package `@mdd/ui` at [packages/ui/](../../../packages/ui/) supplies the canonical **master layout, theme, provider, and navigation primitives** for every React app in this repo. Today that's only [apps/builder](../../../apps/builder/); future React apps consume the same surface.

### Architecture choices

| Concern          | Decision                                                                                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout style     | Folder-per-component (e.g. `Components/MasterLayout/index.tsx`)                                                                                                               |
| Public API       | Subpath exports per top-level concern (`./Components`, `./Providers`, …)                                                                                                      |
| Composition      | One root `<MddUIProvider>` composes AntD `<ConfigProvider>` + a navigation context                                                                                            |
| Shell            | `MasterLayout` = AntD `Layout.Sider` + `Layout.Header` + `Layout.Content`; children mount inside `Content`                                                                    |
| Sidebar collapse | Stored in `NavigationContext` so any descendant can read or flip it                                                                                                           |
| React            | 19 (peerDep `^19`)                                                                                                                                                            |
| UI kit           | AntD v6 (peerDep `^6`)                                                                                                                                                        |
| Router           | `react-router-dom@7` (peerDep `^7`) — matches `apps/builder`                                                                                                                  |
| Brand tokens     | BMS purple `#4F45B6` and the rest of the token set live in `themeTokens.ts`, sourced from [apps/builder/src/theme/antdTheme.ts](../../../apps/builder/src/theme/antdTheme.ts) |
| Logo             | Not bundled. `MasterLayout` exposes a `Logo?: FC<IconProps>` slot; consumers pass their mark                                                                                  |
| Build            | TS source export — no bundler. `apps/builder`'s Vite consumes the package directly via `workspace:*`                                                                          |
| Test harness     | `vitest` + `@testing-library/react` + `happy-dom`, matching `apps/builder`'s setup                                                                                            |

## Full-feature surface (locked target)

```text
packages/ui/
├── package.json          # name: "@mdd/ui", private, workspace:*
├── tsconfig.json         # noEmit, ESNext, allowImportingTsExtensions
├── README.md
└── src/
    ├── index.ts                  # namespace re-exports
    ├── themeTokens.ts            # BMS ConfigProvider config
    ├── types/index.ts            # IconProps, NavigationItem, Tab, AppError, …
    ├── constants/index.ts        # STATUS_COLORS, FORMAT_DATE_TYPE, …
    ├── Utils/{classNames.ts,index.ts}
    ├── Icons/index.ts            # IconProps type export (no bundled marks)
    ├── Contexts/NavigationContext/index.tsx
    ├── Providers/MddUIProvider/index.tsx
    ├── Pages/
    │   └── NotFound/index.tsx          # R03
    └── Components/
        ├── MasterLayout/index.tsx      # R01
        ├── Sidebar/index.tsx           # R01
        ├── SidebarMenu/{index.tsx,SidebarMenuItem.tsx}   # R01
        ├── PageCard/index.tsx          # R02 — promoted from apps/builder
        ├── PageHeader/index.tsx        # R02 — promoted from apps/builder
        ├── Button/index.tsx            # R03
        ├── Modal/index.tsx             # R03
        ├── FormField/index.tsx         # R03 — zod-aware (see § FormField)
        └── index.ts
```

Subpath exports (frozen):
`.`, `./Components`, `./Providers`, `./Contexts`, `./Pages`, `./Icons`, `./Utils`, `./constants`, `./types`, `./themeTokens`.

The export _shape_ is frozen on day one (R01 publishes all 10 subpaths, with `Components` / `Pages` containing only what R01 ships). Adding components in R02 / R03 is purely additive — no consumer-facing churn.

### Per-round surface delivery

| Subpath / item                                                | R01 | R02 | R03 |
| ------------------------------------------------------------- | --- | --- | --- |
| `themeTokens`, `types`, `constants`, `Utils`, `Icons` (types) | ✅  | —   | —   |
| `Providers/MddUIProvider` + `Contexts/NavigationContext`      | ✅  | —   | —   |
| `Components/MasterLayout` + `Sidebar` + `SidebarMenu`         | ✅  | —   | —   |
| `Components/PageCard` + `PageHeader`                          | —   | ✅  | —   |
| `Components/Button` + `Modal` + `FormField`                   | —   | —   | ✅  |
| `Pages/NotFound`                                              | —   | —   | ✅  |

## FormField + zod (R03)

**Decision**: `FormField` is **zod-aware** — its prop signature accepts `issues?: ReadonlyArray<ZodIssue>` and surfaces the issue whose `path` (joined with `.`) equals the field's `name`. Rationale:

- Zod is the lightest schema lib that gives strong typing; it stays _outside_ the form-state library so consumers can pair it with anything (`@tanstack/react-form` — already in builder — `react-hook-form`, plain `useState`).
- Builder already uses `@tanstack/react-form`. That lib has a first-class zod adapter (`zodValidator`), so a builder form looks like:

  ```tsx
  const form = useForm({ validators: { onChange: zodValidator(schema) } });
  // pass form.state.fieldMeta.<name>.errors as ZodIssue[] into <FormField issues={…}>
  ```

- Zod is added as a **peerDependency** (`^3`) only when R03 lands. R01/R02 don't pull it in.

Alternative considered: marrying `FormField` to `@tanstack/react-form` directly. Rejected — couples the package to one form lib, and the value-add (schema-driven error surfacing) is the zod half, not the form-state half.

## Round chain

| Round                           | Goal                                                                                                                                                                                                                                                                                                                                                                                                                                  | Touches                                                           | Status                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| **R01**                         | Ship `@mdd/ui` package: `MasterLayout` + `Sidebar` + `SidebarMenu` + `MddUIProvider` + `NavigationContext` + theme/types/utils.                                                                                                                                                                                                                                                                                                       | `packages/ui/**` only. `apps/builder` untouched & byte-identical. | **Planned** — [Round_01.md](../../../.agents/plan/cycles/Round_01.md) |
| **R02**                         | Migrate [apps/builder](../../../apps/builder/) onto `@mdd/ui`. Swap local `AppShell` → `MasterLayout`; collapse [theme/antdTheme.ts](../../../apps/builder/src/theme/antdTheme.ts) to a re-export of `@mdd/ui/themeTokens`. Promote local [PageCard](../../../apps/builder/src/components/layout/PageCard.tsx) + [PageHeader](../../../apps/builder/src/components/ui/PageHeader.tsx) into `packages/ui` and delete the in-app dupes. | `apps/builder/**` + `packages/ui/**` (additive).                  | Queued                                                                |
| **R03** _(optional, on demand)_ | Add the remaining components a builder route actually needs: `NotFound`, `FormField` (zod-aware), `Modal`, `Button`. Don't pre-build.                                                                                                                                                                                                                                                                                                 | `packages/ui/**` (additive).                                      | Optional                                                              |

Each round is single-feature (per project convention) and reviewable in isolation. R01's gate is "`apps/builder` byte-identical" so the new package can't silently regress the live app.

## Invariants (apply to every round)

1. **No `@tanstack/react-router`** anywhere under `packages/ui/`. `react-router-dom@7` only.
2. **One source of truth for brand tokens.** R01 copies from `apps/builder`; R02 inverts so builder imports from `@mdd/ui`. No third copy ever.
3. **No build step for `packages/ui`.** TS source export only; Vite handles consumption.
4. **`apps/dashboard` & `apps/backend` are untouched** — they're Python.
5. **Allowed change boundary is declared in each round** and enforced by `git diff --name-only`.

## Decisions (signed off 2026-05-18)

1. ✅ **Package name `@mdd/ui`**.
2. ✅ **Defer `PageCard` / `PageHeader` to R02**, but list them in the **full-feature target** (above) so the master plan reflects the end state.
3. ✅ **No bundled logo, ever** — `MasterLayout` takes a `Logo?: FC<IconProps>` prop; consumers provide their mark. `Icons/` only re-exports the `IconProps` type.
4. ✅ **`FormField` is zod-aware in R03** — `issues?: ReadonlyArray<ZodIssue>`, schema-driven error surfacing, form-state lib-agnostic (see § FormField).

## Out of scope (do NOT pull in mid-round)

- Tailwind shipped from `packages/ui` (builder keeps its own Tailwind setup; the package is AntD-only).
- i18n / `react-i18next` integration — builder owns its locale layer.
- Storybook / docs site.
- Tests beyond a happy-dom smoke per component.
- Any change to `pnpm-workspace.yaml` (the `packages/*` glob already covers it).

## Companions

- Workflow: [docs/agents/workflows/packages-ui.workflow.md](../workflows/packages-ui.workflow.md)
- First round: [.agents/plan/cycles/Round_01.md](../../../.agents/plan/cycles/Round_01.md)
