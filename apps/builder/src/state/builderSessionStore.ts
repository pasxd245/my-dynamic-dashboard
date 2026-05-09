import type { BuilderSessionState, WorkflowStageKey } from "../api/types";
import { getBuilderSessionState } from "../api/builderSessionApi";

export interface BuilderSessionStoreState {
  sessionState: BuilderSessionState | null;
  isRefreshing: boolean;
  activeStage: WorkflowStageKey;
}

export const DEFAULT_STAGE: WorkflowStageKey = "upload_source";
const STORAGE_KEY = "builder.workflow.active_stage";

export const initialBuilderSessionStoreState: BuilderSessionStoreState = {
  sessionState: null,
  isRefreshing: false,
  activeStage: DEFAULT_STAGE,
};

export const workflowStagePathByKey: Record<WorkflowStageKey, string> = {
  upload_source: "upload-source",
  schema_sheet: "schema-sheet",
  query: "query",
  results_saved: "results-saved",
};

const workflowStageByPath: Record<string, WorkflowStageKey> = {
  "upload-source": "upload_source",
  "schema-sheet": "schema_sheet",
  query: "query",
  "results-saved": "results_saved",
};

export function pathFromWorkflowStage(stage: WorkflowStageKey): string {
  return workflowStagePathByKey[stage];
}

export function workflowStageFromPath(pathSegment: string | null | undefined): WorkflowStageKey | null {
  if (!pathSegment) {
    return null;
  }
  return workflowStageByPath[pathSegment] ?? null;
}

export function readPersistedWorkflowStage(): WorkflowStageKey {
  if (globalThis.window === undefined) {
    return DEFAULT_STAGE;
  }
  const raw = globalThis.window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return DEFAULT_STAGE;
  }
  return workflowStageByPath[raw] ?? DEFAULT_STAGE;
}

export function persistWorkflowStage(stage: WorkflowStageKey): void {
  if (globalThis.window === undefined) {
    return;
  }
  globalThis.window.sessionStorage.setItem(STORAGE_KEY, workflowStagePathByKey[stage]);
}

function isStageAvailable(state: BuilderSessionState, stage: WorkflowStageKey): boolean {
  const stageState = state.stages.find((item) => item.stage_key === stage);
  if (!stageState) {
    return false;
  }
  return stageState.status !== "locked";
}

function resolveActiveStage(
  sessionState: BuilderSessionState,
  preferredStage: WorkflowStageKey,
): WorkflowStageKey {
  if (isStageAvailable(sessionState, preferredStage)) {
    return preferredStage;
  }
  return sessionState.current_stage;
}

export function canRunContextGuardedActions(state: BuilderSessionStoreState): boolean {
  if (!state.sessionState) {
    return false;
  }

  return (
    state.sessionState.active_workspace.state === "resolved" &&
    state.sessionState.active_source.state === "resolved"
  );
}

export function canUseConnectionDependentActions(state: BuilderSessionStoreState): boolean {
  const status = state.sessionState?.connection_status.status;
  return status === "ready" || status === "degraded";
}

export async function refreshBuilderSessionStore(
  state: BuilderSessionStoreState,
): Promise<BuilderSessionStoreState> {
  const next: BuilderSessionStoreState = {
    ...state,
    isRefreshing: true,
  };

  try {
    const sessionState = await getBuilderSessionState(state.activeStage);
    const activeStage = resolveActiveStage(sessionState, state.activeStage);
    return {
      ...next,
      sessionState,
      activeStage,
      isRefreshing: false,
    };
  } catch {
    return {
      ...next,
      isRefreshing: false,
    };
  }
}
