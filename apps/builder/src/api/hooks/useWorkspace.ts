/**
 * useWorkspace — TanStack Query hooks for workspace operations (Spec 013, T031)
 *
 * Wraps all workspaceApi.ts functions in useQuery / useMutation hooks so
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
  assignColumnRoles,
  createWorkspace,
  exportManifest,
  getReadiness,
  getWorkspaceProfile,
  importManifest,
  overrideSheet,
  uploadSource,
} from "../workspaceApi";
import type {
  AssignRolePayload,
  ImportManifestPayload,
  ManifestResponse,
  OverridePayload,
  ProfileResponse,
  ReadinessResponse,
  UploadResponse,
  WorkspaceResponse,
} from "../types";

// ── Query keys ─────────────────────────────────────────────────────────────

export const workspaceKeys = {
  all: ["workspaces"] as const,
  profile: (workspaceId: string) => ["workspaces", workspaceId, "profile"] as const,
  readiness: (workspaceId: string) => ["workspaces", workspaceId, "readiness"] as const,
  manifest: (workspaceId: string) => ["workspaces", workspaceId, "manifest"] as const,
};

// ── Read hooks ─────────────────────────────────────────────────────────────

export function useWorkspaceProfile(
  workspaceId: string | undefined,
): UseQueryResult<ProfileResponse> {
  return useQuery({
    queryKey: workspaceKeys.profile(workspaceId ?? ""),
    queryFn: () => getWorkspaceProfile(workspaceId!),
    enabled: !!workspaceId,
  });
}

export function useReadiness(
  workspaceId: string | undefined,
): UseQueryResult<ReadinessResponse> {
  return useQuery({
    queryKey: workspaceKeys.readiness(workspaceId ?? ""),
    queryFn: () => getReadiness(workspaceId!),
    enabled: !!workspaceId,
  });
}

export function useExportManifest(
  workspaceId: string | undefined,
): UseQueryResult<ManifestResponse> {
  return useQuery({
    queryKey: workspaceKeys.manifest(workspaceId ?? ""),
    queryFn: () => exportManifest(workspaceId!),
    enabled: !!workspaceId,
  });
}

// ── Mutation hooks ─────────────────────────────────────────────────────────

export function useCreateWorkspace(): UseMutationResult<WorkspaceResponse, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createWorkspace(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
}

export function useUploadSource(): UseMutationResult<
  UploadResponse,
  Error,
  { workspaceId: string; file: File }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, file }) => uploadSource(workspaceId, file),
    onSuccess: (_data, { workspaceId }) => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.profile(workspaceId) });
    },
  });
}

export function useOverrideSheet(): UseMutationResult<
  UploadResponse,
  Error,
  { workspaceId: string; sheetId: string; payload: OverridePayload }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, sheetId, payload }) =>
      overrideSheet(workspaceId, sheetId, payload),
    onSuccess: (_data, { workspaceId }) => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.profile(workspaceId) });
    },
  });
}

export function useAssignColumnRoles(): UseMutationResult<
  ProfileResponse,
  Error,
  { workspaceId: string; columnId: string; payload: AssignRolePayload }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, columnId, payload }) =>
      assignColumnRoles(workspaceId, columnId, payload),
    onSuccess: (_data, { workspaceId }) => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.profile(workspaceId) });
    },
  });
}

export function useImportManifest(): UseMutationResult<
  WorkspaceResponse,
  Error,
  ImportManifestPayload
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (manifest: ImportManifestPayload) => importManifest(manifest),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
}
