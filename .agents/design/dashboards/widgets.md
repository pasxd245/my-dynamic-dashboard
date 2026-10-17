# Widgets — kinds, builder, notes, table totals and export

**Concept**: a **widget** is one formula-free cell on a dashboard: a saved Query plus labelled
choices (which column groups, which is measured, how to aggregate, how to chart, how big) — or,
for a `note`, a block of safe markdown with no query at all. This doc covers the widget model,
the ten kinds, how each kind gets its data, the builder modal, note widgets and the
`SafeMarkdown` subset, number formats (incl. percent), table footer totals and table export.
The page, grid, card shell, filter drawer and dashboard CRUD are in
[dashboard-layout.md](dashboard-layout.md).
**Status**: Accepted.
**Domain folder**: `dashboards/` — code in
[`apps/builder/src/features/dashboard/`](../../../workspace/apps/builder/src/features/dashboard/).
**Sibling docs**: [dashboard-layout.md](dashboard-layout.md) (the grid a widget sits in),
[queries.md](../data-management/queries/queries.md) (the saved Query, its transform steps and
`POST /queries/{id}/aggregate`), [metadata.md](../data-management/_shared/metadata.md) (the
second consumer of `SafeMarkdown`).

---

## Why formula-free

Every widget choice is a labelled select; there is no expression language. The user picks a
query and columns, never writes `SUM(x)/SUM(y)`. Anything that needs a formula belongs in the
saved Query's transform steps ([queries.md](../data-management/queries/queries.md)), and a
widget over such a pre-shaped query renders its rows directly. The one ratio a widget computes
itself — a table footer's `ratio` total — is also a pick (numerator column, denominator column),
not an expression.

---

## Surfaces — layer / reuse / purity declaration

| Surface                                                                                                  | Layer                                                   | Reusability                                    | Purity                                             | Allowed peer deps                                             |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------- |
| `WidgetBuilder` modal (form + live preview + "View as JSON")                                             | `apps/builder/src/features/dashboard/`                  | feature                                        | feature                                            | react, antd, react-i18next, @tanstack/react-query (via hooks) |
| `draftToConfig` (draft → persisted widget shape)                                                         | `apps/builder/src/features/dashboard/WidgetBuilder.tsx` | feature                                        | pure                                               | none                                                          |
| `WidgetView` → `NoteWidgetView` / `ChartWidgetView` (file-private)                                       | `apps/builder/src/features/dashboard/`                  | feature                                        | feature                                            | react, antd, recharts, react-i18next                          |
| `useWidgetChartData` (per-kind fetch mode + roll-up)                                                     | `apps/builder/src/features/dashboard/WidgetView.tsx`    | feature                                        | glue (server-data)                                 | react, @tanstack/react-query                                  |
| `TableView` (file-private), `formatTableCell`, `isRatioColumn`, `formatTotal`, `TABLE_PAGE_ROWS`         | `apps/builder/src/features/dashboard/WidgetView.tsx`    | feature                                        | plain-UI (helpers pure)                            | react, antd                                                   |
| `HeatmapView`, `GaugeView` (lazy, ECharts)                                                               | `apps/builder/src/features/dashboard/`                  | feature                                        | plain-UI                                           | react, echarts                                                |
| `SafeMarkdown`, `markdownProblems`, `parseBlocks`, `MARKDOWN_MAX_CHARS`                                  | `apps/builder/src/features/dashboard/SafeMarkdown.tsx`  | feature (consumed by `features/metadata/` too) | plain-UI (`markdownProblems` / `parseBlocks` pure) | react, antd                                                   |
| `totalsColumns`, `computeTotals` (`totals.ts`)                                                           | `apps/builder/src/features/dashboard/`                  | feature                                        | pure                                               | none                                                          |
| `exportRequest` (pure) + `downloadWidgetExport` (`exportWidget.ts`)                                      | `apps/builder/src/features/dashboard/`                  | feature                                        | glue (fetch + browser download)                    | (fetch — no extra peer dep)                                   |
| `useWidgetData`, `useWidgetAggregate`, `useWidgetTotals`, `useChartPalette`                              | `apps/builder/src/features/dashboard/hooks.ts`          | feature                                        | glue (server-data)                                 | @tanstack/react-query, antd                                   |
| aggregate helpers (`aggregateByGroupSeries`, `aggregateMatrix`, `applyFilters`, `pickWidgetDefaults`, …) | `apps/builder/src/features/dashboard/aggregate.ts`      | feature                                        | pure                                               | none                                                          |
| `queriesApi.getUnpagedRows` / `aggregate` / `totals` / `exportFile`                                      | `apps/builder/src/api/`                                 | builder-only                                   | glue                                               | (fetch — no extra peer dep)                                   |
| `POST /queries/{id}/totals`, `POST /queries/{id}/export`                                                 | `apps/backend/app/routers/queries.py`                   | backend                                        | feature                                            | (FastAPI — backend native; DuckDB)                            |
| `build_csv`, `build_xlsx`, `EXPORT_MAX_ROWS`                                                             | `apps/backend/app/ingest/export.py`                     | backend                                        | pure                                               | (openpyxl)                                                    |
| `markdown_problems`, `MARKDOWN_MAX_CHARS`                                                                | `apps/backend/app/markdown_safe.py`                     | backend                                        | pure                                               | (stdlib `re`)                                                 |
| `Widget`, `TotalSpec`, `TotalsBody`, `ExportBody`, `ApiErrorExportTooLarge`                              | `apps/backend/app/models/common.py`                     | backend                                        | data type                                          | (Pydantic)                                                    |
| `Widget`, `TotalSpec`, `ChartType`, `NumberFormat`, `WidgetSpan`, `WidgetRows` (FE)                      | `apps/builder/src/features/dashboard/types.ts`          | data type                                      | data type                                          | none                                                          |

**Boundary check**: nothing here is in `@mdd/ui`. `SafeMarkdown` has a second consumer
(`features/metadata/MetadataPanel.tsx` imports it) but stays in the dashboard feature folder —
it is the note widget's renderer first, and moving it is a promotion for when a third consumer
appears. Chart libraries (recharts; ECharts lazy-loaded for heatmap and gauge) are a
presentation detail behind `WidgetView`, not a contract field.

---

## Token map

All values are AntD tokens derived from the seeds in
[`themeTokens.ts`](../../../workspace/packages/ui/src/themeTokens.ts); values are informational.

| Surface                                        | AntD token                                                                                                                                                | Value (informational) |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Chart series palette, in order (de-duplicated) | `colorPrimary`, `colorSuccess`, `colorWarning`, `colorError`, then presets `purple` `cyan` `magenta` `gold` `geekblue` `lime` `volcano`, then `colorInfo` | derived               |
| Builder "View as JSON" block background        | `colorFillQuaternary`                                                                                                                                     | derived               |
| Builder "View as JSON" block radius            | `borderRadius`                                                                                                                                            | `6`                   |
| Note inline code / code block background       | `colorFillQuaternary` (read as the AntD CSS variable)                                                                                                     | derived               |
| Note block-quote rule and horizontal rule      | `colorBorder`                                                                                                                                             | `#d9d9d9`             |
| Note block-quote text                          | `colorTextSecondary`                                                                                                                                      | derived               |
| Note headings / paragraphs                     | AntD `Typography` (`colorTextHeading` / `colorText`)                                                                                                      | derived               |
| Builder markdown field error state             | `colorError` (AntD `Form.Item` error status)                                                                                                              | derived               |
| Table footer row                               | AntD `Table.Summary` (`colorText`, bold)                                                                                                                  | derived               |

No new token is introduced; colours track the theme, never ad-hoc hex. Parity is enforced by
[`design-token-parity.mjs`](../../../scripts/lint/design-token-parity.mjs).

---

## Widget model

Source of truth:
[`_shared/dashboard.yaml`](../../../workspace/packages/contracts/_shared/dashboard.yaml) `Widget`
/ `TotalSpec`, enforced by the Pydantic `Widget` (`extra="forbid"`) in
[`models/common.py`](../../../workspace/apps/backend/app/models/common.py). Columns are stored by
logical **name**, not position, so reordering a query's columns does not re-point a widget.

| Field          | Type                                                                                                    | Rule                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `id`           | `wdg_<8 hex>`                                                                                           | required; client-generated                                           |
| `title`        | string 1–120                                                                                            | required                                                             |
| `chartType`    | `bar` \| `pie` \| `line` \| `stat` \| `combo` \| `scatter` \| `heatmap` \| `gauge` \| `table` \| `note` | required                                                             |
| `span`         | int 1–3                                                                                                 | required — grid columns                                              |
| `rows`         | int 1–3                                                                                                 | optional — grid rows; absent = 1, never backfilled                   |
| `queryId`      | `qr_<8 hex>`                                                                                            | required on every kind except `note`; forbidden on `note`            |
| `agg`          | `sum` \| `count`                                                                                        | required on every kind except `note`; forbidden on `note`            |
| `measureCol`   | string                                                                                                  | required when `agg = sum`, forbidden when `agg = count`              |
| `dimensionCol` | string                                                                                                  | optional (grouping; absent on stat / gauge / table / scatter / note) |
| `seriesCol`    | string                                                                                                  | optional — bar "split by", heatmap Y                                 |
| `measureCol2`  | string                                                                                                  | optional — combo line measure, scatter Y                             |
| `target`       | number ≥ 0                                                                                              | optional — gauge max (a literal, not a column)                       |
| `numberFormat` | `plain` \| `compact` \| `percent`                                                                       | optional; absent = `plain`                                           |
| `md`           | string 1–4000                                                                                           | `note` only: required there, forbidden elsewhere                     |
| `totals`       | `{ <column>: TotalSpec }`, ≤ 64 entries                                                                 | `table` only                                                         |

`TotalSpec` = `{ agg: 'sum' }` or `{ agg: 'ratio', num, den }` — a ratio needs both `num` and
`den`; a sum carries neither. A violation of any rule is a `422` on create / update. A `note`
also forbids `dimensionCol`, `seriesCol`, `measureCol`, `measureCol2` and `target`.

---

## Widget kinds

| Kind      | Builder fields                                    | Data path                                                      | Renders                                               |
| --------- | ------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------- |
| `bar`     | dimension, optional split-by, agg, measure (sum)  | server aggregate; with split-by → client roll-up over raw rows | recharts bar; grouped bars per series                 |
| `line`    | dimension, agg, measure                           | server aggregate                                               | recharts line, ordered by the dimension (dtype-aware) |
| `pie`     | dimension, agg, measure                           | server aggregate                                               | recharts donut, slice labels with %                   |
| `stat`    | agg, measure (no dimension)                       | server aggregate (scalar)                                      | AntD `Statistic`, one number                          |
| `combo`   | dimension, bar measure, line measure              | client roll-up (two sums)                                      | recharts bar + line on two Y axes                     |
| `scatter` | X measure, Y measure                              | client, raw points                                             | recharts scatter                                      |
| `heatmap` | dimension (X), series (Y, required), agg, measure | client matrix                                                  | ECharts heatmap (lazy)                                |
| `gauge`   | agg, measure, target                              | client scalar                                                  | ECharts gauge vs `target` (lazy)                      |
| `table`   | query + title only; optional totals               | raw rows (client) + server totals                              | paged AntD table + footer                             |
| `note`    | title + markdown text                             | none                                                           | `SafeMarkdown`                                        |

Bar and pie sort descending by value; line sorts by the dimension. A null dimension cell is
labelled `(blank)`.

### Data paths

`useWidgetChartData` picks the fetch per kind:

- **Server aggregate** (`bar` without split-by, `pie`, `line`, `stat`):
  `POST /queries/{id}/aggregate` with `{ dimensions, measures, filters }` — `GROUP BY` in DuckDB
  over the **whole** result, so no row cap applies and the filters are pushed server-side. It
  fires only once the bound query is loaded, is not pre-shaped, and the measure is not provably
  non-numeric (`serverAggregateSupportsMeasure` — a non-numeric `sum` measure would be a `422`
  with `measure_not_numeric`, so the request is skipped). These kinds have **no client roll-up**:
  when the aggregate cannot run (non-numeric measure, missing dimension) the widget shows the
  empty state.
- **Pre-shaped query** (the bound query has transform `steps`): the aggregating kinds map the
  query's rows to chart data **directly**, never re-aggregating (value = `measureCol`, else a
  `count` column, else the last column).
- **Raw rows** (everything else, and the fallback): `GET /queries/{id}/rows?unpaged=true`,
  capped server-side at `DASHBOARD_MAX_ROWS` (10 000); the response's `total` > rows → the card's
  ⚠ partial-data icon ([dashboard-layout.md](dashboard-layout.md#card-shell-and-per-widget-states)).
  Dashboard filters are applied client-side (`applyFilters`). Columns come from the query's
  `resolvedColumns`, or from its source dataset for a single-source query.
- **Table totals and export** always run server-side over the whole filtered result (below), so
  they are right even when the table's own rows are capped.

---

## Builder

`WidgetBuilder` is an 860 px modal: the form on the left, a **live preview** on the right (the
same `WidgetView` the dashboard renders, fed by the same `draftToConfig` the submit sends, so the
preview is the saved shape), and a collapsed **View as JSON** panel showing that config
read-only with a copy button.

- **Query** — searchable select over the **dashboard's workspace's** queries only (there is no
  per-widget workspace picker). Hidden for `note`. Changing it clears the dimension.
- **Defaults** — when the picked query's columns load and the current dimension is not valid,
  `pickWidgetDefaults` sets dimension = first categorical column, measure = first numeric column
  with `agg: sum` (or `agg: count` when there is no numeric column), chart = `bar`. Kinds with no
  grouping (`table`, `stat`, `gauge`, `scatter`, `note`) are never reset.
- **Fields shown per kind** follow the kinds table: dimension (grouping kinds), split-by
  (`bar`, optional; `heatmap`, required), aggregation (hidden for `table`, `note`, `combo`,
  `scatter`), measure / second measure (numeric columns only), gauge target, number format
  (hidden for `note`), Width 1 / 2 / 3, Height 1 / 2 / 3, and Totals (`table` only).
- **Submit** is enabled when the title is non-empty and the kind's requirements hold (query,
  dimension where needed, measures, heatmap series; for a `note`, non-blank safe text ≤ 4000).
  `draftToConfig` drops fields the kind does not use (a `table` always saves as `agg: count`
  with no measure — since `ff9647a`), and omits `rows` when 1 and `numberFormat` when unset, so editing a widget without touching them saves it back unchanged.

---

## Note widgets

A `note` is text on the grid — a heading for a section, the week's commentary, a link to the
source sheet. It binds no query, so it has no fetch, no filter button and no export; it shares
only the card shell (size, empty state, `⋯` menu, drag handle).

**Safe markdown subset** (`SafeMarkdown.tsx`, rendered by a hand-written parser into React
nodes — no markdown library, never injected as HTML, so a `<script>` in the text can only ever
appear as the literal characters):

- **Allowed** — `#`–`###` headings (rendered as AntD titles levels 3–5), paragraphs,
  `**bold**`, `*italic*` / `_italic_`, `` `code` ``, fenced ` ``` ` code blocks,
  `-` / `*` bullet lists, `1.` / `1)` numbered lists, `>` quotes, `---` / `***` rules, and
  `[text](https://…)` links (opened in a new tab, `rel="noopener noreferrer"`). Anything else
  (e.g. a table) shows as the text it is.
- **Rejected, never silently stripped** — raw HTML or anything tag-shaped (`<b>`, `</div>`,
  `<!-- -->`, `<http://…>` autolinks) → `html`; images `![…](…)` → `image`; a link (inline or
  reference form) whose target is not `http://` / `https://` (`javascript:`, `data:`, `file:`,
  bare `www.`) → `link_scheme`.
- **Two-sided rule** — the server
  ([`app/markdown_safe.py`](../../../workspace/apps/backend/app/markdown_safe.py)
  `markdown_problems`) rejects on save with a `422` whose message carries
  `markdown_unsafe: <tokens>`; the builder runs the same regexes (`markdownProblems`) live and
  shows `dashboard.builder.mdUnsafe` under the field before any round-trip. Cap
  `MARKDOWN_MAX_CHARS` = 4000 on both sides (the textarea shows a counter).

The same renderer shows metadata entry bodies
([metadata.md](../data-management/_shared/metadata.md)), so what an agent writes renders exactly
like a note.

---

## Number formats

`numberFormat` is presentation only (absent = `plain`):

- `plain` — grouped (`1,234`); `compact` — `1.2K`; `percent` — a **0..1 ratio** shown as a
  percentage with ≤ 1 decimal (`0.0548` → `5.5%`). Ratios are stored as 0..1 floats (the
  product's conversion-rate convention); only their display is a percent.
- **stat / gauge** — the headline value uses the chosen format (gauge reads value and target as
  ratios under `percent`).
- **bar / line** — `percent` formats the Y axis and tooltip as percentages; otherwise the axis is
  compact and the tooltip plain. Pie, grouped bar, combo, scatter and heatmap keep their compact
  axis / plain tooltip defaults.
- **table** — cells format by column dtype: integers grouped, floats with ≤ 2 decimals, dates as
  the date part. Under `percent`, only **ratio columns** become percentages — a float column whose
  every non-empty value lies in [−1, 1] (`isRatioColumn`) — so an average premium of 6.6M beside a
  conversion rate is not shown as a 660-million percent.

---

## Table totals

A `table` widget can carry a footer row: `Widget.totals` maps a result column to
`{ agg: 'sum' }` or `{ agg: 'ratio', num, den }`. A column without an entry has no total.

- **Builder** — under Totals, one row per numeric column with `None` / `Sum` / `Ratio`; picking
  Ratio reveals Numerator and Denominator selects (defaults: this column ÷ the first numeric
  column). An empty map is not saved.
- **Server sums** — `POST /queries/{id}/totals` with `{ columns, filters }` (`columns` 1–64
  numeric result names = `totalsColumns(totals)`: each sum column plus every ratio's `num` and
  `den`). One DuckDB query over the query's **final** relation — the post-step result when the
  query has transform steps (which `/aggregate` cannot see) — under the active filters, never
  capped. Response `{ sums: { col: "<stringified number>" }, rowCount }`; an all-NULL column reads
  `"0"`. Errors: `404` (no query / source gone), `409 query_stale` / `relationship_stale`, `422`
  (unknown or non-numeric column, FastAPI envelope).
- **Footer values** (`computeTotals`) — a sum is the sum; a **ratio is Σnum / Σden**, a rate
  re-derived from its parts, never the mean of the rows' rates. A zero or missing denominator →
  `null` → a **blank** cell.
- **Footer row** — AntD `Table.Summary` (fixed), bold; the first column shows `Total`
  (`dashboard.table.total`) when it has no total of its own. Sums follow their column's dtype
  (integers grouped); a ratio total, or any |v| ≤ 1 value, renders as a percent under `percent`,
  else with ≤ 3 decimals (`formatTotal`). The footer appears once the sums arrive.

---

## Export

A `table` widget's numbers can be downloaded (header **⤓** menu: `Download as Excel (.xlsx)` /
`Download as CSV`). The file holds **every** row the table reads, not the visible page.

- **Request** (`exportRequest`) — `POST /queries/{id}/export` with `format` (`csv` | `xlsx`),
  `filters` (the widget's active filters, `(blank)` → null), `totals` (the widget's spec, only
  when non-empty), `percent: true` (only when `numberFormat` is `percent`) and `title` (the
  widget title). `downloadWidgetExport` turns the response into a blob download named by the server's
  `Content-Disposition` filename (the title with unsafe characters replaced, ≤ 60 chars, else
  `export`).
- **Server** — the same final (post-step) relation as totals, filtered by name (a filter on a
  column the result lacks is skipped). Over `EXPORT_MAX_ROWS` = **100 000** rows →
  `422 { code: export_too_large, rows, max }` and nothing is written; the FE toasts
  `dashboard.export.tooLarge` with both numbers. Other failures toast `dashboard.export.failed`;
  success toasts `dashboard.export.done` with the filename.
- **CSV** (`build_csv`) — UTF-8 **with a BOM** so Excel opens it as UTF-8, CRLF lines, header +
  rows (dates ISO, booleans `true` / `false`, NULL empty), then the totals row last.
- **XLSX** (`build_xlsx`) — **typed cells** (numbers are numbers, dates are dates), bold header,
  frozen first row, column widths 10–40. Number formats per column: `0.0%` for ratio columns
  (under `percent`: float columns whose values all lie in [−1, 1], plus every `ratio` total's
  column), `yyyy-mm-dd` / `yyyy-mm-dd hh:mm:ss` for dates. The data sheet is named after the
  title (≤ 31 chars, `[]:*?/\` replaced). A second sheet **`Filters`** lists `query`, `widget`,
  `exported_at`, `rows`, then a `column` / `values` table of the active filters (`(blank)` for
  null; `— / no filter` when none).
- **Totals row** — the same sums as the footer (ratio = Σnum / Σden; zero denominator → empty),
  bold in XLSX, with the label `Total` placed in the first column that has no total.

---

## Acceptance criteria

**User journey** — as an analyst I add a widget by picking a query and a few labelled options,
see it previewed before saving, write a short note beside my charts, put a table with a correct
totals row on the dashboard, and download that table to Excel with the filters I used.

1. **Model** _(pytest)_ — a `sum` widget without `measureCol`, a `count` with one, a non-note
   without `queryId` or `agg`, a note with any data field, `totals` on a non-table, more than 64
   totals, or a ratio total missing `num` / `den` are each `422`.
2. **Builder** _(FE)_ — the query list is the dashboard's workspace's; fields follow the kind;
   the preview and the JSON panel equal the submitted config (`draftToConfig`); `rows: 1` and an
   unset `numberFormat` are omitted.
3. **Data paths** _(FE)_ — bar (no split) / pie / line / stat call `/aggregate` with the filters;
   a pre-shaped query is not re-aggregated; a non-numeric sum measure skips `/aggregate` (empty
   state, no `422` in the console); raw-row kinds flag partial data above 10 000 rows.
4. **Note** _(FE + BE)_ — the allowed subset renders as elements; HTML, images and non-http(s)
   links are flagged in the builder and rejected by the server with `markdown_unsafe`; text over
   4000 characters cannot be saved.
5. **Number formats** _(FE)_ — `percent` renders `0.0548` as `5.5%` on stat / gauge / bar / line
   and only on ratio columns of a table.
6. **Totals** _(FE + BE)_ — `/totals` sums over the whole filtered post-step result; the footer
   shows sums and Σnum / Σden ratios; a zero denominator is blank; non-numeric columns are `422`.
7. **Export** _(BE + FE)_ — CSV starts with a BOM and ends with the totals row; XLSX has typed
   cells, `0.0%` on ratio columns, and a `Filters` sheet; more than 100 000 rows is
   `422 export_too_large` and the FE shows the row count and the limit.

---

## Scope boundary

### IN scope

- The widget model and its validation, the ten kinds and their data paths, the builder, note
  widgets and the safe markdown subset, number formats, table totals and table export.

### OUT of scope (deferred with named triggers)

- **Export for non-table kinds** (chart image, chart data) — pull when a user needs a chart's
  numbers outside the app; the table is the Excel-first output today.
- **Totals other than sum / ratio** (average, min / max, count distinct) — pull with a concrete
  report that needs one; anything formula-like belongs in query steps.
- **Formulas in widgets** — out by product principle; use query transform steps.

### This concept explicitly does NOT cover

- The grid, card states, filter drawer, metadata placements and dashboard CRUD — see
  [dashboard-layout.md](dashboard-layout.md).
- The saved Query, transform steps and the `/aggregate` route contract — see
  [queries.md](../data-management/queries/queries.md).
- Metadata entries (which reuse `SafeMarkdown`) — see
  [metadata.md](../data-management/_shared/metadata.md).

---

## Reference materials (read-only)

- Contracts: [`queries/totals.contract.yaml`](../../../workspace/packages/contracts/queries/totals.contract.yaml),
  [`queries/export.contract.yaml`](../../../workspace/packages/contracts/queries/export.contract.yaml),
  [`queries/aggregate.contract.yaml`](../../../workspace/packages/contracts/queries/aggregate.contract.yaml).
- Backend: [`app/ingest/export.py`](../../../workspace/apps/backend/app/ingest/export.py) (file
  builders), [`app/routers/queries.py`](../../../workspace/apps/backend/app/routers/queries.py)
  (`totals_query`, `export_query`, `_final_relation`).
