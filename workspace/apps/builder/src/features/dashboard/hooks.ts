// R100 — dashboard data layer.
//
// The static Sales dashboard binds each widget to a SAVED QUERY (by name — the
// seed names are stable; ids are server-generated) and runs it LIVE. There is
// no aggregation endpoint, so each widget fetches all rows (paged fetch-all)
// and rolls them up client-side (see `aggregate.ts`). FE-only — reuses the
// existing query-execution endpoints; no contract change.

import { theme } from 'antd';
import { useQuery } from '@tanstack/react-query';

import { PAGE_SIZES } from '@/_generated/constants';
import { queriesApi } from '@/api/queriesApi';
import { useDatasetQuery } from '@/features/data-management/datasets/hooks';
import { useQueriesQuery, useQueryQuery } from '@/features/data-management/queries/hooks';
import { useWorkspacesQuery } from '@/features/data-management/workspaces/hooks';
import type { Column } from '@/features/data-management/datasets/types';
import type { ResolvedColumn } from '@/features/data-management/queries/types';
import type { ColumnLike } from './aggregate';

/** The seed's workspace name (scripts/dev/seed.py · WS_NAME). */
export const SEED_WORKSPACE_NAME = 'Sales demo (seed)';

/** Largest allowed page (the contract caps page_size at 100) — minimises the
 *  fetch-all round-trips (~20 for a 2k-row query). */
const MAX_PAGE_SIZE = Math.max(...(PAGE_SIZES as readonly number[]));

/**
 * Fetch ALL rows of a saved query by looping the paged rows-GET to `total`.
 * The contract exposes only paged raw rows; this is the FE-only path the
 * Design gate resolved (decision #1).
 */
async function fetchAllRows(id: string): Promise<(string | null)[][]> {
  const first = await queriesApi.getRows(id, 1, MAX_PAGE_SIZE);
  const rows: (string | null)[][] = [...first.rows];
  const pages = first.pageSize > 0 ? Math.ceil(first.total / first.pageSize) : 1;
  for (let page = 2; page <= pages; page += 1) {
    const next = await queriesApi.getRows(id, page, first.pageSize);
    rows.push(...next.rows);
  }
  return rows;
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
  columns: readonly ColumnLike[];
  rows: readonly (readonly (string | null)[])[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

/**
 * Columns + the full row set for one saved query.
 *
 * Column resolution mirrors QueryDetailPage: a joined/composed query uses its
 * server-computed `resolvedColumns`; a single-source query uses its source
 * dataset's columns.
 */
export function useWidgetData(queryId: string | undefined): WidgetData {
  const queryQ = useQueryQuery(queryId);
  const query = queryQ.data;
  const joined = (query?.resolvedColumns?.length ?? 0) > 0;
  const sourceDatasetId =
    query && !joined && query.sourceId.startsWith('ds_') ? query.sourceId : undefined;
  const datasetQ = useDatasetQuery(sourceDatasetId);

  const columns: readonly ColumnLike[] = joined
    ? (query?.resolvedColumns as readonly ResolvedColumn[])
    : ((datasetQ.data?.columns as readonly Column[]) ?? []);

  const rowsQ = useQuery({
    queryKey: ['dashboard-all-rows', queryId] as const,
    queryFn: () => fetchAllRows(queryId as string),
    enabled: typeof queryId === 'string',
  });

  return {
    columns,
    rows: rowsQ.data ?? [],
    isLoading: queryQ.isLoading || rowsQ.isLoading || (Boolean(sourceDatasetId) && datasetQ.isLoading),
    isError: queryQ.isError || rowsQ.isError || datasetQ.isError,
    refetch: () => {
      void rowsQ.refetch();
    },
  };
}

/** Categorical chart palette drawn from the AntD theme tokens (Desirability:
 *  no ad-hoc hex — colours track the theme). Five hues cover the widest widget
 *  (the five telesale outcomes). */
export function useChartPalette(): string[] {
  const { token } = theme.useToken();
  return [token.colorPrimary, token.colorSuccess, token.colorWarning, token.colorError, token.colorInfo];
}
