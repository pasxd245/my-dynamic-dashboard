import { describe, expect, it } from "vitest";
import {
  CSV_SHEET_KEY,
  INITIAL_WIZARD_STATE,
  stepIndex,
  wizardReducer,
} from "../src/features/data-management/datasets/upload/state";

describe("wizardReducer", () => {
  it("seeds CSV sheet state and advances to metadata on UPLOAD_INIT_SUCCESS", () => {
    let s = INITIAL_WIZARD_STATE;
    s = wizardReducer(s, { type: "SET_SOURCE_FORMAT", sourceFormat: "csv" });
    s = wizardReducer(s, {
      type: "SET_FILE",
      file: new File(["a"], "leads.csv", { type: "text/csv" }),
    });
    s = wizardReducer(s, {
      type: "UPLOAD_INIT_SUCCESS",
      response: {
        temp_id: "tmp_1234567890abcdef",
        sourceFormat: "csv",
        sizeBytes: 10,
        csvPreview: {
          columns: [{ name: "id", dtype: "integer" }],
          rowCount: 1,
          sampleRows: [["1"]],
        },
      },
    });
    expect(s.step).toBe("metadata");
    expect(s.tempId).toBe("tmp_1234567890abcdef");
    expect(s.sheets[CSV_SHEET_KEY].status).toBe("ok");
    expect(s.sheets[CSV_SHEET_KEY].name).toBe("leads");
  });

  it("opens the Excel sheet step and toggles selections", () => {
    let s = INITIAL_WIZARD_STATE;
    s = wizardReducer(s, {
      type: "UPLOAD_INIT_SUCCESS",
      response: {
        temp_id: "tmp_abcdef0123456789",
        sourceFormat: "excel",
        sizeBytes: 1024,
        sheets: [
          { sheet: "Deals", rowCount: 5, columnCount: 3 },
          { sheet: "Contacts", rowCount: 2, columnCount: 2 },
        ],
      },
    });
    expect(s.step).toBe("sheet");
    expect(s.availableSheets).toHaveLength(2);

    s = wizardReducer(s, { type: "TOGGLE_SELECTED_SHEET", sheet: "Deals" });
    s = wizardReducer(s, { type: "TOGGLE_SELECTED_SHEET", sheet: "Contacts" });
    expect(s.selectedSheets).toEqual(["Deals", "Contacts"]);

    // Toggling Deals off drops it from the selection.
    s = wizardReducer(s, { type: "TOGGLE_SELECTED_SHEET", sheet: "Deals" });
    expect(s.selectedSheets).toEqual(["Contacts"]);
  });

  it("tracks per-sheet parse status across start/success/failed", () => {
    let s = { ...INITIAL_WIZARD_STATE, selectedSheets: ["Deals", "Contacts"] };
    s = wizardReducer(s, { type: "PARSE_SHEET_START", sheet: "Deals" });
    expect(s.sheets.Deals.status).toBe("parsing");

    s = wizardReducer(s, {
      type: "PARSE_SHEET_SUCCESS",
      sheet: "Deals",
      result: {
        sheet: "Deals",
        status: "ok",
        columns: [{ name: "a", dtype: "string" }],
        rowCount: 1,
        sampleRows: [["x"]],
      },
    });
    expect(s.sheets.Deals.status).toBe("ok");
    expect(s.sheets.Deals.columns).toEqual([{ name: "a", dtype: "string" }]);

    s = wizardReducer(s, {
      type: "PARSE_SHEET_FAILED",
      sheet: "Contacts",
      result: {
        sheet: "Contacts",
        status: "failed",
        error: "parse_failed",
        detail: "bad header",
      },
    });
    expect(s.sheets.Contacts.status).toBe("failed");
    expect(s.sheets.Contacts.parseError?.error).toBe("parse_failed");
  });

  it("records column overrides and excluded columns per sheet", () => {
    let s = INITIAL_WIZARD_STATE;
    s = wizardReducer(s, {
      type: "PARSE_SHEET_SUCCESS",
      sheet: "Deals",
      result: {
        sheet: "Deals",
        status: "ok",
        columns: [
          { name: "a", dtype: "string" },
          { name: "b", dtype: "integer" },
        ],
        rowCount: 1,
        sampleRows: [["x", "1"]],
      },
    });
    s = wizardReducer(s, {
      type: "SET_COLUMN_OVERRIDE",
      sheet: "Deals",
      column: "b",
      override: { dtype: "float" },
    });
    expect(s.sheets.Deals.columnOverrides.b).toEqual({ dtype: "float" });

    s = wizardReducer(s, {
      type: "TOGGLE_EXCLUDED_COLUMN",
      sheet: "Deals",
      column: "a",
    });
    expect(s.sheets.Deals.excludedColumns).toEqual(["a"]);
  });

  it("computes step index for both source formats", () => {
    const base = INITIAL_WIZARD_STATE;
    expect(stepIndex({ ...base, sourceFormat: "csv", step: "source" })).toBe(1);
    expect(stepIndex({ ...base, sourceFormat: "csv", step: "metadata" })).toBe(
      2,
    );
    expect(stepIndex({ ...base, sourceFormat: "csv", step: "confirm" })).toBe(3);
    expect(stepIndex({ ...base, sourceFormat: "excel", step: "sheet" })).toBe(2);
    expect(stepIndex({ ...base, sourceFormat: "excel", step: "metadata" })).toBe(
      3,
    );
    expect(stepIndex({ ...base, sourceFormat: "excel", step: "confirm" })).toBe(
      4,
    );
  });
});
