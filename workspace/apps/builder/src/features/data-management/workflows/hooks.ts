import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { workflowsApi } from '@/api/workflowsApi';
import type { Column, RowsPage } from '@/features/data-management/datasets/types';
import { useDatasetQuery } from '@/features/data-management/datasets/hooks';
import { useQueryQuery } from '@/features/data-management/queries/hooks';
import type { CreateWorkflowRequest, Workflow } from './types';

// R132–R135 — Workflow TanStack hooks. Key shapes mirror queries:
//   ['workflows', { workspaceId }]                  — list (workspace-scoped)
//   ['workflow', id]                                — single workflow
//   ['workflow-rows', id, { page, pageSize }]       — materialized output rows
const WORKFLOWS_QUERY_KEY = ['workflows'] as const;

function workflowsKey(workspaceId: string | undefined) {
  return [...WORKFLOWS_QUERY_KEY, { workspaceId }] as const;
}

export function useWorkflowsQuery(workspaceId: string | undefined) {
  return useQuery<Workflow[]>({
    queryKey: workflowsKey(workspaceId),
    queryFn: () => workflowsApi.list(workspaceId as string),
    enabled: typeof workspaceId === 'string' && workspaceId.length > 0,
  });
}

export function useWorkflowQuery(id: string | undefined) {
  return useQuery<Workflow>({
    queryKey: ['workflow', id] as const,
    queryFn: () => workflowsApi.get(id as string),
    enabled: typeof id === 'string' && id.length > 0,
  });
}

/** GET /workflows/{id}/rows — the MATERIALIZED output, paged. Keyed
 *  independently of the workflow metadata so paging doesn't refetch it.
 *  Not enabled until the workflow has been run (no output before then). */
export function useWorkflowRowsQuery(id: string | undefined, page: number, pageSize: number, enabled: boolean) {
  return useQuery<RowsPage>({
    queryKey: ['workflow-rows', id, { page, pageSize }] as const,
    queryFn: () => workflowsApi.getRows(id as string, page, pageSize),
    enabled: enabled && typeof id === 'string' && id.length > 0,
    placeholderData: (prev) => prev,
    retry: false,
  });
}

/** POST /workspaces/{id}/workflows — save. Invalidates the workspace's list. */
export function useCreateWorkflowMutation() {
  const queryClient = useQueryClient();
  return useMutation<Workflow, Error, { workspaceId: string; body: CreateWorkflowRequest }>({
    mutationFn: ({ workspaceId, body }) => workflowsApi.create(workspaceId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKFLOWS_QUERY_KEY });
    },
  });
}

/** POST /workflows/{id}/run — materialize. Invalidates the single (new
 *  `materializedAt`) + the rows caches (the output changed). */
export function useRunWorkflowMutation() {
  const queryClient = useQueryClient();
  return useMutation<Workflow, Error, string>({
    mutationFn: (id) => workflowsApi.run(id),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: WORKFLOWS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['workflow', updated.id] });
      queryClient.invalidateQueries({ queryKey: ['workflow-rows', updated.id] });
    },
  });
}

/** DELETE /workflows/{id}. Invalidates the lists and drops the single + rows caches. */
export function useDeleteWorkflowMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => workflowsApi.delete(id),
    onSuccess: (_void, id) => {
      queryClient.invalidateQueries({ queryKey: WORKFLOWS_QUERY_KEY });
      queryClient.removeQueries({ queryKey: ['workflow', id] });
      queryClient.removeQueries({ queryKey: ['workflow-rows', id] });
    },
  });
}

/** Resolve the author-time column space of a workflow's FIRST source (the
 *  declared consolidation schema, matching the backend's `columns = first
 *  source`). A `qr_` uses its `resolvedColumns` when joined/composed, else its
 *  source dataset's columns; a `wf_` uses its materialized `resolvedColumns`.
 *  Feeds `StepsEditor`'s `columns` prop. No live preview — this is only the
 *  column vocabulary for authoring steps. */
export function useSourceColumns(sourceId: string | undefined): { columns: Column[]; loading: boolean } {
  const isWf = typeof sourceId === 'string' && sourceId.startsWith('wf_');
  const isQr = typeof sourceId === 'string' && sourceId.startsWith('qr_');

  const wf = useWorkflowQuery(isWf ? sourceId : undefined);
  const qr = useQueryQuery(isQr ? sourceId : undefined);
  // A single-source `qr_` (no join/steps) has no resolvedColumns → fall back to
  // its source dataset's columns.
  const needsDataset = isQr && !!qr.data && !(qr.data.resolvedColumns?.length ?? 0);
  const baseDatasetId = needsDataset && qr.data?.sourceId.startsWith('ds_') ? qr.data.sourceId : undefined;
  const ds = useDatasetQuery(baseDatasetId);

  const toColumns = (cols: readonly { name: string; dtype: Column['dtype'] }[] | undefined): Column[] =>
    (cols ?? []).map((c) => ({ name: c.name, dtype: c.dtype }));

  if (isWf) return { columns: toColumns(wf.data?.resolvedColumns), loading: wf.isLoading };
  if (isQr) {
    if (qr.data?.resolvedColumns?.length) return { columns: toColumns(qr.data.resolvedColumns), loading: qr.isLoading };
    return { columns: toColumns(ds.data?.columns), loading: qr.isLoading || ds.isLoading };
  }
  return { columns: [], loading: false };
}
