/**
 * Config field key constants (dotted-key strings).
 * All config reads are routed through these keys to avoid magic strings.
 */
export const Fields = {
  API_BASE_URL: "api.baseUrl",
  FEATURE_FLAGS: "feature.flags",
  LOG_LEVEL: "log.level",
  I18N_LOCALE: "i18n.locale",
} as const;

export type FieldKey = (typeof Fields)[keyof typeof Fields];
