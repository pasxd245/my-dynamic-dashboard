// Hand-aligned to the R15 OpenAPI 3.1 YAML contracts at
// workspace/packages/contracts/. Keep this file in lockstep with
// the YAML; codegen lands when 3+ contracts drift (per the
// Evolution Rule).

export type Dtype = 'string' | 'integer' | 'float' | 'boolean' | 'date' | 'datetime';

export type SourceFormat = 'excel' | 'csv';

export type Column = {
  name: string;
  dtype: Dtype;
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
};

export type CommitBatchRequest = {
  temp_id: string;
  items: CommitBatchItem[];
};

export type CommitBatchResponse = Dataset[];
