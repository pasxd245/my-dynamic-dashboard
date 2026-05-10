/**
 * useQueryBuilder — TanStack Query hooks for query builder operations (Spec 013, T033)
 *
 * Wraps queryBuilderApi.ts functions in useMutation hooks so
 * components never call fetch() directly.
 */

import {
  useMutation,
  type UseMutationResult,
} from "@tanstack/react-query";
import {
  executeQuery,
  exportQuery,
  previewQuery,
  validateQuery,
} from "../queryBuilderApi";
import type {
  QueryConfig,
  QueryExecutionResponse,
  QueryPreviewResponse,
  ValidateQueryResponse,
} from "../queryBuilderTypes";

// ── Mutation hooks ─────────────────────────────────────────────────────────
// Query builder operations are side-effectful (POST) and are not cached,
// so all use useMutation rather than useQuery.

export function useValidateQuery(
  workspaceId: string,
): UseMutationResult<ValidateQueryResponse, Error, QueryConfig> {
  return useMutation({
    mutationFn: (config: QueryConfig) => validateQuery(workspaceId, config),
  });
}

export function usePreviewQuery(
  workspaceId: string,
): UseMutationResult<QueryPreviewResponse, Error, QueryConfig> {
  return useMutation({
    mutationFn: (config: QueryConfig) => previewQuery(workspaceId, config),
  });
}

export function useExecuteQuery(
  workspaceId: string,
): UseMutationResult<QueryExecutionResponse, Error, QueryConfig> {
  return useMutation({
    mutationFn: (config: QueryConfig) => executeQuery(workspaceId, config),
  });
}

export function useExportQuery(
  workspaceId: string,
): UseMutationResult<Blob, Error, { config: QueryConfig; format: "excel" | "csv" }> {
  return useMutation({
    mutationFn: ({ config, format }) => exportQuery(workspaceId, config, format),
  });
}
