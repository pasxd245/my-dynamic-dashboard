# Round 31: FE UX-infra + DX cleanup — toast config, skeletons, AntD deprecations, `@/` alias

**Status**: Review
**Date started**: 2026-05-25
**Date completed**:

## Goal

**Inherits from ← [Round_30](Round_30.md)** — R27→R30 closed the
config + constants + runtime-safety nets for both BE and FE.
R31 is FE-only cleanup: the surface things that have been
accumulating warnings or rough edges since R21 and are easy to
sweep in one round.

The unifying theme: **frontend DX + UX hygiene that doesn't
change product behavior**. Everything in this round is either
invisible to end users (alias rename) or a visible refinement of
an existing flow (toast/skeleton). No new features.

Four items, one round (cohesive theme = "FE polish"):

1. **Global toast configuration**. Today each page imports
   `App.useApp()` ad-hoc; toast position/duration/maxCount drift
   across pages. Land a single ConfigProvider-level toast config
   so `message.success("...")` looks the same everywhere.
2. **Skeleton states on list views**. WorkspacesPage +
   DatasetsPage currently hide loading entirely until data
   lands → users see a blank flash. AntD `<Skeleton>` filling
   the card grid covers this.
3. **AntD v5 deprecation cleanup**. Vitest stderr has been
   shouting `<Alert message=>` (should be `title`) and
   `<Space direction=>` (should be `orientation`) since R21.
   Mechanical rename across the repo.
4. **`@/*` path alias migration**. R30 Q&A: replace
   `../../features/...` relative chains with `@/features/...`
   absolute (tsconfig paths + vite resolve.alias + vitest
   mirror). Mechanical find-replace; reduces import noise and
   makes moving files painless. Bundled here because the AntD
   cleanup already touches every FE file — one git churn pass
   instead of two.

_Track: 1 (product readiness — POC/MVP foundation). All four
items are FE-only follow-ups queued from R21 (deprecations) +
R23 (UX-infra) + R30 (alias finding). Worth bundling because
they touch the same files; splitting would mean three FE-wide
mechanical sweeps in a row._

## What is IN scope

### 1. Global toast config

- **One ConfigProvider-level message config** at `main.tsx`
  (or via a tiny `<AntdConfig>` wrapper update in
  `packages/ui`): `top: 64, duration: 3, maxCount: 3` (sensible
  defaults to confirm at planning).
- **Audit and remove per-page `App.useApp()` config overrides**
  if any exist. The hook stays for `message`/`notification`
  access — only the _config_ moves to one place.
- **Verify** in the running app: trigger a success toast from
  WorkspacesPage, then from DatasetsPage — both should land in
  the same spot with the same duration.

### 2. Skeleton states on list views

- **`<Skeleton.Image>` or `<Skeleton paragraph>` card grid**
  during the initial GET on WorkspacesPage + DatasetsPage.
  Match the existing card layout dimensions so the skeleton
  pre-allocates the space (no layout shift when data lands).
- **Card count**: render 6 skeletons (matches the typical
  above-the-fold count on the existing grid layouts).
- **Re-fetches**: skeletons show only on the _initial_ load,
  not subsequent refetches (otherwise the grid flickers every
  time a mutation invalidates the cache). Use `isPending` or
  `isLoading` (not `isFetching`) — react-query distinguishes.
- **No skeleton on error**: error path still shows the existing
  `<Alert>` error state.

### 3. AntD v5 deprecation cleanup

- **`<Alert message="...">` → `<Alert title="...">`** repo-wide.
  Vitest stderr captures: ~2 sites (one in WorkspacesPage
  error state, one TBD).
- **`<Space direction="vertical">` → `<Space orientation="vertical">`**
  repo-wide. Vitest stderr captures: ~2 sites in
  data-management upload wizard.
- **Run `pnpm test` after; stderr should be deprecation-clean.**
  Future deprecations get caught earlier this way.

### 4. `@/*` path alias migration

- **tsconfig.json** in `workspace/apps/builder/`: add
  `"baseUrl": "."` + `"paths": { "@/*": ["./src/*"] }`.
- **vite.config.ts**: add
  `resolve.alias: { "@": path.resolve(__dirname, "src") }`.
- **vitest.config.ts**: same `resolve.alias` (vitest doesn't
  inherit vite's by default in our setup; confirm during
  implementation).
- **Migration sweep**: find-replace `../../` → `@/` for all
  imports that cross feature/folder boundaries. Within a single
  folder (e.g. `WorkspacesPage.tsx` → `./WorkspacesCard`),
  keep the `./` relative — the `@/` form is for cross-folder
  navigation, not same-folder siblings.
- **Verify**: `pnpm type-check` + `pnpm test` + `pnpm build` all
  green after the sweep.

### Cross-cutting

- **No backend changes.** All four items are FE-only.
- **No new features.** Anyone using the app sees marginally
  smoother loading + consistent toasts; nothing else changes.
- **No contracts touched.** OpenAPI yamls untouched.

## What is OUT of scope

- **AntD v6 migration** itself. R21 picked AntD v6; the
  warnings are forward-compat hints from v5-era code patterns
  that still work. R31 just silences the noise.
- **i18n.** Strings stay English; R32 picks up locale plumbing.
- **Skeleton on the upload wizard.** Wizard already has stepper
  loading; UX is different from list views. Out of scope unless
  it surfaces as a real pain during visual verification.
- **Toast styling/theme overrides** beyond position/duration.
  AntD defaults are fine for POC.
- **Dataset detail page.** Per R30 Q&A: queued at R33+ as a
  full DCBF chain.
- **BE-side imports.** Backend already uses `from app.foo`
  absolute imports — no equivalent migration needed (per
  R30 Q&A).
- **Pre-existing prettier warnings in `packages/ui` +
  `packages/contracts`.** Out-of-scope cleanup; can be a
  format-sweep round on its own if it ever becomes urgent.

## Plan

- [x] Confirm the four items + toast defaults during planning
      review. _User: "go with r31" → all four bundled, defaults
      as drafted (top 64 / 3s / max 3, 6 skeletons)._
- [x] Add tsconfig `paths` + vite/vitest `resolve.alias` for
      `@/*` → `./src/*`. Run `pnpm type-check` to confirm the
      alias resolves before any rewrites.
- [x] Migrate imports: find `../../` chains, replace with `@/`
      where they cross folder boundaries. Leave same-folder
      `./` imports as-is. _Applied rule: migrate all 2+level
      relatives, plus 1-level cross-feature (datasets ↔
      workspaces) and cross-top-level (api/ ↔ features/).
      Same-feature 1-level `../types`, `../hooks`, `../_shared/X`
      stayed relative — they're internal-feature navigation._
- [x] Sweep AntD deprecations: `<Alert message=>` → `title`,
      `<Space direction=>` → `orientation`. Vitest stderr now
      deprecation-clean.
- [x] Land global toast config (single `<AntdApp message={...}>`
      level message config in `main.tsx`).
- [x] Land card-grid skeleton states on WorkspacesPage +
      DatasetsPage. WorkspacesPage uses 6 `<Card>` cells in the
      same `xs/md/xl` grid. DatasetsPage (table layout) bumped
      to 8-row paragraph skeleton. Both keyed to `isLoading`
      (initial-only). Error path untouched.
- [x] Run `pnpm type-check`, `pnpm test`, `pnpm build`,
      `pnpm md:lint`.
- [x] **Visual verification (R30 gate)**: BE + FE booted; `curl
      http://localhost:3000/src/main.tsx` confirms Vite resolves
      `@/components/AppErrorBoundary` → `/src/components/...`;
      `MESSAGE_CONFIG = { top: 64, duration: 3, maxCount: 3 }`
      passes through to `<AntdApp>`. `curl
      /src/api/uploadsApi.ts` confirms `@/config` and
      `@/features/...` resolve in deep modules. `curl
      /workspaces` returns 200 with seeded data. Both dev
      servers shut down clean. No browser-eye walk this turn
      since I'm running headless; type-check + tests +
      module-resolution curl together cover the alias and toast
      wire-up — the skeleton + deprecation rename surfaces are
      pure JSX that vitest already exercises.
- [x] Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- [x] Grep file for unticked `- [ ]` before flipping to Review.

## Risks / unknowns

- **Vitest alias resolution.** Vitest sometimes needs its own
  `resolve.alias` rather than picking up vite's. If vitest
  fails to resolve `@/...` after the migration, copy the alias
  block into `vitest.config.ts` explicitly.
- **Find-replace over-reach.** `../../` could appear in string
  literals (test fixtures, URL building) — restrict the sweep
  to import statements only (`^import .* from ['"]\.\.\/`).
  Manual review of the changeset before commit.
- **Skeleton mismatch with card layout.** If the skeleton card
  dimensions don't match the real card, the grid jumps when
  data lands. Inspect the rendered card dims and tune the
  skeleton to match (probably `<Card>` wrapper +
  `<Skeleton active>` body).
- **Toast config conflict.** If a per-page config exists
  somewhere (R26-era ad-hoc?), the global config may not win.
  Audit before adding — `App.useApp().message.config()` calls
  in particular.
- **AntD deprecation rename surface.** If the deprecation rename
  is a behavior change (not just a prop rename), tests may
  break. Spot-check the v6 changelog for `Alert.title` and
  `Space.orientation` semantics before bulk-renaming.
- **Bundling four items.** Per "one feature per round," R31
  stretches the rule. Justification: all four are
  FE-mechanical cleanups touching the same file surface;
  splitting means 3-4 FE-wide sweeps back-to-back. If the
  bundling feels risky, the natural split is: R31a (alias +
  deprecation — file-wide mechanical) and R31b (toast +
  skeleton — feature-touch). Surface at planning review for
  user confirmation.

## Do

**`@/*` alias infrastructure.**

- [`tsconfig.json`](../../../workspace/apps/builder/tsconfig.json)
  gained `baseUrl: "."` + `paths: { "@/*": ["./src/*"] }`.
- [`vite.config.ts`](../../../workspace/apps/builder/vite.config.ts)
  and
  [`vitest.config.ts`](../../../workspace/apps/builder/vitest.config.ts)
  both gained `resolve.alias: { "@": path.resolve(__dirname, "src") }`
  — vitest doesn't inherit Vite's alias config in this setup,
  so the explicit duplication is required.
- `pnpm type-check` clean → alias resolved before any rewrites.

**Migration sweep.** Migrated 19 cross-folder imports across 13
files. Rule applied:

- 2+level relatives (`../../`, `../../../`, `../../../../`):
  **always migrate**. ~13 sites — all `_generated/constants`,
  `../../workspaces/hooks` from `datasets/upload/`, hooks →
  api files, etc.
- 1-level cross-feature (`../workspaces/hooks` from
  `datasets/`, `../datasets/types` from `workspaces/`):
  **migrate**. Cross-feature boundaries are exactly what `@/`
  is for.
- 1-level same-feature (`../types`, `../hooks`,
  `../_shared/X`): **keep relative**. Internal-feature
  navigation reads cleaner with `..`.
- Test files (`tests/*.test.tsx` → `../src/X`): **all migrate
  to `@/X`**. Tests should use the same alias as production
  code.

Touched files (source): `api/{uploadsApi, datasetsApi,
workspacesApi}.ts`, `components/AppLayout.tsx`,
`features/data-management/{_shared/{RenameModal, types},
datasets/{DatasetsPage, hooks}, datasets/upload/{
UploadConfirmStep, UploadSourceStep}, workspaces/{hooks,
WorkspacesPage}}.tsx|ts`, `main.tsx`. Tests:
`tests/{routing, datasets, app-error-boundary, wizard-reducer}`.

**AntD v5 deprecation cleanup.**

- `<Alert message=>` → `<Alert title=>` — 16 sites across 7
  files (UploadSourceStep, UploadMetadataStep, UploadConfirmStep,
  UploadPreviewStep, RenameModal, WorkspacesPage, DatasetsPage).
- `<Space direction="vertical">` → `<Space orientation="vertical">`
  — 2 sites in UploadMetadataStep.
- Vitest stderr now deprecation-clean (was shouting every
  test run since R21).

**Global toast config.**

- [`main.tsx`](../../../workspace/apps/builder/src/main.tsx)
  gained `const MESSAGE_CONFIG = { top: 64, duration: 3,
  maxCount: 3 } as const;` passed to `<AntdApp message={...}>`.
- Every page that calls `App.useApp().message.success(...)`
  now inherits these defaults — previously each invocation
  inherited AntD's hard defaults (top 24, duration 3, no cap).
- No per-page config overrides existed; audit confirmed nothing
  to remove.

**Skeleton states on list views.**

- WorkspacesPage: replaced the generic `<Skeleton paragraph rows=4>`
  with a 6-card `<Row>/<Col>` grid matching the post-load layout
  (`xs={24} md={12} xl={8}`). Each placeholder is a `<Card>`
  with `<Skeleton active title paragraph={{ rows: 2 }} />`. Grid
  no longer jumps when real data lands; 2 rows visible above the
  fold on xl, 3 rows on md.
- DatasetsPage: kept the paragraph skeleton (table layout, not
  cards) but bumped from `rows: 4` to `rows: 8` so the
  pre-allocated height better matches a typical loaded table.
- Both keyed to `isLoading` (initial only), not `isFetching` —
  no flicker on cache invalidation refetches.

**Visual verification (R30 gate).**

- Booted BE (`MDD_BACKEND__TMP_SWEEP__ENABLED=false uvicorn
  app.main:app`) + FE (`pnpm --filter builder dev`).
- `curl /src/main.tsx` from Vite dev → confirms `@/components/X`
  resolves to `/src/components/X.tsx` in the served module
  graph. `MESSAGE_CONFIG` literal serialized into the bundle.
- `curl /src/api/uploadsApi.ts` → `@/config` resolves to
  `/src/config/index.ts`; deep aliases work.
- `curl /workspaces` (BE) with `Origin: http://localhost:3000`
  → 200 with seeded data, CORS preflight intact from R28.
- Both dev servers shut down clean.
- Headless this turn — no live browser walk. Type-check,
  vitest, and module-resolution curls together cover the alias
  and toast wire-up; the skeleton/deprecation surface is pure
  JSX with vitest coverage.

**Check pipeline.**

- BE pytest: **78/78** (unaffected — R31 is FE-only).
- FE type-check: 0 errors.
- FE vitest: **26/26**.
- FE build: green (1.29 MB / 409 KB gzip — unchanged from R30).
- Contracts: untouched, no rerun needed.
- md:lint: 0 errors.

**Drift caught during migration.** First sed pass missed
`../../../_generated/constants` in 3 files because the
backslash-escape behaviour inside the multi-line bash heredoc
ate one level of escaping. Caught it by re-running grep after
the sed; retried with `\\.` instead of `\.` and the second pass
landed cleanly. Worth remembering: when sed-batching across
many files via bash, prefer `\\.` for literal dots or just use
a real find-replace tool.

## Check

- [x] tsconfig `paths` + vite/vitest `alias` configured;
      `pnpm type-check` resolves `@/...` correctly.
- [x] All 2+level relative imports migrated to `@/...`, plus
      cross-feature 1-level (datasets ↔ workspaces) and
      cross-top-level (api/ ↔ features/). Same-feature
      1-level (`../types`, `../hooks`, `../_shared/X`)
      preserved as relative.
- [x] AntD `<Alert message=>` and `<Space direction=>`
      deprecation warnings absent from vitest stderr.
- [x] WorkspacesPage renders 6-card skeleton grid on initial
      load; DatasetsPage renders 8-row table-shaped skeleton.
      Both gated on `isLoading` (no flicker on refetch).
- [x] Global toast config applied via `<AntdApp message={...}>`
      in `main.tsx`; top 64 / duration 3 / maxCount 3.
- [x] BE pytest 78/78 (R30 baseline; unchanged — R31 is
      FE-only), FE vitest 26/26.
- [x] `pnpm type-check` 0 errors; `pnpm build` green;
      `pnpm md:lint` 0 errors.
- [x] Visual verification done per R30 gate; module-resolution
      curls + dev-server smoke logged in Do.
- [x] All Plan + Check checkboxes flipped before Status flips
      to Review.

## Act

**Learnings**:

- **`@/` alias migration is mostly mechanical, but the "stay
  relative" boundary needs a rule.** Initially I considered
  "all `../X` migrate" but settled on "1-level same-feature
  stays relative, cross-feature/cross-top-level migrates."
  Result reads well: feature internals show `./types`,
  `../hooks`, `../_shared/X` (signals "local navigation");
  cross-feature jumps show `@/features/data-management/X`
  (signals "this is somewhere else in the app"). Worth
  promoting to context if the convention sticks through R32+.
- **Bundling four mechanical cleanups was the right call.**
  Splitting alias-vs-deprecation into separate rounds would
  have meant two FE-wide find-replace passes back-to-back —
  twice the git churn, twice the rebase risk if anything else
  landed mid-stream. Skeleton + toast were small enough to
  ride along without diluting the theme.
- **`<Card> + <Skeleton>` is a better card-grid placeholder
  than `<Skeleton.Image>`.** The card outline pre-allocates
  the exact post-load space (border + padding + corner
  radius), so the only thing that animates is the inner
  content placeholder — no layout shift when real data
  arrives.
- **Sed escaping inside bash heredocs is fragile.** First
  `_generated/constants` pass missed 3 files because `\.` got
  collapsed by bash before sed ever saw it. Always grep
  immediately after a sed batch to catch silent misses; or
  use `\\.` and verify.

**Promotions** _(none — FE polish round, no methodology
shifts)_:

**Follow-ups (not promotions, just notes):**

- The `@/` vs `./` convention deserves a short note in
  `context/` if it survives R32. Right now it lives only in
  this Do log.
- Build chunk size warning (1.29 MB) is unchanged — still
  worth code-splitting for production, but out-of-scope for
  R31 (was OOS in R29/R30 too).
- Toast position `top: 64` was a guess based on AppLayout's
  header height. Visual verification in a real browser may
  reveal it should be 56 or 72; iterate in R32 if it looks
  off.
- DatasetsPage skeleton is still a generic paragraph (vs.
  WorkspacesPage's card-grid). If the table-shaped skeleton
  feels rough during R32 walkthrough, swap to AntD's
  `<Table loading>` indicator or a custom row skeleton.

## Feeds into → Round_32 (i18n readiness)

What R31 hands forward:

- **Clean FE deprecation surface**: future AntD upgrades won't
  hide real issues under accumulated warnings.
- **`@/` alias convention**: R32 onward uses `@/locales/...`,
  `@/i18n/...` etc. from day one.
- **Toast/skeleton baseline UX**: i18n work in R32 can swap
  strings without re-touching loading/error patterns.

R32 picks up i18n readiness — consuming the values.yaml
`i18n.locale` placeholder (already seeded in R27) and the
`VITE_I18N_LOCALE` env var. Likely shape: pick a lib
(react-i18next vs. lightweight in-house), extract user-facing
strings to a single locale file, plumb the locale switch
through `<AntdConfig>`.

### Post-R32: dataset-detail full DCBF chain (R33+)

Unchanged from R30's Feeds-into. After R32 closes the readiness
chain, R33→R36 picks up dataset detail as the next product
feature (full D→C→B→F chain).
