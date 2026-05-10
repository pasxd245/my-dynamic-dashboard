/**
 * useSavedQueries — TanStack Query hooks for saved query operations (Spec 013, T032)
 *
 * Wraps all queryApi.ts functions in useQuery / useMutation hooks so
 * components never call fetch() directly.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  createSavedQuery,
  deleteSavedQuery,
  duplicateSavedQuery,
  getExecutionHistory,
  getSavedQuery,
  listSavedQueries,
  loadSavedQuery,
  restoreSavedQuery,
  searchSavedQueries,
  updateSavedQuery,
} from "../queryApi";
import type {
  DuplicateSavedQueryRequest,
  ExecutionHistoryResponse,
  LoadSavedQueryResponse,
  SavedQueryDetailResponse,
  SavedQueryLibraryResponse,
  SaveQueryRequest,
  SaveQueryResponse,
  UpdateSavedQueryRequest,
} from "../queryApi";

// ── Query keys ─────────────────────────────────────────────────────────────

export const savedQueryKeys = {
  all: (workspaceId: string) => ["savedQueries", workspaceId] as const,
  list: (workspaceId: string, params?: Record<string, unknown>) =>
    ["savedQueries", workspaceId, "list", params] as const,
  search: (workspaceId: string, term: string) =>
    ["savedQueries", workspaceId, "search", term] as const,
  detail: (workspaceId: string, queryId: string) =>
    ["savedQueries", workspaceId, queryId] as const,
  history: (workspaceId: string, queryId: string) =>
    ["savedQueries", workspaceId, queryId, "history"] as const,
};

// ── Read hooks ─────────────────────────────────────────────────────────────

export function useSavedQueries(
  workspaceId: string | undefined,
  params?: { limit?: number; offset?: number; tags?: string[]; include_deleted?: boolean },
): UseQueryResult<SavedQueryLibraryResponse> {
  return useQuery({
    queryKey: savedQueryKeys.list(workspaceId ?? "", params),
    queryFn: () =>
      listSavedQueries(workspaceId!, params?.limit, params?.offset, params?.tags, params?.include_deleted),
    enabled: !!workspaceId,
  });
}

export function useSavedQueryDetail(
  workspaceId: string | undefined,
  queryId: string | undefined,
): UseQueryResult<SavedQueryDetailResponse> {
  return useQuery({
    queryKey: savedQueryKeys.detail(workspaceId ?? "", queryId ?? ""),
    queryFn: () => getSavedQuery(workspaceId!, queryId!),
    enabled: !!workspaceId && !!queryId,
  });
}

export function useLoadSavedQuery(
  workspaceId: string | undefined,
  queryId: string | undefined,
  versionId?: string,
): UseQueryResult<LoadSavedQueryResponse> {
  return useQuery({
    queryKey: [...savedQueryKeys.detail(workspaceId ?? "", queryId ?? ""), "load", versionId],
    queryFn: () => loadSavedQuery(workspaceId!, queryId!, versionId),
    enabled: !!workspaceId && !!queryId,
  });
}

export function useExecutionHistory(
  workspaceId: string | undefined,
  queryId: string | undefined,
  params?: { limit?: number; offset?: number },
): UseQueryResult<ExecutionHistoryResponse> {
  return useQuery({
    queryKey: savedQueryKeys.history(workspaceId ?? "", queryId ?? ""),
    queryFn: () => getExecutionHistory(workspaceId!, queryId!, params?.limit, params?.offset),
    enabled: !!workspaceId && !!queryId,
  });
}

// ── Mutation hooks ─────────────────────────────────────────────────────────

export function useCreateSavedQuery(
  workspaceId: string,
): UseMutationResult<SaveQueryResponse, Error, SaveQueryRequest> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: SaveQueryRequest) => createSavedQuery(workspaceId, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: savedQueryKeys.all(workspaceId) });
    },
  });
}

export function useUpdateSavedQuery(
  workspaceId: string,
  queryId: string,
): UseMutationResult<SaveQueryResponse, Error, UpdateSavedQueryRequest> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: UpdateSavedQueryRequest) => updateSavedQuery(workspaceId, queryId, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: savedQueryKeys.detail(workspaceId, queryId) });
      void queryClient.invalidateQueries({ queryKey: savedQueryKeys.all(workspaceId) });
    },
  });
}

export function useDeleteSavedQuery(
  workspaceId: string,
): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (queryId: string) => deleteSavedQuery(workspaceId, queryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: savedQueryKeys.all(workspaceId) });
    },
  });
}

export function useDuplicateSavedQuery(
  workspaceId: string,
  queryId: string,
): UseMutationResult<SaveQueryResponse, Error, DuplicateSavedQueryRequest> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: DuplicateSavedQueryRequest) =>
      duplicateSavedQuery(workspaceId, queryId, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: savedQueryKeys.all(workspaceId) });
    },
  });
}

export function useRestoreSavedQuery(
  workspaceId: string,
): UseMutationResult<SaveQueryResponse, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (queryId: string) => restoreSavedQuery(workspaceId, queryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: savedQueryKeys.all(workspaceId) });
    },
  });
}

export function useSearchSavedQueries(
  workspaceId: string | undefined,
  term: string,
  params?: { limit?: number; offset?: number },
): UseQueryResult<SavedQueryLibraryResponse> {
  return useQuery({
    queryKey: savedQueryKeys.search(workspaceId ?? "", term),
    queryFn: () => searchSavedQueries(workspaceId!, term, params?.limit, params?.offset),
    enabled: !!workspaceId && term.length > 0,
  });
}
