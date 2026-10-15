// R101 — dashboard-as-a-persisted-noun FE types.
//
// F1 builds these against FE state only (in-memory store); the wire/contract
// shape freezes at Contract AFTER F1 validates the builder + Widget shape
// ([[dfcfbi-f1-precedes-contract]]). The fields here are the F1 hypothesis for
// what a persisted Widget/Dashboard needs — the thing F1 exists to confirm.

export type ChartType = 'bar' | 'pie' | 'line' | 'stat' | 'combo' | 'scatter' | 'heatmap' | 'gauge' | 'table' | 'note';

/** sum needs a numeric `measureCol`; count tallies rows (no measure). */
export type Agg = 'sum' | 'count';

/** R116 — per-widget number formatting (a presentation option, not data):
 *  `plain` = 1,234 · `compact` = 1.2K. The seed of a wider display-options bag. */
/** R116 plain/compact; R175 `percent` renders a 0..1 ratio as a percentage. */
export type NumberFormat = 'plain' | 'compact' | 'percent';

/** How many columns (of a 3-column grid) a widget occupies: 1 = third,
 *  2 = two-thirds, 3 = full row. A per-widget size (Tableau-style arranging). */
export type WidgetSpan = 1 | 2 | 3;

/** R177 — how many widget-rows tall a widget is: 1 = the standard 300 px
 *  body; 2 / 3 = as tall as two / three stacked widgets (gaps included).
 *  Optional on the wire; absent = 1. Presentation only. */
export type WidgetRows = 1 | 2 | 3;

/** R181 — a table column's footer total: `sum` (Σ column) or `ratio`
 *  (Σ`num` / Σ`den` — a rate re-derived from its parts). Computed by the
 *  server over the whole filtered result (`POST /queries/{id}/totals`). */
export type TotalSpec = { agg: 'sum' } | { agg: 'ratio'; num: string; den: string };

/** One chart on a dashboard, defined formula-free: a saved Query + which
 *  column is the dimension, which is the measure, how to aggregate, how to
 *  chart it. Bound to the Query by id (a deleted query → "unavailable"). */
export type Widget = {
  id: string;
  /** FK → Query.id. R179: absent on a `note` widget (it binds no query);
   *  required for every other kind. */
  queryId?: string;
  title: string;
  chartType: ChartType;
  /** R179 — `note` only: the text, in the safe markdown subset (see
   *  `SafeMarkdown`), at most 4000 characters. */
  md?: string;
  /** The grouping column (logical name; resolved against the query's columns).
   *  R110: optional — a `stat` (KPI) widget has no grouping. */
  dimensionCol?: string;
  /** R111: optional second grouping ("split by") → grouped multi-series bar. */
  seriesCol?: string;
  /** R115: gauge only — the target/max the value is shown against (a literal
   *  config number, not a data column). */
  target?: number;
  /** R116: per-widget number format (presentation; default `plain`). */
  numberFormat?: NumberFormat;
  /** The numeric column summed when `agg === 'sum'`; omitted for `count`. */
  measureCol?: string;
  /** Second numeric column. R112 combo: the line measure (summed). R113
   *  scatter: the Y axis (raw, with `measureCol` as X — no aggregation). */
  measureCol2?: string;
  /** R179: absent on a `note`; required otherwise. */
  agg?: Agg;
  /** Grid width: 1–3 columns of a 3-col grid (default 1). */
  span: WidgetSpan;
  /** R177 — grid height in widget-rows (1–3). Absent → 1; omitted on the
   *  wire when 1 so pre-R177 dashboards save back unchanged. */
  rows?: WidgetRows;
  /** R181 — `table` only: footer totals keyed by result column name. */
  totals?: Record<string, TotalSpec>;
};

/** A named, workspace-scoped dashboard: an ordered set of widgets. */
export type Dashboard = {
  id: string;
  workspaceId: string;
  name: string;
  /** URL-friendly dash-case identifier, auto-derived from the name (editable).
   *  Uniqueness is enforced at the Contract/Backend gate. */
  slug: string;
  widgets: Widget[];
};
