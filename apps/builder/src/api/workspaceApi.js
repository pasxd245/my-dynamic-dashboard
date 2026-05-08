async function readApiError(response, fallbackMessage) {
  try {
    const payload = await response.json();
    const detailMessage = payload?.error?.message;
    const mismatchDetails = payload?.error?.details?.mismatches;

    if (Array.isArray(mismatchDetails) && mismatchDetails.length > 0) {
      return `${detailMessage ?? fallbackMessage}: ${JSON.stringify(mismatchDetails)}`;
    }

    return detailMessage ?? fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

export async function createWorkspace(name) {
  const response = await fetch("/api/v1/workspaces", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, "Failed to create workspace"));
  }

  return response.json();
}

export async function uploadSource(workspaceId, file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`/api/v1/workspaces/${workspaceId}/sources/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, "Failed to upload source"));
  }

  return response.json();
}

export async function overrideSheet(workspaceId, sheetId, payload) {
  const response = await fetch(`/api/v1/workspaces/${workspaceId}/sheets/${sheetId}/override`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, "Failed to override sheet settings"));
  }

  return response.json();
}

export async function getWorkspaceProfile(workspaceId) {
  const response = await fetch(`/api/v1/workspaces/${workspaceId}/profile`);

  if (!response.ok) {
    throw new Error(await readApiError(response, "Failed to fetch workspace profile"));
  }

  return response.json();
}

export async function assignColumnRoles(workspaceId, columnId, payload) {
  const response = await fetch(`/api/v1/workspaces/${workspaceId}/columns/${columnId}/roles`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, "Failed to assign column role"));
  }

  return response.json();
}

export async function getReadiness(workspaceId) {
  const response = await fetch(`/api/v1/workspaces/${workspaceId}/readiness`);

  if (!response.ok) {
    throw new Error(await readApiError(response, "Failed to fetch readiness"));
  }

  return response.json();
}

export async function exportManifest(workspaceId) {
  const response = await fetch(`/api/v1/workspaces/${workspaceId}/manifest/export`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, "Failed to export manifest"));
  }

  return response.json();
}

export async function importManifest(manifest) {
  const response = await fetch("/api/v1/workspaces/manifest/import", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ manifest }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, "Failed to import manifest"));
  }

  return response.json();
}
