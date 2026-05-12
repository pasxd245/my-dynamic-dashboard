import { afterEach, describe, expect, it } from "vitest";

import { useUploadFlowStore } from "../uploadFlowStore";

afterEach(() => {
  useUploadFlowStore.getState().reset();
});

describe("uploadFlowStore guided step behavior", () => {
  it("starts on the source step", () => {
    expect(useUploadFlowStore.getState().focusedStep).toBe("source");
  });

  it("resets dependent sheet state when source type changes", () => {
    useUploadFlowStore.setState({
      focusedStep: "extract",
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

  it("moves to the extract step when multiple workbook options are loaded", () => {
    useUploadFlowStore.getState().setSheetOptions([
      { name: "Summary", index: 0 },
      { name: "Revenue", index: 1 },
    ]);

    expect(useUploadFlowStore.getState().focusedStep).toBe("extract");
  });

  it("moves to define after a sheet is selected", () => {
    useUploadFlowStore.getState().setSelectedSheetName("Revenue");

    expect(useUploadFlowStore.getState().focusedStep).toBe("define");
  });
});
