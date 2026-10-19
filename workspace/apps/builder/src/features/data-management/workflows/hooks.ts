import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { workflowsApi } from '@/api/workflowsApi';
import { ApiErrorThrown } from '@/features/data-management/_shared/types';
import type { Column, Dataset, RowsPage } from '@/features/data-management/datasets/types';
import { useDatasetQuery } from '@/features/data-management/datasets/hooks';
import { useQueryQuery } from '@/features/data-management/queries/hooks';
import type { CreateWorkflowRequest, Workflow } from './types';
import { HISTORY_QUERY_KEY } from '@/features/history/hooks';

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
    // A deleted workflow (404) won't come back on retry: fail at once (R192 —
    // the published dataset's "(deleted)" line shows without a 7 s wait).
    retry: (count, err) => !(err instanceof ApiErrorThrown && err.status === 404) && count < 3,
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

/** R192 — publish the frozen output as a dataset. Refreshes the workflow (its
 *  `published` line), every dataset list / detail (the dataset is new or its rows
 *  and version moved) and any query rows reading it. */
export function usePublishWorkflowMutation() {
  const queryClient = useQueryClient();
  return useMutation<{ dataset: Dataset; created: boolean }, Error, { id: string; name?: string }>({
    mutationFn: ({ id, name }) => workflowsApi.publish(id, name === undefined ? {} : { name }),
    onSuccess: () => {
      // Every workflow (a downstream one may now be out of date), every dataset,
      // and everything that reads rows: query pages and dashboard widgets.
      queryClient.invalidateQueries({ queryKey: WORKFLOWS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['workflow'] });
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      queryClient.invalidateQueries({ queryKey: ['query-rows'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-widget-data'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-widget-totals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-widget-aggregate'] });
      // R200 (QA-1) — a re-publish refreshes a dataset that query versions may read.
      queryClient.invalidateQueries({ queryKey: HISTORY_QUERY_KEY });
    },
  });
}

/** PUT /workflows/{id} — edit name + definition. Invalidates the single (definition/
 *  materialized state may have changed) + rows caches, and the lists. */
export function useUpdateWorkflowMutation() {
  const queryClient = useQueryClient();
  return useMutation<Workflow, Error, { id: string; body: CreateWorkflowRequest }>({
    mutationFn: ({ id, body }) => workflowsApi.update(id, body),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: WORKFLOWS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['workflow', updated.id] });
      queryClient.invalidateQueries({ queryKey: ['workflow-rows', updated.id] });
      // R200 — a definition change (an edit or a restore) adds a history row.
      queryClient.invalidateQueries({ queryKey: HISTORY_QUERY_KEY });
      // BA-F1 — … and moves the notes: a definition change (a restore) changes their
      // state, and a dashboard save sets widget notes aside or brings them back.
      queryClient.invalidateQueries({ queryKey: ['metadata'] });
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

/** R191 — the column a multi-source workflow appends at run (R186 W-3,
 *  `query_engine.CONSOLIDATION_PROVENANCE_COLUMN`): each row's source name.
 *  `Source.Query`, or `Source.Query1`, `Source.Query2`, … off a collision with a
 *  source column — the backend's naming rule. Offered to the steps editor so a
 *  step can split a stacked total by source; a one-source workflow has none. */
export const CONSOLIDATION_PROVENANCE_COLUMN = 'Source.Query';

export function withProvenanceColumn(columns: readonly Column[], sourceCount: number): Column[] {
  if (sourceCount < 2) return [...columns];
  const existing = new Set(columns.map((c) => c.name));
  let name = CONSOLIDATION_PROVENANCE_COLUMN;
  for (let i = 1; existing.has(name); i += 1) name = `${CONSOLIDATION_PROVENANCE_COLUMN}${i}`;
  return [...columns, { name, dtype: 'string' }];
}
