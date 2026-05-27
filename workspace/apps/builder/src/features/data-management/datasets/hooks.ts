import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { datasetsApi } from '@/api/datasetsApi';
import { uploadsApi } from '@/api/uploadsApi';
import { cacheKeyForFilters } from './filters/serialize';
import type {
  CommitBatchRequest,
  CommitBatchResponse,
  Dataset,
  FilterSet,
  ParseSheetsRequest,
  ParseSheetsResponse,
  RowsPage,
  TempUploadResponse,
} from './types';

const DATASETS_QUERY_KEY = ['datasets'] as const;

function datasetsKey(workspaceId?: string) {
  return workspaceId ? ([...DATASETS_QUERY_KEY, { workspaceId }] as const) : DATASETS_QUERY_KEY;
}

export function useDatasetsQuery(workspaceId?: string) {
  return useQuery<Dataset[]>({
    queryKey: datasetsKey(workspaceId),
    queryFn: () => datasetsApi.list(workspaceId),
  });
}

/** R36: GET /datasets/{id} — single dataset detail. Cache key
 *  `['datasets', { id }]` matches the list-cache prefix so
 *  R26's existing list-level invalidation also bumps detail. */
export function useDatasetQuery(id: string | undefined) {
  return useQuery<Dataset>({
    queryKey: [...DATASETS_QUERY_KEY, { id }] as const,
    queryFn: () => datasetsApi.get(id as string),
    enabled: typeof id === 'string',
  });
}

/** R36: GET /datasets/{id}/rows — paged rows with optional substring filter.
 *  `q` is part of the cache key so the same page across different searches
 *  caches independently. The undefined-vs-empty distinction is preserved:
 *  `q: undefined` is the unfiltered cache; `q: 'foo'` is the filtered cache.
 *  R40 extension: `filters` is also part of the cache key (serialized via
 *  `cacheKeyForFilters` for stable string equality). */
export function useDatasetRowsQuery(
  id: string | undefined,
  page: number,
  pageSize: number,
  q: string | undefined,
  filters?: FilterSet,
) {
  const filtersKey = cacheKeyForFilters(filters);
  return useQuery<RowsPage>({
    queryKey: [
      ...DATASETS_QUERY_KEY,
      { id },
      'rows',
      { page, pageSize, q, filters: filtersKey },
    ] as const,
    queryFn: () => datasetsApi.getRows(id as string, page, pageSize, q, filters),
    enabled: typeof id === 'string',
    // Keep the previous page visible while a new query loads (AntD
    // `<Table loading>` overlay handles the visual; this just prevents
    // the page from going blank during page/page_size/q transitions).
    placeholderData: (prev) => prev,
  });
}

export function useUploadInitMutation() {
  return useMutation<TempUploadResponse, Error, { file: File; sourceFormat: 'csv' | 'excel' }>({
    mutationFn: ({ file, sourceFormat }) => uploadsApi.createTemp(file, sourceFormat),
  });
}

export function useUploadParseMutation() {
  return useMutation<ParseSheetsResponse, Error, { tempId: string; body: ParseSheetsRequest }>({
    mutationFn: ({ tempId, body }) => uploadsApi.parseSheets(tempId, body),
  });
}

export function useDatasetsCommitMutation() {
  const queryClient = useQueryClient();
  return useMutation<CommitBatchResponse, Error, { workspaceId: string; body: CommitBatchRequest }>({
    mutationFn: ({ workspaceId, body }) => datasetsApi.commitBatch(workspaceId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DATASETS_QUERY_KEY });
    },
  });
}

const WORKSPACES_QUERY_KEY = ['workspaces'] as const;

/** R26: PATCH /datasets/{id} — rename. Invalidates the workspaces
 *  query too because the workspace column on the datasets table
 *  resolves names via the workspace cache. */
export function useRenameDatasetMutation() {
  const queryClient = useQueryClient();
  return useMutation<Dataset, Error, { id: string; name: string }>({
    mutationFn: ({ id, name }) => datasetsApi.patch(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DATASETS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY });
    },
  });
}

/** R26: DELETE /datasets/{id} — atomic with BE-side parquet cleanup.
 *  No 409 path; just 204 success or 404 missing. */
export function useDeleteDatasetMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => datasetsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DATASETS_QUERY_KEY });
    },
  });
}
