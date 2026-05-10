/**
 * Application-wide defaults.
 * These are the lowest-precedence values — overridden by build-time env,
 * runtime /api/v1/config, or localStorage overrides.
 */
export const Const = {
  DEFAULT_LOCALE: "en-US",
  MAX_PREVIEW_ROWS: 10000,
  API_BASE: "/api/v1",
  LOG_LEVEL: "info",
} as const;
