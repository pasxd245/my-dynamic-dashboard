import type { ConnectionStatus } from "../../api/types";

export interface ConnectionStatusBannerProps {
  connectionStatus?: ConnectionStatus;
  isRefreshing?: boolean;
  onRefresh?: () => void;
}

function formatLastChecked(timestamp?: string): string {
  if (!timestamp) {
    return "Not checked yet";
  }
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return timestamp;
  }
  return parsed.toLocaleString();
}

function badgeClasses(status: ConnectionStatus["status"]): string {
  if (status === "ready") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (status === "degraded") {
    return "bg-amber-100 text-amber-800";
  }
  return "bg-rose-100 text-rose-800";
}

export default function ConnectionStatusBanner({
  connectionStatus,
  isRefreshing = false,
  onRefresh,
}: ConnectionStatusBannerProps): React.ReactElement {
  if (!connectionStatus) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        Connection status is loading.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeClasses(connectionStatus.status)}`}
            >
              {connectionStatus.status.toUpperCase()}
            </span>
            <span className="text-xs text-slate-600">
              Last checked: {formatLastChecked(connectionStatus.last_checked_at_utc)}
            </span>
          </div>
          <p className="text-sm font-medium text-slate-800">{connectionStatus.summary}</p>
          <p className="text-sm text-slate-700">{connectionStatus.guidance}</p>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        )}
      </div>
    </div>
  );
}
