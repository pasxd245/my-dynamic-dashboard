# Round 10: Land `@mdd/ui/Pages/NotFound`

**Status**: Complete
**Date started**: 2026-05-19
**Date completed**: 2026-05-19

**Master plan**: [docs/agents/plan/packages-ui.plan.md](../../../docs/agents/plan/packages-ui.plan.md)
**Workflow**: [docs/agents/workflows/packages-ui.workflow.md](../../../docs/agents/workflows/packages-ui.workflow.md)
**Chain predecessors**: [Round_07.md](./Round_07.md) (Button), [Round_08.md](./Round_08.md) (Modal), [Round_09.md](./Round_09.md) (FormField)

## Goal

Final link in the R07→R10 chain. Land `@mdd/ui/Pages/NotFound` — a simple 404 page component that consumers can render under their `<Route path="*">`. Net-new: `apps/builder` has no NotFound today (no `<Route path="*">`, no 404 component); introducing this in `@mdd/ui` gives future apps a default to drop in.

## Product-velocity justification

Package round. Master plan's "Full-feature surface" includes `Pages/NotFound` (line ~35). Without it, every new app would re-author its own 404 page. Landing it as a thin, restylable default keeps the package's coverage matching the plan's locked target. Consumer adoption (wiring `<Route path="*" element={<NotFound />}>` into `apps/builder`) is a future round.

## Trajectory

### Immutable Intent

Ship a single named export `NotFound` from `@mdd/ui/Pages`. Surface:

```tsx
interface NotFoundProps {
  readonly title?: string; // default: "Page not found"
  readonly message?: string; // default: "The page you're looking for doesn't exist."
  readonly homeHref?: string; // default: "/"
  readonly homeLabel?: string; // default: "Go home"
}
```

Render shape: a centered container with the title, message, and an `<a>` link back to `homeHref`. Uses `react-router-dom`'s `Link` (already a `peerDependency`) when `homeHref` looks routable; falls back to plain `<a>` otherwise. **Out of scope**: replacing `apps/builder` routes (no `<Route path="*">` exists today); supporting full i18n (the four string props are the contract — consumers swap text by passing different defaults).

### Current Architecture State

- `packages/ui/src/Pages/index.ts` re-exports nothing (`export {}` placeholder from R01).
- `apps/builder` has no `<Route path="*">` and no `NotFound` component — the URL `/anything-else` falls through to `App.tsx`'s default render.
- `react-router-dom@^7` is already a `peerDependency`/`devDependency` of `@mdd/ui` (from R01); `Link` is the canonical inter-route link.

### Feedback Scope

- **Local (this round)**: net-new `Pages/NotFound/index.tsx` + tests + `Pages/index.ts` re-export + README mention.
- **Global redesign (NOT this round)**: wiring builder's router to render `<NotFound />` under `<Route path="*">`. The page exists first; consumer adoption is a future round.

### Allowed Change Boundary

- In-scope: `packages/ui/src/Pages/NotFound/**`, `packages/ui/src/Pages/index.ts`, `packages/ui/README.md`.
- Read-only context: `packages/ui/src/Providers/MddUIProvider/**`, `react-router-dom`'s `Link` API.
- **Out of scope**: `apps/builder/**`, any other consumer call-site, runtime `dependencies` adds (everything needed is already a peerDep).

## Invariants

- No new entry under `"dependencies"` (runtime) in any `package.json`.
- No new peer/dev deps either (react-router-dom is already there).
- `pnpm --filter @mdd/ui type-check` stays green.
- `pnpm --filter @mdd/ui test` runs the existing suite (23 tests after Round_09) plus the new NotFound suite, all green.
- `pnpm --filter builder type-check` is unchanged.

## Plan

### Phase 1 — Land `NotFound` in `@mdd/ui/Pages`

**Files** (new):

- `packages/ui/src/Pages/NotFound/index.tsx`:

  ```tsx
  import type { ReactElement } from 'react';
  import { Link } from 'react-router-dom';

  export interface NotFoundProps {
    readonly title?: string;
    readonly message?: string;
    readonly homeHref?: string;
    readonly homeLabel?: string;
  }

  /**
   * Default 404 page. Drop under `<Route path="*">` in the consumer's
   * router. All copy is consumer-overridable via props.
   */
  export default function NotFound({
    title = 'Page not found',
    message = "The page you're looking for doesn't exist.",
    homeHref = '/',
    homeLabel = 'Go home',
  }: NotFoundProps = {}): ReactElement {
    return (
      <main className="mdd-ui-not-found" role="main">
        <h1 className="mdd-ui-not-found__title">{title}</h1>
        <p className="mdd-ui-not-found__message">{message}</p>
        <p className="mdd-ui-not-found__home">
          <Link to={homeHref}>{homeLabel}</Link>
        </p>
      </main>
    );
  }

  export { NotFound };
  ```

  BEM-style class names (`mdd-ui-not-found`, `mdd-ui-not-found__title`, etc.) — consumer styles them or doesn't, same approach as FormField (R09). The page must render inside a `react-router-dom` context because of `<Link>` — tests wrap in `<MemoryRouter>`.

**`Pages/index.ts`** — replace `export {};` with:

```ts
export { default as NotFound } from './NotFound/index.tsx';
export type { NotFoundProps } from './NotFound/index.tsx';
```

**Gate**:

- `pnpm --filter @mdd/ui type-check` green.

### Phase 2 — Tests

**Files** (new):

- `packages/ui/src/Pages/NotFound/__tests__/NotFound.test.tsx` — happy-dom; cases:
  1. **Defaults**: render `<NotFound />` inside `<MemoryRouter>`. Assert title = "Page not found", message contains "doesn't exist", link text = "Go home", link `href` resolves to `"/"`. Use the `alertIn(container)`-style **container-scoped query** pattern established in Round_09 — `container.querySelector('a')` — to avoid the cross-file DOM leakage gotcha.
  2. **Custom props**: `<NotFound title="404" message="Nope" homeHref="/dashboard" homeLabel="Dashboard" />` — all four custom strings render.
  3. **Smoke**: typeof NotFound === 'function'.

  3 cases is enough — the wrapper is a pure render of 4 string props through a known router primitive.

**Gate**:

- `pnpm --filter @mdd/ui test` all green.

### Phase 3 — Close-out

**Files**:

- `packages/ui/README.md` — extend Subpath imports comment to remove the `populated in R03` placeholder, replace with an actual `@mdd/ui/Pages` import line. Add a one-paragraph `## NotFound (R10)` block showing the prop shape and a `<Route path="*" element={<NotFound />}>` example.
- This round file — flip `Status: Complete`, fill `Do`, tick `Check`, write `Act`.

**Gate**:

- `pnpm md:lint` green.
- `pnpm --filter @mdd/ui type-check` + `test` green.
- `pnpm --filter builder type-check` unchanged.
- Critical-security: no path-glob hit, no new `"dependencies"`, no `child_process`/`eval`/`vm`.

## Do

- 2026-05-19 — Iter 8 of `/autoagent --budget 10 --warm`. Executor: direct-edit on `autoagent/20260519/Round_10` branch.
- Phase 1 — created `packages/ui/src/Pages/NotFound/index.tsx` with the signature locked in the plan: four overridable string props (`title`, `message`, `homeHref`, `homeLabel`) and a `<Link to={homeHref}>` back home. BEM class names match R09 FormField precedent. Replaced `packages/ui/src/Pages/index.ts`'s `export {};` placeholder with the `NotFound` re-export pair.
- Phase 2 — created `packages/ui/src/Pages/NotFound/__tests__/NotFound.test.tsx` with 3 happy-dom cases:
  1. Defaults: title + message + link text + link href resolve.
  2. Override every prop: title="404", message="Nope", homeHref="/dashboard", homeLabel="Dashboard" — all render.
  3. Smoke: typeof NotFound === 'function'.

  Tests wrap renders in `<MemoryRouter>` (required for `<Link>` resolution) and use the container-scoped `linkIn(container)` helper inherited from Round_09's pattern to avoid happy-dom's cross-file `document.body` leakage.

- Phase 3 — replaced the `// import { } from '@mdd/ui/Pages';   // empty in R01, populated in R03` placeholder in [packages/ui/README.md](../../README.md) with a real `import { NotFound } from '@mdd/ui/Pages';` line. Added a `## NotFound (R10)` section with the prop list, a `<Route path="*">` example, and the four BEM-style class names consumers can style.

## Check

- [x] `pnpm --filter @mdd/ui type-check` — green.
- [x] `pnpm --filter @mdd/ui test` — 9 files, 26 tests pass (3 new NotFound + 23 existing). Duration 6.94s.
- [x] `pnpm --filter builder type-check` — unchanged baseline (pre-existing errors in `useSavedQueries.ts` / `useWorkspace.ts` / `appConfig.ts` / test files persist).
- [x] `pnpm md:lint` — 0 errors.
- [x] Critical-security: only `packages/ui/**` + this round file touched. No new entry under `"dependencies"`. No `child_process`/`eval`/`vm` imports.

## Act

**Learnings**:

- **Container-scoped query pattern carried cleanly from R09.** The `linkIn(container)` helper is a thin equivalent of FormField's `alertIn(container)`. Whenever a future test needs to find an element by role or by selector, scope it to the test's render container, not `document.body`. Documenting this twice across two round files (R09 + R10) suggests it should be promoted — a meta round candidate (e.g. ship a small `packages/ui/src/test-utils/index.ts` that exports `inContainer(role)` / a shared vitest setup file that resets `document.body` between tests).
- **`<MemoryRouter>` wrap is required** because `<Link>` throws outside a router context. The test file's first comment block flags this so the next author drops in `BrowserRouter` only if they actually want URL-history side effects.
- **R10 closes the packages-ui master plan.** The full-feature surface (themeTokens, types, constants, Utils, Icons, Contexts, Providers, Pages/NotFound, Components/MasterLayout|Sidebar|SidebarMenu|PageCard|PageHeader|Button|Modal|FormField) is now present. Plan's per-round delivery table: ✅ R01–R10 all populated (R06 redirected to bugfix; the originally-planned R06 row was split into R07–R10).
- **Write-tool guard caught a stale-Read attempt** when re-writing `Pages/index.ts`. Honored the [[write-tool-discipline]] memory: read first, then Edit. Captured as a successful guard hit.

**Follow-ups (not absorbed)**:

- **Builder consumer adoption of the package surface** is the natural next round chain — Button/Modal/FormField/NotFound migrations in `apps/builder`. Each can be a single-feature round per [[round-cadence]].
- **Three remaining apps/builder typecheck regressions** (`useSavedQueries`, `useWorkspace`, `appConfig`, test files) — open bugfix candidates per `state.json.openObservations.builderTypecheckPreExistingRegression` follow-ups.
- **Test-infra refactor candidate**: extract the container-scoped query helpers to a shared place; consider an `afterEach` hook to reset `document.body` between tests so `queryByRole` works as advertised. Meta-round candidate, not pressing.

## Questions for user before next round

1. **Class-name prefix `mdd-ui-not-found-*`** (BEM) — confirm or override. Matches the FormField precedent from R09.
2. **R07–R10 chain closes the master plan**. Confirm the next round goes back to `apps/builder` product work (e.g. the 3 remaining typecheck regressions in `useSavedQueries`/`useWorkspace`/`appConfig`), or starts builder-side migration of the new package surface (Button/Modal/FormField/NotFound consumer adoption)?
3. **No bundled CSS** — same render-only philosophy as Button/Modal/FormField. Consumer ships its own `.mdd-ui-not-found` styles. Confirm.
