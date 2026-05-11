import { afterEach, describe, expect, it } from "vitest";

import { useUploadFlowStore } from "../uploadFlowStore";

afterEach(() => {
  useUploadFlowStore.getState().reset();
});

describe("uploadFlowStore guided step behavior", () => {
  it("starts on the workspace step", () => {
    expect(useUploadFlowStore.getState().focusedStep).toBe("workspace");
  });

  it("resets dependent sheet state when source type changes", () => {
    useUploadFlowStore.setState({
      focusedStep: "sheet",
      selectedSourceType: "excel",
      selectedSheetName: "Revenue",
      sheetOptions: [{ name: "Revenue", index: 0 }],
      progressState: "idle",
      isUploading: false,
      errorMessage: null,
      lastUpload: null,
    });

    useUploadFlowStore.getState().setSelectedSourceType("csv");

    const nextState = useUploadFlowStore.getState();
    expect(nextState.focusedStep).toBe("source");
    expect(nextState.selectedSheetName).toBeNull();
    expect(nextState.sheetOptions).toEqual([]);
  });

  it("moves to the sheet step when multiple workbook options are loaded", () => {
    useUploadFlowStore.getState().setSheetOptions([
      { name: "Summary", index: 0 },
      { name: "Revenue", index: 1 },
    ]);

    expect(useUploadFlowStore.getState().focusedStep).toBe("sheet");
  });

  it("moves to submit after a sheet is selected", () => {
    useUploadFlowStore.getState().setSelectedSheetName("Revenue");

    expect(useUploadFlowStore.getState().focusedStep).toBe("submit");
  });
});
