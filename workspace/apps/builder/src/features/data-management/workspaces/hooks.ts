import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workspacesApi } from '@/api/workspacesApi';
import type { CreateWorkspaceInput, Workspace } from './types';

export const WORKSPACES_QUERY_KEY = ['workspaces'] as const;
const DATASETS_QUERY_KEY = ['datasets'] as const;

export function useWorkspacesQuery() {
  return useQuery<Workspace[]>({
    queryKey: WORKSPACES_QUERY_KEY,
    queryFn: () => workspacesApi.list(),
  });
}

export function useCreateWorkspaceMutation() {
  const queryClient = useQueryClient();
  return useMutation<Workspace, Error, CreateWorkspaceInput>({
    mutationFn: (input) => workspacesApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY });
    },
  });
}

/** R26: PATCH /workspaces/{id} — rename. Pessimistic UX per R23 Q4
 *  (button loading state via `isPending`; no optimistic update). */
export function useRenameWorkspaceMutation() {
  const queryClient = useQueryClient();
  return useMutation<Workspace, Error, { id: string; name: string }>({
    mutationFn: ({ id, name }) => workspacesApi.patch(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY });
      // The workspace column on the datasets table may render the
      // workspace name; invalidate datasets too so any cached UI
      // re-renders with the new label.
      queryClient.invalidateQueries({ queryKey: DATASETS_QUERY_KEY });
    },
  });
}

/** R26: DELETE /workspaces/{id} — block-on-non-empty cascade rule.
 *  On 409 `non_empty` the mutationFn throws an `ApiErrorThrown`;
 *  the page-level state machine catches it and swaps to the blocked
 *  modal. */
export function useDeleteWorkspaceMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => workspacesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: DATASETS_QUERY_KEY });
    },
  });
}
