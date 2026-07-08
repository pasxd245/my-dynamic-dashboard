import { describe, expect, it } from "vitest";
import type { Dataset } from "@/features/data-management/datasets/types";
import {
  computeSchemaDrift,
  CSV_SHEET_KEY,
  dateFieldOptions,
  hasSchemaDrift,
  INITIAL_WIZARD_STATE,
  mergeKeyIssues,
  wizardReducer,
  wizardSteps,
} from "@/features/data-management/datasets/upload/state";

const excelTarget: Dataset = {
  id: "ds_12345678",
  workspaceId: "ws_abcdef01",
  name: "monthly_calls",
  sizeBytes: 1234,
  rowCount: 5047,
  columnCount: 3,
  columns: [
    { name: "a", dtype: "string" },
    { name: "b", dtype: "integer" },
    { name: "c", dtype: "date" },
  ],
  sourceFormat: "excel",
  sheetName: "Worksheet",
  createdAt: "2026-07-01T00:00:00Z",
};

describe("refresh mode — SEED_REFRESH", () => {
  it("fixes mode/source/workspace/target and stashes the carry-forward preset", () => {
    const s = wizardReducer(INITIAL_WIZARD_STATE, { type: "SEED_REFRESH", target: excelTarget });
    expect(s.mode).toBe("refresh");
    expect(s.sourceFormat).toBe("excel");
    expect(s.workspaceId).toBe("ws_abcdef01");
    expect(s.targetDatasetId).toBe("ds_12345678");
    expect(s.refreshTargetSheet).toBe("Worksheet");
    expect(s.refreshBaseline).toHaveLength(3);
    // Lossy-fallback preset: every committed column → a dtype override.
    expect(s.pendingPreset?.Worksheet.columnOverrides).toEqual({
      a: { dtype: "string" },
      b: { dtype: "integer" },
      c: { dtype: "date" },
    });
    expect(s.pendingPreset?.Worksheet.name).toBe("monthly_calls");
    // Fresh — the user still picks the new file.
    expect(s.file).toBeNull();
    expect(s.step).toBe("source");
  });

  it("builds the preset from persisted commitSettings when available (F2)", () => {
    const s = wizardReducer(INITIAL_WIZARD_STATE, {
      type: "SEED_REFRESH",
      target: excelTarget,
      settings: {
        available: true,
        sheet: "Worksheet",
        parse_options: { has_header: true },
        column_overrides: { b: { dtype: "string" } },
        excluded_columns: ["c"],
      },
    });
    expect(s.refreshLegacy).toBe(false);
    const preset = s.pendingPreset?.Worksheet;
    expect(preset?.columnOverrides).toEqual({ b: { dtype: "string" } });
    expect(preset?.excludedColumns).toEqual(["c"]);
    expect(preset?.parseOptions).toEqual({ has_header: true });
  });

  it("falls back to the lossy preset (refreshLegacy) when no snapshot exists", () => {
    const s = wizardReducer(INITIAL_WIZARD_STATE, {
      type: "SEED_REFRESH",
      target: excelTarget,
      settings: { available: false },
    });
    expect(s.refreshLegacy).toBe(true);
    // Lossy: every committed column becomes a dtype override.
    expect(Object.keys(s.pendingPreset?.Worksheet.columnOverrides ?? {})).toEqual(["a", "b", "c"]);
  });

  it("CSV target keys the preset under the CSV sentinel", () => {
    const csvTarget: Dataset = { ...excelTarget, sourceFormat: "csv", sheetName: undefined };
    const s = wizardReducer(INITIAL_WIZARD_STATE, { type: "SEED_REFRESH", target: csvTarget });
    expect(s.refreshTargetSheet).toBeNull();
    expect(s.pendingPreset?.[CSV_SHEET_KEY]).toBeDefined();
  });
});

describe("refresh mode — preset replay across the seeding parse (the hazard)", () => {
  it("Excel: UPLOAD_INIT_SUCCESS pre-selects the target sheet", () => {
    let s = wizardReducer(INITIAL_WIZARD_STATE, { type: "SEED_REFRESH", target: excelTarget });
    s = wizardReducer(s, {
      type: "UPLOAD_INIT_SUCCESS",
      response: {
        temp_id: "tmp_0011223344556677",
        sourceFormat: "excel",
        sizeBytes: 2048,
        sheets: [
          { sheet: "Worksheet", rowCount: 6692, columnCount: 3 },
          { sheet: "Other", rowCount: 1, columnCount: 1 },
        ],
      },
    });
    expect(s.step).toBe("sheet");
    expect(s.selectedSheets).toEqual(["Worksheet"]);
  });

  it("applies the preset keyed by name: survivors keep, vanished drop, new inferred", () => {
    let s = wizardReducer(INITIAL_WIZARD_STATE, { type: "SEED_REFRESH", target: excelTarget });
    s = wizardReducer(s, {
      type: "UPLOAD_INIT_SUCCESS",
      response: {
        temp_id: "tmp_0011223344556677",
        sourceFormat: "excel",
        sizeBytes: 2048,
        sheets: [{ sheet: "Worksheet", rowCount: 6692, columnCount: 3 }],
      },
    });
    // New file: `a` survives, `b` survives (type changed in file — override still carried),
    // `c` vanished, `d` is new.
    s = wizardReducer(s, {
      type: "PARSE_SHEET_SUCCESS",
      unit: "Worksheet",
      result: {
        sheet: "Worksheet",
        status: "ok",
        columns: [
          { name: "a", dtype: "string" },
          { name: "b", dtype: "string" },
          { name: "d", dtype: "float" },
        ],
        rowCount: 6692,
        sampleRows: [["x", "1", "2.0"]],
      },
    });
    const sheet = s.sheets.Worksheet;
    expect(sheet.columnOverrides).toEqual({
      a: { dtype: "string" },
      b: { dtype: "integer" }, // survivor keeps its carried override; `c` dropped, `d` absent
    });
    expect(sheet.name).toBe("monthly_calls");
    // Preset consumed → a subsequent user re-parse resets normally (R19 Q2).
    expect(s.pendingPreset).toBeNull();
    s = wizardReducer(s, {
      type: "PARSE_SHEET_SUCCESS",
      unit: "Worksheet",
      result: {
        sheet: "Worksheet",
        status: "ok",
        columns: [{ name: "a", dtype: "string" }],
        rowCount: 10,
        sampleRows: [["x"]],
      },
    });
    expect(s.sheets.Worksheet.columnOverrides).toEqual({});
  });

  it("CSV: preset applies at UPLOAD_INIT_SUCCESS", () => {
    const csvTarget: Dataset = {
      ...excelTarget,
      sourceFormat: "csv",
      sheetName: undefined,
      columns: [
        { name: "a", dtype: "string" },
        { name: "b", dtype: "integer" },
      ],
    };
    let s = wizardReducer(INITIAL_WIZARD_STATE, { type: "SEED_REFRESH", target: csvTarget });
    s = wizardReducer(s, {
      type: "UPLOAD_INIT_SUCCESS",
      response: {
        temp_id: "tmp_9988776655443322",
        sourceFormat: "csv",
        sizeBytes: 64,
        csvPreview: {
          columns: [
            { name: "a", dtype: "string" },
            { name: "b", dtype: "integer" },
          ],
          rowCount: 3,
          sampleRows: [["x", "1"]],
        },
      },
    });
    expect(s.step).toBe("metadata");
    expect(s.sheets[CSV_SHEET_KEY].columnOverrides).toEqual({
      a: { dtype: "string" },
      b: { dtype: "integer" },
    });
    expect(s.pendingPreset).toBeNull();
  });
});

describe("refresh mode — steps + drift acknowledge", () => {
  it("inserts a Drift step before Confirm only in refresh mode", () => {
    const create = wizardSteps({ ...INITIAL_WIZARD_STATE, sourceFormat: "excel" });
    expect(create).not.toContain("drift");
    const refresh = wizardSteps({ ...INITIAL_WIZARD_STATE, mode: "refresh", sourceFormat: "excel" });
    expect(refresh).toEqual(["source", "sheet", "metadata", "preview", "drift", "confirm"]);
  });

  it("SET_DRIFT_ACK toggles the acknowledge gate", () => {
    let s = wizardReducer(INITIAL_WIZARD_STATE, { type: "SET_DRIFT_ACK", acknowledged: true });
    expect(s.driftAcknowledged).toBe(true);
    s = wizardReducer(s, { type: "SET_DRIFT_ACK", acknowledged: false });
    expect(s.driftAcknowledged).toBe(false);
  });
});

describe("computeSchemaDrift (F10)", () => {
  it("classifies added / removed / dtype-changed by name", () => {
    const baseline = [
      { name: "a", dtype: "string" as const },
      { name: "b", dtype: "integer" as const },
      { name: "c", dtype: "date" as const },
    ];
    const incoming = [
      { name: "a", dtype: "string" as const },
      { name: "b", dtype: "string" as const },
      { name: "d", dtype: "float" as const },
    ];
    const drift = computeSchemaDrift(baseline, incoming);
    expect(drift.added).toEqual([{ name: "d", dtype: "float" }]);
    expect(drift.removed).toEqual([{ name: "c", dtype: "date" }]);
    expect(drift.dtypeChanged).toEqual([{ name: "b", from: "integer", to: "string" }]);
    expect(hasSchemaDrift(drift)).toBe(true);
  });

  it("reports no drift for an identical schema", () => {
    const cols = [{ name: "a", dtype: "string" as const }];
    expect(hasSchemaDrift(computeSchemaDrift(cols, cols))).toBe(false);
  });
});

describe("refresh merge mode (R147)", () => {
  it("SEED_REFRESH defaults to replace with no key when nothing is remembered", () => {
    const s = wizardReducer(INITIAL_WIZARD_STATE, { type: "SEED_REFRESH", target: excelTarget });
    expect(s.refreshMode).toBe("replace");
    expect(s.mergeKey).toEqual([]);
  });

  it("SEED_REFRESH pre-fills the remembered key + last-used mode (D1/D4)", () => {
    const s = wizardReducer(INITIAL_WIZARD_STATE, {
      type: "SEED_REFRESH",
      target: excelTarget,
      settings: {
        available: true,
        sheet: "Worksheet",
        merge_key: ["a", "b"],
        refresh_mode: "merge",
      },
    });
    expect(s.refreshMode).toBe("merge");
    expect(s.mergeKey).toEqual(["a", "b"]);
  });

  it("drops a remembered key column no longer on the committed schema; merge with no surviving key falls back to replace", () => {
    const s = wizardReducer(INITIAL_WIZARD_STATE, {
      type: "SEED_REFRESH",
      target: excelTarget,
      settings: { available: true, merge_key: ["gone"], refresh_mode: "merge" },
    });
    expect(s.mergeKey).toEqual([]);
    expect(s.refreshMode).toBe("replace");
  });

  it("SET_REFRESH_MODE / SET_MERGE_KEY update the choice", () => {
    let s = wizardReducer(INITIAL_WIZARD_STATE, { type: "SEED_REFRESH", target: excelTarget });
    s = wizardReducer(s, { type: "SET_REFRESH_MODE", mode: "merge" });
    s = wizardReducer(s, { type: "SET_MERGE_KEY", key: ["a"] });
    expect(s.refreshMode).toBe("merge");
    expect(s.mergeKey).toEqual(["a"]);
  });
});

describe("mergeKeyIssues (R147 F5×F2 client guard)", () => {
  const baseline = [
    { name: "a", dtype: "string" as const },
    { name: "b", dtype: "integer" as const },
  ];
  const okSheet = {
    status: "ok" as const,
    columns: [
      { name: "a", dtype: "string" as const },
      { name: "b", dtype: "integer" as const },
    ],
    rowCount: 1,
    sampleRows: [],
    columnOverrides: {},
    excludedColumns: [],
    parseOptions: {},
    name: "x",
    sheetName: "",
  };

  it("passes when every key survives with its committed dtype", () => {
    expect(mergeKeyIssues(baseline, okSheet, ["a", "b"])).toEqual([]);
  });

  it("flags a key column absent from the incoming file", () => {
    const sheet = { ...okSheet, columns: [{ name: "b", dtype: "integer" as const }] };
    expect(mergeKeyIssues(baseline, sheet, ["a"])).toEqual([{ kind: "missing", name: "a" }]);
  });

  it("flags a key column the user excluded (excluded = missing from the kept set)", () => {
    const sheet = { ...okSheet, excludedColumns: ["a"] };
    expect(mergeKeyIssues(baseline, sheet, ["a"])).toEqual([{ kind: "missing", name: "a" }]);
  });

  it("flags a key dtype drift — from the parsed dtype or an override", () => {
    const parsedDrift = { ...okSheet, columns: [{ name: "a", dtype: "integer" as const }, okSheet.columns[1]] };
    expect(mergeKeyIssues(baseline, parsedDrift, ["a"])).toEqual([
      { kind: "dtypeChanged", name: "a", from: "string", to: "integer" },
    ]);
    // The override, not the parsed dtype, is what commits (effective dtype).
    const overrideDrift = { ...okSheet, columnOverrides: { b: { dtype: "string" as const } } };
    expect(mergeKeyIssues(baseline, overrideDrift, ["b"])).toEqual([
      { kind: "dtypeChanged", name: "b", from: "integer", to: "string" },
    ]);
  });

  it("returns no issues while the sheet is not parsed yet (guard runs at Confirm)", () => {
    expect(mergeKeyIssues(baseline, undefined, ["a"])).toEqual([]);
  });
});

describe("refresh append mode (R155)", () => {
  it("SET_REFRESH_MODE 'append' + SET_OVERLAP_FIELD update the choice; None clears the field", () => {
    let s = wizardReducer(INITIAL_WIZARD_STATE, { type: "SEED_REFRESH", target: excelTarget });
    s = wizardReducer(s, { type: "SET_REFRESH_MODE", mode: "append" });
    s = wizardReducer(s, { type: "SET_OVERLAP_FIELD", field: "c" });
    expect(s.refreshMode).toBe("append");
    expect(s.overlapCheckField).toBe("c");
    s = wizardReducer(s, { type: "SET_OVERLAP_FIELD", field: null });
    expect(s.overlapCheckField).toBeNull();
  });

  it("SEED_REFRESH carries a remembered append mode forward (keyless — no key required)", () => {
    const s = wizardReducer(INITIAL_WIZARD_STATE, {
      type: "SEED_REFRESH",
      target: excelTarget,
      settings: { available: true, sheet: "Worksheet", refresh_mode: "append" },
    });
    expect(s.refreshMode).toBe("append");
    expect(s.mergeKey).toEqual([]);
    expect(s.overlapCheckField).toBeNull();
  });

  it("dateFieldOptions returns only kept date/datetime columns", () => {
    const sheet = {
      status: "ok" as const,
      columns: [
        { name: "name", dtype: "string" as const },
        { name: "calls", dtype: "integer" as const },
        { name: "callDate", dtype: "datetime" as const },
        { name: "day", dtype: "date" as const },
        { name: "excludedDate", dtype: "date" as const },
      ],
      rowCount: 1,
      sampleRows: [],
      columnOverrides: {},
      excludedColumns: ["excludedDate"],
      parseOptions: {},
      name: "x",
      sheetName: "",
    };
    expect(dateFieldOptions(sheet)).toEqual([
      { name: "callDate", dtype: "datetime" },
      { name: "day", dtype: "date" },
    ]);
  });

  it("dateFieldOptions honors the effective (override ?? parsed) dtype", () => {
    const sheet = {
      status: "ok" as const,
      columns: [
        { name: "ts", dtype: "string" as const },
        { name: "n", dtype: "date" as const },
      ],
      rowCount: 1,
      sampleRows: [],
      columnOverrides: { ts: { dtype: "datetime" as const }, n: { dtype: "integer" as const } },
      excludedColumns: [],
      parseOptions: {},
      name: "x",
      sheetName: "",
    };
    // ts overridden string→datetime becomes eligible; n overridden date→integer drops out.
    expect(dateFieldOptions(sheet)).toEqual([{ name: "ts", dtype: "datetime" }]);
  });

  it("dateFieldOptions returns [] while the sheet is not parsed yet", () => {
    expect(dateFieldOptions(undefined)).toEqual([]);
  });
});

describe("refresh sheet handling (R147 fix — single-select, ghost pre-select, renamed sheet)", () => {
  const initExcel = (sheets: { sheet: string; rowCount: number; columnCount: number }[]) => {
    let s = wizardReducer(INITIAL_WIZARD_STATE, { type: "SEED_REFRESH", target: excelTarget });
    return wizardReducer(s, {
      type: "UPLOAD_INIT_SUCCESS",
      response: { temp_id: "tmp_0011223344556677", sourceFormat: "excel", sizeBytes: 2048, sheets },
    });
  };

  it("does NOT pre-select the committed sheet when the new workbook renamed it (no ghost)", () => {
    const s = initExcel([{ sheet: "Data 1.5", rowCount: 10, columnCount: 3 }]);
    expect(s.selectedSheets).toEqual([]);
  });

  it("still pre-selects the committed sheet when it exists", () => {
    const s = initExcel([
      { sheet: "Worksheet", rowCount: 10, columnCount: 3 },
      { sheet: "Other", rowCount: 1, columnCount: 1 },
    ]);
    expect(s.selectedSheets).toEqual(["Worksheet"]);
  });

  it("refresh sheet selection is radio: picking another sheet REPLACES; re-toggling clears", () => {
    let s = initExcel([
      { sheet: "Worksheet", rowCount: 10, columnCount: 3 },
      { sheet: "Other", rowCount: 1, columnCount: 1 },
    ]);
    s = wizardReducer(s, { type: "TOGGLE_SELECTED_SHEET", sheet: "Other" });
    expect(s.selectedSheets).toEqual(["Other"]); // replaced, not appended
    s = wizardReducer(s, { type: "TOGGLE_SELECTED_SHEET", sheet: "Other" });
    expect(s.selectedSheets).toEqual([]);
  });

  it("create mode keeps multi-select (unregressed)", () => {
    let s = wizardReducer(INITIAL_WIZARD_STATE, { type: "TOGGLE_SELECTED_SHEET", sheet: "A" });
    s = wizardReducer(s, { type: "TOGGLE_SELECTED_SHEET", sheet: "B" });
    expect(s.selectedSheets).toEqual(["A", "B"]);
  });

  it("carry-forward preset survives a RENAMED sheet (fallback by single pending preset)", () => {
    let s = initExcel([{ sheet: "Data 1.5", rowCount: 10, columnCount: 3 }]);
    s = wizardReducer(s, { type: "TOGGLE_SELECTED_SHEET", sheet: "Data 1.5" });
    s = wizardReducer(s, {
      type: "PARSE_SHEET_SUCCESS",
      unit: "Data 1.5",
      result: {
        sheet: "Data 1.5",
        status: "ok",
        columns: [
          { name: "a", dtype: "string" },
          { name: "b", dtype: "string" },
        ],
        rowCount: 10,
        sampleRows: [["x", "1"]],
      },
    });
    // Preset was keyed under the committed "Worksheet" name but still applies.
    expect(s.sheets["Data 1.5"].columnOverrides).toEqual({
      a: { dtype: "string" },
      b: { dtype: "integer" },
    });
    expect(s.sheets["Data 1.5"].name).toBe("monthly_calls");
    expect(s.pendingPreset).toBeNull(); // consumed wholesale — later re-parse resets normally
  });
});
