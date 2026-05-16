import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import ExcelSheetPicker from "../../components/upload-flow/ExcelSheetPicker";
import UploadStageSidebar from "../../components/upload-flow/UploadStageSidebar";
import {
  buildUploadStepNavItems,
  deriveUploadStep,
} from "../../components/upload-flow";
import {
  detectSourceTypeFromFilename,
  getSourceTypeMismatchMessage,
  isSourceTypeCompatibleWithFilename,
} from "../../components/upload-flow/sourceTypeRules";
import { useUploadFlowStore } from "../../state/uploadFlowStore";

function stepItem(title: string): HTMLElement {
  const el = screen.getByText(title).closest(".ant-steps-item");
  if (!el) throw new Error(`Step item for ${title} not found`);
  return el as HTMLElement;
}

describe("Upload flow source-type compatibility (US1)", () => {
  it("renders upload sidebar steps and marks the active step", () => {
    render(
      <UploadStageSidebar
        items={buildUploadStepNavItems({
          workspaceId: "ws-1",
          hasSelectedFile: false,
          selectedSourceType: null,
          requiresSheetSelection: false,
          selectedSheetName: null,
        })}
        activeStep="source"
        onSelectStep={() => {}}
      />,
    );

    expect(screen.getByText("Source")).toBeTruthy();
    expect(stepItem("Source").className).toContain("ant-steps-item-process");
    expect(screen.getByText("Extract")).toBeTruthy();
    expect(screen.getByText("Define")).toBeTruthy();
    expect(screen.getByText("Publish")).toBeTruthy();
  });

  it("shows blocked-stage guidance when a downstream step is selected too early", () => {
    const onBlockedSelect = vi.fn();

    render(
      <UploadStageSidebar
        items={buildUploadStepNavItems({
          workspaceId: null,
          hasSelectedFile: false,
          selectedSourceType: null,
          requiresSheetSelection: false,
          selectedSheetName: null,
        })}
        activeStep="source"
        onSelectStep={() => {}}
        onBlockedSelect={onBlockedSelect}
      />,
    );

    fireEvent.click(stepItem("Extract"));

    expect(onBlockedSelect).toHaveBeenCalledWith(
      "extract",
      "Select or create a workspace before continuing.",
    );
  });

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
  it("derives the next guided step from current upload prerequisites", () => {
    expect(
      deriveUploadStep({
        workspaceId: null,
        hasSelectedFile: false,
        selectedSourceType: null,
        requiresSheetSelection: false,
        selectedSheetName: null,
      }),
    ).toBe("source");

    expect(
      deriveUploadStep({
        workspaceId: "ws-1",
        hasSelectedFile: true,
        selectedSourceType: "excel",
        requiresSheetSelection: true,
        selectedSheetName: null,
      }),
    ).toBe("extract");

    expect(
      deriveUploadStep({
        workspaceId: "ws-1",
        hasSelectedFile: true,
        selectedSourceType: "csv",
        requiresSheetSelection: false,
        selectedSheetName: null,
      }),
    ).toBe("extract");
  });

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
    fireEvent.mouseDown(screen.getByRole("combobox"));
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
  it("blocks sidebar navigation while upload work is in progress", () => {
    render(
      <UploadStageSidebar
        items={buildUploadStepNavItems({
          workspaceId: "ws-1",
          hasSelectedFile: true,
          selectedSourceType: "csv",
          requiresSheetSelection: false,
          selectedSheetName: null,
        })}
        activeStep="define"
        onSelectStep={() => {}}
        blockNavigation
      />,
    );

    expect(stepItem("Source").className).toContain("ant-steps-item-disabled");
    expect(stepItem("Define").className).toContain("ant-steps-item-disabled");
  });

  it("stores upload progress lifecycle states", () => {
    useUploadFlowStore.getState().setProgressState("uploading");
    expect(useUploadFlowStore.getState().progressState).toBe("uploading");

    useUploadFlowStore.getState().setProgressState("success");
    expect(useUploadFlowStore.getState().progressState).toBe("success");

    useUploadFlowStore.getState().setProgressState("error");
    expect(useUploadFlowStore.getState().progressState).toBe("error");
  });
});
