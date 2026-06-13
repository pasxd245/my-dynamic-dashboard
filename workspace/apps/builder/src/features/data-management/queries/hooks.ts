import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queriesApi } from '@/api/queriesApi';
import type { RowsPage } from '@/features/data-management/datasets/types';
import type { CreateQueryRequest, Query } from './types';

// R69 — Saved Query TanStack hooks. Key shapes mirror datasets:
//   ['queries', { workspaceId }] — list (scoped to a workspace)
//   ['query', id]                — single query (definition + metadata)
//   ['query-rows', id, { page, pageSize }] — run results
const QUERIES_QUERY_KEY = ['queries'] as const;

function queriesKey(workspaceId: string | undefined) {
  return [...QUERIES_QUERY_KEY, { workspaceId }] as const;
}

export function useQueriesQuery(workspaceId: string | undefined) {
  return useQuery<Query[]>({
    queryKey: queriesKey(workspaceId),
    queryFn: () => queriesApi.list(workspaceId as string),
    enabled: typeof workspaceId === 'string' && workspaceId.length > 0,
  });
}

export function useQueryQuery(id: string | undefined) {
  return useQuery<Query>({
    queryKey: ['query', id] as const,
    queryFn: () => queriesApi.get(id as string),
    enabled: typeof id === 'string',
  });
}

/** GET /queries/{id}/rows — the live re-run. Keyed independently of the
 *  query metadata so paging doesn't refetch the definition. */
export function useQueryRowsQuery(id: string | undefined, page: number, pageSize: number) {
  return useQuery<RowsPage>({
    queryKey: ['query-rows', id, { page, pageSize }] as const,
    queryFn: () => queriesApi.getRows(id as string, page, pageSize),
    enabled: typeof id === 'string',
    placeholderData: (prev) => prev,
  });
}

/** POST /workspaces/{id}/queries — save. Invalidates the workspace's list. */
export function useCreateQueryMutation() {
  const queryClient = useQueryClient();
  return useMutation<Query, Error, { workspaceId: string; body: CreateQueryRequest }>({
    mutationFn: ({ workspaceId, body }) => queriesApi.create(workspaceId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERIES_QUERY_KEY });
    },
  });
}

/** DELETE /queries/{id}. Invalidates the lists and drops the single +
 *  rows caches for this id. */
export function useDeleteQueryMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => queriesApi.delete(id),
    onSuccess: (_void, id) => {
      queryClient.invalidateQueries({ queryKey: QUERIES_QUERY_KEY });
      queryClient.removeQueries({ queryKey: ['query', id] });
      queryClient.removeQueries({ queryKey: ['query-rows', id] });
    },
  });
}
