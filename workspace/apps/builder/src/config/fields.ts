/**
 * Dotted-key constants for config fields. All config reads route
 * through these to avoid magic strings at call sites.
 *
 * Mirrors `workspace/values.yaml` structure (dotted to flat). R27 seeds
 * the convention; the full `AppConfig` class on the FE lands in R28
 * alongside the BE-side facade. Today these are just identifiers — read
 * `import.meta.env.VITE_*` directly (see Vite docs).
 *
 * R27 scope intentionally narrow: this file is the convention, not the
 * call-site refactor. Existing `import.meta.env.VITE_API_BASE_URL ?? "..."`
 * usages stay untouched until R28.
 */
export const Fields = {
  API_BASE_URL: "builder.apiBaseUrl",
  LOG_LEVEL: "builder.logLevel",
  I18N_LOCALE: "i18n.locale",
} as const;

export type FieldKey = (typeof Fields)[keyof typeof Fields];
