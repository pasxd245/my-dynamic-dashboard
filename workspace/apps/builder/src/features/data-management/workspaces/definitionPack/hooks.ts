import { useMutation, useQueryClient } from '@tanstack/react-query';

import { definitionsApi } from '@/api/definitionsApi';
import { HISTORY_QUERY_KEY } from '@/features/history/hooks';
import type { DefinitionPack, ImportPlan, OnConflict } from './types';

type ImportVars = { workspaceId: string; pack: unknown; onConflict: OnConflict; expectedPlan?: string };

/** R201 — the dry run: the plan an apply would carry out. Writes nothing, so
 *  it invalidates nothing. */
export function useImportPlanMutation() {
  return useMutation<ImportPlan, Error, ImportVars>({
    mutationFn: ({ workspaceId, pack, onConflict }) =>
      definitionsApi.importPack(workspaceId, pack, { dryRun: true, onConflict }),
  });
}

/** Every cached read an import can change: the three lists and single reads,
 *  what a dashboard widget reads (a replaced query or dashboard), the workflow
 *  outputs (a replaced workflow loses its output), the history drawers (a row
 *  per write) and the notes (a replaced dashboard sets widget notes aside or
 *  brings them back). Prefix keys — every workspace's entries. */
export const IMPORT_INVALIDATES: readonly (readonly string[])[] = [
  ['queries'],
  ['query'],
  ['query-rows'],
  ['dashboards'],
  ['dashboard'],
  ['dashboard-widget-columns'],
  ['dashboard-widget-data'],
  ['dashboard-widget-aggregate'],
  ['dashboard-widget-totals'],
  ['dashboard-column-values'],
  ['workflows'],
  ['workflow'],
  ['workflow-rows'],
  HISTORY_QUERY_KEY,
  ['metadata'],
];

/** R201 — apply the pack (whole or nothing). On success every read the import
 *  can change is fetched again (review-qa item 10). */
export function useApplyPackMutation() {
  const queryClient = useQueryClient();
  return useMutation<ImportPlan, Error, ImportVars>({
    mutationFn: ({ workspaceId, pack, onConflict, expectedPlan }) =>
      definitionsApi.importPack(workspaceId, pack, { dryRun: false, onConflict, expectedPlan }),
    onSuccess: () => {
      for (const queryKey of IMPORT_INVALIDATES) queryClient.invalidateQueries({ queryKey });
    },
  });
}

/** R201 — read a workspace's pack (the export action downloads it). */
export function useExportPackMutation() {
  return useMutation<DefinitionPack, Error, { workspaceId: string }>({
    mutationFn: ({ workspaceId }) => definitionsApi.export(workspaceId),
  });
}
