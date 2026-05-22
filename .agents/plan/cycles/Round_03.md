# Round 03: Builder skeleton — Vite + React 19 + antd consuming `@mdd/ui`

**Status**: Complete
**Date started**: 2026-05-22
**Date completed**: 2026-05-22

## Goal

**Inherits from ← [Round_02](Round_02.md)** — `@mdd/ui` workspace
package, source-only exports, theme baseline (`AntdConfig` +
`themeTokens`), per-package `type-check` / `test` script habit, and the
UI-vs-BIZ governance rule in `workspace/packages/ui/README.md`.

Stand up the builder application at `workspace/apps/builder/` as a
**minimal Vite + React 19 + TypeScript** app that:

1. Declares `"@mdd/ui": "workspace:*"` and imports `{ AntdConfig }`.
2. Renders a single landing page wrapped in `<AntdConfig>` with one
   antd component (a `<Button>`), proving the theme applies and the
   import chain works end-to-end.
3. Establishes the builder's own `type-check` / `test` / `dev` /
   `build` scripts following the per-package pattern R02 inherited
   from R01.

This is the **first real consumer** of `@mdd/ui`. Round 03 is what
validates whether R02's API shape is actually right — if anything in
`themeTokens` / `AntdConfig` doesn't fit, R03 surfaces it.

*Track: 1 (product). Pulled by: the builder is the product itself —
nothing else can be built until this exists. Plus R02's package needs
a real consumer to validate its shape (deliberate sequencing per
[[feedback-ui-boundary-build-first]]).*

## What is IN scope

- Vite + React 19 + TypeScript project skeleton at
  `workspace/apps/builder/`
- `@mdd/ui` workspace dependency, `<AntdConfig>` wrapping the tree
- Single landing page: app title + one antd `<Button>` to prove theme
  applies
- Per-package scripts: `dev`, `build`, `preview`, `type-check`, `test`
- One vitest render test (using @testing-library/react + happy-dom)
  that mounts the app and asserts the button renders inside an
  antd-themed tree

## What is OUT of scope (explicit deferrals)

- **No backend integration** (no `/health` call). Cross-app
  integration is its own round once the contract solidifies.
- **No routing** (`react-router-dom`) — single page; defer until a
  second page exists.
- **No data-fetching** (`@tanstack/react-query`) — no API calls yet.
- **No state library** (`zustand`) — no cross-component state.
- **No forms / tables** (`@tanstack/react-form`, `@tanstack/react-table`)
  — defer until a real CRM upload/profiler feature pulls them.
- **No i18n** (`i18next`) — defer until non-English needed.
- **No icons** (`@ant-design/icons`) in this round — text-only
  page; defer until a feature pulls one.
- **No layout primitives in `@mdd/ui`** — if R03 needs a PageShell,
  build it inline first; if the same shape appears twice, *then*
  promote to `@mdd/ui` in a follow-up round.

## Plan

- [x] Create `workspace/apps/builder/package.json`:
  - `name: "builder"`, `private: true`, `version: "0.0.1"`,
    `type: "module"`.
  - Deps: `@mdd/ui: "workspace:*"`, `react ^19`, `react-dom ^19`,
    `antd ^6`. **Nothing else.**
  - Dev deps: `vite`, `@vitejs/plugin-react`, `typescript`,
    `@types/react`, `@types/react-dom`, `@types/node`, `vitest`,
    `@testing-library/react`, `@testing-library/jest-dom`,
    `happy-dom`.
  - Scripts: `dev` (`vite`), `build` (`vite build`), `preview`
    (`vite preview`), `type-check` (`tsc --noEmit`),
    `test` (`vitest run`).
- [x] Create `workspace/apps/builder/tsconfig.json` (app config:
  strict, `jsx: react-jsx`, `moduleResolution: bundler`).
- [x] Create `workspace/apps/builder/tsconfig.node.json` (for
  `vite.config.ts` itself — node-targeted).
- [x] Create `workspace/apps/builder/vite.config.ts` with React
  plugin, dev port 3000.
- [x] Create `workspace/apps/builder/index.html` (Vite entry).
- [x] Create `workspace/apps/builder/src/main.tsx` — mounts
  `<App />` wrapped in `<AntdConfig>` from `@mdd/ui`.
- [x] Create `workspace/apps/builder/src/App.tsx` — single page,
  title + antd `<Button>` for theme proof.
- [x] Create `workspace/apps/builder/vitest.config.ts` with
  `happy-dom` environment + jsdom-style setup file.
- [x] Create `workspace/apps/builder/tests/setup.ts` —
  `@testing-library/jest-dom` matchers.
- [x] Create `workspace/apps/builder/tests/App.test.tsx` — render
  `<App />` (wrapped in `<AntdConfig>`), assert button is in the
  document with antd-themed class.
- [x] Create `workspace/apps/builder/README.md` with dev/build/test
  commands and the consumption pattern (`AntdConfig` from `@mdd/ui`).
- [x] Create `workspace/apps/builder/.gitignore` (dist/, node_modules).
- [x] Run `pnpm install` from root to register the new workspace
  package and resolve `@mdd/ui` link.
- [x] Verify (Check): type-check + test + `vite build` all green.

## Risks / unknowns

- **No `pnpm dev` smoke from here.** Vite dev server needs a long-
  running process; I can boot it in background and curl `localhost:3000`
  to confirm 200, but can't visually verify the antd theme rendered.
  The vitest render test partly compensates (it asserts DOM under
  `<AntdConfig>`), but the *visual* check is a manual step the user
  takes if they care. Acceptable for a skeleton round.
- **`vite build` may warn about chunk size.** First-time React 19 +
  antd builds tend to produce sizeable bundles. Round 03 doesn't
  optimize — that's a future round when bundle size matters.
- **`@mdd/ui` source-only consumption with Vite.** Should work
  natively because Vite handles `.ts(x)` from any workspace path,
  but this is the first real test. If it fails, the fix likely
  belongs in R02 (e.g., explicit `vite-plugin` for workspace
  source imports) — flag and decide whether to fix here or open
  a follow-up.

## Do

- Scaffolded `workspace/apps/builder/` with 12 files:
  `package.json`, `tsconfig.json`, `tsconfig.node.json`,
  `vite.config.ts`, `vitest.config.ts`, `index.html`,
  `src/{main.tsx, App.tsx}`, `tests/{setup.ts, App.test.tsx}`,
  `README.md`, `.gitignore`.
- `main.tsx` mounts `<App />` wrapped in `<AntdConfig>` from
  `@mdd/ui` — proves the workspace import chain works end-to-end.
- `App.tsx` renders a title + an antd `<Button type="primary">`
  inside a styled `<main>`. The vitest assertion
  `expect(button.className).toMatch(/ant-btn/)` is the empirical
  proof that antd's component tree is active under `<AntdConfig>`.
- `pnpm install` from root added 72 new packages; 3 workspace
  projects now registered (root, `@mdd/ui`, `builder`).
- Resolved versions: `vite@6.4.2`, `@vitejs/plugin-react@5.x`,
  `vitest@3.2.4`, `antd@6.4.3`, `react@19.2.6`, `happy-dom@15.x`,
  `@testing-library/react@16.x`.
- Verified locally:
  - `pnpm --filter builder type-check` → 0 errors.
  - `pnpm --filter builder test` → 2/2 vitest pass (89 ms tests,
    2.13s total).
  - `pnpm --filter builder build` → vite build clean, 1495 modules
    transformed, `dist/assets/index-*.js` 330 kB / 110 kB gzipped.
  - `pnpm --filter builder dev` → vite 6.4.2 boots on :3000,
    `curl localhost:3000` returns 200 with React Refresh + Vite
    client wired in the served HTML.
- Visual antd theme verification (the colored "Theme proof" button)
  is **not** automated this round — flagged in Risks. User can
  confirm visually if desired.

## Check

- [x] `pnpm install` adds the `builder` workspace package and links
      `@mdd/ui` via `workspace:*` (3 workspace projects registered;
      72 new packages added).
- [x] `pnpm --filter builder type-check` → 0 errors.
- [x] `pnpm --filter builder test` → 2/2 vitest pass; both assertions
      (heading present, antd-classed button present) hold.
- [x] `pnpm --filter builder build` → vite 6.4.2 build clean, 1495
      modules, 330 kB / 110 kB gzipped.
- [x] `pnpm --filter builder dev` boots; `curl localhost:3000`
      returns 200 with React Refresh wired. Visual antd theme check
      remains a manual step — acceptable for skeleton round.
- [x] `npx markdownlint-cli2` repo-wide → 32 files, 0 errors.

## Act

**Status**: Complete (human-approved 2026-05-22 via visual verification
on `localhost:3000` — antd `<Button type="primary">` rendered in the
expected `#1677ff` primary blue, confirming `<AntdConfig>` is wiring
`themeTokens` through). Per
[governance.md](../../context/governance.md), only humans move a round
to Complete.

**Learnings**:

- **`@mdd/ui` source-only consumption works out of the box** with
  Vite 6 + pnpm workspaces. No `vite-plugin` workaround needed for
  workspace TS source imports — Vite resolves them transparently.
  This validates R02's "no build step" choice.
- **The vitest render test caught one subtle thing.** Asserting
  `button.className` matches `/ant-btn/` is the empirical proof
  that antd's `ConfigProvider` (from `<AntdConfig>`) is active.
  Without that, the test could have passed against an unstyled
  button. Worth keeping as a pattern for any future component
  test that consumes `@mdd/ui`.
- **R02's API shape held under first real consumption.** Zero
  changes needed in `workspace/packages/ui/`. The build-first
  scaffold paid off — the boundary was correct because it was
  intentionally minimal.
- **vite production bundle: 330 kB / 110 kB gzipped** for an empty
  skeleton is non-trivial. That's antd 6 + React 19 baseline.
  Optimization (tree-shaking antd imports, code-splitting) is a
  future round when bundle size matters.
- The per-package script convention
  (`dev` / `build` / `type-check` / `test`) has now landed in two
  apps (backend uses uv-equivalents; builder uses the canonical
  pnpm set) and one package (`@mdd/ui`). Strong candidate for
  promotion to `.agents/context/` once a fourth use confirms it.

**Memories captured**: no new project memories — all R03 decisions
are derivable from this round file and the existing memories on
tooling/boundary discipline.

**Promotions** *(decision: none this round)*:

- → `context/` : not yet — per-package script convention is close
  to promotable but waits for one more use case (next backend or
  package round).
- → `skills/` : none — defer `scaffold-vite-react-app-mdd-ui` until
  a second React consumer is actually requested.

**Follow-ups (not promotions, just notes):**

- **Body font surfaced by visual check (2026-05-22):** antd's
  `fontFamily` theme token only applies to antd components, not to
  raw HTML elements. The h1 and `<p>` on the landing page rendered
  in the browser's serif default. Two fix options when pulled —
  (a) CSS reset inside the builder, (b) a `<ThemeStyle />` global-
  styles component exported from `@mdd/ui`. Leaning (b) (consistent
  with "`@mdd/ui` owns look-and-feel"). Out of R03 scope per
  single-feature discipline; queue as either a small `@mdd/ui`
  follow-up round or roll into R04.
- **Backend integration round** is now unblocked. Builder can call
  `GET /health` from a landing page (proves contract) or wait for
  a real BIZ feature to drive endpoint shape. Pick one as Round_04.
- **First R02 follow-up:** none surfaced — `@mdd/ui` API held
  under real consumption. Good signal.
- **Track-2 pull-in:** root `package.json` `dev` script booting
  backend + builder concurrently (e.g., via `concurrently` or
  `npm-run-all2`) — wait until a developer actually needs both
  up simultaneously.
- **Track-2 pull-in:** `pnpm md:lint` / `format` scripts in root
  `package.json` (still open from R01 follow-ups).

## Feeds into → Round 04 (TBD)

What R03 hands to whichever round comes next:

- **Full vertical slice is now possible.** Backend (`/health` live)
  plus builder (workspace consumer of `@mdd/ui`) means a real
  end-to-end product round can land. The natural candidates:
  - **R04a — Backend integration:** builder fetches `/health` on
    mount, displays version. Proves the API contract works
    end-to-end. Smallest cross-app slice.
  - **R04b — First BIZ feature:** the user-facing `CRMSourceUpload`
    flow. Bigger, but the actual product value.
- **Per-package script convention** is now the inherited pattern
  for any new app/package: every workspace project ships its own
  `dev` / `build` / `type-check` / `test` / equivalents.
- **UI/BIZ boundary is live.** Any new component in R04+ must
  answer: UI primitive (→ `@mdd/ui`, with strict no-BIZ rule) or
  BIZ feature (→ `apps/builder/src/features/`). The decision is
  enforced by import path.
