import type {
  WorkspaceCreateRequest,
  WorkspaceResponse,
  UploadResponse,
  OverridePayload,
  ProfileResponse,
  AssignRolePayload,
  ReadinessResponse,
  ManifestResponse,
  ImportManifestPayload,
} from "./types";
import { throwApiRequestError } from "./httpErrors";
import { appConfig } from "../config";

export async function createWorkspace(name: string): Promise<WorkspaceResponse> {
  const response = await fetch(`${appConfig.apiBaseUrl()}/workspaces`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name } as WorkspaceCreateRequest),
  });

  if (!response.ok) {
    await throwApiRequestError(response, "Failed to create workspace");
  }

  return response.json() as Promise<WorkspaceResponse>;
}

export async function uploadSource(
  workspaceId: string,
  file: File,
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${appConfig.apiBaseUrl()}/workspaces/${workspaceId}/sources/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    await throwApiRequestError(response, "Failed to upload source");
  }

  return response.json() as Promise<UploadResponse>;
}

export async function overrideSheet(
  workspaceId: string,
  sheetId: string,
  payload: OverridePayload,
): Promise<UploadResponse["sheets"][0]> {
  const response = await fetch(`${appConfig.apiBaseUrl()}/workspaces/${workspaceId}/sheets/${sheetId}/override`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await throwApiRequestError(response, "Failed to override sheet settings");
  }

  return response.json();
}

export async function getWorkspaceProfile(workspaceId: string): Promise<ProfileResponse> {
  const response = await fetch(`${appConfig.apiBaseUrl()}/workspaces/${workspaceId}/profile`);

  if (!response.ok) {
    await throwApiRequestError(response, "Failed to fetch workspace profile");
  }

  return response.json() as Promise<ProfileResponse>;
}

export async function assignColumnRoles(
  workspaceId: string,
  columnId: string,
  payload: AssignRolePayload,
): Promise<void> {
  const response = await fetch(`${appConfig.apiBaseUrl()}/workspaces/${workspaceId}/columns/${columnId}/roles`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await throwApiRequestError(response, "Failed to assign column role");
  }
}

export async function getReadiness(workspaceId: string): Promise<ReadinessResponse> {
  const response = await fetch(`${appConfig.apiBaseUrl()}/workspaces/${workspaceId}/readiness`);

  if (!response.ok) {
    await throwApiRequestError(response, "Failed to fetch readiness");
  }

  return response.json() as Promise<ReadinessResponse>;
}

export async function exportManifest(workspaceId: string): Promise<ManifestResponse> {
  const response = await fetch(`${appConfig.apiBaseUrl()}/workspaces/${workspaceId}/manifest/export`, {
    method: "POST",
  });

  if (!response.ok) {
    await throwApiRequestError(response, "Failed to export manifest");
  }

  return response.json() as Promise<ManifestResponse>;
}

export async function importManifest(manifest: ManifestResponse): Promise<WorkspaceResponse> {
  const response = await fetch(`${appConfig.apiBaseUrl()}/workspaces/manifest/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ manifest } as ImportManifestPayload),
  });

  if (!response.ok) {
    await throwApiRequestError(response, "Failed to import manifest");
  }

  return response.json() as Promise<WorkspaceResponse>;
}
