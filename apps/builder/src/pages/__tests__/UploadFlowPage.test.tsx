import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import ExcelSheetPicker from "../../components/upload-flow/ExcelSheetPicker";
import {
  detectSourceTypeFromFilename,
  getSourceTypeMismatchMessage,
  isSourceTypeCompatibleWithFilename,
} from "../../components/upload-flow/sourceTypeRules";
import { useUploadFlowStore } from "../../state/uploadFlowStore";

describe("Upload flow source-type compatibility (US1)", () => {
  it("detects supported source types by file extension", () => {
    expect(detectSourceTypeFromFilename("orders.csv")).toBe("csv");
    expect(detectSourceTypeFromFilename("book.xlsx")).toBe("excel");
    expect(detectSourceTypeFromFilename("book.xlsm")).toBe("excel");
    expect(detectSourceTypeFromFilename("book.xls")).toBe("excel");
  });

  it("accepts valid source type + file combinations", () => {
    expect(isSourceTypeCompatibleWithFilename("csv", "orders.csv")).toBe(true);
    expect(isSourceTypeCompatibleWithFilename("excel", "book.xlsx")).toBe(true);
  });

  it("returns actionable mismatch or unsupported messages for invalid combinations", () => {
    expect(isSourceTypeCompatibleWithFilename("excel", "orders.csv")).toBe(false);
    expect(getSourceTypeMismatchMessage("excel", "orders.csv")).toContain("does not match");
    expect(getSourceTypeMismatchMessage("csv", "orders.json")).toContain("Unsupported file extension");
  });
});

describe("Upload flow sheet-picker behavior (US2)", () => {
  it("renders explicit sheet choices when multiple workbook sheets are available", () => {
    render(
      <ExcelSheetPicker
        options={[
          { name: "Summary", index: 0 },
          { name: "Revenue", index: 1 },
        ]}
        value={null}
        onChange={() => {}}
      />,
    );

    expect(screen.getByLabelText("Excel sheet")).toBeTruthy();
    expect(screen.getByRole("option", { name: "Summary" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Revenue" })).toBeTruthy();
  });

  it("clears prior sheet selection when the source type changes", () => {
    useUploadFlowStore.setState({
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
    expect(nextState.selectedSourceType).toBe("csv");
    expect(nextState.selectedSheetName).toBeNull();
    expect(nextState.sheetOptions).toEqual([]);
  });
});

describe("Upload flow progress behavior (US3)", () => {
  it("stores upload progress lifecycle states", () => {
    useUploadFlowStore.getState().setProgressState("uploading");
    expect(useUploadFlowStore.getState().progressState).toBe("uploading");

    useUploadFlowStore.getState().setProgressState("success");
    expect(useUploadFlowStore.getState().progressState).toBe("success");

    useUploadFlowStore.getState().setProgressState("error");
    expect(useUploadFlowStore.getState().progressState).toBe("error");
  });
});
