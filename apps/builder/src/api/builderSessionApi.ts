import type {
  ActiveSourceContext,
  ActiveWorkspaceContext,
  BuilderSessionState,
  ConnectionStatus,
  WorkflowStageKey,
} from "./types";

import { appConfig } from "../config";

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

export interface SetActiveContextRequest {
  workspace_id: string;
  source_id: string;
}

export interface ActiveContextResponse {
  workspace: ActiveWorkspaceContext;
  source: ActiveSourceContext;
}

export async function getBuilderPreflight(): Promise<ConnectionStatus> {
  const response = await fetch(`${appConfig.apiBaseUrl()}/builder/preflight`);
  return parseJson<ConnectionStatus>(response);
}

export async function getBuilderSessionState(
  currentStage?: WorkflowStageKey,
): Promise<BuilderSessionState> {
  const query = currentStage
    ? `?current_stage=${encodeURIComponent(currentStage)}`
    : "";
  const response = await fetch(`${appConfig.apiBaseUrl()}/builder/session-state${query}`);
  return parseJson<BuilderSessionState>(response);
}

export async function setActiveContext(
  payload: SetActiveContextRequest,
): Promise<ActiveContextResponse> {
  const response = await fetch(`${appConfig.apiBaseUrl()}/workspaces/active-context`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<ActiveContextResponse>(response);
}
