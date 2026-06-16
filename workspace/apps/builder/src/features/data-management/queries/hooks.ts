import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queriesApi } from '@/api/queriesApi';
import type { RowsPage } from '@/features/data-management/datasets/types';
import type {
  CreateQueryRequest,
  Query,
  QueryDefinition,
  QueryPreview,
  UpdateQueryRequest,
} from './types';

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

/** R72 — POST /workspaces/{id}/queries/preview. The live preview of an
 *  UNSAVED working-copy definition. Keyed on a stable serialization of the
 *  definition + paging so editing re-runs only when the draft actually
 *  changes; `enabled` is the builder's edit-mode flag. `placeholderData`
 *  keeps the last preview visible while the next runs (no flash to empty). */
export function useQueryPreviewQuery(
  workspaceId: string | undefined,
  definition: QueryDefinition,
  page: number,
  pageSize: number,
  enabled: boolean,
  // R79 — the canonical driving source: a `ds_` dataset (the R69→R75 path) or a
  // `qr_` saved Query (the preview is then COMPOSED, built on that Query).
  sourceId: string | undefined,
) {
  const defKey = JSON.stringify(definition);
  return useQuery<QueryPreview>({
    queryKey: ['query-preview', workspaceId, sourceId, defKey, { page, pageSize }] as const,
    queryFn: () =>
      queriesApi.preview(workspaceId as string, { sourceId: sourceId as string, definition }, page, pageSize),
    enabled:
      enabled &&
      typeof workspaceId === 'string' &&
      typeof sourceId === 'string' &&
      sourceId.length > 0,
    placeholderData: (prev) => prev,
    retry: false,
  });
}

/** R72 — PUT /queries/{id}. Persists an edited definition; invalidates the
 *  single + rows caches (so the read-only view re-runs the new definition)
 *  and the lists (the predicate counts may have changed). */
export function useUpdateQueryMutation() {
  const queryClient = useQueryClient();
  return useMutation<Query, Error, { id: string; body: UpdateQueryRequest }>({
    mutationFn: ({ id, body }) => queriesApi.update(id, body),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: QUERIES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['query', updated.id] });
      queryClient.invalidateQueries({ queryKey: ['query-rows', updated.id] });
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
