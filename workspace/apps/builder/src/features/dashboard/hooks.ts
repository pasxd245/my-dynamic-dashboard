// R100 — dashboard data layer.
//
// The static Sales dashboard binds each widget to a SAVED QUERY (by name — the
// seed names are stable; ids are server-generated) and runs it LIVE. There is
// no aggregation endpoint, so each widget fetches all rows and rolls them up
// client-side (see `aggregate.ts`). R107 — the fetch is now a SINGLE
// `?unpaged=true` request (capped server-side at `dashboard_max_rows`),
// replacing the paged-at-100 loop.

import { theme } from 'antd';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import { dashboardsApi } from '@/api/dashboardsApi';
import { datasetsApi } from '@/api/datasetsApi';
import { queriesApi } from '@/api/queriesApi';
import { useQueriesQuery } from '@/features/data-management/queries/hooks';
import { useWorkspacesQuery } from '@/features/data-management/workspaces/hooks';
import { distinctValues, isNumeric, type DataColumn } from './aggregate';
import { ApiErrorThrown } from '@/features/data-management/_shared/types';
import type {
  AggregateFilter,
  AggregateRequest,
  ParamContext,
  ResolvedParams,
  TotalsRequest,
} from '@/features/data-management/queries/types';
import type { Dashboard } from './types';
import { wireToDashboard, type CreateDashboardRequest, type UpdateDashboardRequest } from './wire';
import { HISTORY_QUERY_KEY } from '@/features/history/hooks';

/** The seed's workspace name (scripts/dev/seed.py · WS_NAME). */
export const SEED_WORKSPACE_NAME = 'Sales demo (seed)';

/** The seed workspace's id (looked up by name), with load state. */
export function useSeedWorkspace(): { id: string | undefined; isLoading: boolean; isError: boolean } {
  const ws = useWorkspacesQuery();
  return {
    id: ws.data?.find((w) => w.name === SEED_WORKSPACE_NAME)?.id,
    isLoading: ws.isLoading,
    isError: ws.isError,
  };
}

/** Resolve a saved query id by NAME within a workspace. */
export function useQueryIdByName(workspaceId: string | undefined, name: string): string | undefined {
  const queries = useQueriesQuery(workspaceId);
  return queries.data?.find((q) => q.name === name)?.id;
}

export type WidgetData = {
  /** The effective columns (joined → `resolvedColumns`; single-source →
   *  the source dataset's columns — the QueryDetailPage rule). */
  columns: readonly DataColumn[];
  /** Rows, BOUNDED at the fetch cap (R104). `capped` says whether they're partial. */
  rows: readonly (readonly (string | null)[])[];
  /** The server's full row count for the query (may exceed `rows.length`). */
  total: number;
  /** R104 — true when `total` exceeded the cap, so `rows` (and any aggregate /
   *  filter built on them) is PARTIAL. */
  capped: boolean;
  isLoading: boolean;
  isError: boolean;
  /** R195 — the failure, so a card can name a parameter that needs a value. */
  error: unknown;
  /** R195 — the parameter values the read used. */
  resolvedParams?: ResolvedParams;
  /** R197 — the datasets (and versions) the read read (R196). */
  dataVersions?: Readonly<Record<string, number>>;
  refetch: () => void;
};

/** R195 — a structured 4xx (e.g. `param_unbound`) is an answer, not a hiccup:
 *  retrying it only delays the message (QA P2-2). */
export function retryUnlessRefused(failures: number, err: unknown): boolean {
  return !(err instanceof ApiErrorThrown && err.status < 500) && failures < 3;
}

/**
 * One widget's effective columns + full row set, as a SINGLE cache entry so the
 * widget render and the dashboard filter-options picker (R103) share the fetch
 * — no double round-trip. Column resolution mirrors QueryDetailPage: a
 * joined/composed query uses its server `resolvedColumns`; a single-source query
 * uses its source dataset's columns.
 */
/** R195 — a query's chartable columns alone (no row read): the widget builder
 *  needs them even when a read would refuse for a missing parameter (QA P1-2). */
async function fetchWidgetColumns(queryId: string): Promise<readonly DataColumn[]> {
  const query = await queriesApi.get(queryId);
  const joined = (query.resolvedColumns?.length ?? 0) > 0;
  let columns: readonly DataColumn[];
  if (joined) {
    columns = query.resolvedColumns ?? [];
  } else if (query.sourceId.startsWith('ds_')) {
    columns = (await datasetsApi.get(query.sourceId)).columns;
  } else {
    columns = []; // composed (qr_) single-source without resolvedColumns — rare; no columns to chart
  }
  // R107 — one unpaged request; the server caps rows at `dashboard_max_rows`
  // and returns the full `total`, so a partial (capped) result is `total > len`.
  return columns;
}

export function useWidgetColumns(queryId: string | undefined): { columns: readonly DataColumn[]; isLoading: boolean } {
  const q = useQuery({
    queryKey: ['dashboard-widget-columns', queryId] as const,
    queryFn: () => fetchWidgetColumns(queryId as string),
    enabled: typeof queryId === 'string' && queryId.length > 0,
  });
  return { columns: q.data ?? [], isLoading: q.isLoading };
}

async function fetchWidgetData(
  queryId: string,
  ctx?: ParamContext,
  shared?: readonly AggregateFilter[],
): Promise<{
  columns: readonly DataColumn[];
  rows: (string | null)[][];
  total: number;
  capped: boolean;
  resolvedParams?: ResolvedParams;
  dataVersions?: Readonly<Record<string, number>>;
}> {
  const query = await queriesApi.get(queryId);
  const joined = (query.resolvedColumns?.length ?? 0) > 0;
  let columns: readonly DataColumn[];
  if (joined) {
    columns = query.resolvedColumns ?? [];
  } else if (query.sourceId.startsWith('ds_')) {
    columns = (await datasetsApi.get(query.sourceId)).columns;
  } else {
    columns = []; // composed (qr_) single-source without resolvedColumns — rare; no columns to chart
  }
  // R107 — one unpaged request; the server caps rows at `dashboard_max_rows`
  // and returns the full `total`, so a partial (capped) result is `total > len`.
  const { rows, total, resolvedParams, dataVersions } = await queriesApi.getUnpagedRows(queryId, ctx, shared);
  return { columns, rows, total, capped: total > rows.length, resolvedParams, dataVersions };
}

function widgetDataKey(queryId: string | undefined, ctx?: ParamContext, shared?: readonly AggregateFilter[]) {
  return ['dashboard-widget-data', queryId, ctx ?? null, shared?.length ? shared : null] as const;
}

export function useWidgetData(
  queryId: string | undefined,
  enabled = true,
  ctx?: ParamContext,
  // R199 — the viewer's shared selections for this widget (`f.*` on the read).
  shared?: readonly AggregateFilter[],
): WidgetData {
  // R119 — `enabled` lets an aggregating widget (bar/pie/line/stat) SKIP the raw
  // fetch: it binds to the server aggregate instead, so it never pulls (capped)
  // rows. The filter-options drawer still calls this with the default `enabled`,
  // so the raw rows are fetched lazily only when a filter drawer opens.
  const q = useQuery({
    queryKey: widgetDataKey(queryId, ctx, shared),
    queryFn: () => fetchWidgetData(queryId as string, ctx, shared),
    retry: retryUnlessRefused,
    enabled: enabled && typeof queryId === 'string' && queryId.length > 0,
  });
  return {
    columns: q.data?.columns ?? [],
    rows: q.data?.rows ?? [],
    total: q.data?.total ?? 0,
    capped: q.data?.capped ?? false,
    isLoading: q.isLoading,
    isError: q.isError,
    error: q.error,
    resolvedParams: q.data?.resolvedParams,
    dataVersions: q.data?.dataVersions,
    refetch: () => {
      q.refetch().catch(() => undefined);
    },
  };
}

/** R119 — one aggregating widget's server-computed GROUP BY result. `enabled`
 *  gates the fetch (so a non-aggregating widget doesn't call the endpoint). The
 *  result is small (one row per group) — no cap, so totals are correct. */
export type WidgetAggregate = {
  columns: readonly DataColumn[];
  rows: readonly (readonly (string | null)[])[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  resolvedParams?: ResolvedParams;
  dataVersions?: Readonly<Record<string, number>>;
};

/** R181 — the server sums for a table widget's footer (whole filtered result).
 *  Disabled when the widget has no `totals`; one request per distinct column set. */
export function useWidgetTotals(
  queryId: string | undefined,
  body: TotalsRequest,
  enabled: boolean,
): { sums: Record<string, string | null> | undefined; rowCount: number | undefined; isError: boolean } {
  const q = useQuery({
    queryKey: ['dashboard-widget-totals', queryId, body] as const,
    queryFn: () => queriesApi.totals(queryId as string, body),
    retry: retryUnlessRefused,
    enabled: enabled && typeof queryId === 'string' && queryId.length > 0 && body.columns.length > 0,
  });
  return { sums: q.data?.sums, rowCount: q.data?.rowCount, isError: q.isError };
}

export function useWidgetAggregate(
  queryId: string | undefined,
  body: AggregateRequest,
  enabled: boolean,
): WidgetAggregate {
  const q = useQuery({
    queryKey: ['dashboard-widget-aggregate', queryId, body] as const,
    queryFn: () => queriesApi.aggregate(queryId as string, body),
    retry: retryUnlessRefused,
    enabled: enabled && typeof queryId === 'string' && queryId.length > 0,
  });
  return {
    columns: q.data?.columns ?? [],
    rows: q.data?.rows ?? [],
    total: q.data?.total ?? 0,
    isLoading: q.isLoading,
    isError: q.isError,
    error: q.error,
    resolvedParams: q.data?.resolvedParams,
    dataVersions: q.data?.dataVersions,
  };
}

/** A filterable column + its distinct values (the per-widget filter picker). */
export type FilterOption = { column: string; values: string[] };

/**
 * R103 — ONE widget's filterable columns + distinct values (categorical only,
 * v1), read from its own raw `useWidgetData` fetch (an aggregating widget
 * renders from the server aggregate, so this is a fetch of its own). Powers the per-widget filter drawer: each widget filters on its OWN
 * columns, so there's no cross-widget column-matching ambiguity. Empty until
 * the widget's data has loaded (or when it has no categorical columns).
 */
export function useWidgetFilterOptions(
  queryId: string | undefined,
  // R195 — the same parameter context as the card, so the options are the card's values.
  ctx?: ParamContext,
  // R199 — and the same shared selections (the drawer ANDs with them).
  shared?: readonly AggregateFilter[],
): { options: FilterOption[]; capped: boolean } {
  const { columns, rows, capped } = useWidgetData(queryId, true, ctx, shared);
  const options: FilterOption[] = [];
  columns.forEach((c, i) => {
    if (isNumeric(c)) return; // categorical only (v1)
    options.push({ column: c.name, values: distinctValues(rows, i) });
  });
  // R104 — when the widget is capped, the distinct-value lists are partial too.
  return { options, capped };
}

/** R199 — the result columns of several queries at once (the same cache entries
 *  as `useWidgetColumns`): the reach badge and the values control need to know
 *  which widgets' results HAVE a column (D5). A query still loading is absent. */
export function useColumnsOfQueries(queryIds: readonly string[]): ReadonlyMap<string, readonly DataColumn[]> {
  const unique = [...new Set(queryIds)];
  const results = useQueries({
    queries: unique.map((id) => ({
      queryKey: ['dashboard-widget-columns', id] as const,
      queryFn: () => fetchWidgetColumns(id),
    })),
  });
  const out = new Map<string, readonly DataColumn[]>();
  results.forEach((r, i) => {
    if (r.data) out.set(unique[i], r.data);
  });
  return out;
}

/** R199 — a values control's options (`GET /queries/{id}/values`), read over
 *  one widget's query with that widget's parameter context. */
export function useColumnValues(queryId: string | undefined, column: string | undefined, ctx?: ParamContext) {
  const q = useQuery({
    queryKey: ['dashboard-column-values', queryId, column, ctx ?? null] as const,
    queryFn: () => queriesApi.values(queryId as string, column as string, ctx),
    retry: retryUnlessRefused,
    enabled: Boolean(queryId) && Boolean(column),
  });
  return {
    values: q.data?.values ?? [],
    partial: q.data?.partial ?? false,
    isLoading: q.isLoading,
    isError: q.isError,
  };
}

/** Categorical chart palette drawn from the AntD theme tokens (Desirability:
 *  no ad-hoc hex — colours track the theme). R175: the semantic tokens alone
 *  give four distinct hues (`colorInfo` equals `colorPrimary` in the default
 *  theme), so a 6-status or 15-reason series repeated colours; the AntD preset
 *  hues extend it to twelve, de-duplicated so a custom theme never repeats. */
export function useChartPalette(): string[] {
  const { token } = theme.useToken();
  const hues = [
    token.colorPrimary,
    token.colorSuccess,
    token.colorWarning,
    token.colorError,
    token.purple,
    token.cyan,
    token.magenta,
    token.gold,
    token.geekblue,
    token.lime,
    token.volcano,
    token.colorInfo,
  ];
  return [...new Set(hues.filter((h): h is string => typeof h === 'string' && h.length > 0))];
}

// ─── R101 — dashboard CRUD (persisted noun, real API) ────────────────
// Keys mirror queries: ['dashboards', { workspaceId }] (per-workspace list) +
// ['dashboard', id] (single). The hooks adapt the wire shape to the flatter FE
// `Dashboard` at the boundary (wireToDashboard) so components stay wire-free.
const DASHBOARDS_QUERY_KEY = ['dashboards'] as const;

function dashboardsKey(workspaceId: string | undefined) {
  return [...DASHBOARDS_QUERY_KEY, { workspaceId }] as const;
}

/** GET /workspaces/{id}/dashboards — one workspace's dashboards, newest first. */
export function useDashboardsQuery(workspaceId: string | undefined) {
  return useQuery<Dashboard[]>({
    queryKey: dashboardsKey(workspaceId),
    queryFn: () => dashboardsApi.list(workspaceId as string).then((ws) => ws.map(wireToDashboard)),
    enabled: typeof workspaceId === 'string' && workspaceId.length > 0,
  });
}

export type DashboardWithWorkspace = { dashboard: Dashboard; workspaceName: string };

/**
 * Every workspace's dashboards, flattened with their workspace name — the
 * source for the dynamic nav + the Settings catalog (there is no global
 * dashboards endpoint; dashboards are workspace-scoped, so we fan out one list
 * query per workspace via `useQueries` — cached + deduped by the per-workspace
 * key, so the catalog and nav share them).
 */
export function useAllDashboards(): {
  items: DashboardWithWorkspace[];
  isLoading: boolean;
  isError: boolean;
} {
  const ws = useWorkspacesQuery();
  const workspaces = ws.data ?? [];
  const results = useQueries({
    queries: workspaces.map((w) => ({
      queryKey: dashboardsKey(w.id),
      queryFn: () => dashboardsApi.list(w.id).then((list) => list.map(wireToDashboard)),
    })),
  });
  const items: DashboardWithWorkspace[] = [];
  results.forEach((r, i) => {
    for (const dashboard of r.data ?? []) {
      items.push({ dashboard, workspaceName: workspaces[i].name });
    }
  });
  return {
    items,
    isLoading: ws.isLoading || results.some((r) => r.isLoading),
    isError: ws.isError || results.some((r) => r.isError),
  };
}

/** POST /workspaces/{id}/dashboards — create. Invalidates the lists. */
export function useCreateDashboardMutation() {
  const queryClient = useQueryClient();
  return useMutation<Dashboard, Error, { workspaceId: string; body: CreateDashboardRequest }>({
    mutationFn: ({ workspaceId, body }) => dashboardsApi.create(workspaceId, body).then(wireToDashboard),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DASHBOARDS_QUERY_KEY });
    },
  });
}

/** PUT /dashboards/{id} — full-representation update (name + slug + widgets).
 *  Invalidates the lists + the single cache. */
export function useUpdateDashboardMutation() {
  const queryClient = useQueryClient();
  return useMutation<Dashboard, Error, { id: string; body: UpdateDashboardRequest }>({
    mutationFn: ({ id, body }) => dashboardsApi.update(id, body).then(wireToDashboard),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: DASHBOARDS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard', updated.id] });
      // R195 — a saved control value changes what every widget reads, under the
      // same keys (code review P1-1): re-read them.
      queryClient.invalidateQueries({ queryKey: ['dashboard-widget-data'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-widget-aggregate'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-widget-totals'] });
      // R199 — a saved shared selection changes what the reads return, too.
      queryClient.invalidateQueries({ queryKey: ['dashboard-column-values'] });
      // R200 — a definition change (an edit or a restore) adds a history row.
      queryClient.invalidateQueries({ queryKey: HISTORY_QUERY_KEY });
      // BA-F1 — … and moves the notes: a definition change (a restore) changes their
      // state, and a dashboard save sets widget notes aside or brings them back.
      queryClient.invalidateQueries({ queryKey: ['metadata'] });
    },
  });
}

/** DELETE /dashboards/{id}. Invalidates the lists + drops the single cache. */
export function useDeleteDashboardMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => dashboardsApi.delete(id),
    onSuccess: (_void, id) => {
      queryClient.invalidateQueries({ queryKey: DASHBOARDS_QUERY_KEY });
      queryClient.removeQueries({ queryKey: ['dashboard', id] });
    },
  });
}
