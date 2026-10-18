// R101 Contract — dashboard WIRE types.
//
// Hand-aligned to the OpenAPI 3.1 contracts at
//   workspace/packages/contracts/dashboards/* and _shared/dashboard.yaml.
//
// Distinct from the FE-STATE types in ./types.ts (the F1 in-memory shape, which
// flattens `widgets` onto the Dashboard). On the wire, widgets live under
// `definition.widgets` (embedded JSON, mirroring `queries.definition`) and the
// Dashboard carries a server-stamped `createdAt`. The Frontend gate adds the
// thin adapter that maps wire ↔ FE-state when the in-memory store is swapped
// for the real API; this module is the contract-faithful boundary type used by
// the API client + the MSW handlers.

import type {
  ChartType,
  Agg,
  NumberFormat,
  WidgetSpan,
  WidgetRows,
  TotalSpec,
  Dashboard,
  DashboardControl,
  Widget,
} from './types';

/** A widget as carried on the wire. Same fields as the FE-state `Widget`
 *  (./types.ts) — columns by logical NAME, `dsh_`/`wdg_`/`qr_` id shapes. */
export type WidgetWire = {
  id: string;
  /** R179 — absent on a `note` widget. */
  queryId?: string;
  title: string;
  chartType: ChartType;
  /** R179 — `note` only: safe-subset markdown, ≤ 4000 chars. */
  md?: string;
  /** Omitted for a `stat` (KPI) widget — no grouping (R110). */
  dimensionCol?: string;
  /** R111 — optional second grouping ("split by") → multi-series bar. */
  seriesCol?: string;
  /** R115 — gauge only: the target/max (a literal config number). */
  target?: number;
  /** R116 — per-widget number format (presentation; default `plain`). */
  numberFormat?: NumberFormat;
  /** Required when `agg === 'sum'`; omitted for `count`. */
  measureCol?: string;
  /** R112 — combo only: the second measure, drawn as a line. */
  measureCol2?: string;
  /** R179 — absent on a `note`. */
  agg?: Agg;
  span: WidgetSpan;
  /** R177 — optional grid height in widget-rows (1–3); absent = 1. */
  rows?: WidgetRows;
  /** R181 — `table` only: footer totals by result column name. */
  totals?: Record<string, TotalSpec>;
};

/** The embedded dashboard body: the ordered widget set. */
export type DashboardDefinitionWire = {
  widgets: readonly WidgetWire[];
  /** R195 — parameter controls; omitted when none. */
  controls?: readonly DashboardControl[];
};

/** A dashboard as returned by the API. `name` and `slug` are each unique
 *  per workspace (the route is `/dashboards/<workspaceId>/<slug>`);
 *  `createdAt` server-stamped. */
export type DashboardWire = {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  definition: DashboardDefinitionWire;
  createdAt: string;
};

/** POST body — create a dashboard (`createDashboard`). */
export type CreateDashboardRequest = {
  name: string;
  slug: string;
  definition: DashboardDefinitionWire;
};

/** PUT body — full-representation update (`updateDashboard`): name + slug +
 *  widgets, all replaced. Same shape as create. */
export type UpdateDashboardRequest = CreateDashboardRequest;

// ─── wire ↔ FE-state adapter ─────────────────────────────────────────
// The component tree works with the flatter FE-state `Dashboard` (./types.ts)
// — widgets at the top level. On the wire they nest under `definition.widgets`
// (+ a server `createdAt`). These two functions are the single boundary that
// maps between them; the API hooks apply them so components never see the wire.

/** Wire dashboard → the component-facing FE `Dashboard` (flatten widgets). */
export function wireToDashboard(w: DashboardWire): Dashboard {
  return {
    id: w.id,
    workspaceId: w.workspaceId,
    name: w.name,
    slug: w.slug,
    widgets: [...w.definition.widgets],
    ...(w.definition.controls?.length ? { controls: [...w.definition.controls] } : {}),
  };
}

/** A widget list → the wire `definition` body (nest under `widgets`). */
export function widgetsToDefinition(
  widgets: readonly Widget[],
  // Required: a caller that forgot it would wipe the controls (BA-1 / CR P0-1).
  controls: readonly DashboardControl[] | undefined,
): DashboardDefinitionWire {
  // R195 — a control keeps only targets that are still widgets (a removed widget
  // would make the save fail); a control left with none is dropped.
  const ids = new Set(widgets.map((w) => w.id));
  const kept = (controls ?? [])
    .map((c) => (c.targets === 'all' ? c : { ...c, targets: c.targets.filter((id) => ids.has(id)) }))
    .filter((c) => c.targets === 'all' || c.targets.length > 0);
  return kept.length ? { widgets: [...widgets], controls: kept } : { widgets: [...widgets] };
}
