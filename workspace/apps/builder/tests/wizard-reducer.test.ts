import { describe, expect, it } from "vitest";
import {
  CSV_SHEET_KEY,
  INITIAL_WIZARD_STATE,
  sheetHasMultipleUnits,
  stepIndex,
  units,
  wizardReducer,
  type WizardState,
} from "@/features/data-management/datasets/upload/state";

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
    // One CSV unit, keyed by the sentinel.
    expect(s.unitOrder).toEqual([CSV_SHEET_KEY]);
    expect(units(s)).toHaveLength(1);
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
    // Each selected sheet seeds one unit (keyed by the sheet name).
    expect(s.unitOrder).toEqual(["Deals", "Contacts"]);

    // Toggling Deals off drops it from the selection and its unit.
    s = wizardReducer(s, { type: "TOGGLE_SELECTED_SHEET", sheet: "Deals" });
    expect(s.selectedSheets).toEqual(["Contacts"]);
    expect(s.unitOrder).toEqual(["Contacts"]);
  });

  it("tracks per-unit parse status across start/success/failed", () => {
    let s: WizardState = {
      ...INITIAL_WIZARD_STATE,
      selectedSheets: ["Deals", "Contacts"],
      unitOrder: ["Deals", "Contacts"],
    };
    s = wizardReducer(s, { type: "PARSE_SHEET_START", unit: "Deals" });
    expect(s.sheets.Deals.status).toBe("parsing");

    s = wizardReducer(s, {
      type: "PARSE_SHEET_SUCCESS",
      unit: "Deals",
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
      unit: "Contacts",
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

  it("records column overrides and excluded columns per unit", () => {
    let s = INITIAL_WIZARD_STATE;
    s = wizardReducer(s, {
      type: "PARSE_SHEET_SUCCESS",
      unit: "Deals",
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
      unit: "Deals",
      column: "b",
      override: { dtype: "float" },
    });
    expect(s.sheets.Deals.columnOverrides.b).toEqual({ dtype: "float" });

    s = wizardReducer(s, {
      type: "TOGGLE_EXCLUDED_COLUMN",
      unit: "Deals",
      column: "a",
    });
    expect(s.sheets.Deals.excludedColumns).toEqual(["a"]);
  });

  it("SET_PARSE_OPTIONS stores options on the right unit (Excel + CSV)", () => {
    let s = INITIAL_WIZARD_STATE;
    s = wizardReducer(s, {
      type: "PARSE_SHEET_SUCCESS",
      unit: "Deals",
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
      unit: "Deals",
      options: { range: "A1:C20", has_header: true },
    });
    expect(s.sheets.Deals.parseOptions).toEqual({
      range: "A1:C20",
      has_header: true,
    });

    // CSV path uses the empty-string sentinel key.
    s = wizardReducer(s, {
      type: "SET_PARSE_OPTIONS",
      unit: CSV_SHEET_KEY,
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
      unit: "Deals",
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
      unit: "Deals",
      column: "b",
      override: { dtype: "float" },
    });
    s = wizardReducer(s, {
      type: "TOGGLE_EXCLUDED_COLUMN",
      unit: "Deals",
      column: "a",
    });
    expect(s.sheets.Deals.columnOverrides.b).toEqual({ dtype: "float" });
    expect(s.sheets.Deals.excludedColumns).toEqual(["a"]);

    s = wizardReducer(s, {
      type: "SET_PARSE_OPTIONS",
      unit: "Deals",
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
      unit: "Deals",
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
      unit: "Deals",
      column: "b",
      override: { dtype: "float" },
    });
    s = wizardReducer(s, {
      type: "TOGGLE_EXCLUDED_COLUMN",
      unit: "Deals",
      column: "a",
    });
    // Re-parse: same unit, new columns (range changed). Q2 must clear.
    s = wizardReducer(s, {
      type: "PARSE_SHEET_SUCCESS",
      unit: "Deals",
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
      "@/features/data-management/datasets/upload/state"
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

// F8 — multi-range extraction: N range-units carved from one sheet.
describe("wizardReducer — F8 range units", () => {
  // A file + one selected Excel sheet with its initial unit already parsed OK.
  const seededExcel = (): WizardState => {
    let s: WizardState = wizardReducer(INITIAL_WIZARD_STATE, {
      type: "SET_FILE",
      file: new File(["a"], "fm_2026.xlsx"),
    });
    s = wizardReducer(s, {
      type: "UPLOAD_INIT_SUCCESS",
      response: {
        temp_id: "tmp_0011223344556677",
        sourceFormat: "excel",
        sizeBytes: 2048,
        sheets: [{ sheet: "CallLog", rowCount: 100, columnCount: 4 }],
      },
    });
    s = wizardReducer(s, { type: "TOGGLE_SELECTED_SHEET", sheet: "CallLog" });
    return wizardReducer(s, {
      type: "PARSE_SHEET_SUCCESS",
      unit: "CallLog",
      result: {
        sheet: "CallLog",
        status: "ok",
        columns: [{ name: "a", dtype: "string" }],
        rowCount: 100,
        sampleRows: [["x"]],
      },
    });
  };

  it("ADD_RANGE_UNIT creates a 2nd unit with a synthetic key, appended after the sheet's units, default name <stem>_<sheet>_<ordinal>", () => {
    let s = seededExcel();
    expect(sheetHasMultipleUnits(s, "CallLog")).toBe(false);
    s = wizardReducer(s, { type: "ADD_RANGE_UNIT", sheetName: "CallLog" });

    const list = units(s);
    expect(list).toHaveLength(2);
    // Contiguous: both units belong to CallLog, added one comes last.
    expect(list[0].key).toBe("CallLog");
    const added = list[1];
    expect(added.key).not.toBe("CallLog");
    expect(added.sheetName).toBe("CallLog");
    expect(added.key).toContain(":"); // synthetic `${sheet}:<seq>`
    expect(added.state.status).toBe("pending");
    // No range typed yet → ordinal-suffixed default name.
    expect(added.state.name).toBe("fm_2026_CallLog_2");
    expect(sheetHasMultipleUnits(s, "CallLog")).toBe(true);
  });

  it("SET_PARSE_OPTIONS on an added unit updates the range-derived default name (`:`→`-`)", () => {
    let s = seededExcel();
    s = wizardReducer(s, { type: "ADD_RANGE_UNIT", sheetName: "CallLog" });
    const key = units(s)[1].key;
    s = wizardReducer(s, {
      type: "SET_PARSE_OPTIONS",
      unit: key,
      options: { range: "H1:K40" },
    });
    expect(s.sheets[key].name).toBe("fm_2026_CallLog_H1-K40");
  });

  it("a user-edited name (nameEdited) is NOT overwritten by a later range change", () => {
    let s = seededExcel();
    s = wizardReducer(s, { type: "ADD_RANGE_UNIT", sheetName: "CallLog" });
    const key = units(s)[1].key;
    s = wizardReducer(s, { type: "SET_DATASET_NAME", unit: key, name: "my_custom" });
    s = wizardReducer(s, {
      type: "SET_PARSE_OPTIONS",
      unit: key,
      options: { range: "H1:K40" },
    });
    expect(s.sheets[key].name).toBe("my_custom");
    expect(s.sheets[key].parseOptions.range).toBe("H1:K40");
  });

  it("REMOVE_RANGE_UNIT drops an added unit; an initial unit is not removable", () => {
    let s = seededExcel();
    s = wizardReducer(s, { type: "ADD_RANGE_UNIT", sheetName: "CallLog" });
    const key = units(s)[1].key;
    s = wizardReducer(s, { type: "REMOVE_RANGE_UNIT", unit: key });
    expect(units(s)).toHaveLength(1);
    expect(s.sheets[key]).toBeUndefined();

    // The initial unit (key === sheetName) is not removable via REMOVE_RANGE_UNIT.
    const before = units(s).length;
    s = wizardReducer(s, { type: "REMOVE_RANGE_UNIT", unit: "CallLog" });
    expect(units(s)).toHaveLength(before);
  });

  it("deselecting a sheet drops its added range-units too", () => {
    let s = seededExcel();
    s = wizardReducer(s, { type: "ADD_RANGE_UNIT", sheetName: "CallLog" });
    s = wizardReducer(s, { type: "ADD_RANGE_UNIT", sheetName: "CallLog" });
    expect(units(s)).toHaveLength(3);
    s = wizardReducer(s, { type: "TOGGLE_SELECTED_SHEET", sheet: "CallLog" });
    expect(s.selectedSheets).toEqual([]);
    expect(units(s)).toHaveLength(0);
    expect(Object.keys(s.sheets)).toHaveLength(0);
  });

  it("units() keeps a sheet's units contiguous across two sheets", () => {
    let s: WizardState = wizardReducer(INITIAL_WIZARD_STATE, {
      type: "SET_FILE",
      file: new File(["a"], "fm_2026.xlsx"),
    });
    s = wizardReducer(s, {
      type: "UPLOAD_INIT_SUCCESS",
      response: {
        temp_id: "tmp_0011223344556677",
        sourceFormat: "excel",
        sizeBytes: 2048,
        sheets: [
          { sheet: "CallLog", rowCount: 100, columnCount: 4 },
          { sheet: "Master", rowCount: 200, columnCount: 7 },
        ],
      },
    });
    s = wizardReducer(s, { type: "TOGGLE_SELECTED_SHEET", sheet: "CallLog" });
    s = wizardReducer(s, { type: "TOGGLE_SELECTED_SHEET", sheet: "Master" });
    // Add a range to the FIRST sheet — it must slot in after CallLog, before Master.
    s = wizardReducer(s, { type: "ADD_RANGE_UNIT", sheetName: "CallLog" });
    expect(units(s).map((u) => u.sheetName)).toEqual(["CallLog", "CallLog", "Master"]);
  });

  it("two units of one sheet map to two commit items sharing `sheet`, different ranges", () => {
    let s = seededExcel();
    s = wizardReducer(s, { type: "ADD_RANGE_UNIT", sheetName: "CallLog" });
    const key = units(s)[1].key;
    s = wizardReducer(s, {
      type: "SET_PARSE_OPTIONS",
      unit: key,
      options: { range: "H1:K40" },
    });
    // Mirror the DatasetNewPage commit mapping (units → batch items).
    const items = units(s).map((u) => ({
      sheet: u.sheetName,
      name: u.state.name,
      range: u.state.parseOptions.range,
    }));
    expect(items).toHaveLength(2);
    expect(items[0].sheet).toBe("CallLog");
    expect(items[1].sheet).toBe("CallLog");
    expect(items[0].range).toBeUndefined();
    expect(items[1].range).toBe("H1:K40");
  });

  it("ADD_RANGE_UNIT is a no-op in refresh mode (single-unit)", () => {
    const s = wizardReducer(
      { ...INITIAL_WIZARD_STATE, mode: "refresh", selectedSheets: ["S"], unitOrder: ["S"] },
      { type: "ADD_RANGE_UNIT", sheetName: "S" },
    );
    expect(units(s)).toHaveLength(1);
  });
});
