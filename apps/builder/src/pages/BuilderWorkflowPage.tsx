import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import WorkflowShell from "../components/workflow-shell/WorkflowShell";
import QueryBuilderPanel from "../components/query-builder/QueryBuilderPanel";
import { SavedQueryLibraryPage } from "./SavedQueryLibrary";
import {
  pathFromWorkflowStage,
  persistWorkflowStage,
  readPersistedWorkflowStage,
  workflowStageFromPath,
  initialBuilderSessionStoreState,
  refreshBuilderSessionStore,
  canRunContextGuardedActions,
  type BuilderSessionStoreState,
} from "../state/builderSessionStore";

export interface BuilderWorkflowPageProps {
  uploadSourcePanel?: ReactNode;
  schemaSheetPanel?: ReactNode;
  queryPanel?: ReactNode;
  resultsSavedPanel?: ReactNode;
}

export default function BuilderWorkflowPage({
  uploadSourcePanel,
  schemaSheetPanel,
  queryPanel,
  resultsSavedPanel,
}: BuilderWorkflowPageProps): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const [storeState, setStoreState] = useState<BuilderSessionStoreState>(
    initialBuilderSessionStoreState,
  );

  const loadStoreState = async (baseState: BuilderSessionStoreState): Promise<void> => {
    setStoreState((current) => ({
      ...current,
      isRefreshing: true,
    }));

    const nextState = await refreshBuilderSessionStore(baseState);
    setStoreState(nextState);
  };

  useEffect(() => {
    const pathStage = workflowStageFromPath(location.pathname.split("/").pop());
    const persistedStage = readPersistedWorkflowStage();
    const requestedStage = pathStage ?? persistedStage;
    const seedState: BuilderSessionStoreState = {
      ...initialBuilderSessionStoreState,
      activeStage: requestedStage,
    };
    void loadStoreState(seedState);
  }, []);

  useEffect(() => {
    persistWorkflowStage(storeState.activeStage);
  }, [storeState.activeStage]);

  const setActiveStage = (stage: BuilderSessionStoreState["activeStage"]): void => {
    setStoreState((previous) => ({
      ...previous,
      activeStage: stage,
    }));
    navigate(`/workflow/${pathFromWorkflowStage(stage)}`);
  };

  const sessionState = storeState.sessionState;
  const contextGuardReady = canRunContextGuardedActions(storeState);
  const stageContent: Record<BuilderSessionStoreState["activeStage"], React.ReactNode> = {
    upload_source:
      uploadSourcePanel ?? (
        <div className="space-y-2 text-sm text-slate-700">
          <p>Use the main builder page to create workspace and upload your source.</p>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="rounded bg-slate-800 px-3 py-1.5 font-medium text-white hover:bg-slate-900"
          >
            Open upload controls
          </button>
        </div>
      ),
    schema_sheet:
      schemaSheetPanel ?? (
        <div className="space-y-2 text-sm text-slate-700">
          <p>Schema and profile actions are available from the main builder controls.</p>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="rounded bg-slate-800 px-3 py-1.5 font-medium text-white hover:bg-slate-900"
          >
            Open schema controls
          </button>
        </div>
      ),
    query: queryPanel ?? <QueryBuilderPanel workspaceId={sessionState?.active_workspace.workspace_id} />,
    results_saved:
      resultsSavedPanel ??
      (sessionState?.active_workspace.workspace_id ? (
        <SavedQueryLibraryPage workspaceId={sessionState.active_workspace.workspace_id} />
      ) : (
        <p className="text-sm text-slate-700">Select an active workspace to browse saved queries.</p>
      )),
  };

  return (
    <WorkflowShell
      workspaceName={sessionState?.active_workspace.workspace_name || sessionState?.active_workspace.workspace_id}
      sourceName={sessionState?.active_source.source_name || sessionState?.active_source.source_id}
      workspaceState={sessionState?.active_workspace.state || "unresolved"}
      sourceState={sessionState?.active_source.state || "unresolved"}
      connectionStatus={sessionState?.connection_status}
      isRefreshingConnectionStatus={storeState.isRefreshing}
      onRefreshConnectionStatus={() => {
        void loadStoreState(storeState);
      }}
      stages={sessionState?.stages ?? []}
      activeStage={storeState.activeStage}
      onSelectStage={setActiveStage}
      stageContent={stageContent}
      blockContextGuardedStages={!contextGuardReady}
      onReselectContext={() => {
        globalThis.window.location.hash = "#context-selector";
      }}
    >
      {contextGuardReady ? null : (
        <p className="text-sm text-slate-700">Resolve workspace/source context to unlock downstream stages.</p>
      )}
    </WorkflowShell>
  );
}
