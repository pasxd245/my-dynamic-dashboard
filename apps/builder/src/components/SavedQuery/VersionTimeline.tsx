/**
 * VersionTimeline.tsx
 * 
 * Displays immutable version history of a saved query.
 * Shows:
 * - Version number
 * - Created date and author
 * - Change summary (if any)
 * - Clickable to load previous versions
 */

import { SavedQueryVersionResponse } from "../../api/queryApi";
import { Button } from "antd";

export interface VersionTimelineProps {
  versions: SavedQueryVersionResponse[];
  onLoadVersion?: (versionId: string, versionNumber: number) => void;
  isLoading?: boolean;
}

export default function VersionTimeline({
  versions,
  onLoadVersion,
  isLoading = false,
}: VersionTimelineProps): React.ReactElement {
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

  if (versions.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 p-6 text-center text-gray-500">
        No version history available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">Version History</h3>
      <div className="space-y-3">
        {versions.map((version, index) => (
          <div
            key={version.version_id}
            className={`rounded-lg border p-4 ${
              index === 0
                ? "border-blue-200 bg-blue-50"
                : "border-gray-200 hover:bg-gray-50"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="inline-block rounded-full bg-gray-200 px-2 py-1 text-sm font-semibold text-gray-700">
                    v{version.version_number}
                  </span>
                  {index === 0 && (
                    <span className="text-xs font-medium text-blue-600">Latest</span>
                  )}
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  {formatDate(version.created_at)}
                  {version.created_by && ` by ${version.created_by}`}
                </div>
                {version.change_summary && (
                  <div className="mt-2 text-sm text-gray-700">
                    <strong>Changes:</strong> {version.change_summary}
                  </div>
                )}
                {version.parent_version_id && (
                  <div className="mt-2 text-xs text-gray-500">
                    → Updated from v{version.version_number - 1}
                  </div>
                )}
              </div>

              {index > 0 && onLoadVersion && (
                <Button
                  onClick={() => onLoadVersion(version.version_id, version.version_number)}
                  disabled={isLoading}
                  type="default"
                  className="ml-4 !border-blue-200 !bg-blue-100 !text-blue-700"
                >
                  Load v{version.version_number}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
