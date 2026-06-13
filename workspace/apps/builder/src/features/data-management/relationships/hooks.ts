import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { relationshipsApi } from '@/api/relationshipsApi';
import type { CreateRelationshipRequest, Relationship } from './types';

// R70 — relationship governance TanStack hooks.
//   ['relationships', { workspaceId }] — list (scoped to a workspace)
//   ['relationship', id]               — single edge (computed status)
const RELATIONSHIPS_QUERY_KEY = ['relationships'] as const;

function relationshipsKey(workspaceId: string | undefined) {
  return [...RELATIONSHIPS_QUERY_KEY, { workspaceId }] as const;
}

export function useRelationshipsQuery(workspaceId: string | undefined) {
  return useQuery<Relationship[]>({
    queryKey: relationshipsKey(workspaceId),
    queryFn: () => relationshipsApi.list(workspaceId as string),
    enabled: typeof workspaceId === 'string' && workspaceId.length > 0,
  });
}

export function useRelationshipQuery(id: string | undefined) {
  return useQuery<Relationship>({
    queryKey: ['relationship', id] as const,
    queryFn: () => relationshipsApi.get(id as string),
    enabled: typeof id === 'string',
  });
}

/** POST /workspaces/{id}/relationships — declare. Invalidates the list. */
export function useCreateRelationshipMutation() {
  const queryClient = useQueryClient();
  return useMutation<Relationship, Error, { workspaceId: string; body: CreateRelationshipRequest }>({
    mutationFn: ({ workspaceId, body }) => relationshipsApi.create(workspaceId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RELATIONSHIPS_QUERY_KEY });
    },
  });
}

/** DELETE /relationships/{id}. Invalidates the lists and drops the single cache. */
export function useDeleteRelationshipMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => relationshipsApi.delete(id),
    onSuccess: (_void, id) => {
      queryClient.invalidateQueries({ queryKey: RELATIONSHIPS_QUERY_KEY });
      queryClient.removeQueries({ queryKey: ['relationship', id] });
    },
  });
}
