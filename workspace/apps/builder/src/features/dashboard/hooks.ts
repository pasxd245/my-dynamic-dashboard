// R100 — dashboard data layer.
//
// The static Sales dashboard binds each widget to a SAVED QUERY (by name — the
// seed names are stable; ids are server-generated) and runs it LIVE. There is
// no aggregation endpoint, so each widget fetches all rows (paged fetch-all)
// and rolls them up client-side (see `aggregate.ts`). FE-only — reuses the
// existing query-execution endpoints; no contract change.

import { theme } from 'antd';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import { DASHBOARD_MAX_ROWS, PAGE_SIZES } from '@/_generated/constants';
import { dashboardsApi } from '@/api/dashboardsApi';
import { datasetsApi } from '@/api/datasetsApi';
import { queriesApi } from '@/api/queriesApi';
import { useQueriesQuery } from '@/features/data-management/queries/hooks';
import { useWorkspacesQuery } from '@/features/data-management/workspaces/hooks';
import { distinctValues, isNumeric, type DataColumn } from './aggregate';
import type { Dashboard } from './types';
import { wireToDashboard, type CreateDashboardRequest, type UpdateDashboardRequest } from './wire';

/** The seed's workspace name (scripts/dev/seed.py · WS_NAME). */
export const SEED_WORKSPACE_NAME = 'Sales demo (seed)';

/** Largest allowed page (the contract caps page_size at 100) — minimises the
 *  fetch-all round-trips (~20 for a 2k-row query). */
const MAX_PAGE_SIZE = Math.max(...(PAGE_SIZES as readonly number[]));

/**
 * Fetch a saved query's rows by looping the paged rows-GET, BOUNDED at `cap`
 * (R104): stop once `cap` rows are pulled (or `total` is reached), so an
 * oversized query degrades gracefully instead of pulling everything. Returns
 * the (capped) rows + the server's `total` so the caller can warn when the view
 * is partial. The contract caps `page_size` at 100, so this still pages — the
 * cap bounds the page count (the request-count fix is the deferred server-side
 * pushdown, not a bigger page).
 */
async function fetchAllRows(id: string, cap: number): Promise<{ rows: (string | null)[][]; total: number }> {
  const first = await queriesApi.getRows(id, 1, MAX_PAGE_SIZE);
  const rows: (string | null)[][] = [...first.rows];
  const pageSize = first.pageSize > 0 ? first.pageSize : MAX_PAGE_SIZE;
  const targetRows = Math.min(cap, first.total);
  const pages = Math.ceil(targetRows / pageSize);
  for (let page = 2; page <= pages; page += 1) {
    const next = await queriesApi.getRows(id, page, pageSize);
    rows.push(...next.rows);
  }
  return { rows: rows.slice(0, cap), total: first.total };
}

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
  refetch: () => void;
};

/**
 * One widget's effective columns + full row set, as a SINGLE cache entry so the
 * widget render and the dashboard filter-options picker (R103) share the fetch
 * — no double round-trip. Column resolution mirrors QueryDetailPage: a
 * joined/composed query uses its server `resolvedColumns`; a single-source query
 * uses its source dataset's columns.
 */
async function fetchWidgetData(
  queryId: string,
): Promise<{ columns: readonly DataColumn[]; rows: (string | null)[][]; total: number; capped: boolean }> {
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
  const { rows, total } = await fetchAllRows(queryId, DASHBOARD_MAX_ROWS);
  return { columns, rows, total, capped: total > DASHBOARD_MAX_ROWS };
}

function widgetDataKey(queryId: string | undefined) {
  return ['dashboard-widget-data', queryId] as const;
}

export function useWidgetData(queryId: string | undefined): WidgetData {
  const q = useQuery({
    queryKey: widgetDataKey(queryId),
    queryFn: () => fetchWidgetData(queryId as string),
    enabled: typeof queryId === 'string' && queryId.length > 0,
  });
  return {
    columns: q.data?.columns ?? [],
    rows: q.data?.rows ?? [],
    total: q.data?.total ?? 0,
    capped: q.data?.capped ?? false,
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: () => {
      q.refetch().catch(() => undefined);
    },
  };
}

/** A filterable column + its distinct values (the per-widget filter picker). */
export type FilterOption = { column: string; values: string[] };

/**
 * R103 — ONE widget's filterable columns + distinct values (categorical only,
 * v1), read from its own `useWidgetData` (shared cache with the widget's
 * render). Powers the per-widget filter drawer: each widget filters on its OWN
 * columns, so there's no cross-widget column-matching ambiguity. Empty until
 * the widget's data has loaded (or when it has no categorical columns).
 */
export function useWidgetFilterOptions(queryId: string | undefined): { options: FilterOption[]; capped: boolean } {
  const { columns, rows, capped } = useWidgetData(queryId);
  const options: FilterOption[] = [];
  columns.forEach((c, i) => {
    if (isNumeric(c)) return; // categorical only (v1)
    options.push({ column: c.name, values: distinctValues(rows, i) });
  });
  // R104 — when the widget is capped, the distinct-value lists are partial too.
  return { options, capped };
}

/** Categorical chart palette drawn from the AntD theme tokens (Desirability:
 *  no ad-hoc hex — colours track the theme). Five hues cover the widest widget
 *  (the five telesale outcomes). */
export function useChartPalette(): string[] {
  const { token } = theme.useToken();
  return [token.colorPrimary, token.colorSuccess, token.colorWarning, token.colorError, token.colorInfo];
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
