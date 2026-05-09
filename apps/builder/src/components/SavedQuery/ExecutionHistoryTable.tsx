/**
 * ExecutionHistoryTable.tsx
 * 
 * Displays execution history for a saved query.
 * Shows:
 * - Execution timestamp
 * - Status (success/failure)
 * - Row count
 * - Execution duration
 * - User who executed
 */

import { ExecutionHistoryItem } from "../../api/queryApi";

export interface ExecutionHistoryTableProps {
  executions: ExecutionHistoryItem[];
  isLoading?: boolean;
}

export default function ExecutionHistoryTable({
  executions,
  isLoading = false,
}: ExecutionHistoryTableProps): React.ReactElement {
  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
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

  const formatDuration = (ms: number | undefined): string => {
    if (ms === undefined || ms === null) return "—";
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status.toLowerCase()) {
      case "success":
        return "bg-green-100 text-green-800";
      case "failed":
      case "error":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) {
    return <div className="py-6 text-center text-gray-500">Loading execution history...</div>;
  }

  if (executions.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 p-6 text-center text-gray-500">
        No executions recorded yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">Execution History</h3>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Timestamp
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Version
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Status
              </th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                Rows
              </th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                Duration
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Executed By
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {executions.map((exec) => (
              <tr key={exec.execution_id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm text-gray-900">
                  {formatDate(exec.executed_at)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {exec.version_number ? `v${exec.version_number}` : "—"}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeClass(
                      exec.status,
                    )}`}
                  >
                    {exec.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-sm text-gray-600">
                  {exec.row_count !== null && exec.row_count !== undefined
                    ? exec.row_count.toLocaleString()
                    : "—"}
                </td>
                <td className="px-6 py-4 text-right text-sm text-gray-600">
                  {formatDuration(exec.execution_ms ?? undefined)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {exec.executed_by || "System"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
