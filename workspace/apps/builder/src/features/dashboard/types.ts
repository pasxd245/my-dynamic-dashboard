// R101 — dashboard-as-a-persisted-noun FE types.
//
// F1 builds these against FE state only (in-memory store); the wire/contract
// shape freezes at Contract AFTER F1 validates the builder + Widget shape
// ([[dfcfbi-f1-precedes-contract]]). The fields here are the F1 hypothesis for
// what a persisted Widget/Dashboard needs — the thing F1 exists to confirm.

export type ChartType = 'bar' | 'pie' | 'line' | 'stat' | 'combo';

/** sum needs a numeric `measureCol`; count tallies rows (no measure). */
export type Agg = 'sum' | 'count';

/** How many columns (of a 3-column grid) a widget occupies: 1 = third,
 *  2 = two-thirds, 3 = full row. A per-widget size (Tableau-style arranging). */
export type WidgetSpan = 1 | 2 | 3;

/** One chart on a dashboard, defined formula-free: a saved Query + which
 *  column is the dimension, which is the measure, how to aggregate, how to
 *  chart it. Bound to the Query by id (a deleted query → "unavailable"). */
export type Widget = {
  id: string;
  /** FK → Query.id. */
  queryId: string;
  title: string;
  chartType: ChartType;
  /** The grouping column (logical name; resolved against the query's columns).
   *  R110: optional — a `stat` (KPI) widget has no grouping. */
  dimensionCol?: string;
  /** R111: optional second grouping ("split by") → grouped multi-series bar. */
  seriesCol?: string;
  /** The numeric column summed when `agg === 'sum'`; omitted for `count`. */
  measureCol?: string;
  /** R112 — combo only: the SECOND measure, drawn as a line over the bar.
   *  Both measures are summed per dimension (combo implies sum). */
  measureCol2?: string;
  agg: Agg;
  /** Grid width: 1–3 columns of a 3-col grid (default 1). */
  span: WidgetSpan;
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
