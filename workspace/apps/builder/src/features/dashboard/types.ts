// R101 — dashboard-as-a-persisted-noun FE types.
//
// F1 builds these against FE state only (in-memory store); the wire/contract
// shape freezes at Contract AFTER F1 validates the builder + Widget shape
// ([[dfcfbi-f1-precedes-contract]]). The fields here are the F1 hypothesis for
// what a persisted Widget/Dashboard needs — the thing F1 exists to confirm.

export type ChartType = 'bar' | 'pie';

/** sum needs a numeric `measureCol`; count tallies rows (no measure). */
export type Agg = 'sum' | 'count';

/** One chart on a dashboard, defined formula-free: a saved Query + which
 *  column is the dimension, which is the measure, how to aggregate, how to
 *  chart it. Bound to the Query by id (a deleted query → "unavailable"). */
export type Widget = {
  id: string;
  /** FK → Query.id. */
  queryId: string;
  title: string;
  chartType: ChartType;
  /** The grouping column (logical name; resolved against the query's columns). */
  dimensionCol: string;
  /** The numeric column summed when `agg === 'sum'`; omitted for `count`. */
  measureCol?: string;
  agg: Agg;
};

/** A named, workspace-scoped dashboard: an ordered set of widgets. */
export type Dashboard = {
  id: string;
  workspaceId: string;
  name: string;
  widgets: Widget[];
};
