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
  /** R155 — explicit refresh-semantics discriminator (requires
   *  `target_dataset_id`). Omitted ⇒ inferred (merge iff `merge_key`, else
   *  replace); `append` must be explicit (keyless). */
  refresh_mode?: RefreshMode;
  /** R155 append — the date/datetime column the double-count check used,
   *  remembered for next refresh (not acted on at commit). */
  overlap_check_field?: string;
};

/** Refresh mode — replace (R145, whole-table), merge-on-key (R147), or the
 *  keyless append/union that accumulates periodic exports (R155). */
export type RefreshMode = 'replace' | 'merge' | 'append';

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
  /** R155 — the date/datetime column the last append refresh's overlap check used. */
  overlap_check_field?: string;
  /** R147 D4 — the last refresh's semantics (the per-refresh choice defaults to it). */
  refresh_mode?: RefreshMode;
  /** R158 — the computed columns (provenance-only for now) recorded in the ingest
   *  registry. The FE reads the name to exclude the computed column from the
   *  schema-drift diff (it exists committed but is absent from every source file).
   *  Synthesized server-side for legacy datasets on read. */
  computed_columns?: { name: string; kind: string }[];
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

/** R155 — what an append did: rows appended · the dataset's new total
 *  (committed + appended). */
export type AppendReport = {
  appended: number;
  total: number;
};

/** R155 — 201 shape 3: an append refresh wraps the updated dataset with the
 *  append report. The FE branches on `Array.isArray` then on `merge`/`append`. */
export type CommitBatchAppendResponse = {
  datasets: Dataset[];
  append: AppendReport;
};

export type CommitBatchResponse =
  | Dataset[]
  | CommitBatchMergeResponse
  | CommitBatchAppendResponse;

/** R155 — a min/max span on a date/datetime column. */
export type DateRange = {
  min: string;
  max: string;
};

/** R155 — `POST /datasets/{id}/append-overlap` request: check the staged
 *  upload's range on `field` against the target dataset. */
export type AppendOverlapRequest = {
  temp_id: string;
  sheet?: string;
  field: string;
};

/** R155 — the pre-commit double-count advisory. `overlaps` is the headline;
 *  the ranges are the evidence. `overlappingRange` is present iff `overlaps`. */
export type AppendOverlapResult = {
  field: string;
  overlaps: boolean;
  committedRange: DateRange | null;
  incomingRange: DateRange | null;
  overlappingRange?: DateRange;
};

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

// Re-export per-column filter types so callers can import from the
// datasets feature root without reaching into the filters/ subdir.
export type { FilterPredicate, FilterSet, Operator } from './filters/types';
