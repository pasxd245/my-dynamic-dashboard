/**
 * R32 add-on: byte formatter consolidated from three duplicated
 * call sites (UploadConfirmStep, UploadSheetStep, DatasetsPage).
 *
 * Two flavours:
 * - `formatBytes(n)` — precise: "1.2 KB", "12.3 MB". Used in dataset
 *   table cells where individual file sizes vary.
 * - `formatBytesCoarse(n)` — rounded to whole megabytes/kilobytes:
 *   "100 MB", "5 KB". Used in upload-hint copy where the value is a
 *   configured limit and a decimal looks fussy ("100.0 MB").
 */

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatBytesCoarse(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${Math.round(n / (1024 * 1024))} MB`;
}
