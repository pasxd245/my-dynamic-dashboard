import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { datasetsApi } from "../../../api/datasetsApi";
import { uploadsApi } from "../../../api/uploadsApi";
import type {
  CommitBatchRequest,
  CommitBatchResponse,
  Dataset,
  ParseSheetsRequest,
  ParseSheetsResponse,
  TempUploadResponse,
} from "./types";

const DATASETS_QUERY_KEY = ["datasets"] as const;

function datasetsKey(workspaceId?: string) {
  return workspaceId
    ? ([...DATASETS_QUERY_KEY, { workspaceId }] as const)
    : DATASETS_QUERY_KEY;
}

export function useDatasetsQuery(workspaceId?: string) {
  return useQuery<Dataset[]>({
    queryKey: datasetsKey(workspaceId),
    queryFn: () => datasetsApi.list(workspaceId),
  });
}

export function useUploadInitMutation() {
  return useMutation<
    TempUploadResponse,
    Error,
    { file: File; sourceFormat: "csv" | "excel" }
  >({
    mutationFn: ({ file, sourceFormat }) =>
      uploadsApi.createTemp(file, sourceFormat),
  });
}

export function useUploadParseMutation() {
  return useMutation<
    ParseSheetsResponse,
    Error,
    { tempId: string; body: ParseSheetsRequest }
  >({
    mutationFn: ({ tempId, body }) => uploadsApi.parseSheets(tempId, body),
  });
}

export function useDatasetsCommitMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    CommitBatchResponse,
    Error,
    { workspaceId: string; body: CommitBatchRequest }
  >({
    mutationFn: ({ workspaceId, body }) =>
      datasetsApi.commitBatch(workspaceId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DATASETS_QUERY_KEY });
    },
  });
}
