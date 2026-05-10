/**
 * useBuilderSession — TanStack Query hooks for builder session operations (Spec 013, T034)
 *
 * Wraps builderSessionApi.ts functions in useQuery / useMutation hooks so
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
  getBuilderPreflight,
  getBuilderSessionState,
  setActiveContext,
  type ActiveContextResponse,
  type SetActiveContextRequest,
} from "../builderSessionApi";
import type { BuilderSessionState, ConnectionStatus, WorkflowStageKey } from "../types";

// ── Query keys ─────────────────────────────────────────────────────────────

export const builderSessionKeys = {
  preflight: ["builderSession", "preflight"] as const,
  sessionState: (currentStage?: WorkflowStageKey) =>
    ["builderSession", "sessionState", currentStage] as const,
};

// ── Read hooks ─────────────────────────────────────────────────────────────

export function useBuilderPreflight(): UseQueryResult<ConnectionStatus> {
  return useQuery({
    queryKey: builderSessionKeys.preflight,
    queryFn: () => getBuilderPreflight(),
    refetchInterval: 30_000, // poll every 30 s for connection status
  });
}

export function useBuilderSessionState(
  currentStage?: WorkflowStageKey,
): UseQueryResult<BuilderSessionState> {
  return useQuery({
    queryKey: builderSessionKeys.sessionState(currentStage),
    queryFn: () => getBuilderSessionState(currentStage),
  });
}

// ── Mutation hooks ─────────────────────────────────────────────────────────

export function useSetActiveContext(): UseMutationResult<
  ActiveContextResponse,
  Error,
  SetActiveContextRequest
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SetActiveContextRequest) => setActiveContext(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: builderSessionKeys.sessionState() });
    },
  });
}
