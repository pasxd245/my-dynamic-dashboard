import { create } from "zustand";
import type { WorkspaceResponse } from "../api/types";
import { listWorkspaces, createWorkspace } from "../api/workspaceApi";

export interface WorkspaceStoreState {
  workspaces: WorkspaceResponse[];
  selectedWorkspaceId: string | null;
  isLoading: boolean;
  error: string | null;
  loadWorkspaces: () => Promise<void>;
  selectWorkspace: (workspaceId: string) => void;
  createAndSelectWorkspace: (name: string) => Promise<WorkspaceResponse>;
  setError: (error: string | null) => void;
  reset: () => void;
}

const defaultState = {
  workspaces: [] as WorkspaceResponse[],
  selectedWorkspaceId: null,
  isLoading: false,
  error: null,
};

export const useWorkspaceStore = create<WorkspaceStoreState>((set) => ({
  ...defaultState,

  loadWorkspaces: async () => {
    set({ isLoading: true, error: null });
    try {
      const workspaces = await listWorkspaces();
      set({ workspaces, isLoading: false });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load workspaces";
      set({ error: errorMessage, isLoading: false });
    }
  },

  selectWorkspace: (workspaceId: string) => {
    set({ selectedWorkspaceId: workspaceId });
  },

  createAndSelectWorkspace: async (name: string) => {
    set({ isLoading: true, error: null });
    try {
      const newWorkspace = await createWorkspace(name);
      set((state) => ({
        workspaces: [...state.workspaces, newWorkspace],
        selectedWorkspaceId: newWorkspace.id,
        isLoading: false,
      }));
      return newWorkspace;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create workspace";
      set({ error: errorMessage, isLoading: false });
      throw err;
    }
  },

  setError: (error) => set({ error }),

  reset: () => set({ ...defaultState }),
}));
