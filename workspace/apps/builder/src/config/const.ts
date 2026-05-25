/**
 * Application-wide constants that are NOT user-overridable via env or
 * runtime config — different surface from `Fields` (which IS overridable).
 *
 * R27 seeds the convention (matches drifted's `const.ts` shape). The
 * full set lands incrementally as R29's constants audit identifies
 * inline magic strings to centralize.
 */
export const Const = {
  /** Last-resort default if nothing else resolves the API base URL. */
  API_BASE_FALLBACK: "http://localhost:8000",

  /** Default locale when no override is present. */
  DEFAULT_LOCALE: "en-US",

  /** Default log level when no override is present. */
  LOG_LEVEL: "info",

  /** Fallback upload byte limit if `VITE_UPLOAD_MAX_BYTES` is missing.
   *  Matches the BE default (100 MiB). The rendered env should always
   *  populate this; the constant is a safety net for misconfigured boots. */
  UPLOAD_MAX_BYTES_FALLBACK: 100 * 1024 * 1024,
} as const;
