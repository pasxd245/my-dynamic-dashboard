/**
 * SavedQueryLibraryPage.tsx
 * 
 * Main page for browsing the saved queries library.
 * Displays:
 * - List of saved queries in a table
 * - Search and filter UI
 * - Pagination controls
 * - Actions per query (view, delete, restore)
 */

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  listSavedQueries,
  searchSavedQueries,
  deleteSavedQuery,
  restoreSavedQuery,
  type SavedQuerySummary,
} from "../../api/queryApi";
import SavedQuerySearch from "../../components/SavedQuery/SavedQuerySearch";
import type { SearchFilters } from "../../components/SavedQuery/SavedQuerySearch";

export interface SavedQueryLibraryPageProps {
  workspaceId: string;
}

export default function SavedQueryLibraryPage({
  workspaceId,
}: SavedQueryLibraryPageProps): React.ReactElement {
  const navigate = useNavigate();
  const [queries, setQueries] = useState<SavedQuerySummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [total, setTotal] = useState<number>(0);
  const [limit] = useState<number>(50);
  const [offset, setOffset] = useState<number>(0);
  const [filters, setFilters] = useState<SearchFilters>({
    query: "",
    tags: [],
    state: "active",
  });
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Get all unique tags for filter suggestions
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    queries.forEach((q) => {
      q.tags.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [queries]);

  // Fetch queries based on current filters
  useEffect(() => {
    const fetchQueries = async (): Promise<void> => {
      setIsLoading(true);
      setError("");

      try {
        let response;

        if (filters.query.trim()) {
          response = await searchSavedQueries(
            workspaceId,
            filters.query,
            filters.state,
            filters.tags.length > 0 ? filters.tags : undefined,
            limit,
            offset,
          );
        } else {
          response = await listSavedQueries(
            workspaceId,
            filters.state,
            filters.tags.length > 0 ? filters.tags : undefined,
            limit,
            offset,
          );
        }

        setQueries(response.items);
        setTotal(response.total);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to load saved queries";
        setError(errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    // Reset offset when filters change
    if (offset !== 0) {
      setOffset(0);
    } else {
      fetchQueries();
    }
  }, [filters, limit, offset, workspaceId]);

  const handleSearch = (newFilters: SearchFilters): void => {
    setFilters(newFilters);
  };

  const handleViewDetails = (queryId: string): void => {
    navigate(`/saved-queries/${queryId}`);
  };

  const handleDelete = async (queryId: string, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation();

    if (
      !confirm(
        "Delete this query? It will be recoverable for 24 hours.",
      )
    ) {
      return;
    }

    setActionInProgress(queryId);
    try {
      await deleteSavedQuery(workspaceId, queryId);
      setQueries(queries.filter((q) => q.query_id !== queryId));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to delete query";
      setError(errorMsg);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRestore = async (queryId: string, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation();

    setActionInProgress(queryId);
    try {
      const restored = await restoreSavedQuery(workspaceId, queryId);
      setQueries(
        queries.map((q) =>
          q.query_id === queryId
            ? {
                ...q,
                deleted_at: restored.deleted_at,
                recoverable_until: restored.recoverable_until,
              }
            : q,
        ),
      );
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
      });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (dateStr: string | undefined): string => {
    if (!dateStr) return "Never";
    try {
      return new Date(dateStr).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  const canPaginateNext = offset + limit < total;
  const canPaginatePrev = offset > 0;

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Saved Queries Library</h1>
          <p className="mt-1 text-sm text-gray-600">
            Browse, search, and manage your saved queries
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-6">
          <SavedQuerySearch
            allTags={allTags}
            onSearch={handleSearch}
            isLoading={isLoading}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="text-gray-500">Loading queries...</div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && queries.length === 0 && (
          <div className="rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-600">
              {filters.query || filters.tags.length > 0
                ? "No saved queries match your search criteria"
                : "No saved queries yet. Create one from the query builder!"}
            </p>
          </div>
        )}

        {/* Results Table */}
        {!isLoading && queries.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Tags
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Versions
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Executions
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {queries.map((query) => (
                    <tr
                      key={query.query_id}
                      onClick={() => handleViewDetails(query.query_id)}
                      className={`cursor-pointer hover:bg-gray-50 ${
                        query.deleted_at ? "bg-red-50" : ""
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{query.name}</div>
                        {query.deleted_at && (
                          <div className="mt-1 text-xs text-red-600">
                            Deleted • Expires in{" "}
                            {query.recoverable_until
                              ? Math.ceil(
                                  (new Date(query.recoverable_until).getTime() -
                                    new Date().getTime()) /
                                    (1000 * 60 * 60),
                                )
                              : "?"}
                            h
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {query.description || <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {query.tags.length > 0
                            ? query.tags.slice(0, 2).map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-block rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800"
                                >
                                  {tag}
                                </span>
                              ))
                            : null}
                          {query.tags.length > 2 && (
                            <span className="text-xs text-gray-500">
                              +{query.tags.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {query.version_count}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {query.execution_count}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDate(query.created_at)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {query.deleted_at ? (
                            <button
                              onClick={(e) => handleRestore(query.query_id, e)}
                              disabled={actionInProgress === query.query_id}
                              className="text-xs font-medium text-green-600 hover:text-green-700 disabled:opacity-50"
                            >
                              Restore
                            </button>
                          ) : (
                            <button
                              onClick={(e) => handleDelete(query.query_id, e)}
                              disabled={actionInProgress === query.query_id}
                              className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {offset + 1} to {Math.min(offset + limit, total)} of {total}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={!canPaginatePrev || isLoading}
                  className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
                >
                  ← Previous
                </button>
                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={!canPaginateNext || isLoading}
                  className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
