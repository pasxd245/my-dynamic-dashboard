import { useEffect, useMemo, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Empty, Pagination, Spin, Tag, Tooltip } from "antd";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import {
  listSavedQueries,
  searchSavedQueries,
  deleteSavedQuery,
  restoreSavedQuery,
} from "../../api/queryApi";
import type { SavedQuerySummary } from "../../api/queryApi";
import { getActionableError } from "../../api/httpErrors";
import ActionableErrorPanel from "../../components/errors/ActionableErrorPanel";
import SavedQuerySearch from "../../components/SavedQuery/SavedQuerySearch";
import type { SearchFilters } from "../../components/SavedQuery/SavedQuerySearch";
import { useSavedQueryStore } from "../../state";

export interface SavedQueryLibraryPageProps {
  workspaceId: string;
}

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

export default function SavedQueryLibraryPage({
  workspaceId,
}: Readonly<SavedQueryLibraryPageProps>): React.ReactElement {
  const navigate = useNavigate();
  const {
    queries,
    isLoading,
    error,
    actionableError,
    total,
    limit,
    offset,
    filters,
    actionInProgress,
    init,
    setQueries,
    updateQueries,
    setIsLoading,
    setError,
    setActionableError,
    setTotal,
    setOffset,
    setFilters,
    setActionInProgress,
  } = useSavedQueryStore();

  const [sorting, setSorting] = useState<SortingState>([]);

  useEffect(() => {
    init();
  }, [init]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    queries.forEach((q) => {
      q.tags.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [queries]);

  useEffect(() => {
    const fetchQueries = async (): Promise<void> => {
      setIsLoading(true);
      setError("");
      setActionableError(null);

      try {
        const apiState = filters.state === "all" ? undefined : filters.state;
        const response = filters.query.trim()
          ? await searchSavedQueries(
              workspaceId,
              filters.query,
              apiState,
              filters.tags.length > 0 ? filters.tags : undefined,
              limit,
              offset,
            )
          : await listSavedQueries(
              workspaceId,
              apiState,
              filters.tags.length > 0 ? filters.tags : undefined,
              limit,
              offset,
            );
        setQueries(response.items);
        setTotal(response.total);
      } catch (err) {
        setActionableError(getActionableError(err));
        const errorMsg =
          err instanceof Error ? err.message : "Failed to load saved queries";
        setError(errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    if (offset === 0) {
      void fetchQueries();
    } else {
      setOffset(0);
    }
  }, [filters, limit, offset, workspaceId]);

  const handleSearch = useCallback(
    (newFilters: SearchFilters): void => {
      const sameQuery = filters.query === newFilters.query;
      const sameState = filters.state === newFilters.state;
      const sameTags =
        filters.tags.length === newFilters.tags.length &&
        filters.tags.every((tag, idx) => tag === newFilters.tags[idx]);
      if (sameQuery && sameState && sameTags) {
        return;
      }
      setFilters(newFilters);
    },
    [filters, setFilters],
  );

  const handleViewDetails = (queryId: string): void => {
    navigate(`/saved-queries/${queryId}`);
  };

  const handleDelete = async (queryId: string): Promise<void> => {
    if (!confirm("Delete this query? It will be recoverable for 24 hours.")) {
      return;
    }
    setActionInProgress(queryId);
    try {
      setActionableError(null);
      await deleteSavedQuery(workspaceId, queryId);
      updateQueries((previous) => previous.filter((q) => q.query_id !== queryId));
    } catch (err) {
      setActionableError(getActionableError(err));
      const errorMsg =
        err instanceof Error ? err.message : "Failed to delete query";
      setError(errorMsg);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRestore = async (queryId: string): Promise<void> => {
    setActionInProgress(queryId);
    try {
      setActionableError(null);
      const restored = await restoreSavedQuery(workspaceId, queryId);
      updateQueries((previous) =>
        previous.map((q) =>
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
      setActionableError(getActionableError(err));
      const errorMsg =
        err instanceof Error ? err.message : "Failed to restore query";
      setError(errorMsg);
    } finally {
      setActionInProgress(null);
    }
  };

  const columns = useMemo<ColumnDef<SavedQuerySummary>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-slate-900">{row.original.name}</div>
            {row.original.deleted_at ? (
              <div className="mt-1 text-xs text-red-600">
                Deleted • Expires in{" "}
                {row.original.recoverable_until
                  ? Math.ceil(
                      (new Date(row.original.recoverable_until).getTime() -
                        Date.now()) /
                        (1000 * 60 * 60),
                    )
                  : "?"}
                h
              </div>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "description",
        header: "Description",
        enableSorting: false,
        cell: ({ getValue }) => {
          const value = getValue<string | null | undefined>();
          return value ? (
            <span className="text-sm text-slate-600">{value}</span>
          ) : (
            <span className="text-slate-400">—</span>
          );
        },
      },
      {
        accessorKey: "tags",
        header: "Tags",
        enableSorting: false,
        cell: ({ getValue }) => {
          const tags = getValue<string[]>() ?? [];
          return (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 2).map((tag) => (
                <Tag key={tag} color="processing">
                  {tag}
                </Tag>
              ))}
              {tags.length > 2 ? (
                <Tooltip title={tags.slice(2).join(", ")}>
                  <span className="text-xs text-slate-500">
                    +{tags.length - 2}
                  </span>
                </Tooltip>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "version_count",
        header: "Versions",
      },
      {
        accessorKey: "execution_count",
        header: "Executions",
      },
      {
        accessorKey: "created_at",
        header: "Created",
        cell: ({ getValue }) => formatDate(getValue<string>()),
      },
      {
        id: "actions",
        header: () => <span className="block text-right">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="text-right">
            {row.original.deleted_at ? (
              <Button
                type="link"
                size="small"
                loading={actionInProgress === row.original.query_id}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleRestore(row.original.query_id);
                }}
              >
                Restore
              </Button>
            ) : (
              <Button
                type="link"
                size="small"
                danger
                loading={actionInProgress === row.original.query_id}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDelete(row.original.query_id);
                }}
              >
                Delete
              </Button>
            )}
          </div>
        ),
      },
    ],
    [actionInProgress],
  );

  const table = useReactTable({
    data: queries,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
  });

  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="w-full">
      <SavedQuerySearch
        allTags={allTags}
        onSearch={handleSearch}
        isLoading={isLoading}
      />

      {actionableError ? (
        <div className="mt-4">
          <ActionableErrorPanel error={actionableError} />
        </div>
      ) : null}

      {error ? <Alert className="mt-4" type="error" description={error} showIcon /> : null}

      <div className="dt-table-wrapper mt-4">
        <Spin spinning={isLoading}>
          {queries.length === 0 && !isLoading ? (
            <Empty
              description={
                filters.query || filters.tags.length > 0
                  ? "No saved queries match your search criteria"
                  : "No saved queries yet. Create one from the query builder!"
              }
              style={{ padding: "2rem 0" }}
            />
          ) : (
            <table className="dt-table">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      const sortDir = header.column.getIsSorted();
                      return (
                        <th
                          key={header.id}
                          onClick={
                            canSort
                              ? header.column.getToggleSortingHandler()
                              : undefined
                          }
                          className={canSort ? "dt-th-sortable" : undefined}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {canSort ? (
                            <span className="dt-sort-indicator">
                              {sortDir === "asc"
                                ? " ▲"
                                : sortDir === "desc"
                                  ? " ▼"
                                  : ""}
                            </span>
                          ) : null}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => handleViewDetails(row.original.query_id)}
                    className={
                      row.original.deleted_at ? "dt-row dt-row-deleted" : "dt-row"
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Spin>

        {queries.length > 0 ? (
          <div className="mt-4 flex items-center justify-end">
            <Pagination
              current={currentPage}
              pageSize={limit}
              total={total}
              showSizeChanger={false}
              showTotal={(totalItems, range) =>
                `Showing ${range[0]} to ${range[1]} of ${totalItems}`
              }
              onChange={(page) => {
                setOffset((page - 1) * limit);
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
