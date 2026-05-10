import { create } from "zustand";

import type {
  ManifestResponse,
  ProfileResponse,
  ReadinessResponse,
  UploadResponse,
} from "../api/types";

const STORAGE_KEY = "builder.query.workspace";

interface WorkspaceHydration {
  workspaceId: string;
  workspaceName: string;
}

export interface QueryBuilderStoreState {
  workspaceName: string;
  workspaceId: string;
  uploadResult: UploadResponse | null;
  profile: ProfileResponse | null;
  readiness: ReadinessResponse | null;
  manifestPreview: ManifestResponse | null;
  builderSnapshot: Record<string, unknown> | null;
  loadedSnapshot: Record<string, unknown> | null;
  init: () => void;
  reset: () => void;
  setWorkspaceName: (workspaceName: string) => void;
  setWorkspaceId: (workspaceId: string) => void;
  setUploadResult: (uploadResult: UploadResponse | null) => void;
  setProfile: (profile: ProfileResponse | null) => void;
  setReadiness: (readiness: ReadinessResponse | null) => void;
  setManifestPreview: (manifestPreview: ManifestResponse | null) => void;
  setBuilderSnapshot: (builderSnapshot: Record<string, unknown> | null) => void;
  setLoadedSnapshot: (loadedSnapshot: Record<string, unknown> | null) => void;
}

const defaultState = {
  workspaceName: "MVP1 Workspace",
  workspaceId: "",
  uploadResult: null,
  profile: null,
  readiness: null,
  manifestPreview: null,
  builderSnapshot: null,
  loadedSnapshot: null,
};

function readHydration(): WorkspaceHydration | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<WorkspaceHydration>;
    if (typeof parsed.workspaceId !== "string" || typeof parsed.workspaceName !== "string") {
      return null;
    }
    return {
      workspaceId: parsed.workspaceId,
      workspaceName: parsed.workspaceName,
    };
  } catch {
    return null;
  }
}

function writeHydration(workspaceId: string, workspaceName: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ workspaceId, workspaceName } satisfies WorkspaceHydration),
    );
  } catch {
    // Ignore storage failures.
  }
}

export const useQueryBuilderStore = create<QueryBuilderStoreState>((set, get) => ({
  ...defaultState,

  init: () => {
    const hydrated = readHydration();
    if (!hydrated) {
      return;
    }
    set({
      workspaceId: hydrated.workspaceId,
      workspaceName: hydrated.workspaceName,
    });
  },

  reset: () => {
    set({ ...defaultState });
    writeHydration("", defaultState.workspaceName);
  },

  setWorkspaceName: (workspaceName: string) => {
    set({ workspaceName });
    const { workspaceId } = get();
    writeHydration(workspaceId, workspaceName);
  },

  setWorkspaceId: (workspaceId: string) => {
    set({ workspaceId });
    const { workspaceName } = get();
    writeHydration(workspaceId, workspaceName);
  },

  setUploadResult: (uploadResult: UploadResponse | null) => set({ uploadResult }),
  setProfile: (profile: ProfileResponse | null) => set({ profile }),
  setReadiness: (readiness: ReadinessResponse | null) => set({ readiness }),
  setManifestPreview: (manifestPreview: ManifestResponse | null) => set({ manifestPreview }),
  setBuilderSnapshot: (builderSnapshot: Record<string, unknown> | null) => set({ builderSnapshot }),
  setLoadedSnapshot: (loadedSnapshot: Record<string, unknown> | null) => set({ loadedSnapshot }),
}));
