import { create } from "zustand";

import type {
  UploadProgressState,
  UploadResponse,
  UploadSheetOption,
  UploadSourceType,
} from "../api/types";
import type { UploadStepKey } from "../components/upload-flow";

export interface UploadFlowStoreState {
  focusedStep: UploadStepKey;
  selectedSourceType: UploadSourceType | null;
  selectedSheetName: string | null;
  sheetOptions: UploadSheetOption[];
  progressState: UploadProgressState;
  isUploading: boolean;
  errorMessage: string | null;
  lastUpload: UploadResponse | null;
  setFocusedStep: (step: UploadStepKey) => void;
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
  focusedStep: "workspace" as UploadStepKey,
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

  setFocusedStep: (focusedStep) => set({ focusedStep }),
  setSelectedSourceType: (selectedSourceType) =>
    set({
      focusedStep: "source",
      selectedSourceType,
      // Source changes invalidate sheet selection decisions from a prior source type.
      selectedSheetName: null,
      sheetOptions: [],
    }),
  setSelectedSheetName: (selectedSheetName) =>
    set((state) => ({
      focusedStep: selectedSheetName ? "submit" : state.focusedStep,
      selectedSheetName,
    })),
  setSheetOptions: (sheetOptions) =>
    set((state) => {
      let nextFocusedStep = state.focusedStep;
      if (sheetOptions.length > 1) {
        nextFocusedStep = "sheet";
      } else if (sheetOptions.length === 1) {
        nextFocusedStep = "submit";
      }
      return {
        focusedStep: nextFocusedStep,
        sheetOptions,
      };
    }),
  setProgressState: (progressState) => set({ progressState }),
  setIsUploading: (isUploading) => set({ isUploading }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
  setLastUpload: (lastUpload) => set({ lastUpload }),
  reset: () => set({ ...defaultState }),
}));
