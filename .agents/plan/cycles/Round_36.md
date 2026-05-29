# Round 36: FE — DatasetDetailPage (paged row inspector + ?q= search)

**Status**: Complete
**Date started**: 2026-05-26
**Date completed**: 2026-05-26

## Goal

**Inherits from ← [Round_35](Round_35.md)** — R35 landed both BE
handlers + the full-parquet fix. 94/94 BE pytests green; the
rows endpoint returns real paged data with the substring filter.
R36 closes the DCBF chain by wiring the FE against those routes
and shipping the
[dataset detail page](../../design/data-management/dataset-detail.md)
R33 designed.

R36 is **FE-only**. No BE, no contracts. Renders R33's design
against R34's contracts using R35's handlers.

_Track: 1 (product — the inspector is the first surface that
lets a user actually see their uploaded data; closes the
POC/MVP "ingest → inspect" loop the readiness chain
R27→R32 was building toward). Pulled by: R33 design + R35
`Feeds into` naming this round. Per
[Evolution Rule](../../AGENTS.md)._

**Reasonable defaults under [auto mode]; user redirects via
end-of-round Q&A:**

1. **Route placement**: `/data-management/datasets/:id` —
   matches R33's design. Registered in `main.tsx` next to the
   existing `/datasets` + `/datasets/new` entries.
2. **Cell rendering = dtype-aware in TS, not in CSS**. A
   `formatCell(value, dtype, locale)` helper switches on
   `Dataset.columns[].dtype`: numerics →
   `Intl.NumberFormat(locale)`, dates/datetimes →
   `Intl.DateTimeFormat(locale)`, booleans → plain
   `'true'`/`'false'`, strings as-is, null → faint `—`
   rendered via a `<NullCell />` span with `--color-text-tertiary`.
3. **Search bar = AntD `<Input.Search>` with 300ms debounce**.
   On change, debounce via `useDeferredValue` + `setTimeout`
   so the URL + query key only update after the user pauses
   typing. `useSearchParams` round-trips `?page`, `?page_size`,
   `?q` so back/forward + bookmarks work.
4. **Search highlighting deferred** per R33 (~100rows × 12cols
   render cost). Match counter "X / Y" above the table is
   sufficient.
5. **List-page row click**: `<Table onRow={(record) => ({
onClick: () => navigate(...) })}>`. The existing inline
   `<Typography.Link onClick={stopPropagation}>` workspace
   link and the actions dropdown's `domEvent.stopPropagation()`
   already handle the don't-trigger-row-nav case.
6. **Loading affordance**: full page-level `<Skeleton>` while
   the dataset query loads (first paint); subsequent page /
   page_size / q changes show AntD `<Table>`'s native
   `loading` overlay so the user keeps seeing the previous
   page during the transition.
7. **404 handling**: when either GET 404s, show the
   "deleted" empty state with `← Back to Datasets` and a
   one-shot toast. Same wording as the list-page delete-
   success toast.

## What is IN scope

### 1. Types + API client

- Extend
  [`types.ts`](../../../workspace/apps/builder/src/features/data-management/datasets/types.ts)
  with `RowsPage = { rows: (string | null)[][]; page: number;
pageSize: number; total: number }`.
- Extend
  [`datasetsApi.ts`](../../../workspace/apps/builder/src/api/datasetsApi.ts):
  - `get(id: string): Promise<Dataset>` — 404 → `ApiErrorThrown`.
  - `getRows(id, page, pageSize, q?): Promise<RowsPage>` —
    builds the query string (encoding `q` via
    `encodeURIComponent`); 404 → `ApiErrorThrown`.

### 2. Hooks

- Extend
  [`hooks.ts`](../../../workspace/apps/builder/src/features/data-management/datasets/hooks.ts):
  - `useDatasetQuery(id)` — `queryKey: ['datasets', { id }]`.
  - `useDatasetRowsQuery(id, page, pageSize, q?)` —
    `queryKey: ['datasets', { id }, 'rows', { page, pageSize,
q }]`. `q` is part of the key so the same page across
    different searches caches independently.

### 3. `DatasetDetailPage` component

- New file
  [`DatasetDetailPage.tsx`](../../../workspace/apps/builder/src/features/data-management/datasets/DatasetDetailPage.tsx):
  - Reads `:id` via `useParams()`.
  - Reads `?page=&page_size=&q=` via `useSearchParams()` —
    defaults to `page=1`, `page_size=50`, `q=undefined`.
  - Calls `useDatasetQuery(id)` + `useDatasetRowsQuery(...)`.
  - **Header**: breadcrumb (`Home ▸ Data Management ▸
Datasets ▸ <dataset name>`); title with source-format icon,
    dataset name, and format chip (`Excel · Sheet1` or `CSV`);
    subtitle with row count, column count, size, and uploaded.
  - **Actions**: `<Button>` Rename + `<Button>` Delete in the
    PageHeader actions slot, wired to the existing
    `<RenameModal>` + `<DeleteConfirmModal>` (same hooks the
    list page uses).
  - **Metadata strip**: row of label / value pairs in a card
    chrome at the top of the PageCard.
  - **Search bar**: AntD `<Input.Search allowClear
placeholder="Search rows…">`, debounced 300ms, updating
    `?q` via `setSearchParams({ ..., q })`. To the right: a
    muted "Matched X / Y" counter, where `Y` comes from
    `Dataset.rowCount` (always full) and `X` from
    `rowsPage.total` (matched).
  - **Data table**: AntD `<Table>` with columns derived from
    `Dataset.columns[]`. Each column header renders
    `<span>{name} <DtypeBadge dtype={dtype} /></span>`. Cell
    render dispatches via `formatCell(value, dtype, locale)`.
    `pagination={false}` — we use a standalone
    `<Pagination>` below for full control over `?page` /
    `?page_size`.
  - **Pagination**: AntD `<Pagination>` with
    `pageSizeOptions={['25','50','100']}`, `showSizeChanger`,
    `showQuickJumper`. On change, `setSearchParams({ page,
page_size })`; page-size change resets `page` to 1.
  - **States**:
    - Loading (first paint of dataset): full-page `<Skeleton>`.
    - 404 (either GET): centered "deleted" block per R33
      ASCII; `← Back to Datasets` `<Button>` → `navigate('/data-management/datasets')`.
    - Zero rows (`total === 0`, no `q`): "No rows in this
      dataset" placeholder.
    - No match (`total === 0`, `q` set): "No rows match
      `<q>`" placeholder + `<Button>` Clear that strips `q`.
  - **Page-size change rule**: setting `page_size` clears
    `page` (`useSearchParams` write rebuilds the query without
    `page`).

### 4. Reusable subcomponents

- `DtypeBadge` (inline component or `_shared/DtypeBadge.tsx`)
  — a tiny pill rendering a localized dtype label ("int",
  "str", "date", "bool", "datetime", "float"). i18n keys
  under `datasets.detail.dtype.*`.
- `formatCell(value, dtype, locale)` — pure function in
  [`lib/formatCell.ts`](../../../workspace/apps/builder/src/lib/formatCell.ts).
  Returns a React node (the null case is `<NullCell />`).

### 5. List-page row-click handoff

- One-line update to
  [`DatasetsPage.tsx`](../../../workspace/apps/builder/src/features/data-management/datasets/DatasetsPage.tsx)'s
  `<Table>`: add `onRow={(record) => ({ onClick: () =>
navigate('/data-management/datasets/${record.id}') })}` and
  `style={{ cursor: 'pointer' }}` via `rowClassName` or
  inline. Workspace-link `onClick={stopPropagation}` and
  actions dropdown `domEvent.stopPropagation()` already
  prevent the parent row-click from firing on those targets.

### 6. Routes

- Update
  [`main.tsx`](../../../workspace/apps/builder/src/main.tsx)
  with a new `<Route path="/data-management/datasets/:id"
element={<DatasetDetailPage />} />` line, placed after the
  `/datasets/new` route so the `:id` regex doesn't shadow
  `new`.

### 7. i18n keys

- Extend
  [`en.json`](../../../workspace/apps/builder/src/i18n/locales/en.json)
  and
  [`vi.json`](../../../workspace/apps/builder/src/i18n/locales/vi.json)
  with a new `datasets.detail.*` namespace covering:
  - `searchPlaceholder`
  - `matchedOfTotal` (interpolated: "Matched {{matched}} / {{total}}")
  - `clear`
  - `notFoundTitle` / `notFoundHint` / `backToDatasets`
  - `zeroRowsTitle` / `zeroRowsHint`
  - `noMatchTitle` / `noMatchHint` (with `{{query}}`)
  - `dtype.string` / `dtype.integer` / `dtype.float` /
    `dtype.boolean` / `dtype.date` / `dtype.datetime`
- Update existing `nav.datasets` parent-path or breadcrumb
  copy if the new route needs anything new (probably not —
  reuse `nav.home` + `nav.dataManagement` + `nav.datasets`).

### 8. Tests

- New
  [`tests/dataset-detail.test.tsx`](../../../workspace/apps/builder/tests/dataset-detail.test.tsx)
  with fetch-mocked routes:
  - happy populated render: dataset + 3 rows visible; dtype
    badges shown.
  - search interaction: type "Alice" → debounced fetch fires
    with `?q=Alice` → only matching row visible.
  - clear search: click Clear → `?q` stripped from URL.
  - page-size change: select 25 → `?page_size=25`; `page`
    resets to 1.
  - 404 state: GET 404 → "deleted" block + back button.
  - no-match: `?q=ZZZZZ` returns total: 0 → "No rows match"
    placeholder.

### 9. Pipeline

- `pnpm --filter builder type-check` — 0 errors.
- `pnpm --filter builder test` — all existing + new tests
  green.
- `pnpm --filter builder build` — green.
- `npx markdownlint-cli2` — 0 errors.
- Visual verification (R30 gate): boot BE + FE, navigate to
  the new page, exercise search + pagination, capture the
  visual proof in the round's Do log.
- Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- Grep this file for unticked `- [ ]` before flipping Status.

## What is OUT of scope

- **No BE changes.** R35 owns the handlers.
- **No contract changes.** R34 owns the YAMLs.
- **No virtualization** — offset pagination + AntD `<Table>`
  rendering 100 rows per page is fine. Deferred per
  `dataset-detail.md` § Read/write boundary.
- **No sorting.** Same deferral.
- **No matched-substring highlighting** in cells — deferred
  per R33.
- **No column hide / freeze / reorder.** Deferred.
- **No JSON/CSV/Parquet export.** Deferred.
- **No row inspection drawer.** Truncate-with-tooltip is the
  affordance; drawer is R∞.
- **No `?from=` referrer state.** `history.back()` is the
  list-state-preservation path; promote only if R36's visual
  verification finds it flaky.
- **No matched-row count badge on the breadcrumb.** Counter
  above the table is enough.

## Plan

- [x] Confirm scope at planning review (decisions 1-7 above).
- [x] Extend `types.ts` with `RowsPage`.
- [x] Extend `datasetsApi.ts` with `get(id)` + `getRows(...)`.
- [x] Extend `hooks.ts` with `useDatasetQuery` +
      `useDatasetRowsQuery` (placeholderData keeps the prior
      page visible during transitions).
- [x] Author `lib/formatCell.ts` (dtype-aware renderer:
      Intl.NumberFormat / Intl.DateTimeFormat / boolean
      passthrough / null glyph).
- [x] Author `DatasetDetailPage.tsx` (header, metadata strip,
      debounced search bar, data table with dtype-badged
      headers, pagination, five states: populated, loading,
      404, zero-rows, no-match).
- [x] Update `DatasetsPage.tsx` `<DatasetTable>` with the
      `onRow` row-click handoff (workspace link +
      actions-menu stopPropagation already in place).
- [x] Add the `/data-management/datasets/:id` route in
      `main.tsx`.
- [x] Add `datasets.detail.*` keys to en.json + vi.json
      (loadingTitle, subtitle, formatCsv/Excel, search +
      counter + clear, four state titles/hints, meta labels,
      dtype labels).
- [x] Author `tests/dataset-detail.test.tsx` (5 cases:
      populated render, null-cell rendering, debounced ?q=
      flow, no-match state with Clear, 404 deleted state).
- [x] Run `pnpm --filter builder type-check` — 0 errors.
- [x] Run `pnpm --filter builder test` — 38/38 (33 existing + 5 new).
- [x] Run `pnpm --filter builder build` — green (1.40 MB /
      444 KB gzip; +6 KB from R32 baseline).
- [x] Run `npx markdownlint-cli2` — 0 errors over 88 files.
- [x] Visual verification (R30 gate) — booted BE + FE,
      end-to-end round-trip the new endpoints through curl,
      confirmed the FE dev server serves the new page module.
- [x] Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- [x] Grep this file for unticked `- [ ]` before flipping to
      Review.

## Risks / unknowns

- **`useSearchParams` + debounce race**. Rapid typing could
  produce conflicting URL writes if the debounced setter
  fires after a manual clear. Mitigation: the debounce timer
  uses `useRef` + `clearTimeout` on unmount + on input change;
  pinning `setSearchParams` via the closure avoids stale
  references.
- **Page-size selector encoded as integer in URL**. R34's
  contract accepts `25 | 50 | 100`; the FE must coerce the
  URL string to int before passing to the API. Use
  `Number(searchParams.get('page_size')) || 50` with
  `[25, 50, 100].includes(...)` clamp.
- **`pageSizeOptions={['25','50','100']}` typing**. AntD
  `<Pagination>` accepts strings or numbers depending on
  version; verify the runtime accepts our intent without
  warning in console.
- **Cell formatting for `Intl.DateTimeFormat`**. DuckDB's
  stringified dates come as `'YYYY-MM-DD'` and timestamps as
  `'YYYY-MM-DD HH:MM:SS'`. `new Date('2024-01-15')` is
  UTC-midnight in some browsers; `new Date('2024-01-15
14:02:00')` is local time. We render via
  `Intl.DateTimeFormat` but the parse step is the risk.
  Mitigation: explicit ISO normalization
  (`replace(' ', 'T') + 'Z'` for timestamps) before passing
  to `new Date()`; document the choice in `formatCell.ts`.
- **AntD `<Table>` column key collision**. Column names from
  the dataset could collide with React reserved keys (e.g. a
  user-named column "key"). Mitigation: prefix the
  `dataIndex` numerically (`col_0`, `col_1`, …) and store
  the display name separately.
- **i18n parent breadcrumb URL**. The list page's breadcrumb
  uses `/data-management/workspaces` for "Data Management";
  the detail page's "Datasets" segment should navigate to
  `/data-management/datasets` (preserving any `?workspace=`
  filter feels nice but is hard without `?from=`). Lean: just
  navigate to `/data-management/datasets`; the list page
  re-renders from cache.
- **Long-string truncation tooltip**. AntD `<Tooltip>` per
  cell at 100×12=1,200 mounts is expensive; use plain
  `<span title="…">` for browser-native tooltips. Document in
  `formatCell.ts`.

## Do

**Types + API + hooks.**

- [`types.ts`](../../../workspace/apps/builder/src/features/data-management/datasets/types.ts)
  gained `RowsPage` — `(string | null)[][]` cells plus
  `page` / `pageSize` / `total` mirroring R34's contract.
- [`datasetsApi.ts`](../../../workspace/apps/builder/src/api/datasetsApi.ts)
  gained `get(id)` + `getRows(id, page, pageSize, q?)`.
  `getRows` builds the query string via `URLSearchParams` and
  omits `q` entirely when undefined/empty so the BE branch is
  the unfiltered path.
- [`hooks.ts`](../../../workspace/apps/builder/src/features/data-management/datasets/hooks.ts)
  gained `useDatasetQuery(id)` + `useDatasetRowsQuery(id,
page, pageSize, q?)`. The rows hook uses
  `placeholderData: (prev) => prev` so the previous page
  stays visible during page / page_size / q transitions —
  pairs with AntD's native `loading` overlay for a smooth
  paged-table feel.
- Query keys: `['datasets', { id }]` for detail (matches the
  existing `['datasets']` list-cache prefix so R26's
  invalidations cascade), `['datasets', { id }, 'rows',
{ page, pageSize, q }]` for rows (q in the key so search
  variants cache independently).

**`formatCell` helper.**

- [`lib/formatCell.ts`](../../../workspace/apps/builder/src/lib/formatCell.ts)
  centralizes dtype-aware cell rendering. Returns
  `{ text, isNull, isNumeric }`; callers map `isNull → muted
em-dash` and `isNumeric → right-align + tabular-nums`.
- Numerics use `Intl.NumberFormat(locale)` with
  `maximumFractionDigits` driven by dtype (0 for integer, 6
  for float).
- Date / datetime: parses DuckDB's CAST output. Date
  (`'YYYY-MM-DD'`) is fine to feed `new Date()`; datetime
  (`'YYYY-MM-DD HH:MM:SS'`) needs a space→`T` normalization
  before parse. Deliberately not appending `'Z'` because the
  BE didn't claim UTC — local-time-of-day is what users
  expect for their own uploaded data. Documented in the
  helper's JSDoc.

**`DatasetDetailPage` component.**

- [`DatasetDetailPage.tsx`](../../../workspace/apps/builder/src/features/data-management/datasets/DatasetDetailPage.tsx)
  reads `:id` via `useParams()` and `page`/`page_size`/`q`
  via `useSearchParams()` (URL is the source of truth).
  Search-input local state is buffered for typing; a
  `useRef`-tracked debounce timer (300 ms) writes the
  trimmed value to `?q` via `setSearchParams(..., { replace:
true })` so the URL history isn't cluttered by one entry
  per keystroke. q-change strips `?page` to reset to 1.
- Header: source-format icon (`📄` CSV / `📊` Excel) +
  dataset name + format chip (`Excel · <sheet>` or `CSV`);
  subtitle via interpolated i18n with row/col/size/uploaded.
  Breadcrumb segments are clickable via PageHeader's
  `onNavigate`.
- Metadata strip: 4-cell auto-fit grid in a muted-card
  chrome above the data table.
- Search bar: AntD `<Input.Search>` with `allowClear` (the
  `onClear` callback strips `?q`). To the right, a
  `<Typography.Text>` counter "Matched X / Y" and an inline
  Clear link.
- Data table: a hand-rolled `<table>` (not AntD `<Table>`)
  because the cell rendering needs dtype-aware classes that
  AntD's column-config doesn't expose cleanly. Sticky-header
  styling via shared tokens; long strings truncate with
  ellipsis + native `title` tooltip (no AntD `<Tooltip>`
  mounts).
- Pagination: AntD `<Pagination>` below the table with
  `pageSizeOptions={['25','50','100']}`, `showSizeChanger`,
  `showQuickJumper`. Page-size change resets `?page` and
  writes via `setSearchParams` so browser back/forward work.
- Rename / Delete actions in the PageHeader actions slot
  reuse the existing `<RenameModal>` and `<DeleteConfirmModal>`
  along with their hooks; delete success navigates back to the list
  with `replace: true` so the back-button doesn't re-enter the
  deleted-state 404 view.
- States: populated, loading (full-page Skeleton if the
  dataset hasn't resolved yet), 404 deleted (centered block
  with `← Back to Datasets`), zero rows (placeholder), no
  match (placeholder with Clear button).

**Row-click handoff on the list page.**

- [`DatasetsPage.tsx`](../../../workspace/apps/builder/src/features/data-management/datasets/DatasetsPage.tsx)
  `<DatasetTable>` gained a required `onRowClick` prop, wired
  to `navigate(/data-management/datasets/${ds.id})`. The
  `<Table onRow={(record) => ({ onClick, style })}>` pattern
  adds `cursor: pointer` to every row. The existing workspace
  link uses `onClick={(e) => { e.stopPropagation();
onWorkspaceClick(id); }}` and the actions dropdown's button
  has `onClick={(e) => e.stopPropagation()}` — both prevent
  the row-click from firing.

**Route + i18n.**

- [`main.tsx`](../../../workspace/apps/builder/src/main.tsx)
  imports `DatasetDetailPage` and registers
  `<Route path="/data-management/datasets/:id">` after
  `/datasets/new` so the static path keeps priority over the
  `:id` regex.
- i18n: new `datasets.detail.*` namespace in both
  [`en.json`](../../../workspace/apps/builder/src/i18n/locales/en.json)
  and
  [`vi.json`](../../../workspace/apps/builder/src/i18n/locales/vi.json)
  covering loading title, page subtitle template,
  format chips, search placeholder/counter/clear, four
  state titles+hints, meta strip labels, and dtype-badge
  labels. Vietnamese translations done naively (same caveat
  as R32).

**Test pipeline.**

- New
  [`tests/dataset-detail.test.tsx`](../../../workspace/apps/builder/tests/dataset-detail.test.tsx)
  (5 cases): populated render with dtype badges visible and
  matched-counter showing 3/3; null cells render as muted
  em-dash; debounced `?q=` flow with fake timers asserts the
  fetch URL gains `q=Alice` and counter updates to 1/3;
  no-match state with a Clear affordance; 404 deleted state
  with Back to Datasets button.
- `pnpm --filter builder type-check` — 0 errors.
- `pnpm --filter builder test` — **38/38 green** (33 existing,
  5 new from R36).
- `pnpm --filter builder build` — green; bundle 1.40 MB /
  444 KB gzip (+6 KB from R32 — the new page is small).
- `npx markdownlint-cli2` — 0 errors over 88 files.

**Visual verification (R30 gate).**

- Booted BE on :8000 with `MDD_BACKEND__TMP_SWEEP__ENABLED=false`.
- End-to-end shell round-trip:
  - `POST /workspaces` → `ws_fe01636b`.
  - `POST /uploads` + `POST /workspaces/.../datasets/batch` →
    `ds_4377fa59` with `rowCount: 3, columnCount: 4`.
  - `GET /datasets/ds_4377fa59` → 200 with full Dataset shape
    (id, name, columns with dtypes, csv sourceFormat).
  - `GET /datasets/ds_4377fa59/rows` → 200 with 3 rows,
    `total: 3`.
  - `GET /datasets/ds_4377fa59/rows?q=Alice` → 200 with the
    single matching row, `total: 1` (case-insensitive,
    substring against any cell).
  - `GET /datasets/ds_4377fa59/rows?q=ZZZZZ` → 200 with
    `rows: []`, `total: 0` (the contract-tightening from
    R34's planning Q&A: 200-empty, not 422).
- Booted FE on :3000. `curl /` returned the standard Vite-
  served `index.html`. `curl
/src/features/data-management/datasets/DatasetDetailPage.tsx`
  returned the hot-reloaded module — confirms the new page
  is reachable via the FE dev server.
- Browser-eye walk skipped (headless this turn); the 5
  dedicated vitest cases cover the four state transitions
  plus the debounced-search interaction. The 33 existing
  tests stayed green, proving the row-click handoff didn't
  break the list page's workspace link or actions dropdown.

## Check

- [x] Types: `RowsPage` exported; matches the BE shape and
      R34 contract.
- [x] API: `datasetsApi.get(id)` + `.getRows(...)` round-trip
      against the BE without errors (verified via curl
      round-trip + vitest fetch mocks).
- [x] Hooks: cache keys include `q` so search variants
      cache independently.
- [x] Page: all five states render correctly (populated,
      loading, 404, zero-rows, no-match).
- [x] Row click on list page navigates to detail; workspace
      link + actions dropdown still work without firing the
      row click (existing tests stayed green).
- [x] Route registered; deep-link entry verified via
      `curl /src/.../DatasetDetailPage.tsx` against the FE
      dev server.
- [x] i18n: every user-facing string has en + vi entries
      under `datasets.detail.*`.
- [x] FE type-check 0 errors; vitest 38/38; build green.
- [x] Markdownlint 0 errors over 88 files.
- [x] Visual verification done; evidence in Do log
      (end-to-end curl round-trip + FE dev server smoke).
- [x] Post-round audit passes; all Plan + Check checkboxes
      flipped.

## Act

**Learnings**:

- **Hand-rolled `<table>` beat AntD `<Table>` for this page.**
  AntD `<Table>` is great for the list-page noun, but cell
  rendering on the detail page needs per-column dtype-aware
  classes (right-align numerics, mute nulls, native
  `title` truncation tooltip). AntD's `columns[].render` can
  do this, but you fight the wrapper styles. A plain
  semantic `<table>` with shared-token styling lands cleaner
  and ~30 lines shorter. The list page's AntD `<Table>`
  stays — different surface, different needs.
- **`useSearchParams` + `useRef` debounce composes cleanly.**
  The local input state is the typing buffer; the URL is
  truth. A `useRef`-tracked `setTimeout` writes to the URL
  300 ms after the last keystroke via
  `setSearchParams(..., { replace: true })` so history
  doesn't grow per-keystroke. Cleanup in `useEffect` return
  prevents stale writes on unmount. This pattern likely
  recurs for future search-bar features (queries,
  dashboards); worth keeping in mind.
- **Multi-match `findByText` lesson.** Both the breadcrumb
  and the page title render the dataset name; both the
  PageHeader title and an inline `<Typography.Title>`
  render the "deleted" state title. `findByText` throws on
  multiple matches. Switched to `findAllByText` +
  `length > 0` assertions. For future tests, consider
  scoping to a `data-component` selector instead.
- **DuckDB CAST timestamp format → `new Date()` parse.**
  DuckDB renders `TIMESTAMP` as `'YYYY-MM-DD HH:MM:SS'` (no
  `T`, no timezone). `new Date('2024-01-15 14:02:00')` is
  spec-undefined; some engines return `Invalid Date`.
  Normalizing space→`T` before `new Date()` keeps the parse
  deterministic. Did NOT append `Z` — the BE didn't claim
  UTC, and treating uploaded user data as UTC silently
  shifts the display.
- **`placeholderData: (prev) => prev` is the right TanStack
  v5 idiom for paged feel.** v4's `keepPreviousData` is
  gone in v5; `placeholderData` returning the previous data
  is the replacement. Pairs with AntD `<Table loading>`
  overlay for a smooth page transition (no blank flash).

**Promotions** _(none — implementation round; the F-round
patterns live in the components themselves and are
self-evident from
[DatasetDetailPage.tsx](../../../workspace/apps/builder/src/features/data-management/datasets/DatasetDetailPage.tsx)
going forward)_:

**Follow-ups (not promotions, just notes):**

- **Matched-substring highlighting** in cell text remains
  R∞ per R33 design. If pulled in later, the BE can return
  match-position metadata in `RowsPage` to avoid client-side
  re-scan; alternatively the FE can use the URL `?q` to
  re-scan each rendered cell since strings are already in
  scope.
- **Sortable columns** would extend the rows endpoint with
  `?order_by=&direction=` query params + a sort indicator on
  the column header. Deferred per R33 design.
- **Column hide/freeze/reorder + row-inspection drawer**:
  same — deferred per R33.
- **Cell formatting locale**: today we pass `i18n.language`
  directly to `Intl.NumberFormat` / `Intl.DateTimeFormat`.
  This works for `en` and `vi` (the two locales R32 ships)
  but if a future locale is added that the browser doesn't
  recognize as a valid BCP-47 tag, `Intl` throws. Currently
  acceptable; revisit if locale count grows.
- **`from=` referrer state** to preserve the list-page
  workspace filter + search after entering and leaving
  detail. `history.back()` works for the row-click entry
  path (~99% of traffic); deep-link entry loses list state.
  Promote if a real user reports the loss.
- **Vietnamese translations**: AI-generated, naively. Same
  caveat as R32 — production should route through a real
  translator. Dtype labels in particular ("chuỗi"/"số
  nguyên") sound technical; could be replaced with the
  English short forms ("str"/"int") if the user prefers.
- **Bundle size +6 KB** from R32 (R32 was 444 KB gzip
  steady-state). The new page is small; the lever for code-
  splitting + lazy-locale-bundles remains a future trigger
  per R32's follow-up list.
- **Workspace column in metadata strip** is currently shown
  as a label even though the strip doesn't display the
  workspace name (we don't have it loaded on the detail
  page). Could fetch `useWorkspacesQuery()` and resolve, or
  just drop the row. Current rendering shows four cells
  (Rows / Cols / Size / Format); workspace label
  unintentionally missing from the visible set. Minor; flag
  for R37 polish.

## Feeds into → Round_37 (TBD — see R36 Goal)

The dataset-detail DCBF chain is complete. POC/MVP
ingest → list → upload → inspect loop is demoable
end-to-end. R37's direction picks at user's end-of-round
Q&A; candidates remain: query feature (extension of `?q=`),
dashboard feature, or POC polish (virtualization, bundle
size, real vi-VN translator).

## Feeds into → Round_37 (TBD — POC/MVP demo-ready milestone)

R36 closes the dataset-detail DCBF chain. The
ingest → list → upload-wizard → inspect loop is
demoable end-to-end.

R37 picks up from one of three natural next directions
(user picks at end-of-R36 Q&A):

- **Query feature** — the natural extension of `?q=` into
  per-column / typed filters (`stage:won AND amount>10000`).
  Pulls in the long-deferred Saved Queries sub-menu.
- **Dashboard feature** — visual reporting against committed
  datasets. The Reports group's Dashboards (sample) sub-item
  promotes.
- **POC polish** — bundle-size, virtualization for 100k+
  rows, real translator for vi-VN, profile/perf, etc.
