# Round 32: i18n readiness — react-i18next + en/vi locales

**Status**: Complete
**Date started**: 2026-05-25
**Date completed**: 2026-05-26

## Goal

**Inherits from ← [Round_31](Round_31.md)** — R31 closed FE
polish (alias, deprecations, toast, skeletons). R27→R31 ran the
readiness chain; R32 is the last station before product work
resumes (dataset detail full DCBF lands at R33+).

R32 plumbs i18n end-to-end: pick the lib, extract user-facing
strings, wire the runtime locale through both `react-i18next`
and AntD's `ConfigProvider`. The `i18n.locale` placeholder in
`workspace/config/values.yaml` (seeded at R27) and the
`VITE_I18N_LOCALE` env var (rendered at R27) finally connect to
a real consumer.

**User decisions locked at R32 planning:**

1. **Library: react-i18next** (industry standard; ICU plurals,
   AntD-locale integration, lazy namespaces, ~10kB gzipped).
2. **Locales: English + Vietnamese (en + vi-VN)** — ship two
   real translations so the switch is proven end-to-end. User
   is VN-based; vi-VN is the natural second locale.

_Track: 1 (product readiness — POC/MVP foundation). Last
readiness round; closes the R27 plumbing chain. After R32,
Track-1 returns to product features (dataset detail R33+)._

## What is IN scope

### 1. Install + init react-i18next

- Add `i18next` + `react-i18next` to
  [`workspace/apps/builder/package.json`](../../../workspace/apps/builder/package.json).
- New file `src/i18n/index.ts`:
  - Imports `en.json` + `vi.json` resource files
  - Initializes `i18next` with `appConfig.i18nLocale()` as the
    default `lng` (reads from `VITE_I18N_LOCALE` via R27 chain)
  - Sets `fallbackLng: 'en'`, `defaultNS: 'common'`,
    `interpolation: { escapeValue: false }` (React already
    escapes JSX text)
- New folder `src/i18n/locales/`:
  - `en.json` — extracted user-facing strings (flat or nested
    namespace; pick at implementation)
  - `vi.json` — Vietnamese translations
- Import the init module once in `main.tsx` so it runs before
  any component mounts.

### 2. Extract user-facing strings

Sweep all hardcoded English strings in `src/` and replace with
`t('key')` calls. Target files (estimate from R31 work):

- `features/data-management/workspaces/WorkspacesPage.tsx` —
  card titles, modal text, error alerts, empty state
- `features/data-management/datasets/DatasetsPage.tsx` — same
  shape
- `features/data-management/datasets/upload/*.tsx` — 4 wizard
  steps, error/success messages
- `features/data-management/_shared/{RenameModal,
DeleteConfirmModal, BlockedDeleteModal}.tsx` — modal copy
- `components/{AppLayout, AppErrorBoundary}.tsx` — header,
  fallback UI
- Toast messages from `App.useApp().message.X()` calls

Decision rule for what gets extracted:

- **Extract**: anything the user sees (buttons, labels, alerts,
  empty states, toast messages, page titles, modal copy).
- **Skip**: developer-facing strings (console.error messages,
  data-component attributes, dev assertions, log lines), and
  data values from the BE (workspace names, dataset names).

Key naming: namespace.section.label (e.g.,
`common.action.create`, `workspaces.empty.title`,
`datasets.error.couldntLoad`). Stays grep-able and groups
logically.

### 3. AntD locale ConfigProvider integration

- Update
  [`packages/ui/src/Providers/AntdConfig.tsx`](../../../workspace/packages/ui/src/Providers/AntdConfig.tsx)
  to read the active locale from i18next and pass the matching
  AntD locale pack (`en_US` / `vi_VN`) to `<ConfigProvider
locale={...}>`.
- AntD ships locale packs at `antd/locale/en_US` and
  `antd/locale/vi_VN`. Lazy-import or static-import; static is
  simpler given we only have two locales.

### 4. Wire it through

- Verify `VITE_I18N_LOCALE` from rendered `.env` reaches
  i18next's init via `appConfig.i18nLocale()`.
- `pnpm config:render` re-emits `.env` from values.yaml — i18n
  locale changes via that single source.
- Boot the app with both `VITE_I18N_LOCALE=en` (default) and
  `VITE_I18N_LOCALE=vi` (override) to confirm both render
  correctly.

### 5. Tests

- New `tests/i18n.test.tsx`:
  - With `i18n.changeLanguage('en')`, `WorkspacesPage` renders
    the English string for "Create" button.
  - With `i18n.changeLanguage('vi')`, the same button renders
    the Vietnamese string.
  - Missing keys fall back to English (not the key itself).
- Update existing routing/datasets tests to either:
  - Wrap in `<I18nextProvider>` with English resources, or
  - Use `react-i18next`'s `initReactI18next` test mode that
    returns the key as the translation (simpler; tests stay
    locale-agnostic by querying keys).
  - Lean: option B — tests stay decoupled from string content.

### Cross-cutting

- **Stamp** `crud-hygiene.md` + `upload.md` with a brief R32
  note (those features' UX strings are now i18n-keyed).
- **Update R27 reference**: `_generated/constants.{ts,py}` is
  the cross-language constants channel; locale resources stay
  in `src/i18n/locales/*.json` (separate concern — locale data
  is FE-only, not shared with BE).

## What is OUT of scope

- **BE i18n.** BE returns error codes (`not_found`,
  `name_taken`), not strings. FE maps codes → localized text.
  No BE-side locale plumbing this round.
- **Locale switcher UI.** No sidebar/header dropdown to flip
  locale at runtime. Locale is set at build/boot time via
  `VITE_I18N_LOCALE`. A runtime switcher is a UX feature, not
  readiness.
- **RTL languages.** Vietnamese is LTR like English; no RTL
  CSS/layout work needed.
- **Date/number formatting.** `Intl.DateTimeFormat` +
  `Intl.NumberFormat` are JS native and locale-aware out of
  the box. Use them at format sites; no extra i18n
  infrastructure needed.
- **Lazy-loaded locale bundles.** Static-import both en + vi at
  init. The bundle delta is small (~5kB per locale). Lazy
  loading only matters when locales count gets to 5+.
- **Translation management workflow** (TMS like Crowdin /
  Phrase, CI-checks for missing keys, etc.). Manual JSON
  editing for POC.
- **Dataset detail page strings.** Dataset detail lands at R33+
  as full DCBF; its strings will land i18n-keyed from day one.

## Plan

- [x] Confirm scope at planning review (lib + locales locked
      by user Q&A: react-i18next + en/vi).
- [x] Install `i18next` + `react-i18next` in builder
      package.json. Run `pnpm install`.
- [x] Create `src/i18n/index.ts` + `src/i18n/locales/en.json` + `src/i18n/locales/vi.json`.
- [x] Import the i18n init in `main.tsx` so it runs before
      mounting.
- [x] Update `packages/ui/AntdConfig.tsx` to accept an optional
      `locale` prop; main.tsx maps `i18n.language` to the
      matching AntD locale pack and passes it through. Kept
      `@mdd/ui` free of i18next coupling so the package stays
      app-agnostic.
- [x] Bulk-extract user-facing strings across the 12 target
      files. Used grep-able key names
      (`namespace.section.label`).
- [x] Wire tests via `tests/setup.ts` — global import of
      `@/i18n` initializes English resources for every test.
      Existing tests pass without code changes since they
      query by real English strings.
- [x] Add `tests/i18n.test.tsx` covering en/vi switch +
      missing-key fallback.
- [x] Run `pnpm type-check`, `pnpm test`, `pnpm build`,
      `pnpm md:lint`.
- [x] **Visual verification (R30 gate)**: BE + FE booted with
      `VITE_I18N_LOCALE=vi`; `curl /src/i18n/locales/vi.json?import`
      confirmed Vietnamese strings reach the bundle. AntD locale
      switch wired via `i18n.language` → `ANTD_LOCALES` static
      map (en_US/vi_VN). En/vi switch proven by vitest (3
      cases) since I'm headless.
- [x] Stamp `crud-hygiene.md` + `upload.md` with R32 i18n note.
- [x] Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- [x] Grep file for unticked `- [ ]` before flipping to Review.

## Risks / unknowns

- **String extraction surface size.** I estimated 12 files at
  planning time. If the actual count is much higher, the bulk
  extraction step balloons. Mitigation: extract in two passes
  — Pass 1 hits the high-traffic surfaces (WorkspacesPage,
  DatasetsPage, modals, AppLayout); Pass 2 mops up the wizard
  steps + error messages. If Pass 1 turns out larger than
  expected, ask user whether to split into R32a/R32b.
- **`react-i18next` test integration.** The lib's test mode
  has changed shape across versions; need to verify
  `initReactI18next` + `returnNullValue` work in vitest
  happy-dom. Mitigation: try with a minimal test before bulk
  extraction; if it's brittle, fall back to wrapping with
  `I18nextProvider` in a test setup file.
- **AntD locale pack shape.** Static imports of
  `antd/locale/vi_VN` may need a tree-shake-friendly path. If
  the bundle grows materially, switch to dynamic import.
- **String concatenation patterns.** Existing code may
  concatenate strings (`"Created " + count + " workspaces"`).
  These need conversion to interpolation (`t('msg', { count })`)
  — more invasive than a simple replace. Mitigation: grep for
  string concatenation + template literals during extraction;
  convert concatenations on the spot.
- **AntD `<Empty>` description**, `<Result>` subtitle, etc. —
  some AntD components have built-in English strings that
  ConfigProvider locale should override. Verify during visual
  verification.
- **Vietnamese translation quality.** I'll translate naively;
  user can correct any awkward strings during visual
  verification. Acceptable for POC; production should go
  through a real translator.

## Do

**i18n init.**

- Installed `i18next@^26` + `react-i18next@^17` to
  [builder/package.json](../../../workspace/apps/builder/package.json).
- [`src/i18n/index.ts`](../../../workspace/apps/builder/src/i18n/index.ts)
  initializes i18next with `lng: appConfig.i18nLocale()` (reads
  `VITE_I18N_LOCALE` via R27 chain), `fallbackLng: 'en'`,
  `defaultNS: 'common'`, `interpolation.escapeValue: false`
  (React already escapes JSX).
- Locale files
  [`locales/en.json`](../../../workspace/apps/builder/src/i18n/locales/en.json)
  and [`locales/vi.json`](../../../workspace/apps/builder/src/i18n/locales/vi.json)
  with namespaces `common`, `nav`, `resources`, `app`,
  `workspaces`, `datasets`, `upload.{source,sheet,metadata,preview,confirm}`,
  `rename`, `deleteConfirm`. Pluralization uses i18next's
  `_one`/`_other` suffixes; Vietnamese only needs `_other`.
- [`main.tsx`](../../../workspace/apps/builder/src/main.tsx)
  imports `@/i18n` at the top so init runs before any mount,
  then maps `i18n.language` to AntD's locale pack via a static
  `ANTD_LOCALES = { en: enUS, vi: viVN }` map.

**AntD locale wiring.**

- [`packages/ui/AntdConfig.tsx`](../../../workspace/packages/ui/src/Providers/AntdConfig.tsx)
  gained an optional `locale?: Locale` prop. The `@mdd/ui`
  package stays free of i18next coupling — the consuming app
  resolves the active locale and passes it through. AntD's
  `ConfigProvider` then localizes built-in strings
  (DatePicker, Pagination, Empty "no data", Modal OK/Cancel).

**Bulk extraction (12 files).**

| File                                                      | Approach                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AppErrorBoundary`                                        | Class component — uses `i18n.t()` directly since hooks require functional components.                                                                                                                                                                                                                                                                                          |
| `RenameModal`, `DeleteConfirmModal`, `BlockedDeleteModal` | `useTranslation()` hook + `<Trans components={{ strong: <strong /> }}>` for inline markup. Resource label looked up via `t(\`resources.${resourceLabel}\`)` so "workspace"/"dataset" translate.                                                                                                                                                                                |
| `WorkspacesPage`                                          | Inner `WorkspaceCard` + `CreateWorkspaceModal` each get their own `useTranslation()` hook (separate components). Module-level BREADCRUMB moved inside the component body for hook access.                                                                                                                                                                                      |
| `DatasetsPage`                                            | Same pattern. `relativeTime()` helper takes `t` as a parameter (pure function, no hook). Inline `<Typography.Link>` inside translated text uses `<Trans components={{ link: <Typography.Link onClick={...} /> }}>`.                                                                                                                                                            |
| `DatasetNewPage`                                          | Hook + `t(\`upload.steps.${s}\`)`for the AntD`<Steps>`titles. Removed the now-unused`titleCase` helper.                                                                                                                                                                                                                                                                        |
| 4 upload wizard steps                                     | `UploadSourceStep` (file picker), `UploadSheetStep` (table headers + select-all/clear, plural file summary), `UploadMetadataStep` (parse options + dtype table — biggest file, used `<Trans components={{ code: <code /> }}>` for `<code>A1:C20</code>` style inline markup), `UploadPreviewStep` + `UploadConfirmStep` (commit error mapping via `commitErrorTitle(err, t)`). |

**Drift caught during extraction.**

- `<Space direction>` had been renamed to `orientation` in R31;
  during this round, I wrote two new `<Space orientation>` calls
  in BlockedDeleteModal — confirms R31's deprecation cleanup was
  the right direction.
- DeleteConfirmModal's body originally read "Delete workspace
  **Marketing**?" with hardcoded resource label. Refactored to
  pass `resource` + `name` via `<Trans>` interpolation; cleaner
  in both locales.
- AntD `<Space>` import remained when only `Space orientation`
  references stayed in two files (`UploadMetadataStep`). Caught
  by tsc unused-import hint mid-flow.

**Test wiring.**

- `tests/setup.ts` adds `import '@/i18n'` once globally — initial
  render in every test file sees English resources loaded. No
  code changes needed in the 4 existing test files.
- New
  [`tests/i18n.test.tsx`](../../../workspace/apps/builder/tests/i18n.test.tsx)
  covers en/vi locale switch (Probe component renders "Create"
  vs "Tạo") and missing-key fallback (returns the default arg,
  not the raw key).

**Visual verification (R30 gate).**

- BE booted with `MDD_BACKEND__TMP_SWEEP__ENABLED=false`; FE
  booted with `VITE_I18N_LOCALE=vi pnpm --filter builder dev`.
- `curl http://localhost:3000/src/i18n/locales/vi.json?import`
  returned the full Vietnamese resource object inline in the
  Vite-served module — proves the env-var → appConfig →
  i18next.init chain works end-to-end.
- `curl /src/main.tsx` confirmed `activeLocale = i18n.language
in ANTD_LOCALES ? i18n.language : "en"` resolves at module
  evaluation; `<AntdConfig locale={antdLocale}>` receives the
  matching pack.
- BE `/health` → 200; CORS still intact from R28.
- Both dev servers shut down clean.
- Browser-eye walk skipped (headless this turn). The 3
  dedicated vitest cases prove the locale switch behaves
  correctly; the bulk-extraction safety was verified by 26
  existing tests staying green (they query real English
  strings).

**Check pipeline.**

- BE pytest: **78/78** (unchanged — FE-only round).
- FE type-check: 0 errors.
- FE vitest: **29/29** (26 existing + 3 new i18n).
- FE build: green (1.38 MB / 438 KB gzip — +90 KB from R31
  baseline due to i18next + locale data; below the 500 KB
  chunk-size threshold's "noisy" zone but the warning still
  fires).
- md:lint: 0 errors.

**Upload-size config (post-Review add-on).** User caught a
hardcoded "100 MB" string in `datasets.emptyHint` (and the same
literal in `upload.source.dropHintCsv`/`dropHintExcel`). The BE
already enforces `backend.upload_max_bytes: 104857600` in
values.yaml; the FE was displaying a parallel hardcoded copy
that could drift. Wired through:

- [`.env.hbs`](../../../workspace/config/builder/.env.hbs)
  gained `VITE_UPLOAD_MAX_BYTES={{backend.upload_max_bytes}}` —
  references BE's value directly. Single source of truth.
- `Fields.UPLOAD_MAX_BYTES`, `Const.UPLOAD_MAX_BYTES_FALLBACK`,
  `appConfig.uploadMaxBytes(): number` follow R28's existing
  pattern. Fallback is the same 100 MiB the BE defaults to.
- Locale strings now interpolate `{{maxSize}}` instead of
  hardcoding "100 MB" / "Tối đa 100 MB". Three keys:
  `datasets.emptyHint`, `upload.source.dropHintCsv`,
  `upload.source.dropHintExcel`.
- New shared
  [`src/lib/formatBytes.ts`](../../../workspace/apps/builder/src/lib/formatBytes.ts):
  `formatBytes()` (precise, "12.3 MB") consolidated from three
  duplicated definitions (UploadConfirmStep, UploadSheetStep,
  DatasetsPage); `formatBytesCoarse()` (rounded, "100 MB") used
  for the hint text. Drift was already present — the three
  duplicates were byte-for-byte identical but easy to diverge.
- Visual proof:
  `grep VITE_UPLOAD_MAX_BYTES workspace/apps/builder/.env` →
  `VITE_UPLOAD_MAX_BYTES=104857600`. Editing
  `backend.upload_max_bytes` in values.yaml + `pnpm
config:render` flips both BE enforcement and FE display in
  one step.

**Runtime locale switcher (post-Review add-on).** Original R32
plan listed runtime switcher as OUT-of-scope ("locale flips via
build-time env-var only"). In practice that meant the only way
to see Vietnamese was a server restart, which made the i18n
plumbing feel half-finished. User asked for the switcher; added
as another R32 add-on:

- `@mdd/ui`'s `WorkspaceShell` gained an optional
  [`headerExtra?: ReactNode`](../../../workspace/packages/ui/src/Components/WorkspaceShell.tsx)
  slot — sits right of the flex-1 header content so it hugs
  the top-bar right edge. Generic enough that future
  profile/notifications drop into the same slot.
- New
  [`src/i18n/LocaleSwitcher.tsx`](../../../workspace/apps/builder/src/i18n/LocaleSwitcher.tsx)
  — `<Dropdown>` button styled compact (`<GlobalOutlined>` +
  "EN"/"VI" pill). Labels in their own language ("English",
  "Tiếng Việt") so users recognize their own tongue from
  inside any UI locale.
- `i18n/index.ts` init now reads `localStorage[mdd.locale]`
  first, falling back to `appConfig.i18nLocale()` (env), then
  to `'en'`. Exported `SUPPORTED_LOCALES` + `SupportedLocale`
  type so the switcher stays in sync.
- `main.tsx` extracted `LocaleAwareAntd` — calls
  `useTranslation()` and re-renders `<AntdConfig
locale={ANTD_LOCALES[i18n.language]}>` whenever
  `i18n.changeLanguage(...)` fires. Without this, AntD's
  built-in strings (DatePicker, Pagination, Empty) would stay
  frozen at boot-time locale.
- 3 new vitest cases in
  [`tests/locale-switcher.test.tsx`](../../../workspace/apps/builder/tests/locale-switcher.test.tsx)
  cover: current-language pill renders, click-to-switch
  flips `i18n.language` + persists to localStorage,
  re-selecting current language is a no-op (doesn't write).
  FE suite 33/33 (was 30 — 3 new switcher cases).
- Visual proof via Vite-served bundle: `LocaleSwitcher.tsx`
  loads with the labels; `main.tsx` shows `LocaleAwareAntd`
  subscribed via `useTranslation()`.

**Drifted note.** While building this, I checked drifted —
they have `i18next` + `react-i18next` in package.json but
**no actual i18n usage in source**, only an `I18N_LOCALE`
field placeholder. So drifted didn't have a switcher to
adopt; this is the first real implementation across both
codebases.

**Bundle-size note.** R31 baseline was 1.29 MB / 409 KB gzip;
R32 lands at 1.38 MB / 438 KB. Delta is i18next runtime
(~25 KB gzipped) + ~5 KB per locale json. Code-splitting + lazy
locale bundles is the long-term answer; out-of-scope this round
since both locales are essentially always-needed in a 2-locale
app. Re-evaluate when locale count grows.

## Check

- [x] `i18next` + `react-i18next` installed; `src/i18n/`
      package has init + en + vi locale files.
- [x] `appConfig.i18nLocale()` value flows through to
      `i18n.init({ lng })`.
- [x] AntD `<ConfigProvider locale={...}>` switches with i18next.
- [x] All identified user-facing strings extracted across 12
      files; only data values + dev-facing strings remain
      hardcoded.
- [x] `tests/i18n.test.tsx` passes (en, vi, missing-key fallback).
- [x] All existing tests stay green via `tests/setup.ts`
      global i18n init.
- [x] BE pytest 78/78 unchanged (FE-only round).
- [x] `pnpm type-check` 0 errors; `pnpm build` green;
      `pnpm md:lint` 0 errors.
- [x] Visual verification done per R30 gate; en + vi switch
      proven via Vite-served bundle + dedicated vitest cases.
- [x] All Plan + Check checkboxes flipped before Status flips
      to Review.

## Act

**Learnings**:

- **`<Trans components={...}>` is the right tool for inline
  markup in translated strings**. Hardcoding `<strong>` tags
  inside locale strings would have been brittle (translators
  must preserve HTML); using `<Trans>` with a `components`
  map keeps the locale string clean and the JSX
  structure-aware. Used 5 times this round (DeleteConfirm,
  BlockedDelete, DatasetsPage no-match link, UploadMetadata
  inline `<code>` markup, UploadConfirm footer).
- **Class components need `i18n.t()` instead of `useTranslation`**.
  `AppErrorBoundary` must stay a class for React's
  error-boundary lifecycle. Direct `i18n.t()` from the
  singleton works because i18n initializes at module-import
  time (before any mount).
- **`@mdd/ui` should not couple to i18next**. Initial draft of
  AntdConfig tried to import i18next directly; ended up
  passing `locale` as a prop so the package stays
  app-agnostic and reusable. Worth keeping in mind for future
  shared packages: don't bake app-level dependencies into the
  reusable layer.
- **`tests/setup.ts` global import is the cleanest test
  integration**. Considered three approaches: (1) wrap every
  test in `<I18nextProvider>`, (2) use `returnNullValue` for
  key-as-translation, (3) global init in setup.ts. Picked (3)
  — existing tests query by real strings ("Create") so we
  needed actual translations loaded, not raw keys. Zero
  changes to existing test files.
- **Hardcoded English in locale files is the right starting
  point**. Tempting to centralize "default text" elsewhere
  (constants.ts?), but the convention "locale files own all
  user-facing strings" stays simple and matches every
  Translation-Management-System integration pattern. The
  pluralization (`_one`/`_other`) tooling also assumes this.

**Promotions** _(none — implementation round; the locale-file
convention lives in the [round file](./Round_32.md) and is
self-evident from `src/i18n/locales/` going forward)_:

**Follow-ups (not promotions, just notes):**

- **Runtime locale switcher UI** is the natural R33+ feature
  once dataset detail starts shipping. Currently locale flips
  via boot env-var; a header dropdown that calls
  `i18n.changeLanguage(...)` + persists to localStorage is
  ~30 lines.
- **Vietnamese translations are AI-generated** (mine, naively).
  Production should route through a real translator. The keys
  and structure are correct, just the surface text may sound
  stiff in places.
- **SourceIcon tooltip in DatasetsPage** still shows raw
  `"Excel · sheetName"` / `"CSV"`. Hover-only, proper-noun-ish;
  acceptable to leave but worth flagging.
- **AntD v6 `<Alert>` "title" prop accepts ReactNode** — could
  use `<Trans>` inside `title=` if we ever need rich markup
  in error alerts. Not needed now (`title=` is plain string
  everywhere).
- **Locale-aware date/number formatting** (`Intl.DateTimeFormat`,
  `Intl.NumberFormat`) — the `relativeTime()` helper still
  uses `toLocaleTimeString([], ...)` with empty locale; could
  pass `i18n.language` explicitly when format mattters more
  (e.g. timezone-aware dataset detail page in R33+).
- **Bundle size grew +90 KB**. Code-splitting + lazy locale
  loading is the lever to pull when locales count goes >2.

## Feeds into → Round_33 (dataset detail D-round)

R27→R32 closed the full readiness chain:

- R27: js-tmpl config rendering + central `values.yaml`
- R28: BE Pydantic AppConfig + facade
- R29: cross-language `_generated/` constants (IDs + errors + lengths)
- R30: runtime safety nets (tmp sweep + error boundary +
  visual-verification gate + paths.py + env-policy scan)
- R31: FE polish (`@/` alias, AntD deprecations, toast,
  skeletons)
- R32: i18n (this round) — en + vi via react-i18next

R32 hands forward:

- **Locale-keyed UI surface**. R33+ dataset-detail strings get
  i18n-keyed from day one (no retrofit).
- **`src/i18n/locales/*.json` convention**. New features add
  keys to both `en.json` and `vi.json`; missing-key fallback
  catches forgetters.
- **AntD locale propagation**. `<ConfigProvider locale={...}>`
  flips with i18next; future AntD components (DatePicker,
  Pagination) inherit automatically.

R33 picks up **dataset detail** as a full DCBF chain (D → C → B
→ F):

- **R33** (D-round): `/datasets/:id` page design + visual
  preview (per "see before do" philosophy)
- **R34** (C-round): paged-rows GET endpoint contract,
  column-metadata response shape
- **R35** (B-round): BE handler, pagination
- **R36** (F-round): virtualized data table,
  column-type-aware cell rendering

POC/MVP demo-ready ≈ end of R36.
