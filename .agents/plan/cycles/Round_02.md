# Round 02: `@mdd/ui` skeleton — UI/BIZ boundary, build-first

**Status**: Complete
**Date started**: 2026-05-22
**Date completed**: 2026-05-22

## Goal

**Inherits from ← [Round_01](Round_01.md)** — workspace pattern
(`workspace/<apps|packages>/<name>/`), per-package tooling discipline
(own config + lockfile + scripts), verification-habit-per-round, and
the build-first restraint (smallest thing that proves the boundary).

Scaffold the `@mdd/ui` workspace package at
`workspace/packages/ui/` as an empty, source-only React + antd
"look-and-feel" library. Day-1 deliverables are intentionally
**conceptual scaffolding** — the boundary itself, not its contents.

The goal is to make the UI-vs-BIZ split a physical, import-path-enforced
rule **before any builder code exists**, so every component built in
Round_03+ has to choose a side at creation time.

_Track: 1 (product). Pulled by: drifted-iteration lesson — `@mdd/ui`
came in too late, after UI and BIZ were already entangled, and the
product became "good idea, hard to use." See
[.agents/memory/2026-05-22-ui-boundary-build-first.md](../../memory/2026-05-22-ui-boundary-build-first.md)
for the full diagnosis._

## What is IN scope (the three ✅ items)

- `themeTokens.ts` — antd theme tokens (colors, spacing, radii, fonts).
- `Providers/AntdConfig.tsx` — antd `ConfigProvider` wired to the
  tokens; the single bootstrap point any consumer wraps its tree with.
- Re-export shells: `Components/index.ts`, `Icons/index.ts`,
  `Utils/index.ts` — empty `export {}` files that establish the import
  paths consumers will use. Empty by design.

## What is OUT of scope (explicit deferrals)

- Layout primitives (PageShell, AppHeader, Sidebar) — defer to the
  first round that pulls them from a real builder need.
- Form wrappers, DataTable, FileUpload — these encode BIZ assumptions;
  they belong in `apps/builder/src/features/`, never here.
- `Pages/`, `Contexts/` from the drifted repo's exports — `Pages` is
  BIZ; `Contexts` is feature state. Both stay in the builder.
- Tailwind — antd 6 covers the look-and-feel surface; Tailwind not
  included this iteration.
- A build step / `dist/` — source-only exports (`./src/*.ts(x)`)
  consumed via Vite TS. No bundler config in `@mdd/ui`.
- `react-router-dom`, `@tanstack/react-query`, `zod` as peer deps —
  these are BIZ; the drifted repo's `@mdd/ui` should not have had them.

## Plan

- [x] Create `workspace/packages/ui/package.json`:
  - `name: "@mdd/ui"`, `private: true`, `version: "0.0.0"`, `type:
"module"`.
  - Source-only `exports` map: `.`, `./Components`, `./Icons`,
    `./Utils`, `./Providers`, `./themeTokens` → all pointing at
    `./src/*.ts(x)`.
  - Peer deps: `react ^19`, `react-dom ^19`, `antd ^6`,
    `@ant-design/icons ^6`. **Nothing else.**
  - Dev deps: `typescript`, `vitest`, `@types/react`, `@types/react-dom`,
    `react`, `react-dom`, `antd`, `@ant-design/icons` (needed by
    type-check and the vitest snapshot test).
  - Scripts: `type-check` (`tsc --noEmit`), `test` (`vitest run`).
- [x] Create `workspace/packages/ui/tsconfig.json`
      (strict, `moduleResolution: "bundler"`, `jsx: "react-jsx"`,
      `target: "ES2022"`, no `outDir` — source-only).
- [x] Create `src/themeTokens.ts` — minimal but concrete antd
      `ThemeConfig` object (token + algorithm).
- [x] Create `src/Providers/AntdConfig.tsx` — `ConfigProvider`
      consuming `themeTokens` + an `AntdConfig` named export accepting
      `children`.
- [x] Create `src/Providers/index.ts` re-exporting `AntdConfig`.
- [x] Create `src/Components/index.ts`, `src/Icons/index.ts`,
      `src/Utils/index.ts` — each containing only `export {}` with a
      one-line comment explaining the shell intent.
- [x] Create `src/index.ts` — barrel re-exporting `themeTokens` +
      `AntdConfig`.
- [x] Create `tests/themeTokens.test.ts` — vitest snapshot of the
      `themeTokens` object to prove the import resolves and the shape is
      stable.
- [x] Create `workspace/packages/ui/README.md` with the
      one-paragraph **UI/BIZ governance rule** (what belongs here, what
      doesn't, one example of each).
- [x] Run `pnpm install` from root so pnpm picks up the new workspace
      package and links peer/dev deps.
- [x] Verify: `pnpm --filter @mdd/ui type-check` clean; `pnpm --filter
@mdd/ui test` passes (1 snapshot).

## Risks / unknowns

- **antd 6 peer-dep availability.** Drifted used `antd ^6.3.7`. Need
  to confirm the resolved version when pnpm installs. If 6.x is still
  alpha/RC at install time, may fall back to `^5` (the stable line)
  and revisit later. Will note the resolved version in Do.
- **`react ^19` is the target.** Drifted used React 19. If any
  dev-dep refuses 19 peers, fall back to ^18 with a note. Round_03
  will be the real consumer test.
- **No runtime exercise without a consumer.** Round*02 Check is
  type-check + snapshot, not a rendered UI. That's intentional per
  the scope discussion — the \_consumer* test is Round_03's job.

## Do

- Scaffolded `workspace/packages/ui/` with 11 files:
  `package.json`, `tsconfig.json`, `README.md`,
  `src/{index.ts, themeTokens.ts}`,
  `src/Providers/{AntdConfig.tsx, index.ts}`,
  `src/{Components, Icons, Utils}/index.ts` (empty shells with
  one-line boundary comments),
  `tests/themeTokens.test.ts`.
- `package.json` exports map: `.`, `./themeTokens`, `./Providers`,
  `./Components`, `./Icons`, `./Utils` — all source-only paths,
  no build step.
- Peer deps locked to **react/react-dom/antd/@ant-design/icons only**.
  No router, no query lib, no zod — these are BIZ.
- `pnpm install` from root added 117 packages (esbuild build-script
  warning ignored — not blocking).
- Resolved versions (no fallback needed):
  **antd 6.4.3** (stable 6.x line), **react 19.2.6**.
- Boundary governance written into `workspace/packages/ui/README.md`
  with positive example (`<AntdConfig>`) and negative example
  (`<CRMSourceUploader>` → builder, not here).
- Verified locally:
  - `pnpm --filter @mdd/ui type-check` → tsc clean, 0 errors.
  - `pnpm --filter @mdd/ui test` → 2/2 vitest passes, snapshot
    written for `themeTokens` shape.

## Check

- [x] `pnpm install` at repo root resolves with new workspace package
      registered (2 workspace projects, 117 new packages).
- [x] `pnpm --filter @mdd/ui type-check` → 0 errors.
- [x] `pnpm --filter @mdd/ui test` → 2/2 pass, snapshot written.
- [x] `npx markdownlint-cli2` repo-wide → 30 files, 0 errors.
- [x] Boundary discipline written down:
      [workspace/packages/ui/README.md](../../../workspace/packages/ui/README.md)
      includes the UI-vs-BIZ rule with `<AntdConfig>` (in scope) and
      `<CRMSourceUploader>` (out of scope) examples.

## Act

**Status**: Complete (human-approved 2026-05-22). Per
[governance.md](../../context/governance.md), only humans move a round
to Complete.

**Learnings**:

- **antd 6 + react 19 resolve cleanly** at this date (2026-05-22):
  `antd@6.4.3` and `react@19.2.6`, no fallback needed. The drifted
  repo's stack choice still holds for the new iteration.
- **Source-only exports work out of the box** with pnpm workspace +
  vitest + tsc — no build step, no compile cache. Validates the
  approach for any future `@mdd/*` packages.
- **Boundary governance lives best in the package's own README**, not
  in `.agents/context/`, because that's where consumers actually see
  it. Promotion to `context/` only makes sense if multiple packages
  need the same rule.
- The "scaffold-the-boundary-before-the-feature" pattern took ~30
  minutes from drafted plan to all-green Check. Cheap insurance
  against the drifted iteration's failure mode.

**Memories captured**: no new project memories this round — the
governance rule lives in
[workspace/packages/ui/README.md](../../../workspace/packages/ui/README.md)
itself, and the build-first lesson was already captured in
[2026-05-22-ui-boundary-build-first.md](../../memory/2026-05-22-ui-boundary-build-first.md)
during Round_01.

**Promotions** _(decision: none this round)_:

- → `context/` : not yet — the UI-vs-BIZ boundary rule should prove
  itself under Round_03's real builder use before promoting. Revisit
  in R03 Act.
- → `skills/` : none expected.

**Follow-ups (not promotions, just notes):**

- Track-2: when first cross-cutting tooling round happens, wire
  `pnpm md:lint` / `format` / per-filter scripts into root
  `package.json` (R01 follow-up still open).
- Track-2: husky pre-commit running `pnpm --filter @mdd/ui type-check`
  on staged `.ts(x)` files in `workspace/packages/ui/` — wait until
  someone forgets to type-check and breaks main.

## Feeds into → Round 03

What R02 hands to R03 (builder skeleton):

- **A workspace package to consume**, not just a folder. R03's
  builder will declare `"@mdd/ui": "workspace:*"` and import
  `{ AntdConfig, themeTokens }` from the root export.
- **Theme baseline**: R03 doesn't need to redefine antd theme — wrap
  the app in `<AntdConfig>` and the look-and-feel is set.
- **A governance rule to test**: every component R03 creates must
  answer "UI primitive or BIZ feature?" The rule in
  `workspace/packages/ui/README.md` becomes the live decision aid.
  Expect a small `@mdd/ui` follow-up round if real consumption
  surfaces shape gaps in `themeTokens` or `AntdConfig`.
- **Workspace verification habit**: R03 inherits `type-check` +
  `test` scripts as the per-package check pattern.
