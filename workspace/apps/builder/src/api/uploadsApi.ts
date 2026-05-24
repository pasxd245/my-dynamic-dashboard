import type {
  ParseSheetsRequest,
  ParseSheetsResponse,
  TempUploadResponse,
} from "../features/data-management/datasets/types";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function readJson<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    throw new Error(`Request failed: ${resp.status} ${resp.statusText}`);
  }
  return (await resp.json()) as T;
}

export const uploadsApi = {
  /**
   * Multipart upload. The Content-Type header is set by the browser
   * (with the multipart boundary) — do NOT set it explicitly.
   */
  async createTemp(
    file: File,
    sourceFormat: "csv" | "excel",
  ): Promise<TempUploadResponse> {
    const body = new FormData();
    body.append("file", file);
    body.append("sourceFormat", sourceFormat);
    const resp = await fetch(`${API_BASE_URL}/uploads`, {
      method: "POST",
      body,
    });
    return readJson<TempUploadResponse>(resp);
  },

  async parseSheets(
    tempId: string,
    body: ParseSheetsRequest,
  ): Promise<ParseSheetsResponse> {
    const resp = await fetch(`${API_BASE_URL}/uploads/${tempId}/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return readJson<ParseSheetsResponse>(resp);
  },
};
