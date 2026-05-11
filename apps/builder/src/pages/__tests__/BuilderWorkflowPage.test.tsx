import { describe, expect, it } from "vitest";
import type { BuilderSessionState } from "../../api/types";
import { getUploadStepBlockedReason } from "../../components/upload-flow";
import {
  canRunContextGuardedActions,
  canUseConnectionDependentActions,
  pathFromWorkflowStage,
  workflowStageFromPath,
  type BuilderSessionStoreState,
} from "../../state/builderSessionStore";

// Lightweight stage-navigation checks — converted from exported functions to Vitest format.

function makeStoreState(sessionState: BuilderSessionState): BuilderSessionStoreState {
  return {
    sessionState,
    isRefreshing: false,
    activeStage: sessionState.current_stage,
  };
}

const baseSessionState: BuilderSessionState = {
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
    { stage_key: "upload_source", title: "Upload + Source", order_index: 1, status: "completed", prerequisites: [] },
    { stage_key: "schema_sheet", title: "Schema + Sheet", order_index: 2, status: "completed", prerequisites: ["upload_complete"] },
    { stage_key: "query", title: "Query", order_index: 3, status: "in_progress", prerequisites: ["active_context_resolved"] },
    { stage_key: "results_saved", title: "Results + Saved", order_index: 4, status: "ready", prerequisites: ["query_validated"] },
  ],
};

describe("WorkflowStage path mapping", () => {
  it("maps stage keys to URL paths", () => {
    expect(pathFromWorkflowStage("upload_source")).toBe("upload-source");
    expect(pathFromWorkflowStage("results_saved")).toBe("results-saved");
  });

  it("maps URL paths back to stage keys", () => {
    expect(workflowStageFromPath("schema-sheet")).toBe("schema_sheet");
    expect(workflowStageFromPath("query")).toBe("query");
  });

  it("returns null for unknown stage paths", () => {
    expect(workflowStageFromPath("unknown")).toBeNull();
  });
});

describe("Stage navigation preserves context and connection indicators", () => {
  it("allows context-guarded actions in the query stage", () => {
    const queryState = makeStoreState(baseSessionState);
    expect(canRunContextGuardedActions(queryState)).toBe(true);
    expect(canUseConnectionDependentActions(queryState)).toBe(true);
  });

  it("preserves context and connection status after navigating to results_saved", () => {
    const queryState = makeStoreState(baseSessionState);
    const resultsState: BuilderSessionStoreState = { ...queryState, activeStage: "results_saved" };
    expect(canRunContextGuardedActions(resultsState)).toBe(true);
    expect(canUseConnectionDependentActions(resultsState)).toBe(true);
  });

  it("returns guard guidance when a submit step is selected before prerequisites are met", () => {
    expect(
      getUploadStepBlockedReason("submit", {
        workspaceId: "ws-1",
        hasSelectedFile: true,
        selectedSourceType: "excel",
        requiresSheetSelection: true,
        selectedSheetName: null,
      }),
    ).toBe("Choose an Excel sheet before continuing to submit.");
  });

  it("returns no guard guidance when prerequisites are satisfied", () => {
    expect(
      getUploadStepBlockedReason("submit", {
        workspaceId: "ws-1",
        hasSelectedFile: true,
        selectedSourceType: "csv",
        requiresSheetSelection: false,
        selectedSheetName: null,
      }),
    ).toBeNull();
  });
});
