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

  it("SET_PARSE_OPTIONS stores options on the right sheet (Excel + CSV)", () => {
    let s = INITIAL_WIZARD_STATE;
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
    s = wizardReducer(s, {
      type: "SET_PARSE_OPTIONS",
      sheet: "Deals",
      options: { range: "A1:C20", has_header: true },
    });
    expect(s.sheets.Deals.parseOptions).toEqual({
      range: "A1:C20",
      has_header: true,
    });

    // CSV path uses the empty-string sentinel key.
    s = wizardReducer(s, {
      type: "SET_PARSE_OPTIONS",
      sheet: CSV_SHEET_KEY,
      options: { skip_rows: 2, has_header: false },
    });
    expect(s.sheets[CSV_SHEET_KEY].parseOptions).toEqual({
      skip_rows: 2,
      has_header: false,
    });
    // Excel state untouched by the CSV-key dispatch.
    expect(s.sheets.Deals.parseOptions).toEqual({
      range: "A1:C20",
      has_header: true,
    });
  });

  it("SET_PARSE_OPTIONS resets columnOverrides and excludedColumns (R19 Q4)", () => {
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
    s = wizardReducer(s, {
      type: "TOGGLE_EXCLUDED_COLUMN",
      sheet: "Deals",
      column: "a",
    });
    expect(s.sheets.Deals.columnOverrides.b).toEqual({ dtype: "float" });
    expect(s.sheets.Deals.excludedColumns).toEqual(["a"]);

    s = wizardReducer(s, {
      type: "SET_PARSE_OPTIONS",
      sheet: "Deals",
      options: { range: "A1:B20" },
    });
    // Q4: editing parse options invalidates per-column choices.
    expect(s.sheets.Deals.columnOverrides).toEqual({});
    expect(s.sheets.Deals.excludedColumns).toEqual([]);
    expect(s.sheets.Deals.parseOptions).toEqual({ range: "A1:B20" });
  });

  it("PARSE_SHEET_SUCCESS resets overrides on re-parse (R19 Q2)", () => {
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
    s = wizardReducer(s, {
      type: "TOGGLE_EXCLUDED_COLUMN",
      sheet: "Deals",
      column: "a",
    });
    // Re-parse: same sheet, new columns (range changed). Q2 must clear.
    s = wizardReducer(s, {
      type: "PARSE_SHEET_SUCCESS",
      sheet: "Deals",
      result: {
        sheet: "Deals",
        status: "ok",
        columns: [{ name: "a", dtype: "string" }],
        rowCount: 5,
        sampleRows: [["x"]],
      },
    });
    expect(s.sheets.Deals.columnOverrides).toEqual({});
    expect(s.sheets.Deals.excludedColumns).toEqual([]);
    expect(s.sheets.Deals.columns).toHaveLength(1);
    expect(s.sheets.Deals.rowCount).toBe(5);
  });

  it("hasParseOptionsSet detects empty vs populated options", async () => {
    const { hasParseOptionsSet } = await import(
      "../src/features/data-management/datasets/upload/state"
    );
    expect(hasParseOptionsSet(undefined)).toBe(false);
    expect(hasParseOptionsSet({})).toBe(false);
    expect(hasParseOptionsSet({ skip_rows: 0 })).toBe(true);
    expect(hasParseOptionsSet({ has_header: true })).toBe(true);
    expect(hasParseOptionsSet({ range: "A1:B2" })).toBe(true);
  });

  it("computes step index for both source formats", () => {
    const base = INITIAL_WIZARD_STATE;
    expect(stepIndex({ ...base, sourceFormat: "csv", step: "source" })).toBe(1);
    expect(stepIndex({ ...base, sourceFormat: "csv", step: "metadata" })).toBe(
      2,
    );
    expect(stepIndex({ ...base, sourceFormat: "csv", step: "preview" })).toBe(3);
    expect(stepIndex({ ...base, sourceFormat: "csv", step: "confirm" })).toBe(4);
    expect(stepIndex({ ...base, sourceFormat: "excel", step: "sheet" })).toBe(2);
    expect(stepIndex({ ...base, sourceFormat: "excel", step: "metadata" })).toBe(
      3,
    );
    expect(stepIndex({ ...base, sourceFormat: "excel", step: "preview" })).toBe(
      4,
    );
    expect(stepIndex({ ...base, sourceFormat: "excel", step: "confirm" })).toBe(
      5,
    );
  });
});
