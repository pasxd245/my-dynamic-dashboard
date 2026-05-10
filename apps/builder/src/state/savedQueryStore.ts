import { create } from "zustand";

import type { SavedQuerySummary } from "../api/queryApi";
import type { ActionableError } from "../api/types";

export interface SavedQueryFilters {
  query: string;
  tags: string[];
  state: "active" | "deleted" | "all";
}

export interface SavedQueryStoreState {
  queries: SavedQuerySummary[];
  isLoading: boolean;
  error: string;
  actionableError: ActionableError | null;
  total: number;
  limit: number;
  offset: number;
  filters: SavedQueryFilters;
  actionInProgress: string | null;
  init: () => void;
  reset: () => void;
  setQueries: (queries: SavedQuerySummary[]) => void;
  updateQueries: (updater: (queries: SavedQuerySummary[]) => SavedQuerySummary[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: string) => void;
  setActionableError: (actionableError: ActionableError | null) => void;
  setTotal: (total: number) => void;
  setOffset: (offset: number) => void;
  setFilters: (filters: SavedQueryFilters) => void;
  setActionInProgress: (actionInProgress: string | null) => void;
}

const defaultFilters: SavedQueryFilters = {
  query: "",
  tags: [],
  state: "active",
};

const defaultState = {
  queries: [] as SavedQuerySummary[],
  isLoading: false,
  error: "",
  actionableError: null as ActionableError | null,
  total: 0,
  limit: 50,
  offset: 0,
  filters: defaultFilters,
  actionInProgress: null as string | null,
};

export const useSavedQueryStore = create<SavedQueryStoreState>((set) => ({
  ...defaultState,

  init: () => {
    // Placeholder to keep init/reset parity with other stores.
  },

  reset: () => set({ ...defaultState, filters: { ...defaultFilters } }),
  setQueries: (queries: SavedQuerySummary[]) => set({ queries }),
  updateQueries: (updater) => set((state) => ({ queries: updater(state.queries) })),
  setIsLoading: (isLoading: boolean) => set({ isLoading }),
  setError: (error: string) => set({ error }),
  setActionableError: (actionableError: ActionableError | null) => set({ actionableError }),
  setTotal: (total: number) => set({ total }),
  setOffset: (offset: number) => set({ offset }),
  setFilters: (filters: SavedQueryFilters) => set({ filters }),
  setActionInProgress: (actionInProgress: string | null) => set({ actionInProgress }),
}));
