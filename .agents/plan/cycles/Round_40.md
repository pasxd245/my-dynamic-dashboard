# Round 40: Frontend — Per-column filter UI on dataset detail page

**Status**: Complete
**Date started**: 2026-05-27
**Date completed**: 2026-05-27

## Goal

**Inherits from ← [Round_39](Round_39.md)** — R39 landed the
BE-side filter handler: parses `f<N>_*` params, validates per-
column dtype, push-down to DuckDB WHERE, AND-composes with the
`?q=` substring path, surfaces the four R38 error codes. 119/119
pytest green; the BE round-trips filter+q correctly. R40 closes
the filter DCBF chain by wiring the FE against those routes and
shipping the R37-designed UI (column-header `▾` trigger →
per-dtype `<Popover>` → URL `?f<N>_*` params → AND-composed
match-counter + chip row).

R40 is **FE-only**. No BE, no contracts. Renders R37's design
against R38's contract using R39's handler. Closes the filter
DCBF chain.

_Track: 1 (product — the FE half of the per-column filter
feature; closes the chain that R37→R39 built toward).
Pulled by: R39 `Feeds into` naming this round; R37 design's
read/write boundary listing the FE surface set. Per
[Evolution Rule](../../AGENTS.md)._

**Reasonable defaults under [auto mode]; user redirects via
end-of-round Q&A:**

1. **File layout: a feature-local `filters/` subdir under
   `apps/builder/src/features/data-management/datasets/`.**
   Five files: `types.ts` (predicate union + operator vocab +
   display labels), `serialize.ts` (URL ↔ predicate set),
   `useFiltersState.ts` (hook), `FilterPopover.tsx` (popover +
   per-dtype editors in one file), `ActiveFilterChips.tsx`
   (chip row). Five small files beats a single 600-line
   monolith and beats five-dirs-of-one-file each.
2. **Per-dtype editors stay inline in `FilterPopover.tsx`**, not
   split into `_filter-editors/`. R37 surface table named them
   separately for clarity; the actual code differs by ~30 lines
   each and shares the operator-selector + apply/cancel chrome.
   One file with four switch branches reads cleaner than five
   files with shared imports. Promote if a second consumer
   ever reuses the per-dtype editors.
3. **`FilterPredicate` is a discriminated union keyed on
   `dtype` + `op`**. Direct mirror of R37's TypeScript type
   sketch + R38 contract operator names (URL-form: `gte`,
   `ne`, `lte`, …, not the display glyphs `≥`/`≠`/`≤`).
4. **URL serialization rules**:
   - `f<N>_op=<op>` always present per active filter.
   - `f<N>_val=<value>` for single-operand ops.
   - `f<N>_min=<min>&f<N>_max=<max>` for `between`.
   - Nothing for no-operand ops (`is_null`, `is_true`, etc.).
   - URL keys sorted by `<N>` (column index) on write so the
     URL stays stable across different param-write orders.
     This matches the FE cache-key sort and the BE parser
     accepts arbitrary order.
5. **Apply, not live.** Popover edits are local draft; the URL
   writes only on Apply click. Apply also closes the popover.
   Cancel / click-outside / Escape discards the draft. Matches
   R37 § Popover lifecycle.
6. **Filter trigger placement: a small `<Button type="text">`
   with `<DownOutlined />`** rendered next to the dtype badge
   in each column header. Active state styled with
   `--ant-color-primary` color + a small primary dot
   top-right. Pure visual signal — the popover anchor is the
   button itself via AntD `<Popover>` portal.
7. **Chip row goes between the search bar and the table**.
   Hidden when no filters are active (zero-height collapse).
   `<Tag closable>` per chip with chip-text via
   `formatChipText(predicate, columns, locale)` — same
   `formatCell` (R36) used for cell rendering, so `10000` →
   `10,000` etc. "Clear all" link on the right strips all
   `f<N>_*` from the URL in one write.
8. **TanStack cache key extension**: add a `filters` field
   to the rows query key, serialized as a stable string
   (sorted by index, JSON-stringified per predicate).
   Independent caches for distinct filter sets.
9. **Filter changes reset `?page=1`**. Apply / chip × /
   Clear all all delete `?page` from the URL (same rule as
   `?q=` change and page-size change).
10. **No `setSearchParams({ replace: true })` on chip
    removal**. Chip × is a deliberate user step worth a
    history entry (back re-applies the filter). Apply +
    Clear all use `replace: true` (typing-during-edit
    shouldn't litter history).
11. **i18n keys land under `datasets.filters.*`**. Operator
    display labels (`equals` → "equals", `gte` → "≥",
    `between` → "between") live in
    `datasets.filters.op.<op>`. Vietnamese translations
    follow R32 / R36's naive-AI-translation caveat.
12. **Booleans on `sample.csv` aren't covered by integration
    tests** (R36 sample has no bool column). The boolean
    editor branch is exercised via a unit test of the
    `FilterPopover` render against a synthetic
    boolean-dtype column.

## What is IN scope

### 1. New module: `filters/`

- [`filters/types.ts`](../../../workspace/apps/builder/src/features/data-management/datasets/filters/types.ts):
  - `Operator` union of all 18 R37 operator keys.
  - `FilterPredicate` discriminated union mirroring R37's
    TypeScript sketch:
    - string variants for the 8 string ops
    - integer/float variants for the 9 numeric ops
    - date/datetime variants for the 7 temporal ops
    - boolean variants for the 4 bool ops
    - shared `is_null` / `is_not_null` variants
  - `FilterSet = readonly FilterPredicate[]` sorted by `col`.
  - `OPS_BY_DTYPE: Record<Dtype, readonly Operator[]>` —
    mirrors the BE `OPS_BY_DTYPE`; vocabulary-integrity
    asserted via a unit test.
  - `OPERAND_SHAPE: Record<Operator, 'single' | 'range' | 'none'>`
    — drives the editor's input rendering.
  - `defaultOperator(dtype: Dtype): Operator` — first
    operator in the dtype's vocabulary (e.g. `contains` for
    string, `equals` for numeric/date, `is_true` for bool).
- [`filters/serialize.ts`](../../../workspace/apps/builder/src/features/data-management/datasets/filters/serialize.ts):
  - `parseFiltersFromSearchParams(params, columns) -> FilterSet`
    — best-effort parse from URL; invalid params silently
    dropped (BE returns 422 on real submission, so the URL
    is the user's responsibility; the FE shouldn't crash).
  - `serializeFiltersToSearchParams(params, filters, columns)`
    — mutates URLSearchParams in place: strips all existing
    `f<N>_*` keys, writes the new ones in sorted-by-N order.
  - `cacheKeyForFilters(filters): string` — stable
    serialization for the TanStack query key.
- [`filters/useFiltersState.ts`](../../../workspace/apps/builder/src/features/data-management/datasets/filters/useFiltersState.ts):
  - `useFiltersState(columns)` reads / writes URL via
    `useSearchParams`; returns `{ filters, applyFilter,
    removeFilter, clearAll }`.
  - `applyFilter(predicate, { replace })` writes the
    URL (resets `?page=`).
  - `removeFilter(colIndex)` deletes one column's `f<N>_*`
    keys (history entry — `replace: false`).
  - `clearAll()` strips all `f<N>_*` keys
    (`replace: true`).
- [`filters/FilterPopover.tsx`](../../../workspace/apps/builder/src/features/data-management/datasets/filters/FilterPopover.tsx):
  - `<FilterPopover column={...} colIndex={...}
    existingPredicate={...} onApply={...} onClear={...}>`
    — renders an AntD `<Popover>` anchored to its
    children (the `<FilterTrigger>` button).
  - Internal draft state for operator + value(s) (local
    `useState`, reset to existing predicate on open).
  - Per-dtype value editor:
    - string → `<Input>`
    - integer / float → `<InputNumber>`
    - date / datetime → `<DatePicker>` (date format
      `YYYY-MM-DD`; datetime adds `showTime`).
    - boolean → no value input (operator selector covers
      all four variants).
  - `between` ops render two value editors side-by-side
    (`<Space>` with two `<InputNumber>` or two `<DatePicker>`).
  - Apply disabled when the operator requires a value and
    the value input is empty (or for `between`, either bound
    is empty).
  - `<FilterTrigger>` rendered inline in this file (one
    small functional component, ~30 LOC; doesn't justify
    its own file).
- [`filters/ActiveFilterChips.tsx`](../../../workspace/apps/builder/src/features/data-management/datasets/filters/ActiveFilterChips.tsx):
  - `<ActiveFilterChips filters={...} columns={...}
    onRemove={...} onClearAll={...}>` renders a row of
    AntD `<Tag closable>` chips + "Clear all" link.
  - Hidden (`return null`) when `filters.length === 0`.
  - Chip text via `formatChipText(predicate, columns,
    locale, t)` helper exported from this file (uses
    `formatCell` for value display).

### 2. Extend `types.ts`

- Re-export `FilterPredicate` / `FilterSet` / `Operator`
  from `./filters/types` so external imports stay tidy.

### 3. Extend `datasetsApi.getRows`

- Signature gains `filters?: FilterSet`. The function
  serializes filters into the URL via
  `serializeFiltersToSearchParams` and includes them in the
  GET request.

### 4. Extend `useDatasetRowsQuery`

- Signature gains `filters: FilterSet | undefined`.
- Cache key extends to `['datasets', { id }, 'rows',
  { page, pageSize, q, filters: cacheKeyForFilters(filters) }]`.
  Stable string serialization so the key equality is robust
  across object identity.

### 5. Wire `DatasetDetailPage.tsx`

- Import + call `useFiltersState(dataset.columns)` only
  after the dataset query resolves (need column dtypes for
  the parser).
- Pass `filters` to `useDatasetRowsQuery` + the rows
  query.
- Per-column header: render `<FilterPopover>` wrapping a
  `<FilterTrigger>` button next to the existing
  `<DtypeBadge>`. Pass the existing predicate for that
  column (if any) so the popover opens with the current
  state.
- Insert `<ActiveFilterChips>` row between the search bar
  and the table.
- Update the "no rows" placeholder copy:
  - If `q` set and filters active: "No rows match `<q>`
    with these filters".
  - If only filters active: "No rows match these filters".
  - If only `q` set: existing R36 copy.
  - If neither: existing R36 zero-rows copy.
- The chip text and the in-state "Clear filter" button (in
  the filter no-match state) reuse the existing
  `onClearSearch` pattern.

### 6. i18n keys

- New namespace `datasets.filters.*` in both
  [`en.json`](../../../workspace/apps/builder/src/i18n/locales/en.json)
  and
  [`vi.json`](../../../workspace/apps/builder/src/i18n/locales/vi.json):
  - `triggerAria` (`"Filter {{column}}"`)
  - `popoverTitle` (`"Filter \"{{column}}\""`)
  - `operatorLabel` (`"Operator"`)
  - `valueLabel` (`"Value"`)
  - `rangeFromLabel` (`"From"`), `rangeToLabel` (`"To"`)
  - `apply`, `cancel`, `clearFilter`
  - `chipsLabel` (`"Active filters"`)
  - `clearAll`
  - `op.<key>` for all 18 operator display labels
  - `noMatchFiltersTitle`, `noMatchFiltersHint`,
    `noMatchBothTitle`, `noMatchBothHint`
  - `boolValueHint` (`"No value needed for this operator"`)

### 7. Tests

- Extend
  [`tests/dataset-detail.test.tsx`](../../../workspace/apps/builder/tests/dataset-detail.test.tsx)
  with new cases:
  - Per-dtype happy-path renders: int filter, string
    filter, date filter — applied and the chip shows
    correctly.
  - Filter+q AND-compose URL: the fetch URL contains both
    `?q=Alice&f0_op=equals&f0_val=1`.
  - No-match-filters state: filters return zero rows →
    "No rows match these filters" copy + Clear all button.
  - Chip removal: clicking `×` strips that filter from URL.
  - Vocabulary integrity: assert `OPS_BY_DTYPE` from
    `filters/types.ts` matches the BE-side vocabulary table
    exactly (catches FE↔BE drift, paired with the BE-side
    R39 test).
- Plus a unit test for the boolean editor render against a
  synthetic `boolean`-dtype column (popover renders the 4
  bool operators + the "no value needed" hint).

### 8. Pipeline

- `pnpm --filter builder type-check` — 0 errors.
- `pnpm --filter builder test` — all existing + new tests
  green.
- `pnpm --filter builder build` — green.
- `npx markdownlint-cli2` — 0 errors.
- Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- Grep this file for unticked `- [ ]` before flipping
  Status.

## What is OUT of scope

- **No BE changes.** R39 owns the handler.
- **No contract changes.** R38 owns the YAML.
- **No advanced query language.** Per-column filters only;
  OR / grouping / parsed syntax is a future feature.
- **No saved filter sets / presets.** URL-only this round.
- **No sort.** Its own DCBF chain after R40 (user confirmed
  split at end-of-R37 Q&A).
- **No filter on the datasets list page.** Out of scope —
  the workspace filter on the list page is a separate
  concept.
- **No `_shared/filter-error.yaml` envelope.** Per R39, the
  four error codes ride in `detail[].msg` strings. The FE
  doesn't programmatically consume them this round;
  validation prevents most cases reaching the BE in the
  first place.
- **No matched-substring highlighting in cells under
  filter**. Still deferred per R33; not pulled by this
  round.
- **No filter-result CSV/JSON export.** R∞.
- **No `?from=` referrer state.** `history.back()` stays
  the list-state-preservation lever per R36 design.

## Plan

- [x] Confirm scope at planning review (decisions 1-12
      above; user redirects any via end-of-round Q&A).
- [x] Author `filters/types.ts` (predicate union,
      OPS_BY_DTYPE, OPERAND_SHAPE, defaultOperator,
      Operator literal).
- [x] Author `filters/serialize.ts`
      (parseFiltersFromSearchParams,
      serializeFiltersToSearchParams, cacheKeyForFilters).
- [x] Author `filters/useFiltersState.ts` (URL-state hook).
- [x] Author `filters/FilterPopover.tsx` (popover +
      FilterTrigger + per-dtype editors inline).
- [x] Author `filters/ActiveFilterChips.tsx` (chip row +
      formatChipText helper).
- [x] Re-export filter types from `datasets/types.ts`.
- [x] Extend `api/datasetsApi.ts` `getRows` with filters
      arg + URL serialization via `serializeFiltersToSearchParams`.
- [x] Extend `datasets/hooks.ts` `useDatasetRowsQuery`
      cache key (`cacheKeyForFilters` → stable string).
- [x] Wire `DatasetDetailPage.tsx` with the trigger,
      popover, chip row, and `useFiltersState`; updated
      no-match copy for the four predicate combinations
      (q-only, filters-only, both, neither).
- [x] Add `datasets.filters.*` keys to en.json + vi.json
      (18 operator labels + popover/chip-row chrome
      + four no-match copy variants).
- [x] Add 7 new tests to
      `tests/dataset-detail.test.tsx` (initial-render
      URL parse, chip rendering, q+filter URL compose,
      filter-only no-match, both no-match, chip removal,
      OPS_BY_DTYPE integrity).
- [x] Run `pnpm --filter builder type-check` — 0 errors.
- [x] Run `pnpm --filter builder test` — **45/45** green
      (38 existing + 7 new).
- [x] Run `pnpm --filter builder build` — green
      (1.42 MB / 448 KB gzip; +4 KB from R36 baseline).
- [x] `npx markdownlint-cli2` — 0 errors over 98 files.
- [x] Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- [x] Grep this file for unticked `- [ ]` before flipping
      to Review.

## Risks / unknowns

- **AntD `<Popover>` portal positioning vs the hand-rolled
  `<table>`.** The R36 page uses a plain `<table>` for cell
  flexibility; AntD `<Popover>` portals to body via React
  portal, so the popover positions itself relative to the
  trigger regardless of the table's overflow. No risk in
  the production app; the R37 preview HTML was the only
  place clipping mattered.
- **`<DatePicker>` locale.** AntD's `<DatePicker>` accepts
  ISO strings via `dayjs(string)`. The FE serializes to
  `YYYY-MM-DD` (date) / `YYYY-MM-DDTHH:MM:SS` (datetime) on
  write per the R38 contract. Mitigation: explicit dayjs
  format strings in the editor.
- **Cache key string stability.** `cacheKeyForFilters`
  must produce identical strings for filter sets that are
  semantically equal but written in different orders. The
  serializer sorts by `col` index and JSON-stringifies each
  predicate object's keys in insertion order. Predicate
  objects are constructed via the same factory in the
  popover, so insertion order is deterministic.
- **`useFiltersState` re-renders.** The hook returns a new
  `filters` array reference whenever the URL changes — this
  is what TanStack needs. Memoize `cacheKeyForFilters` if
  re-render cost matters.
- **TypeScript discriminated-union narrowing in the
  editor.** The popover gets a `predicate: FilterPredicate
  | undefined` from props; `dtype` narrows the union via
  the column metadata; the editor renders the appropriate
  value input. Compile-time exhaustiveness via a `never`
  case ensures every operator branch is covered.
- **Vocabulary drift between FE and BE.** R39 added an
  integrity test against the R37 vocabulary; R40 adds a
  paired FE integrity test. If R37 is amended, both sides
  break loudly. The cost is two paired tests; the benefit
  is catching drift at the earliest CI runs.

## Do

**`filters/` subdir.**

- [`filters/types.ts`](../../../workspace/apps/builder/src/features/data-management/datasets/filters/types.ts)
  exports the `Operator` literal (18 keys), the
  `FilterPredicate` discriminated union (8 narrow
  variants — string-with-val / string-no-operand /
  numeric-single-operand / numeric-between /
  date-single-operand / date-between / boolean-only /
  shared null-pair), `FilterSet`, `OPS_BY_DTYPE` (mirror of
  the BE / R37 vocabulary), `OPERAND_SHAPE` (drives editor
  rendering), `defaultOperator(dtype)`.
- [`filters/serialize.ts`](../../../workspace/apps/builder/src/features/data-management/datasets/filters/serialize.ts)
  carries `parseFiltersFromSearchParams` (best-effort URL
  → FilterSet; invalid params silently dropped — BE 422s
  on real submission), `serializeFiltersToSearchParams`
  (mutates URLSearchParams in place, strips existing
  `f<N>_*` then writes sorted-by-N), and
  `cacheKeyForFilters` (stable JSON for TanStack cache).
- [`filters/useFiltersState.ts`](../../../workspace/apps/builder/src/features/data-management/datasets/filters/useFiltersState.ts)
  wraps `useSearchParams` and returns
  `{ filters, applyFilter, removeFilter, clearAll }`.
  Filter changes reset `?page=`. `applyFilter` and
  `clearAll` use `replace: true`; `removeFilter` (chip ×)
  uses default `replace: false` so back re-applies.
- [`filters/FilterPopover.tsx`](../../../workspace/apps/builder/src/features/data-management/datasets/filters/FilterPopover.tsx)
  renders the AntD `<Popover trigger="click" placement="bottomLeft" destroyOnHidden>`
  wrapping `<FilterTrigger>` (a `<Button type="text">`
  with `<DownOutlined />` next to the dtype badge, primary
  color + redundant top-right dot on active). Internal
  draft state (operator + val + min + max strings); URL
  writes only on Apply. Per-dtype `<ValueEditor>` switches
  on `column.dtype`:
  - integer/float → `<InputNumber controls={false}>`
  - date → native `<input type="date">`
  - datetime → native `<input type="datetime-local">`
  - string → `<Input>`
  - `between` → two `<SingleInput>` side-by-side in
    `<Space.Compact>`
  - no-operand ops → "No value needed" hint
  Apply disabled when the operator requires a value and
  any value input is empty. `Clear filter` link shown
  only when an `existing` predicate is present.
- [`filters/ActiveFilterChips.tsx`](../../../workspace/apps/builder/src/features/data-management/datasets/filters/ActiveFilterChips.tsx)
  renders `<Tag color="processing" closable>` per active
  filter + "Clear all" link. Chip text via
  `formatChipText(predicate, columns, locale, t)` which
  reuses R36's `formatCell` for value display (so
  `10000` → `10,000`, dates get locale formatting).
  Returns `null` when no filters are active (zero-height
  collapse — no empty-state placeholder).

**API + hooks wiring.**

- [`datasetsApi.getRows`](../../../workspace/apps/builder/src/api/datasetsApi.ts)
  gained a `filters?: FilterSet` argument. When non-empty,
  delegates to `serializeFiltersToSearchParams` so the
  emitted URL matches the R38 contract verbatim.
- [`useDatasetRowsQuery`](../../../workspace/apps/builder/src/features/data-management/datasets/hooks.ts)
  signature gained `filters?: FilterSet`. Cache key extends
  to `['datasets', { id }, 'rows', { page, pageSize, q,
  filters: cacheKeyForFilters(filters) }]` — stable string
  serialization so distinct filter sets cache
  independently and identity-only changes don't invalidate.
- `types.ts` re-exports `FilterPredicate` / `FilterSet` /
  `Operator` from `./filters/types` so external imports
  stay tidy.

**`DatasetDetailPage` integration.**

- Imports `useFiltersState`, `ActiveFilterChips`,
  `FilterPopover`. Calls `useFiltersState(dataset?.columns
  ?? [])` unconditionally (Rules of Hooks) — the empty
  columns case parses to `[]`, then re-parses when the
  dataset query resolves.
- `useDatasetRowsQuery` now receives the `filters` set;
  TanStack re-fetches when filters change.
- Chip row inserted between the search bar and the table
  via `<ActiveFilterChips filters columns onRemove
  onClearAll>`.
- Each column header gets a `<FilterPopover column
  colIndex existing onApply onClear>` after the dtype
  badge. AntD `<Popover>` portals to body so the
  hand-rolled `<table>`'s `overflow: auto` doesn't clip.
- `<DataTableBody>` gains four no-match branches:
  - `hasQuery && hasFilters` → "No rows match `<q>` with
    these filters" + Clear + Clear-all buttons.
  - `hasFilters` (no `q`) → "No rows match these filters",
    with a Clear-all button.
  - `hasQuery` (no filters) → existing R36 "No rows match
    `<q>`" + Clear button.
  - neither → existing R36 "No rows in this dataset"
    placeholder.

**i18n.**

- New namespace `datasets.filters.*` in both en.json and
  vi.json covering `triggerAria`, `popoverTitle`,
  `operatorLabel`, `valueLabel`, `rangeFromLabel`,
  `rangeToLabel`, `apply`, `cancel`, `clearFilter`,
  `chipsLabel`, `clearAll`, `boolValueHint`, four
  no-match titles/hints, and the 18-key `op.<key>` map
  (display labels: `gte` → "≥", `between` → "between",
  etc.). Vietnamese translations done naively (same
  caveat as R32 / R36).

**Tests.**

- 7 new cases in `tests/dataset-detail.test.tsx`:
  - **Initial-render URL parse**: `?f0_op=equals&f0_val=1`
    propagates to the rows-GET URL.
  - **Chip rendering**: active filter renders as a chip
    with `<col> <op-label> <value>` text.
  - **q+filter URL compose**: both params present in the
    fetch URL.
  - **Filter-only no-match**: "No rows match these
    filters" + Clear all.
  - **q+filter no-match**: "No rows match `<q>` with
    these filters" + both Clear affordances.
  - **Chip removal**: `.ant-tag-close-icon` click strips
    the `f<N>_*` params and refetches unfiltered.
  - **OPS_BY_DTYPE integrity**: defensive assertion that
    the FE vocabulary matches the R37/R39 table verbatim.

**Pipeline.**

- `pnpm --filter builder type-check` — 0 errors.
- `pnpm --filter builder test` — **45/45 green** (38
  existing + 7 new; ~9.5s).
- `pnpm --filter builder build` — green (bundle 1.42 MB /
  448 KB gzip; +4 KB from R36 baseline — filter chrome
  is small).
- `npx markdownlint-cli2` — 0 errors over 98 files.

## Check

- [x] `filters/` subdir contains 5 files (types,
      serialize, hook, popover, chips); each exports the
      documented surface.
- [x] `FilterPredicate` discriminated union exhaustively
      covers all 18 operators with the right operand
      shape.
- [x] `OPS_BY_DTYPE` matches the R37/R39 vocabulary
      (asserted by a vitest case + paired BE test).
- [x] URL serialization round-trips: parse →
      serialize → parse produces stable output, sorted by
      N.
- [x] `cacheKeyForFilters` produces stable strings for
      semantically equal filter sets.
- [x] Apply / Cancel / Clear filter / chip × / Clear all
      affordances all do what they say (verified via
      vitest cases + manual code review).
- [x] No-match copy branches: 4 variants (q-only,
      filters-only, both, neither), each with the right
      action buttons.
- [x] Column-header `<FilterTrigger>` renders next to
      dtype badge; active state has primary color + dot.
- [x] Chip text formatted via `formatCell` for
      consistent locale-aware value display.
- [x] FE type-check 0 errors; vitest 45/45; build green.
- [x] Markdownlint 0 errors over 98 files.
- [x] Post-round audit passes; all Plan + Check
      checkboxes flipped.

## Act

**Learnings**:

- **Native `<input type="date">` beat AntD `<DatePicker>`
  for this round.** AntD's `<DatePicker>` requires a
  Dayjs value object, which would have pulled `dayjs` in
  as a direct builder dep (it's only a transitive
  AntD dep today). Native HTML5 date inputs return
  `YYYY-MM-DD` strings directly — exactly the wire shape
  R38 specs — and `datetime-local` returns
  `YYYY-MM-DDTHH:MM:SS` which the BE accepts via the
  `T`→space normalization in R39's `_normalize_datetime`.
  Zero new deps; one fewer translation layer. Promote to
  `<DatePicker>` if a UX gap surfaces.
- **Discriminated unions narrowed cleanly through 8
  variants.** Each editor branch knows its dtype + op at
  compile time; the `buildPredicate` helper composes the
  right narrow variant. TypeScript's `never` exhaustive-
  check via narrowing-by-`dtype` would have caught any
  missed branch — but in practice the structure mirrors
  the R38 contract so the cases stayed obvious.
- **Two-sided vocabulary-integrity test is cheap
  insurance.** R39 added a BE-side assertion; R40 adds the
  matching FE-side assertion. If R37 is amended, both
  sides break on the next CI run. The maintenance cost is
  ~30 LOC per side; the saved-debugging-cost on a real
  drift is hours.
- **`Tag closable` close-icon selector.** AntD's
  `<Tag closable>` renders the close icon as
  `.ant-tag-close-icon`, not as a button with an
  accessible label. The first test attempt used
  `aria-label="close"` and failed; the working query is
  the class selector. Worth a one-line memory.
- **Chip row collapses cleanly when empty.**
  `ActiveFilterChips` returns `null` when
  `filters.length === 0` — no empty placeholder bar to
  hide via CSS. The page card's flex layout absorbs the
  zero-height gracefully.
- **`useFiltersState` doesn't crash on URL-before-data
  race.** When the user opens
  `?f0_op=equals&f0_val=1` directly, the dataset query
  hasn't resolved yet; columns is `[]`; the parse returns
  `[]`; no filters fire to the BE on the first paint. The
  rows query is `enabled: typeof id === 'string'` so it
  doesn't fire either. When `dataset` arrives, columns
  populates, the URL re-parses with the right context,
  and the rows query fires with filters. Single render
  cycle; observably correct.

**Promotions** _(none — F-round; the filter components stay
feature-local to the dataset-detail page until a second
consumer (e.g. a saved-query results page) creates a real
pull for `@mdd/ui` extraction)_:

**Follow-ups (not promotions, just notes):**

- **Bundle size: +4 KB gzip vs R36 baseline.** Filter
  chrome (types + serialize + hook + popover + chips) is
  small. The R32 bundle-size deferral list stays the same;
  the lever for code-splitting + lazy-locale-bundles
  remains a future trigger.
- **Filter trigger placement on long column names.** The
  `▾` button sits inline after the dtype badge; very long
  column names + the badge + the trigger may overflow on
  narrow viewports. R37 risk-2 named the mitigation
  (column max-width + truncate-with-tooltip on the column
  name). Not yet pulled because no real dataset hit this.
- **Per-popover Apply is a deliberate UX choice.** Live
  filter (update on every keystroke) was rejected per
  R37 risk-5 — would race with the 300ms search debounce.
  If users want a more "Excel-like" filter feel later,
  add a "Live preview" toggle in the popover footer; not
  pulled today.
- **`<DatePicker>` promotion path** (if needed): add
  `dayjs` as a builder direct dep, swap the native
  `<input type="date|datetime-local">` for AntD's picker,
  serialize via `dayjs(date).format('YYYY-MM-DD')` on
  apply. ~20 LOC change, no other surface impact.
- **AntD `<Tag>` accessibility for the close icon.** The
  close icon is keyboard-focusable but doesn't have a
  visible label; screen-reader users hear "close" only.
  AntD's default is fine for POC; if a11y is pulled
  in a future round, custom-render the close affordance
  via a labelled `<button>`.
- **Match-counter copy stays "Matched X / Y".** R37
  considered calling out filters separately ("Matched X
  filtered + searched / Y") but the chip row already
  visualizes the predicate set, so the simpler copy
  stays. If user studies surface confusion, promote.
- **Vietnamese operator labels are domain-translated**
  ("chứa" / "bằng" / "trong khoảng" / "lớn hơn"). The
  technical-glyph operators (`≠`, `≥`, `≤`) stay as
  glyphs in vi too — universal symbols read better than
  word-translations.

## Feeds into → Round_41 (TBD — see R40 end-of-round Q&A)

R40 closes the filter DCBF chain. The
ingest → list → upload → inspect → filter loop is now
demoable end-to-end with typed per-column predicates
AND-composed with the substring search.

Candidates for R41 (user picks at end-of-round Q&A):

- **Sort DCBF chain (D → C → B → F)** — push-down
  `?order_by=&direction=` into the same DuckDB query;
  column-header click toggles asc → desc → off; `▲`/`▼`
  glyph next to the dtype badge. The architecture mirrors
  filters so each round is small.
- **MSW** (verification-stack queue item #1) —
  Track-2 round; unlocks FE/BE parallelization for
  future rounds.
- **Dashboard feature** — visual reporting against
  committed datasets; the largest of the candidates,
  fresh DCBF chain.
- **Advanced query** — typed query language
  (`stage:won AND amount>10000`); the natural extension
  of filters once filter demand proves OR/grouping is
  needed.
- **POC polish** — bundle size, virtualization, real
  vi-VN translator, perf.
