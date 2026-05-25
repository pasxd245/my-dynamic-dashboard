import { appConfig } from '../config';
import { ApiErrorThrown, isApiError } from '../features/data-management/_shared/types';
import type { CreateWorkspaceInput, Workspace } from '../features/data-management/workspaces/types';

// R28: single config source — appConfig reads from the rendered
// VITE_API_BASE_URL with a Const fallback. Was triplicated across the
// three api files; now one call per file (and the same call returns
// the same value, so file-local constants are still fine).
const API_BASE_URL = appConfig.apiBaseUrl();

async function readJson<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    await throwApiError(resp);
  }
  return (await resp.json()) as T;
}

/** Parse a 4xx body as `ApiError` when shaped that way; otherwise throw a
 *  generic Error. Defensive against non-JSON 4xx (proxy, network errors). */
async function throwApiError(resp: Response): Promise<never> {
  let parsed: unknown = null;
  try {
    parsed = await resp.json();
  } catch {
    // Non-JSON 4xx — fall through to the generic throw.
  }
  if (isApiError(parsed)) {
    throw new ApiErrorThrown(resp.status, parsed);
  }
  throw new Error(`Request failed: ${resp.status} ${resp.statusText}`);
}

export const workspacesApi = {
  async list(): Promise<Workspace[]> {
    const resp = await fetch(`${API_BASE_URL}/workspaces`);
    return readJson<Workspace[]>(resp);
  },
  async create(input: CreateWorkspaceInput): Promise<Workspace> {
    const resp = await fetch(`${API_BASE_URL}/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return readJson<Workspace>(resp);
  },
  async patch(id: string, body: { name: string }): Promise<Workspace> {
    const resp = await fetch(`${API_BASE_URL}/workspaces/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return readJson<Workspace>(resp);
  },
  async delete(id: string): Promise<void> {
    const resp = await fetch(`${API_BASE_URL}/workspaces/${id}`, {
      method: 'DELETE',
    });
    if (!resp.ok) {
      await throwApiError(resp);
    }
  },
};
