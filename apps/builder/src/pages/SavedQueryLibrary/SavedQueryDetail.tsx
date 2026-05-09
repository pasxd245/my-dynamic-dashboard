/**
 * SavedQueryDetail.tsx
 * 
 * Displays full details of a saved query including:
 * - Query metadata (name, description, tags, timestamps)
 * - Version history
 * - Execution history
 * - Actions (load, duplicate, update, delete/restore)
 * - Validation warnings modal when loading
 */

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getSavedQuery,
  loadSavedQuery,
  deleteSavedQuery,
  restoreSavedQuery,
  duplicateSavedQuery,
  getExecutionHistory,
  type SavedQueryDetailResponse,
  type ExecutionHistoryItem,
  type SavedQueryValidationIssue,
} from "../../api/queryApi";
import VersionTimeline from "../../components/SavedQuery/VersionTimeline";
import ExecutionHistoryTable from "../../components/SavedQuery/ExecutionHistoryTable";

export interface SavedQueryDetailProps {
  workspaceId: string;
  onLoadInBuilder?: (builderSnapshot: Record<string, unknown>) => void;
}

interface LoadState {
  isLoading: boolean;
  warnings: SavedQueryValidationIssue[];
  canLoad: boolean;
}

export default function SavedQueryDetail({
  workspaceId,
  onLoadInBuilder,
}: SavedQueryDetailProps): React.ReactElement {
  const navigate = useNavigate();
  const { queryId } = useParams<{ queryId: string }>();
  const [query, setQuery] = useState<SavedQueryDetailResponse | null>(null);
  const [executions, setExecutions] = useState<ExecutionHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [execLoading, setExecLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [loadState, setLoadState] = useState<LoadState | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  if (!queryId) {
    return (
      <div className="p-6 text-center text-red-600">
        Query ID is missing
      </div>
    );
  }

  // Fetch query details
  useEffect(() => {
    const fetchQuery = async (): Promise<void> => {
      setIsLoading(true);
      setError("");

      try {
        const response = await getSavedQuery(workspaceId, queryId);
        setQuery(response);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to load query details";
        setError(errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuery();
  }, [workspaceId, queryId]);

  // Fetch execution history
  useEffect(() => {
    if (!query) return;

    const fetchExecutions = async (): Promise<void> => {
      setExecLoading(true);

      try {
        const response = await getExecutionHistory(workspaceId, queryId, 20, 0);
        setExecutions(response.items);
      } catch (err) {
        // Silently fail for executions
        console.error("Failed to load execution history:", err);
      } finally {
        setExecLoading(false);
      }
    };

    fetchExecutions();
  }, [query, workspaceId, queryId]);

  const handleLoadInBuilder = async (): Promise<void> => {
    setActionInProgress("load");

    try {
      const response = await loadSavedQuery(workspaceId, queryId);

      if (response.validation_issues.length > 0 && !response.can_load) {
        setLoadState({
          isLoading: false,
          warnings: response.validation_issues,
          canLoad: false,
        });
        return;
      }

      if (response.validation_issues.length > 0) {
        setLoadState({
          isLoading: false,
          warnings: response.validation_issues,
          canLoad: true,
        });
        return;
      }

      // Proceed with loading
      if (onLoadInBuilder) {
        onLoadInBuilder(response.builder_snapshot);
      }
      navigate("/query-builder");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to load query";
      setError(errorMsg);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDuplicate = async (): Promise<void> => {
    if (!query) return;

    const newName = prompt(`Duplicate as:`, `${query.name} (copy)`);
    if (!newName) return;

    setActionInProgress("duplicate");

    try {
      const response = await duplicateSavedQuery(workspaceId, queryId, {
        name: newName,
        description: query.description,
        tags: query.tags,
      });

      // Navigate to the new query
      navigate(`/saved-queries/${response.query_id}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to duplicate query";
      setError(errorMsg);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (
      !confirm(
        "Delete this query? It will be recoverable for 24 hours.",
      )
    ) {
      return;
    }

    setActionInProgress("delete");

    try {
      await deleteSavedQuery(workspaceId, queryId);
      // Refresh the query
      const response = await getSavedQuery(workspaceId, queryId);
      setQuery(response);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to delete query";
      setError(errorMsg);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRestore = async (): Promise<void> => {
    setActionInProgress("restore");

    try {
      const response = await restoreSavedQuery(workspaceId, queryId);
      setQuery(response);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to restore query";
      setError(errorMsg);
    } finally {
      setActionInProgress(null);
    }
  };

  const formatDate = (dateStr: string): string => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-gray-500">Loading query details...</div>
      </div>
    );
  }

  if (!query) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
        {error || "Query not found"}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{query.name}</h1>
            {query.deleted_at && (
              <div className="mt-2 text-sm text-red-600">
                🗑️ Deleted • Recoverable for{" "}
                {query.recoverable_until
                  ? Math.ceil(
                      (new Date(query.recoverable_until).getTime() -
                        new Date().getTime()) /
                        (1000 * 60 * 60),
                    )
                  : "?"}
                hours
              </div>
            )}
          </div>
          <button
            onClick={() => navigate("/saved-queries")}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Validation Warnings Modal */}
        {loadState && loadState.warnings.length > 0 && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <h3 className="font-semibold text-yellow-900">
              ⚠️ Schema Changes Detected
            </h3>
            <ul className="mt-2 space-y-1">
              {loadState.warnings.map((issue, idx) => (
                <li key={idx} className="text-sm text-yellow-800">
                  • {issue.message}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setLoadState(null)}
                className="rounded border border-yellow-600 px-3 py-1 text-sm font-medium text-yellow-600 hover:bg-yellow-100"
              >
                Cancel
              </button>
              {loadState.canLoad && (
                <button
                  onClick={() => {
                    if (loadState && query.latest_version) {
                      if (onLoadInBuilder) {
                        onLoadInBuilder(query.latest_version.builder_snapshot);
                      }
                      navigate("/query-builder");
                    }
                  }}
                  className="rounded bg-yellow-600 px-3 py-1 text-sm font-medium text-white hover:bg-yellow-700"
                >
                  Load Anyway
                </button>
              )}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="rounded-lg border border-gray-200 p-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <div className="text-sm text-gray-600">Created</div>
              <div className="mt-1 font-medium text-gray-900">
                {formatDate(query.created_at)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Updated</div>
              <div className="mt-1 font-medium text-gray-900">
                {formatDate(query.updated_at)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Versions</div>
              <div className="mt-1 font-medium text-gray-900">{query.version_count}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Executions</div>
              <div className="mt-1 font-medium text-gray-900">
                {query.execution_count}
              </div>
            </div>
          </div>

          {query.description && (
            <div className="mt-4 border-t border-gray-200 pt-4">
              <div className="text-sm text-gray-600">Description</div>
              <div className="mt-1 text-gray-900">{query.description}</div>
            </div>
          )}

          {query.tags.length > 0 && (
            <div className="mt-4 border-t border-gray-200 pt-4">
              <div className="text-sm text-gray-600">Tags</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {query.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-block rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleLoadInBuilder}
            disabled={actionInProgress !== null || query.deleted_at !== null}
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {actionInProgress === "load" ? "Loading..." : "Load in Builder"}
          </button>
          <button
            onClick={handleDuplicate}
            disabled={actionInProgress !== null || query.deleted_at !== null}
            className="rounded border border-blue-600 px-4 py-2 font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
          >
            Duplicate
          </button>
          {!query.deleted_at ? (
            <button
              onClick={handleDelete}
              disabled={actionInProgress !== null}
              className="rounded border border-red-600 px-4 py-2 font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {actionInProgress === "delete" ? "Deleting..." : "Delete"}
            </button>
          ) : (
            <button
              onClick={handleRestore}
              disabled={actionInProgress !== null}
              className="rounded bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {actionInProgress === "restore" ? "Restoring..." : "Restore"}
            </button>
          )}
        </div>

        {/* Version History */}
        {query.versions.length > 0 && (
          <div className="rounded-lg border border-gray-200 p-6">
            <VersionTimeline
              versions={query.versions}
              onLoadVersion={async (versionId) => {
                setActionInProgress("load");
                try {
                  const response = await loadSavedQuery(
                    workspaceId,
                    queryId,
                    versionId,
                  );

                  if (response.validation_issues.length > 0 && !response.can_load) {
                    setLoadState({
                      isLoading: false,
                      warnings: response.validation_issues,
                      canLoad: false,
                    });
                    return;
                  }

                  if (onLoadInBuilder) {
                    onLoadInBuilder(response.builder_snapshot);
                  }
                  navigate("/query-builder");
                } catch (err) {
                  const errorMsg =
                    err instanceof Error ? err.message : "Failed to load version";
                  setError(errorMsg);
                } finally {
                  setActionInProgress(null);
                }
              }}
              isLoading={actionInProgress === "load"}
            />
          </div>
        )}

        {/* Execution History */}
        {executions.length > 0 || execLoading && (
          <div className="rounded-lg border border-gray-200 p-6">
            <ExecutionHistoryTable
              executions={executions}
              isLoading={execLoading}
            />
          </div>
        )}
      </div>
    </div>
  );
}
