import type {
  Column,
  ColumnOverride,
  CsvParsePreview,
  Dataset,
  Dtype,
  ParseOptions,
  ParseSheetFailed,
  ParseSheetOk,
  RefreshMode,
  RefreshSettings,
  SheetSummary,
  SourceFormat,
  TempUploadResponse,
} from "../types";

export type WizardStep =
  | "source"
  | "sheet"
  | "metadata"
  | "preview"
  | "drift"
  | "confirm";

/** Create = new dataset(s). Refresh = re-upload into an existing dataset
 *  (R145 § Refresh — whole-table replace, settings carry-forward, drift gate). */
export type WizardMode = "create" | "refresh";

/** Refresh carry-forward preset for one sheet key, (re)applied AFTER the
 *  seeding parse so PARSE_SHEET_SUCCESS's override-wipe (R19 Q2) cannot
 *  discard it. Keyed by column NAME — columns that survive keep their
 *  override, vanished columns drop theirs, new columns start inferred
 *  (upload.md § Refresh, "strict on the skeleton"). */
export type RefreshPreset = {
  columnOverrides: Record<string, ColumnOverride>;
  excludedColumns: string[];
  parseOptions: ParseOptions;
  /** Target dataset name — pinned; refresh never renames. */
  name: string;
};

/** Key used to store CSV state in the sheets map (CSV is single-unit). */
export const CSV_SHEET_KEY = "";

/** One dataset-to-be. F8: the wizard models one **unit** = one dataset, keyed
 *  in the `sheets` map by a **unit key** (NOT the sheet name — one sheet can be
 *  carved into N range-units, each its own dataset). A sheet's FIRST unit keys
 *  by the bare sheet name (so refresh + CSV + single-range paths are unchanged);
 *  additional range-units get a synthetic `${sheetName}:<seq>` key. */
export type SheetState = {
  /** Per-unit parse status (Excel) or "ok" once the CSV upload returns. */
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
  /** Per-unit parse options (range / skip_rows / has_header). */
  parseOptions: ParseOptions;
  /** Dataset name input. Defaults per D2 (see {@link unitName}). */
  name: string;
  /** F8 — the source sheet this unit reads. The map key is a unit key, not the
   *  sheet name, once a sheet is split into ranges. CSV uses "". */
  sheetName: string;
  /** F8 — true once the user edits the name, so the range-derived default (D2)
   *  stops overwriting it. */
  nameEdited?: boolean;
};

/** True when at least one ParseOptions field is set. Used to omit the
 *  field from the wire when nothing was customized. */
export function hasParseOptionsSet(opts: ParseOptions | undefined): boolean {
  if (!opts) return false;
  return (
    opts.range !== undefined ||
    opts.skip_rows !== undefined ||
    opts.has_header !== undefined
  );
}

export type WizardState = {
  step: WizardStep;
  mode: WizardMode;
  sourceFormat: SourceFormat;
  workspaceId: string | null;
  file: File | null;
  tempId: string | null;
  /** Excel only — sheet metadata returned by `POST /uploads`. */
  availableSheets: SheetSummary[];
  /** Excel only — user-selected sheets, in the order they'll appear. Drives the
   *  Sheet-step checkboxes; each selected sheet seeds one initial unit. */
  selectedSheets: string[];
  /** Per-unit state map, keyed by unit key (see {@link SheetState}). */
  sheets: Record<string, SheetState>;
  /** F8 — the ordered unit keys that drive the Metadata/Preview tabs, the
   *  Confirm rows, and the commit items. One entry per dataset-to-be. */
  unitOrder: string[];
  /** F8 — monotonic counter for synthetic range-unit keys (deterministic;
   *  survives remove/re-add without collision). */
  nextUnitSeq: number;
  /** Refresh only — the target dataset's id (→ commit `target_dataset_id` at C). */
  targetDatasetId: string | null;
  /** Refresh only — the target's committed columns, the drift-diff baseline. */
  refreshBaseline: Column[] | null;
  /** Refresh only — target name (banner + pinned dataset name). */
  refreshTargetName: string | null;
  /** Refresh only (Excel) — the target's committed sheet, pre-selected. */
  refreshTargetSheet: string | null;
  /** Refresh only — carry-forward preset per sheet key, applied post-parse. */
  pendingPreset: Record<string, RefreshPreset> | null;
  /** Refresh only — the Drift-review step's acknowledge gate. */
  driftAcknowledged: boolean;
  /** Refresh only — true when the target had no persisted commitSettings
   *  (legacy dataset → lossy pre-fill; surfaced honestly to the user). */
  refreshLegacy: boolean;
  /** Refresh only — the commit semantics (R147): replace (R145 whole-table)
   *  or merge-on-key. Defaults to the last-used mode (D4, via refresh-settings). */
  refreshMode: RefreshMode;
  /** Refresh only — the declared identity-key columns for a merge (R147 D1;
   *  pre-filled from the remembered `merge_key` when available). */
  mergeKey: string[];
};

export const INITIAL_WIZARD_STATE: WizardState = {
  step: "source",
  mode: "create",
  sourceFormat: "excel",
  workspaceId: null,
  file: null,
  tempId: null,
  availableSheets: [],
  selectedSheets: [],
  sheets: {},
  unitOrder: [],
  nextUnitSeq: 0,
  targetDatasetId: null,
  refreshBaseline: null,
  refreshTargetName: null,
  refreshTargetSheet: null,
  pendingPreset: null,
  driftAcknowledged: false,
  refreshLegacy: false,
  refreshMode: "replace",
  mergeKey: [],
};

function stemFromName(filename: string): string {
  const last = filename.lastIndexOf(".");
  return last <= 0 ? filename : filename.slice(0, last);
}

/** D2 — the default dataset name for a unit. CSV = `<stem>`; a sheet's first
 *  unit = `<stem>_<sheet>`; an additional range-unit = `<stem>_<sheet>_<range>`
 *  (A1 sanitized, `:`→`-`), falling back to an ordinal until the range is typed. */
function unitName(
  file: File | null,
  sheetName: string,
  isAdded: boolean,
  range: string | undefined,
  ordinal: number,
): string {
  const stem = file ? stemFromName(file.name) : "dataset";
  if (!sheetName) return stem;
  if (!isAdded) return `${stem}_${sheetName}`;
  const suffix = range ? range.replace(/:/g, "-") : String(ordinal);
  return `${stem}_${sheetName}_${suffix}`;
}

/** A sheet's first unit keys by the bare sheet name; the CSV sentinel likewise.
 *  A key equal to its own sheetName is therefore the initial (non-added) unit. */
function isAddedUnit(key: string, sheetName: string): boolean {
  return key !== sheetName;
}

/** The default SheetState for a unit key not yet in the map (an initial unit
 *  between sheet-selection and its first parse). `key === sheetName` here. */
function defaultSheetState(state: WizardState, key: string): SheetState {
  return {
    status: "pending",
    columns: [],
    rowCount: 0,
    sampleRows: [],
    columnOverrides: {},
    excludedColumns: [],
    parseOptions: {},
    name: unitName(state.file, key, false, undefined, 1),
    sheetName: key,
  };
}

export type WizardAction =
  | { type: "SET_SOURCE_FORMAT"; sourceFormat: SourceFormat }
  | { type: "SET_WORKSPACE"; workspaceId: string }
  | { type: "SET_FILE"; file: File }
  | { type: "UPLOAD_INIT_SUCCESS"; response: TempUploadResponse }
  | { type: "TOGGLE_SELECTED_SHEET"; sheet: string }
  | { type: "ADD_RANGE_UNIT"; sheetName: string }
  | { type: "REMOVE_RANGE_UNIT"; unit: string }
  | { type: "PARSE_SHEET_START"; unit: string }
  | { type: "PARSE_SHEET_SUCCESS"; unit: string; result: ParseSheetOk }
  | { type: "PARSE_SHEET_FAILED"; unit: string; result: ParseSheetFailed }
  | {
      type: "SET_COLUMN_OVERRIDE";
      unit: string;
      column: string;
      override: ColumnOverride | null;
    }
  | { type: "TOGGLE_EXCLUDED_COLUMN"; unit: string; column: string }
  | { type: "SET_PARSE_OPTIONS"; unit: string; options: ParseOptions }
  | { type: "SET_DATASET_NAME"; unit: string; name: string }
  | { type: "SEED_REFRESH"; target: Dataset; settings?: RefreshSettings | null }
  | { type: "SET_REFRESH_MODE"; mode: RefreshMode }
  | { type: "SET_MERGE_KEY"; key: string[] }
  | { type: "SET_DRIFT_ACK"; acknowledged: boolean }
  | { type: "GOTO_STEP"; step: WizardStep }
  | { type: "RESET" };

/** Build the lossy-fallback carry-forward preset from a committed dataset
 *  (F1 — no `commitSettings` yet, so only sheet + final dtypes are known;
 *  formats / parse options / exclusions land with the C/B backend read).
 *  Each committed column becomes a dtype override so the Metadata step
 *  shows the prior choice pre-filled. */
function presetFromDataset(target: Dataset): RefreshPreset {
  const columnOverrides: Record<string, ColumnOverride> = {};
  for (const col of target.columns) {
    columnOverrides[col.name] = { dtype: col.dtype };
  }
  return {
    columnOverrides,
    excludedColumns: [],
    parseOptions: {},
    name: target.name,
  };
}

/** Apply a refresh preset against the freshly-parsed columns, keyed by name:
 *  survivors keep their override, vanished columns drop out, new columns are
 *  absent (→ inferred). Returns the patch for the sheet + whether a preset ran. */
function applyPreset(
  preset: RefreshPreset | undefined,
  columns: Column[],
): Partial<SheetState> {
  if (!preset) return { columnOverrides: {}, excludedColumns: [] };
  const present = new Set(columns.map((c) => c.name));
  const columnOverrides: Record<string, ColumnOverride> = {};
  for (const [name, ov] of Object.entries(preset.columnOverrides)) {
    if (present.has(name)) columnOverrides[name] = ov;
  }
  return {
    columnOverrides,
    excludedColumns: preset.excludedColumns.filter((c) => present.has(c)),
    name: preset.name,
  };
}

/** The single pending refresh preset (refresh is single-table). It is keyed
 *  by the COMMITTED sheet name, but the new export may have RENAMED the sheet
 *  (the lived CRM shape: date-stamped sheet names) — fall back to the one
 *  stashed preset whatever its key, so carry-forward survives a rename
 *  (R147 fix; before this, a renamed sheet silently lost the preset). */
function pendingPresetFor(
  pending: Record<string, RefreshPreset> | null,
  key: string,
): RefreshPreset | undefined {
  if (!pending) return undefined;
  return pending[key] ?? Object.values(pending)[0];
}

function setSheet(
  state: WizardState,
  key: string,
  patch: Partial<SheetState>,
): WizardState {
  const base: SheetState = state.sheets[key] ?? defaultSheetState(state, key);
  const next: SheetState = { ...base, ...patch };
  return { ...state, sheets: { ...state.sheets, [key]: next } };
}

/** UPLOAD_INIT_SUCCESS handler — extracted to keep the reducer flat.
 *  CSV seeds its single unit ok (+ refresh preset); Excel lists sheets
 *  (refresh pre-selects the target's committed sheet). */
function reduceUploadInit(
  state: WizardState,
  response: TempUploadResponse,
): WizardState {
  if (response.sourceFormat === "csv") {
    const preview: CsvParsePreview = response.csvPreview;
    const preset =
      state.mode === "refresh" ? pendingPresetFor(state.pendingPreset, CSV_SHEET_KEY) : undefined;
    const seeded = setSheet(
      { ...state, tempId: response.temp_id, unitOrder: [CSV_SHEET_KEY], nextUnitSeq: 0 },
      CSV_SHEET_KEY,
      {
        status: "ok",
        columns: preview.columns,
        rowCount: preview.rowCount,
        sampleRows: preview.sampleRows,
        name: unitName(state.file, "", false, undefined, 1),
        sheetName: "",
        ...applyPreset(preset, preview.columns),
      },
    );
    return {
      ...seeded,
      pendingPreset: preset === undefined ? state.pendingPreset : null,
      step: "metadata",
    };
  }
  // Excel — refresh pre-selects the target's committed sheet, but ONLY when
  // the new workbook actually has it (R147 fix: a renamed sheet used to
  // leave a ghost selection — "1 selected", nothing visibly checked, a
  // doomed parse). Absent → empty selection + the Sheet-step note switches
  // to "pick the sheet to update from".
  const committedSheetPresent =
    state.refreshTargetSheet !== null &&
    response.sheets.some((s) => s.sheet === state.refreshTargetSheet);
  const selectedSheets =
    state.mode === "refresh" && state.refreshTargetSheet && committedSheetPresent
      ? [state.refreshTargetSheet]
      : [];
  return {
    ...state,
    tempId: response.temp_id,
    availableSheets: response.sheets,
    selectedSheets,
    // One initial unit per selected sheet (keyed by the sheet name).
    unitOrder: [...selectedSheets],
    nextUnitSeq: 0,
    sheets: {},
    step: "sheet",
  };
}

/** PARSE_SHEET_SUCCESS handler — extracted to keep the reducer flat.
 *  Create mode wipes overrides (R19 Q2); refresh replays the preset once. */
function reduceParseSuccess(
  state: WizardState,
  action: Extract<WizardAction, { type: "PARSE_SHEET_SUCCESS" }>,
): WizardState {
  const preset =
    state.mode === "refresh" ? pendingPresetFor(state.pendingPreset, action.unit) : undefined;
  const next = setSheet(state, action.unit, {
    status: "ok",
    columns: action.result.columns,
    rowCount: action.result.rowCount,
    sampleRows: action.result.sampleRows,
    parseError: undefined,
    ...applyPreset(preset, action.result.columns),
  });
  // Refresh stashes exactly ONE preset; once applied (by committed name OR
  // the rename fallback) it is consumed wholesale, so a later user re-parse
  // resets normally (R19 Q2 create-mode behavior).
  return { ...next, pendingPreset: preset === undefined ? state.pendingPreset : null };
}

/** SEED_REFRESH handler — enter refresh mode against a committed dataset.
 *  Fresh state (the user picks the new file next); fixes workspace + source +
 *  target, stashes the drift baseline + the carry-forward preset. The preset
 *  comes from the persisted `commitSettings` (F9, faithful) when available,
 *  else a lossy fallback derived from the committed columns (legacy datasets). */
function reduceSeedRefresh(target: Dataset, settings: RefreshSettings | null | undefined): WizardState {
  const isCsv = target.sourceFormat === "csv";
  const sheetKey = isCsv ? CSV_SHEET_KEY : (target.sheetName ?? "");
  const preset: RefreshPreset = settings?.available
    ? {
        parseOptions: settings.parse_options ?? {},
        columnOverrides: settings.column_overrides ?? {},
        excludedColumns: settings.excluded_columns ?? [],
        name: target.name,
      }
    : presetFromDataset(target);
  // R147 D1/D4 — pre-fill the remembered key + last-used mode. A remembered
  // key column no longer on the committed schema is dropped (a later replace
  // may have reshaped the dataset); a merge default with no surviving key
  // falls back to replace rather than seeding an un-committable state.
  const committed = new Set(target.columns.map((c) => c.name));
  const mergeKey = (settings?.merge_key ?? []).filter((k) => committed.has(k));
  const refreshMode: RefreshMode =
    settings?.refresh_mode === "merge" && mergeKey.length > 0 ? "merge" : "replace";
  return {
    ...INITIAL_WIZARD_STATE,
    mode: "refresh",
    sourceFormat: target.sourceFormat,
    workspaceId: target.workspaceId,
    targetDatasetId: target.id,
    refreshBaseline: target.columns,
    refreshTargetName: target.name,
    refreshTargetSheet: isCsv ? null : (target.sheetName ?? null),
    pendingPreset: { [sheetKey]: preset },
    refreshLegacy: !settings?.available,
    refreshMode,
    mergeKey,
  };
}

/** TOGGLE_SELECTED_SHEET handler — extracted to keep the reducer flat.
 *  R147 — refresh is single-table: selecting a sheet REPLACES the selection
 *  (radio semantics; before this, extra selections were silently dropped at
 *  commit). Toggling the selected one clears it. Create keeps multi-select.
 *  F8 — units track selection: selecting adds the sheet's initial unit,
 *  deselecting drops it AND any range-units carved from it. */
function reduceToggleSheet(state: WizardState, sheet: string): WizardState {
  const present = state.selectedSheets.includes(sheet);
  if (state.mode === "refresh") {
    const sheets: Record<string, SheetState> = {};
    if (!present && state.sheets[sheet]) sheets[sheet] = state.sheets[sheet];
    return {
      ...state,
      selectedSheets: present ? [] : [sheet],
      unitOrder: present ? [] : [sheet],
      sheets,
    };
  }
  if (present) {
    // Deselect: drop the sheet + every unit (initial + added ranges) it owns.
    const selectedSheets = state.selectedSheets.filter((s) => s !== sheet);
    const dropped = new Set(
      state.unitOrder.filter((k) => (state.sheets[k]?.sheetName ?? k) === sheet),
    );
    const unitOrder = state.unitOrder.filter((k) => !dropped.has(k));
    const sheets = { ...state.sheets };
    for (const k of dropped) delete sheets[k];
    return { ...state, selectedSheets, unitOrder, sheets };
  }
  // Select: append the sheet + its initial unit (keyed by the sheet name).
  return {
    ...state,
    selectedSheets: [...state.selectedSheets, sheet],
    unitOrder: [...state.unitOrder, sheet],
  };
}

/** ADD_RANGE_UNIT — F8: carve another range-unit from an already-selected
 *  sheet. The new unit gets a synthetic key, is inserted right after the
 *  sheet's existing units (keeping a sheet's units contiguous), and starts
 *  pending with an empty range for the user to type. */
function reduceAddRangeUnit(state: WizardState, sheetName: string): WizardState {
  if (state.mode === "refresh") return state; // refresh is single-unit (slice 1)
  // `:` can't occur in an Excel sheet name (Excel forbids it) → the synthetic
  // key never collides with a real sheet's initial-unit key (the bare name).
  const key = `${sheetName}:${state.nextUnitSeq}`;
  const ordinal =
    state.unitOrder.filter((k) => (state.sheets[k]?.sheetName ?? k) === sheetName).length + 1;
  // Insert after the last existing unit of this sheet.
  let insertAt = state.unitOrder.length;
  for (let i = state.unitOrder.length - 1; i >= 0; i--) {
    if ((state.sheets[state.unitOrder[i]]?.sheetName ?? state.unitOrder[i]) === sheetName) {
      insertAt = i + 1;
      break;
    }
  }
  const unitOrder = [
    ...state.unitOrder.slice(0, insertAt),
    key,
    ...state.unitOrder.slice(insertAt),
  ];
  const unit: SheetState = {
    status: "pending",
    columns: [],
    rowCount: 0,
    sampleRows: [],
    columnOverrides: {},
    excludedColumns: [],
    parseOptions: {},
    name: unitName(state.file, sheetName, true, undefined, ordinal),
    sheetName,
  };
  return {
    ...state,
    unitOrder,
    nextUnitSeq: state.nextUnitSeq + 1,
    sheets: { ...state.sheets, [key]: unit },
  };
}

/** REMOVE_RANGE_UNIT — F8: drop an added range-unit. Only added units are
 *  removable (an initial unit is removed by deselecting its sheet). */
function reduceRemoveRangeUnit(state: WizardState, key: string): WizardState {
  const unit = state.sheets[key];
  if (!unit || !isAddedUnit(key, unit.sheetName)) return state;
  const sheets = { ...state.sheets };
  delete sheets[key];
  return { ...state, unitOrder: state.unitOrder.filter((k) => k !== key), sheets };
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
        // Switching source resets file + temp + units to avoid stale state.
        file: null,
        tempId: null,
        availableSheets: [],
        selectedSheets: [],
        sheets: {},
        unitOrder: [],
        nextUnitSeq: 0,
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
        unitOrder: [],
        nextUnitSeq: 0,
      };
    case "UPLOAD_INIT_SUCCESS":
      return reduceUploadInit(state, action.response);
    case "TOGGLE_SELECTED_SHEET":
      return reduceToggleSheet(state, action.sheet);
    case "ADD_RANGE_UNIT":
      return reduceAddRangeUnit(state, action.sheetName);
    case "REMOVE_RANGE_UNIT":
      return reduceRemoveRangeUnit(state, action.unit);
    case "PARSE_SHEET_START":
      return setSheet(state, action.unit, { status: "parsing" });
    case "PARSE_SHEET_SUCCESS":
      // Create wipes overrides (R19 Q2); refresh replays the preset once
      // (R145 — the seeding parse survives the wipe). See reduceParseSuccess.
      return reduceParseSuccess(state, action);
    case "PARSE_SHEET_FAILED":
      return setSheet(state, action.unit, {
        status: "failed",
        parseError: { error: action.result.error, detail: action.result.detail },
      });
    case "SET_COLUMN_OVERRIDE": {
      const sheet = state.sheets[action.unit];
      if (!sheet) return state;
      const columnOverrides = { ...sheet.columnOverrides };
      if (action.override === null) {
        delete columnOverrides[action.column];
      } else {
        columnOverrides[action.column] = action.override;
      }
      return setSheet(state, action.unit, { columnOverrides });
    }
    case "TOGGLE_EXCLUDED_COLUMN": {
      const sheet = state.sheets[action.unit];
      if (!sheet) return state;
      const present = sheet.excludedColumns.includes(action.column);
      const excludedColumns = present
        ? sheet.excludedColumns.filter((c) => c !== action.column)
        : [...sheet.excludedColumns, action.column];
      return setSheet(state, action.unit, { excludedColumns });
    }
    case "SET_PARSE_OPTIONS": {
      // R19 Q4: editing parse options invalidates per-column choices, so reset
      // overrides + exclusions symmetrically with Q2's re-parse. F8 D2: for an
      // added range-unit whose name the user hasn't edited, refresh the
      // range-derived default name to track the new range.
      const sheet = state.sheets[action.unit];
      const patch: Partial<SheetState> = {
        parseOptions: action.options,
        columnOverrides: {},
        excludedColumns: [],
      };
      if (
        sheet &&
        isAddedUnit(action.unit, sheet.sheetName) &&
        !sheet.nameEdited
      ) {
        const ordinal =
          state.unitOrder
            .filter((k) => (state.sheets[k]?.sheetName ?? k) === sheet.sheetName)
            .indexOf(action.unit) + 1;
        patch.name = unitName(state.file, sheet.sheetName, true, action.options.range, ordinal);
      }
      return setSheet(state, action.unit, patch);
    }
    case "SET_DATASET_NAME":
      return setSheet(state, action.unit, { name: action.name, nameEdited: true });
    case "SEED_REFRESH":
      return reduceSeedRefresh(action.target, action.settings);
    case "SET_REFRESH_MODE":
      return { ...state, refreshMode: action.mode };
    case "SET_MERGE_KEY":
      return { ...state, mergeKey: action.key };
    case "SET_DRIFT_ACK":
      return { ...state, driftAcknowledged: action.acknowledged };
    case "GOTO_STEP":
      return { ...state, step: action.step };
    case "RESET":
      return INITIAL_WIZARD_STATE;
  }
}

/** One dataset-to-be, resolved for the tabs / Confirm / commit. `range` is the
 *  unit's A1 range (undefined = the sheet's full used range). */
export type WizardUnit = {
  key: string;
  sheetName: string;
  range: string | undefined;
  state: SheetState;
};

/** The ordered units driving the Metadata/Preview tabs, the Confirm rows, and
 *  the commit items (F8). One entry per dataset-to-be. */
export function units(state: WizardState): WizardUnit[] {
  return state.unitOrder.map((key) => {
    const s = state.sheets[key] ?? defaultSheetState(state, key);
    return { key, sheetName: s.sheetName, range: s.parseOptions.range, state: s };
  });
}

/** True when a sheet has more than one unit (→ show the Range column / a
 *  range-bearing tab label so the units are distinguishable). */
export function sheetHasMultipleUnits(state: WizardState, sheetName: string): boolean {
  return (
    state.unitOrder.filter((k) => (state.sheets[k]?.sheetName ?? k) === sheetName).length > 1
  );
}

/** The wizard's step sequence for a given mode + source format. The active
 *  step's index is `steps.indexOf(state.step)` — mode-aware (refresh inserts
 *  a Drift-review step before Confirm; R145). Single source of truth for both
 *  the stepper and Back/Next navigation. */
export function wizardSteps(state: WizardState): WizardStep[] {
  const isCsv = state.sourceFormat === "csv";
  const base: WizardStep[] = isCsv
    ? ["source", "metadata", "preview"]
    : ["source", "sheet", "metadata", "preview"];
  if (state.mode === "refresh") base.push("drift");
  base.push("confirm");
  return base;
}

/** 1-based index of the active step within its sequence (0 if not present).
 *  Thin wrapper over {@link wizardSteps} — mode + source aware. */
export function stepIndex(state: WizardState): number {
  return wizardSteps(state).indexOf(state.step) + 1;
}

/** The single unit-key a refresh targets (refresh is single-table): the CSV
 *  sentinel, or the user's selected Excel sheet (pre-seeded to the target's
 *  committed sheet). */
export function refreshSheetKey(state: WizardState): string {
  if (state.sourceFormat === "csv") return CSV_SHEET_KEY;
  return state.selectedSheets[0] ?? state.refreshTargetSheet ?? "";
}

export type SchemaDrift = {
  added: Column[];
  removed: Column[];
  dtypeChanged: { name: string; from: Dtype; to: Dtype }[];
};

/** F10 drift diff — the incoming file's parsed columns vs the target's
 *  committed columns, by name. Pure + client-side (F1); the dependent-artifact
 *  blast-radius is a backend read that lands at C/B (upload.md § Refresh F10). */
export function computeSchemaDrift(
  baseline: Column[],
  incoming: Column[],
): SchemaDrift {
  const baseByName = new Map(baseline.map((c) => [c.name, c]));
  const incByName = new Map(incoming.map((c) => [c.name, c]));
  const added = incoming.filter((c) => !baseByName.has(c.name));
  const removed = baseline.filter((c) => !incByName.has(c.name));
  const dtypeChanged: SchemaDrift["dtypeChanged"] = [];
  for (const col of baseline) {
    const inc = incByName.get(col.name);
    if (inc && inc.dtype !== col.dtype) {
      dtypeChanged.push({ name: col.name, from: col.dtype, to: inc.dtype });
    }
  }
  return { added, removed, dtypeChanged };
}

/** True when any drift kind is present (gates the Drift-review acknowledge). */
export function hasSchemaDrift(d: SchemaDrift): boolean {
  return d.added.length > 0 || d.removed.length > 0 || d.dtypeChanged.length > 0;
}

export type MergeKeyIssue =
  | { kind: "missing"; name: string }
  | { kind: "dtypeChanged"; name: string; from: Dtype; to: Dtype };

/** R147 F5×F2 — the key columns are the ONE exception to warn-never-block:
 *  a key that is excluded/absent from the incoming kept set, or whose
 *  effective incoming dtype (override ?? parsed) differs from the committed
 *  dtype, silently mis-matches rows. Pure client-side mirror of the backend
 *  guards; a non-empty result disables the merge commit. */
export function mergeKeyIssues(
  baseline: Column[],
  sheet: SheetState | undefined,
  mergeKey: string[],
): MergeKeyIssue[] {
  if (sheet?.status !== "ok") return [];
  const committedDtype = new Map(baseline.map((c) => [c.name, c.dtype]));
  const excluded = new Set(sheet.excludedColumns);
  const incomingDtype = new Map(
    sheet.columns
      .filter((c) => !excluded.has(c.name))
      .map((c) => [c.name, sheet.columnOverrides[c.name]?.dtype ?? c.dtype]),
  );
  const issues: MergeKeyIssue[] = [];
  for (const name of mergeKey) {
    const to = incomingDtype.get(name);
    const from = committedDtype.get(name);
    if (to === undefined) {
      issues.push({ kind: "missing", name });
    } else if (from !== undefined && from !== to) {
      issues.push({ kind: "dtypeChanged", name, from, to });
    }
  }
  return issues;
}
