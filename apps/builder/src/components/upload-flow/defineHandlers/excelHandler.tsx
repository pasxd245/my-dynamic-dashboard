import ExcelSheetPicker from "../ExcelSheetPicker";
import type { SourceTypeDefineHandler } from "./types";
import type { UploadFlowState } from "../../../state";

const excelHandler: SourceTypeDefineHandler = {
  /**
   * Excel layout card: sheet picker for single-sheet selection.
   * Positioned before schema preview; wired to upload flow state.
   */
  layoutCard: (state: UploadFlowState) => {
    const { selectedSheetName, sheetOptions, setSelectedSheetName } = state;
    return (
      <ExcelSheetPicker
        options={sheetOptions}
        value={selectedSheetName}
        onChange={(sheetName) => setSelectedSheetName(sheetName)}
        disabled={false}
      />
    );
  },

  /**
   * No pre-schema preview UI for Excel.
   */
  beforeSchemaPreview: undefined,

  /**
   * Excel readiness: requires sheet selection if workbook has multiple sheets.
   * Single-sheet workbooks auto-select the only sheet and are ready.
   */
  validate: (state: UploadFlowState) => {
    const { sheetOptions, selectedSheetName } = state;
    if (sheetOptions.length === 0) {
      return {
        ok: false,
        reasons: ["Excel workbook must contain at least one sheet."],
      };
    }
    if (sheetOptions.length > 1 && !selectedSheetName) {
      return {
        ok: false,
        reasons: ["Select a sheet from the workbook to continue."],
      };
    }
    return {
      ok: true,
      reasons: [],
    };
  },
};

export default excelHandler;
