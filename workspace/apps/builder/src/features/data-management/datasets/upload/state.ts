import type {
  Column,
  ColumnOverride,
  CsvParsePreview,
  ParseSheetFailed,
  ParseSheetOk,
  SheetSummary,
  SourceFormat,
  TempUploadResponse,
} from "../types";

export type WizardStep =
  | "source"
  | "sheet"
  | "metadata"
  | "preview"
  | "confirm";

/** Key used to store CSV state in the sheets map. */
export const CSV_SHEET_KEY = "";

export type SheetState = {
  /** Per-sheet parse status (Excel) or "ok" once the CSV upload returns. */
  status: "pending" | "parsing" | "ok" | "failed";
  columns: Column[];
  rowCount: number;
  sampleRows: (string | null)[][];
  /** Set when status === "failed". */
  parseError?: { error: string; detail: string };
  /** User-supplied dtype overrides keyed by column name. */
  columnOverrides: Record<string, ColumnOverride>;
  /** Column names the user has chosen to drop. */
  excludedColumns: string[];
  /** Dataset name input. Defaults to `<file-stem>_<sheet>` for Excel. */
  name: string;
};

export type WizardState = {
  step: WizardStep;
  sourceFormat: SourceFormat;
  workspaceId: string | null;
  file: File | null;
  tempId: string | null;
  /** Excel only — sheet metadata returned by `POST /uploads`. */
  availableSheets: SheetSummary[];
  /** Excel only — user-selected sheets, in the order they'll appear. */
  selectedSheets: string[];
  /** Per-sheet state map. CSV uses the empty-string sentinel key. */
  sheets: Record<string, SheetState>;
};

export const INITIAL_WIZARD_STATE: WizardState = {
  step: "source",
  sourceFormat: "excel",
  workspaceId: null,
  file: null,
  tempId: null,
  availableSheets: [],
  selectedSheets: [],
  sheets: {},
};

function stemFromName(filename: string): string {
  const last = filename.lastIndexOf(".");
  return last <= 0 ? filename : filename.slice(0, last);
}

function defaultName(file: File | null, sheet: string | undefined): string {
  const stem = file ? stemFromName(file.name) : "dataset";
  return sheet ? `${stem}_${sheet}` : stem;
}

export type WizardAction =
  | { type: "SET_SOURCE_FORMAT"; sourceFormat: SourceFormat }
  | { type: "SET_WORKSPACE"; workspaceId: string }
  | { type: "SET_FILE"; file: File }
  | { type: "UPLOAD_INIT_SUCCESS"; response: TempUploadResponse }
  | { type: "TOGGLE_SELECTED_SHEET"; sheet: string }
  | { type: "PARSE_SHEET_START"; sheet: string }
  | { type: "PARSE_SHEET_SUCCESS"; sheet: string; result: ParseSheetOk }
  | { type: "PARSE_SHEET_FAILED"; sheet: string; result: ParseSheetFailed }
  | {
      type: "SET_COLUMN_OVERRIDE";
      sheet: string;
      column: string;
      override: ColumnOverride | null;
    }
  | { type: "TOGGLE_EXCLUDED_COLUMN"; sheet: string; column: string }
  | { type: "SET_DATASET_NAME"; sheet: string; name: string }
  | { type: "GOTO_STEP"; step: WizardStep }
  | { type: "RESET" };

function setSheet(
  state: WizardState,
  key: string,
  patch: Partial<SheetState>,
): WizardState {
  const base: SheetState = state.sheets[key] ?? {
    status: "pending",
    columns: [],
    rowCount: 0,
    sampleRows: [],
    columnOverrides: {},
    excludedColumns: [],
    name: defaultName(state.file, key || undefined),
  };
  const next: SheetState = { ...base, ...patch };
  return { ...state, sheets: { ...state.sheets, [key]: next } };
}

export function wizardReducer(
  state: WizardState,
  action: WizardAction,
): WizardState {
  switch (action.type) {
    case "SET_SOURCE_FORMAT":
      return {
        ...state,
        sourceFormat: action.sourceFormat,
        // Switching source resets file + temp + sheets to avoid stale state.
        file: null,
        tempId: null,
        availableSheets: [],
        selectedSheets: [],
        sheets: {},
      };
    case "SET_WORKSPACE":
      return { ...state, workspaceId: action.workspaceId };
    case "SET_FILE":
      return {
        ...state,
        file: action.file,
        tempId: null,
        availableSheets: [],
        selectedSheets: [],
        sheets: {},
      };
    case "UPLOAD_INIT_SUCCESS": {
      if (action.response.sourceFormat === "csv") {
        const preview: CsvParsePreview = action.response.csvPreview;
        const seeded = setSheet(
          { ...state, tempId: action.response.temp_id },
          CSV_SHEET_KEY,
          {
            status: "ok",
            columns: preview.columns,
            rowCount: preview.rowCount,
            sampleRows: preview.sampleRows,
            name: defaultName(state.file, undefined),
          },
        );
        return { ...seeded, step: "metadata" };
      }
      // Excel
      return {
        ...state,
        tempId: action.response.temp_id,
        availableSheets: action.response.sheets,
        selectedSheets: [],
        sheets: {},
        step: "sheet",
      };
    }
    case "TOGGLE_SELECTED_SHEET": {
      const present = state.selectedSheets.includes(action.sheet);
      const selectedSheets = present
        ? state.selectedSheets.filter((s) => s !== action.sheet)
        : [...state.selectedSheets, action.sheet];
      // Drop sheet state when deselected so re-selecting re-parses.
      const sheets = { ...state.sheets };
      if (present) delete sheets[action.sheet];
      return { ...state, selectedSheets, sheets };
    }
    case "PARSE_SHEET_START":
      return setSheet(state, action.sheet, { status: "parsing" });
    case "PARSE_SHEET_SUCCESS":
      return setSheet(state, action.sheet, {
        status: "ok",
        columns: action.result.columns,
        rowCount: action.result.rowCount,
        sampleRows: action.result.sampleRows,
        parseError: undefined,
      });
    case "PARSE_SHEET_FAILED":
      return setSheet(state, action.sheet, {
        status: "failed",
        parseError: { error: action.result.error, detail: action.result.detail },
      });
    case "SET_COLUMN_OVERRIDE": {
      const sheet = state.sheets[action.sheet];
      if (!sheet) return state;
      const columnOverrides = { ...sheet.columnOverrides };
      if (action.override === null) {
        delete columnOverrides[action.column];
      } else {
        columnOverrides[action.column] = action.override;
      }
      return setSheet(state, action.sheet, { columnOverrides });
    }
    case "TOGGLE_EXCLUDED_COLUMN": {
      const sheet = state.sheets[action.sheet];
      if (!sheet) return state;
      const present = sheet.excludedColumns.includes(action.column);
      const excludedColumns = present
        ? sheet.excludedColumns.filter((c) => c !== action.column)
        : [...sheet.excludedColumns, action.column];
      return setSheet(state, action.sheet, { excludedColumns });
    }
    case "SET_DATASET_NAME":
      return setSheet(state, action.sheet, { name: action.name });
    case "GOTO_STEP":
      return { ...state, step: action.step };
    case "RESET":
      return INITIAL_WIZARD_STATE;
  }
}

/** Total step count for the stepper, by source format. */
export function stepCount(format: SourceFormat): number {
  return format === "csv" ? 4 : 5;
}

/** Numeric step index (1-based) for the active step, by source format. */
export function stepIndex(state: WizardState): number {
  if (state.sourceFormat === "csv") {
    switch (state.step) {
      case "source":
        return 1;
      case "metadata":
        return 2;
      case "preview":
        return 3;
      case "confirm":
        return 4;
      default:
        return 1;
    }
  }
  switch (state.step) {
    case "source":
      return 1;
    case "sheet":
      return 2;
    case "metadata":
      return 3;
    case "preview":
      return 4;
    case "confirm":
      return 5;
  }
}
