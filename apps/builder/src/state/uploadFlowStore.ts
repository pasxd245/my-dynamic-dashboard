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

/**
 * UploadFlowState — public view of upload flow state for use in handlers and UI components.
 * Combines read-only state fields with setter functions needed for Define section handlers.
 */
export type UploadFlowState = Pick<UploadFlowStoreState, 'selectedSourceType' | 'selectedSheetName' | 'sheetOptions' | 'isUploading'> & Pick<UploadFlowStoreState, 'setSelectedSheetName'>;

const defaultState = {
  focusedStep: "source" as UploadStepKey,
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
      selectedSheetName: null,
      sheetOptions: [],
    }),
  setSelectedSheetName: (selectedSheetName) =>
    set((state) => ({
      focusedStep: selectedSheetName ? "define" : state.focusedStep,
      selectedSheetName,
    })),
  setSheetOptions: (sheetOptions) =>
    set((state) => {
      let nextFocusedStep = state.focusedStep;
      if (sheetOptions.length > 1) {
        nextFocusedStep = "extract";
      } else if (sheetOptions.length === 1) {
        nextFocusedStep = "define";
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
