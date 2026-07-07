// Hand-aligned to the R15 OpenAPI 3.1 YAML contracts at
// workspace/packages/contracts/. Keep this file in lockstep with
// the YAML; codegen lands when 3+ contracts drift (per the
// Evolution Rule).

export type Dtype = 'string' | 'integer' | 'float' | 'boolean' | 'date' | 'datetime';

export type SourceFormat = 'excel' | 'csv';

export type Column = {
  name: string;
  dtype: Dtype;
  /** R152 presentation-only view-hint. Absent/false = visible. When true,
   *  the dataset-detail row-preview default-hides it (with a "show all"
   *  escape); every picker ignores it. Set via PATCH /datasets/{id}/columns;
   *  never touches the parquet. */
  hidden?: boolean;
};

export type Dataset = {
  id: string;
  workspaceId: string;
  name: string;
  sizeBytes: number;
  rowCount: number;
  columnCount: number;
  columns: Column[];
  sourceFormat: SourceFormat;
  /** Present iff sourceFormat === 'excel'. */
  sheetName?: string;
  createdAt: string;
};

export type ParseOptions = {
  /** Excel only — e.g. "A1:C20". */
  range?: string;
  /** CSV only. */
  skip_rows?: number;
  /** Default true. */
  has_header?: boolean;
};

export type ColumnOverride = {
  dtype: Dtype;
  /** Required iff dtype is 'date' or 'datetime'. */
  format?: string;
};

export type SheetSummary = {
  sheet: string;
  rowCount: number;
  columnCount: number;
  /** e.g. "A1:G250". */
  usedRange?: string;
};

export type CsvParsePreview = {
  columns: Column[];
  rowCount: number;
  sampleRows: (string | null)[][];
};

export type TempUploadCsv = {
  temp_id: string;
  sourceFormat: 'csv';
  sizeBytes: number;
  csvPreview: CsvParsePreview;
};

export type TempUploadExcel = {
  temp_id: string;
  sourceFormat: 'excel';
  sizeBytes: number;
  sheets: SheetSummary[];
};

export type TempUploadResponse = TempUploadCsv | TempUploadExcel;

export type ParseSheetOk = {
  /** Echoed for Excel; omitted for CSV (single implicit table). */
  sheet?: string;
  status: 'ok';
  columns: Column[];
  rowCount: number;
  sampleRows: (string | null)[][];
};

export type ParseSheetFailed = {
  /** Echoed for Excel; omitted for CSV. */
  sheet?: string;
  status: 'failed';
  error: string;
  detail: string;
};

export type ParseSheetResult = ParseSheetOk | ParseSheetFailed;

export type ParseSheetsRequestItem = {
  /** Required for Excel; must be omitted for CSV. R26 extension. */
  sheet?: string;
  parse_options?: ParseOptions;
};

export type ParseSheetsRequest = {
  items: ParseSheetsRequestItem[];
};

export type ParseSheetsResponse = {
  results: ParseSheetResult[];
};

export type CommitBatchItem = {
  /** Excel only — the sheet to promote. */
  sheet?: string;
  name: string;
  parse_options?: ParseOptions;
  column_overrides?: Record<string, ColumnOverride>;
  excluded_columns?: string[];
  /** R145 refresh — replace this existing dataset in place (name ignored). */
  target_dataset_id?: string;
  /** R147 merge refresh — the identity-key column(s); requires
   *  `target_dataset_id`. Presence selects merge (keep-latest-per-key)
   *  instead of replace. */
  merge_key?: string[];
};

/** R147 refresh mode — replace (R145, whole-table) or merge-on-key. */
export type RefreshMode = 'replace' | 'merge';

/** R145: GET /datasets/{id}/refresh-settings — the carry-forward snapshot a
 *  refresh wizard pre-fills from. Mirrors a commit item's settings shape.
 *  `available: false` for pre-R145 datasets (no snapshot → lossy fallback). */
export type RefreshSettings = {
  available: boolean;
  sheet?: string;
  parse_options?: ParseOptions;
  column_overrides?: Record<string, ColumnOverride>;
  excluded_columns?: string[];
  /** R147 D1 — the key the last merge refresh declared (remembered per dataset). */
  merge_key?: string[];
  /** R147 D4 — the last refresh's semantics (the per-refresh choice defaults to it). */
  refresh_mode?: RefreshMode;
};

export type CommitBatchRequest = {
  temp_id: string;
  items: CommitBatchItem[];
};

/** R147 — what the merge did: incoming rows that superseded a committed key ·
 *  incoming rows with a new key · committed rows kept (no incoming counterpart).
 *  Sums to the dataset's new rowCount. */
export type MergeReport = {
  updated: number;
  inserted: number;
  kept: number;
};

/** R147 — 201 shape 2: a merge refresh wraps the updated dataset with the
 *  merge report. The FE branches on `Array.isArray`. */
export type CommitBatchMergeResponse = {
  datasets: Dataset[];
  merge: MergeReport;
};

export type CommitBatchResponse = Dataset[] | CommitBatchMergeResponse;

/** R36: response shape for GET /datasets/{id}/rows.
 *  Mirrors `workspace/packages/contracts/datasets/rows-get.contract.yaml`.
 *  Cells are stringified BE-side via DuckDB `CAST(... AS VARCHAR)`; the FE
 *  re-applies dtype-aware display formatting via `formatCell()` using the
 *  parent `Dataset.columns[].dtype`. R40 extended: `total` reflects the
 *  AND-composed matched count under (optional) `?q=` and (optional)
 *  `f<N>_*` per-column filters. */
export type RowsPage = {
  rows: (string | null)[][];
  page: number;
  pageSize: number;
  /** Matched-row count under the active predicate set; equals
   *  `Dataset.rowCount` when no predicates are active. */
  total: number;
};

// R154 — GET /datasets/{id}/profile. On-demand DuckDB profile; read-only
// compute (never touches the parquet). Mirrors profile-get.contract.yaml.
export type ColumnProfile = {
  name: string;
  dtype: Dtype;
  /** date/datetime display pattern from commitSettings; null if no override. */
  format: string | null;
  nullCount: number;
  /** nullCount / rowCount * 100 (0 when rowCount is 0). */
  nullPct: number;
  distinctCount: number;
  /** Stringified min for numeric/date/datetime; null for string/boolean. */
  min: string | null;
  /** Stringified max for numeric/date/datetime; null for string/boolean. */
  max: string | null;
  /** Top-k sample values for string columns; null for numeric/date/datetime/boolean. */
  sample: (string | null)[] | null;
};

export type DatasetProfile = {
  datasetId: string;
  rowCount: number;
  /** true when computed on a sample, not a full scan. */
  approx: boolean;
  /** Rows scanned when `approx`; null on a full scan. */
  sampledRows: number | null;
  columns: ColumnProfile[];
};

// Re-export per-column filter types so callers can import from the
// datasets feature root without reaching into the filters/ subdir.
export type { FilterPredicate, FilterSet, Operator } from './filters/types';
