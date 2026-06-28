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

import type { ChartType, Agg, WidgetSpan, Dashboard, Widget } from './types';

/** A widget as carried on the wire. Same fields as the FE-state `Widget`
 *  (./types.ts) — columns by logical NAME, `dsh_`/`wdg_`/`qr_` id shapes. */
export type WidgetWire = {
  id: string;
  queryId: string;
  title: string;
  chartType: ChartType;
  dimensionCol: string;
  /** Required when `agg === 'sum'`; omitted for `count`. */
  measureCol?: string;
  agg: Agg;
  span: WidgetSpan;
};

/** The embedded dashboard body: the ordered widget set. */
export type DashboardDefinitionWire = {
  widgets: readonly WidgetWire[];
};

/** A dashboard as returned by the API. `name` unique per-workspace; `slug`
 *  unique globally (the URL routing key); `createdAt` server-stamped. */
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
  };
}

/** A widget list → the wire `definition` body (nest under `widgets`). */
export function widgetsToDefinition(widgets: readonly Widget[]): DashboardDefinitionWire {
  return { widgets: [...widgets] };
}
