import { create } from "zustand";

import type {
  UploadProgressState,
  UploadResponse,
  UploadSheetOption,
  UploadSourceType,
} from "../api/types";

export interface UploadFlowStoreState {
  selectedSourceType: UploadSourceType | null;
  selectedSheetName: string | null;
  sheetOptions: UploadSheetOption[];
  progressState: UploadProgressState;
  isUploading: boolean;
  errorMessage: string | null;
  lastUpload: UploadResponse | null;
  setSelectedSourceType: (sourceType: UploadSourceType | null) => void;
  setSelectedSheetName: (sheetName: string | null) => void;
  setSheetOptions: (options: UploadSheetOption[]) => void;
  setProgressState: (state: UploadProgressState) => void;
  setIsUploading: (isUploading: boolean) => void;
  setErrorMessage: (errorMessage: string | null) => void;
  setLastUpload: (payload: UploadResponse | null) => void;
  reset: () => void;
}

const defaultState = {
  selectedSourceType: null,
  selectedSheetName: null,
  sheetOptions: [] as UploadSheetOption[],
  progressState: "idle" as UploadProgressState,
  isUploading: false,
  errorMessage: null,
  lastUpload: null,
};

export const useUploadFlowStore = create<UploadFlowStoreState>((set) => ({
  ...defaultState,

  setSelectedSourceType: (selectedSourceType) =>
    set({
      selectedSourceType,
      // Source changes invalidate sheet selection decisions from a prior source type.
      selectedSheetName: null,
      sheetOptions: [],
    }),
  setSelectedSheetName: (selectedSheetName) => set({ selectedSheetName }),
  setSheetOptions: (sheetOptions) => set({ sheetOptions }),
  setProgressState: (progressState) => set({ progressState }),
  setIsUploading: (isUploading) => set({ isUploading }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
  setLastUpload: (lastUpload) => set({ lastUpload }),
  reset: () => set({ ...defaultState }),
}));
