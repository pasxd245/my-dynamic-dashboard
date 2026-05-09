import type { BuilderSessionState } from "../../api/types";
import {
  canRunContextGuardedActions,
  canUseConnectionDependentActions,
  pathFromWorkflowStage,
  workflowStageFromPath,
  type BuilderSessionStoreState,
} from "../../state/builderSessionStore";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

// Lightweight stage-navigation checks until the project test runner is wired.
export function testStageNavigationMapping(): void {
  assert(pathFromWorkflowStage("upload_source") === "upload-source", "upload path mismatch");
  assert(pathFromWorkflowStage("results_saved") === "results-saved", "results path mismatch");
  assert(workflowStageFromPath("schema-sheet") === "schema_sheet", "schema path mapping mismatch");
  assert(workflowStageFromPath("query") === "query", "query path mapping mismatch");
}

export function testUnknownStagePathRejected(): void {
  assert(workflowStageFromPath("unknown") === null, "unknown stage path should return null");
}

function makeStoreState(sessionState: BuilderSessionState): BuilderSessionStoreState {
  return {
    sessionState,
    isRefreshing: false,
    activeStage: sessionState.current_stage,
  };
}

export function testStageNavigationPreservesActiveContextAndConnectionIndicators(): void {
  const sessionState: BuilderSessionState = {
    connection_status: {
      status: "degraded",
      last_checked_at_utc: "2026-05-09T00:00:00.000Z",
      summary: "Degraded",
      guidance: "Retry",
      dependencies: [{ name: "metadata_db", status: "degraded" }],
      degraded_capabilities: ["results_saved"],
    },
    active_workspace: {
      state: "resolved",
      workspace_id: "ws-1",
      workspace_name: "Workspace 1",
      resolved_at_utc: "2026-05-09T00:00:00.000Z",
      selected_at_utc: "2026-05-09T00:00:00.000Z",
    },
    active_source: {
      state: "resolved",
      source_id: "src-1",
      source_name: "Source 1",
      workspace_id: "ws-1",
      resolved_at_utc: "2026-05-09T00:00:00.000Z",
      selected_at_utc: "2026-05-09T00:00:00.000Z",
    },
    current_stage: "query",
    stages: [
      {
        stage_key: "upload_source",
        title: "Upload + Source",
        order_index: 1,
        status: "completed",
        prerequisites: [],
      },
      {
        stage_key: "schema_sheet",
        title: "Schema + Sheet",
        order_index: 2,
        status: "completed",
        prerequisites: ["upload_complete"],
      },
      {
        stage_key: "query",
        title: "Query",
        order_index: 3,
        status: "in_progress",
        prerequisites: ["active_context_resolved"],
      },
      {
        stage_key: "results_saved",
        title: "Results + Saved",
        order_index: 4,
        status: "ready",
        prerequisites: ["query_validated"],
      },
    ],
  };

  const queryState = makeStoreState(sessionState);
  assert(canRunContextGuardedActions(queryState), "context guard should be satisfied in query stage");
  assert(
    canUseConnectionDependentActions(queryState),
    "connection indicators should allow actions for degraded status",
  );

  const resultsState: BuilderSessionStoreState = {
    ...queryState,
    activeStage: "results_saved",
  };
  assert(canRunContextGuardedActions(resultsState), "active context should persist after stage navigation");
  assert(
    canUseConnectionDependentActions(resultsState),
    "connection status indicator should persist after stage navigation",
  );
}
