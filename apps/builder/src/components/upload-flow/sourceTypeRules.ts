import type { UploadSourceType } from "../../api/types";

const excelExtensions = new Set(["xlsx", "xlsm", "xlsb", "xls"]);

export function detectSourceTypeFromFilename(filename: string): UploadSourceType | null {
  const parts = filename.toLowerCase().split(".");
  const extension = parts.length > 1 ? parts[parts.length - 1] : "";

  if (excelExtensions.has(extension)) {
    return "excel";
  }
  if (extension === "csv") {
    return "csv";
  }
  return null;
}

export function isSourceTypeCompatibleWithFilename(sourceType: UploadSourceType, filename: string): boolean {
  const detected = detectSourceTypeFromFilename(filename);
  return detected !== null && detected === sourceType;
}

export function getSourceTypeMismatchMessage(sourceType: UploadSourceType, filename: string): string | null {
  const detected = detectSourceTypeFromFilename(filename);
  if (detected === null) {
    return "Unsupported file extension. Choose a CSV or Excel file.";
  }
  if (detected !== sourceType) {
    return `Selected source type '${sourceType}' does not match file '${filename}'.`;
  }
  return null;
}

/**
 * sourceTypeNeedsFile — determines if a source type requires a file upload.
 * CSV and Excel need files in R41. URL, API, and text source types
 * (queued for R45+) do not require files.
 */
export function sourceTypeNeedsFile(sourceType: UploadSourceType | null): boolean {
  if (!sourceType) return false;
  return sourceType === "csv" || sourceType === "excel";
}
