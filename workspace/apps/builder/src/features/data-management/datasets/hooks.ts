import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { datasetsApi } from '../../../api/datasetsApi';
import { uploadsApi } from '../../../api/uploadsApi';
import type {
  CommitBatchRequest,
  CommitBatchResponse,
  Dataset,
  ParseSheetsRequest,
  ParseSheetsResponse,
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
