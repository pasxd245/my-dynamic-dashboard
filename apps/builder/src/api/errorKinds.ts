/**
 * Frontend error-kind taxonomy.
 *
 * Backend `error_code` strings (see `apps/backend/app/api/upload.py`) are
 * classified into a small kind enum so the UI can render bespoke guidance
 * (icon + actionable copy + AntD Alert severity) rather than a generic
 * "something went wrong" message.
 *
 * If a code is unknown, the classifier falls back to `unknown`, which the
 * panel renders using the backend-provided `user_message` + `next_steps`
 * verbatim.
 */

export type ErrorKind =
  | "encrypted_file"
  | "malformed_file"
  | "unsupported_extension"
  | "source_type_mismatch"
  | "missing_source_type"
  | "empty_sheet"
  | "sheet_not_supported"
  | "not_found"
  | "unknown";

export type ErrorSeverity = "error" | "warning" | "info";

export interface ErrorKindMeta {
  readonly kind: ErrorKind;
  readonly severity: ErrorSeverity;
  readonly title: string;
  readonly guidance: string;
}

const CODE_TO_KIND: Record<string, ErrorKind> = {
  encrypted_file: "encrypted_file",
  parse_failed: "malformed_file",
  sheet_discovery_failed: "malformed_file",
  unsupported_file: "unsupported_extension",
  source_type_mismatch: "source_type_mismatch",
  invalid_source_type: "missing_source_type",
  empty_sheet: "empty_sheet",
  sheet_discovery_not_supported: "sheet_not_supported",
  sheet_selection_not_supported: "sheet_not_supported",
  smoke_run_not_found: "not_found",
};

const KIND_META: Record<ErrorKind, Omit<ErrorKindMeta, "kind">> = {
  encrypted_file: {
    severity: "error",
    title: "This file is password-protected",
    guidance:
      "Open the workbook in Excel, remove the password (File → Info → Protect Workbook), save a new copy, and upload that instead.",
  },
  malformed_file: {
    severity: "error",
    title: "We could not read this file",
    guidance:
      "The file may be corrupted or in an unexpected format. Open it locally to confirm it loads, then re-save and try again.",
  },
  unsupported_extension: {
    severity: "warning",
    title: "Unsupported file type",
    guidance:
      "Only .csv and Excel files (.xlsx, .xlsm, .xlsb, .xls) are accepted. Export your data to one of these formats and try again.",
  },
  source_type_mismatch: {
    severity: "warning",
    title: "Source type doesn't match the file",
    guidance:
      "Pick 'CSV' for .csv files and 'Excel' for .xlsx / .xlsm / .xlsb / .xls files, then retry the upload.",
  },
  missing_source_type: {
    severity: "info",
    title: "Pick a source type before uploading",
    guidance: "Choose CSV or Excel from the Source type selector and try the upload again.",
  },
  empty_sheet: {
    severity: "warning",
    title: "The selected sheet has no data rows",
    guidance:
      "Pick a different sheet from the workbook, or add data rows to this sheet and re-upload.",
  },
  sheet_not_supported: {
    severity: "info",
    title: "Sheet selection doesn't apply here",
    guidance:
      "Sheet selection is only relevant for multi-sheet Excel workbooks. For CSV or single-sheet files, continue to the next step.",
  },
  not_found: {
    severity: "warning",
    title: "Resource not found",
    guidance:
      "The item you tried to load no longer exists. Refresh the page or pick a different item from the list.",
  },
  unknown: {
    severity: "error",
    title: "Something went wrong",
    guidance:
      "Review the technical details below for context, then retry. If the problem persists, capture the correlation ID and contact support.",
  },
};

export function classifyErrorCode(errorCode: string): ErrorKind {
  return CODE_TO_KIND[errorCode] ?? "unknown";
}

export function getErrorKindMeta(kind: ErrorKind): ErrorKindMeta {
  return { kind, ...KIND_META[kind] };
}

export function getErrorMetaForCode(errorCode: string): ErrorKindMeta {
  return getErrorKindMeta(classifyErrorCode(errorCode));
}
