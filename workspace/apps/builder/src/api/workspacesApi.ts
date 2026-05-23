import type {
  CreateWorkspaceInput,
  Workspace,
} from "../features/data-management/workspaces/types";

// R13 ships with a TypeScript constant + import.meta.env fallback.
// A .env-driven base URL waits until staging/prod URLs exist.
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function readJson<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    throw new Error(`Request failed: ${resp.status} ${resp.statusText}`);
  }
  return (await resp.json()) as T;
}

export const workspacesApi = {
  async list(): Promise<Workspace[]> {
    const resp = await fetch(`${API_BASE_URL}/workspaces`);
    return readJson<Workspace[]>(resp);
  },
  async create(input: CreateWorkspaceInput): Promise<Workspace> {
    const resp = await fetch(`${API_BASE_URL}/workspaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return readJson<Workspace>(resp);
  },
};
