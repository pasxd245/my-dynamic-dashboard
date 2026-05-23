import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { workspacesApi } from "../../../api/workspacesApi";
import type { CreateWorkspaceInput, Workspace } from "./types";

const WORKSPACES_QUERY_KEY = ["workspaces"] as const;

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
