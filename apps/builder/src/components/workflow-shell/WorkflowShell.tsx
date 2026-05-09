import type { ReactNode } from "react";
import ActiveContextBar from "./ActiveContextBar";
import ConnectionStatusBanner from "./ConnectionStatusBanner";
import type {
  ActiveContextState,
  ConnectionStatus,
  WorkflowStage,
  WorkflowStageKey,
} from "../../api/types";

export interface WorkflowShellProps {
  readonly title?: string;
  readonly children?: ReactNode;
  readonly stageContent?: Partial<Record<WorkflowStageKey, ReactNode>>;
  readonly stages?: WorkflowStage[];
  readonly activeStage?: WorkflowStageKey;
  readonly onSelectStage?: (stage: WorkflowStageKey) => void;
  readonly workspaceName?: string;
  readonly sourceName?: string;
  readonly workspaceState?: ActiveContextState;
  readonly sourceState?: ActiveContextState;
  readonly connectionStatus?: ConnectionStatus;
  readonly isRefreshingConnectionStatus?: boolean;
  readonly onRefreshConnectionStatus?: () => void;
  readonly blockContextGuardedStages?: boolean;
  readonly onReselectContext?: () => void;
}

function badgeToneForStatus(status: WorkflowStage["status"]): string {
  if (status === "completed") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (status === "in_progress") {
    return "bg-blue-100 text-blue-800";
  }
  if (status === "ready") {
    return "bg-slate-100 text-slate-700";
  }
  return "bg-rose-100 text-rose-700";
}

export default function WorkflowShell({
  title = "Builder Workflow",
  children,
  stageContent,
  stages = [],
  activeStage = "upload_source",
  onSelectStage,
  workspaceName,
  sourceName,
  workspaceState = "unresolved",
  sourceState = "unresolved",
  connectionStatus,
  isRefreshingConnectionStatus = false,
  onRefreshConnectionStatus,
  blockContextGuardedStages = false,
  onReselectContext,
}: WorkflowShellProps): React.ReactElement {
  const activeStageInfo = stages.find((stage) => stage.stage_key === activeStage);

  const renderStageButton = (stage: WorkflowStage): React.ReactElement => {
    const isActive = stage.stage_key === activeStage;
    const isLocked = stage.status === "locked";
    const statusTone = badgeToneForStatus(stage.status);

    return (
      <button
        key={stage.stage_key}
        type="button"
        onClick={() => {
          if (!isLocked) {
            onSelectStage?.(stage.stage_key);
          }
        }}
        disabled={isLocked}
        className={`rounded-md border px-3 py-2 text-left text-sm transition ${
          isActive ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-800"
        } ${isLocked ? "cursor-not-allowed opacity-60" : "hover:border-slate-300 hover:bg-slate-50"}`}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold">{stage.title}</span>
          <span className={`rounded px-2 py-0.5 text-xs font-semibold ${statusTone}`}>
            {stage.status}
          </span>
        </div>
      </button>
    );
  };

  const renderPrerequisiteCallout = (): React.ReactElement | null => {
    if (activeStageInfo?.status !== "locked") {
      return null;
    }

    const missing = activeStageInfo.missing_prerequisites ?? activeStageInfo.prerequisites;
    const previousStageKey = activeStageInfo.previous_stage_key;
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <p className="font-semibold">This stage is blocked by prerequisites.</p>
        {missing.length > 0 ? (
          <ul className="mt-2 list-disc pl-5">
            {missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {previousStageKey ? (
            <button
              type="button"
              onClick={() => onSelectStage?.(previousStageKey)}
              className="rounded bg-slate-800 px-3 py-1.5 font-medium text-white hover:bg-slate-900"
            >
              Go to previous stage
            </button>
          ) : null}
          {onReselectContext && activeStageInfo.prerequisites.includes("active_context_resolved") ? (
            <button
              type="button"
              onClick={onReselectContext}
              className="rounded border border-amber-500 px-3 py-1.5 font-medium text-amber-800 hover:bg-amber-100"
            >
              Resolve active context
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <section
      aria-label="builder-workflow-shell"
      data-testid="builder-workflow-shell"
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-4"
    >
      <header className="space-y-3">
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        <ActiveContextBar
          workspaceName={workspaceName}
          sourceName={sourceName}
          workspaceState={workspaceState}
          sourceState={sourceState}
        />
        <ConnectionStatusBanner
          connectionStatus={connectionStatus}
          isRefreshing={isRefreshingConnectionStatus}
          onRefresh={onRefreshConnectionStatus}
        />

        {stages.length > 0 ? (
          <nav aria-label="workflow-stages" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {stages.map((stage) => renderStageButton(stage))}
          </nav>
        ) : null}

        {blockContextGuardedStages && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Query and saved-query stages are locked until workspace/source context is resolved.
            {onReselectContext && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={onReselectContext}
                  className="rounded bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700"
                >
                  Reselect Context
                </button>
              </div>
            )}
          </div>
        )}

        {renderPrerequisiteCallout()}
      </header>
      <div>
        {stageContent && activeStage ? stageContent[activeStage] : null}
        {children}
      </div>
    </section>
  );
}
