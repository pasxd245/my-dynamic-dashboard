import type {
  WorkspaceCreateRequest,
  WorkspaceResponse,
  UploadResponse,
  UploadSheetDiscoveryResponse,
  UploadSourceOptions,
  OverridePayload,
  ProfileResponse,
  AssignRolePayload,
  ReadinessResponse,
  ManifestResponse,
  ImportManifestPayload,
} from "./types";
import { throwApiRequestError } from "./httpErrors";
import { appConfig } from "../config";

function buildUploadSourceFormData(file: File, options: UploadSourceOptions): FormData {
  const { sourceType, sheetName } = options;
  const formData = new FormData();
  formData.append("file", file);
  if (sourceType) {
    formData.append("source_type", sourceType);
  }
  if (sheetName) {
    formData.append("sheet_name", sheetName);
  }
  return formData;
}

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
  options: UploadSourceOptions = {},
): Promise<UploadResponse> {
  const { lifecycle } = options;
  const formData = buildUploadSourceFormData(file, options);

  lifecycle?.onStart?.();

  let response: Response;
  try {
    response = await fetch(`${appConfig.apiBaseUrl()}/workspaces/${workspaceId}/sources/upload`, {
      method: "POST",
      body: formData,
    });
  } catch (error) {
    lifecycle?.onError?.(error);
    lifecycle?.onSettled?.();
    throw error;
  }

  if (!response.ok) {
    try {
      await throwApiRequestError(response, "Failed to upload source");
    } catch (error) {
      lifecycle?.onError?.(error);
      lifecycle?.onSettled?.();
      throw error;
    }
  }

  const payload = (await response.json()) as UploadResponse;
  lifecycle?.onSuccess?.(payload);
  lifecycle?.onSettled?.();
  return payload;
}

export async function discoverExcelSheets(
  workspaceId: string,
  file: File,
): Promise<UploadSheetDiscoveryResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("source_type", "excel");

  const response = await fetch(`${appConfig.apiBaseUrl()}/workspaces/${workspaceId}/sources/discover-sheets`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    await throwApiRequestError(response, "Failed to discover Excel sheets");
  }

  return response.json() as Promise<UploadSheetDiscoveryResponse>;
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
