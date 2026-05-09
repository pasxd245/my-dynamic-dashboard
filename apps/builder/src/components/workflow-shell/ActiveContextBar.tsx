import type { ActiveContextState } from "../../api/types";

interface ContextBadgeProps {
  label: string;
  value: string;
  state: ActiveContextState;
}

function ContextBadge({ label, value, state }: ContextBadgeProps): React.ReactElement {
  const badgeClass =
    state === "resolved"
      ? "bg-emerald-100 text-emerald-900"
      : state === "stale"
      ? "bg-amber-100 text-amber-900"
      : "bg-slate-100 text-slate-700";

  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900">{value}</span>
      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${badgeClass}`}>{state}</span>
    </div>
  );
}

export interface ActiveContextBarProps {
  workspaceName?: string;
  sourceName?: string;
  workspaceState: ActiveContextState;
  sourceState: ActiveContextState;
}

export default function ActiveContextBar({
  workspaceName,
  sourceName,
  workspaceState,
  sourceState,
}: ActiveContextBarProps): React.ReactElement {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <ContextBadge
        label="Workspace"
        value={workspaceName || "Not selected"}
        state={workspaceState}
      />
      <ContextBadge label="Source" value={sourceName || "Not selected"} state={sourceState} />
    </div>
  );
}
