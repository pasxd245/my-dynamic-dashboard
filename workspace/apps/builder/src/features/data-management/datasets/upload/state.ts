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
  /** Per-sheet parse options (range / skip_rows / has_header). */
  parseOptions: ParseOptions;
  /** Dataset name input. Defaults to `<file-stem>_<sheet>` for Excel. */
  name: string;
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
  /** Excel only — user-selected sheets, in the order they'll appear. */
  selectedSheets: string[];
  /** Per-sheet state map. CSV uses the empty-string sentinel key. */
  sheets: Record<string, SheetState>;
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
  | { type: "SET_PARSE_OPTIONS"; sheet: string; options: ParseOptions }
  | { type: "SET_DATASET_NAME"; sheet: string; name: string }
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
  const base: SheetState = state.sheets[key] ?? {
    status: "pending",
    columns: [],
    rowCount: 0,
    sampleRows: [],
    columnOverrides: {},
    excludedColumns: [],
    parseOptions: {},
    name: defaultName(state.file, key || undefined),
  };
  const next: SheetState = { ...base, ...patch };
  return { ...state, sheets: { ...state.sheets, [key]: next } };
}

/** UPLOAD_INIT_SUCCESS handler — extracted to keep the reducer flat.
 *  CSV seeds its single sheet ok (+ refresh preset); Excel lists sheets
 *  (refresh pre-selects the target's committed sheet). */
function reduceUploadInit(
  state: WizardState,
  response: TempUploadResponse,
): WizardState {
  if (response.sourceFormat === "csv") {
    const preview: CsvParsePreview = response.csvPreview;
    const preset =
      state.mode === "refresh" ? pendingPresetFor(state.pendingPreset, CSV_SHEET_KEY) : undefined;
    const seeded = setSheet({ ...state, tempId: response.temp_id }, CSV_SHEET_KEY, {
      status: "ok",
      columns: preview.columns,
      rowCount: preview.rowCount,
      sampleRows: preview.sampleRows,
      name: defaultName(state.file, undefined),
      ...applyPreset(preset, preview.columns),
    });
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
    state.mode === "refresh" ? pendingPresetFor(state.pendingPreset, action.sheet) : undefined;
  const next = setSheet(state, action.sheet, {
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
 *  commit). Toggling the selected one clears it. Create keeps multi-select. */
function reduceToggleSheet(state: WizardState, sheet: string): WizardState {
  const present = state.selectedSheets.includes(sheet);
  if (state.mode === "refresh") {
    const sheets: Record<string, SheetState> = {};
    if (!present && state.sheets[sheet]) sheets[sheet] = state.sheets[sheet];
    return { ...state, selectedSheets: present ? [] : [sheet], sheets };
  }
  const selectedSheets = present
    ? state.selectedSheets.filter((s) => s !== sheet)
    : [...state.selectedSheets, sheet];
  // Drop sheet state when deselected so re-selecting re-parses.
  const sheets = { ...state.sheets };
  if (present) delete sheets[sheet];
  return { ...state, selectedSheets, sheets };
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
    case "UPLOAD_INIT_SUCCESS":
      return reduceUploadInit(state, action.response);
    case "TOGGLE_SELECTED_SHEET":
      return reduceToggleSheet(state, action.sheet);
    case "PARSE_SHEET_START":
      return setSheet(state, action.sheet, { status: "parsing" });
    case "PARSE_SHEET_SUCCESS":
      // Create wipes overrides (R19 Q2); refresh replays the preset once
      // (R145 — the seeding parse survives the wipe). See reduceParseSuccess.
      return reduceParseSuccess(state, action);
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
    case "SET_PARSE_OPTIONS":
      // R19 Q4: editing parse options invalidates per-column choices,
      // so reset overrides + exclusions symmetrically with Q2's re-parse.
      return setSheet(state, action.sheet, {
        parseOptions: action.options,
        columnOverrides: {},
        excludedColumns: [],
      });
    case "SET_DATASET_NAME":
      return setSheet(state, action.sheet, { name: action.name });
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

/** The single sheet a refresh targets (refresh is single-table): the CSV
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
