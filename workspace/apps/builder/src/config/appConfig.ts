/**
 * AppConfig — minimal FE facade for build-time config (R28).
 *
 * Reads `import.meta.env.VITE_*` values rendered by js-tmpl from
 * `workspace/config/values.yaml` into `workspace/apps/builder/.env`.
 *
 * Layer 2 (runtime fetch via /api/v1/config) and Layer 3 (localStorage
 * overrides) are SKIPPED per the drifted-config research memo — the
 * POC doesn't need them yet. Adding them later is mechanical: add the
 * `init()` async + the localStorage reader + a `_resolve()` chain.
 *
 * Drifted-pattern reference: `apps/builder/src/config/appConfig.ts`
 * (drifted shipped the full 3-layer version; we adopt a single-layer
 * cousin).
 */

import { Const } from "./const";
import { Fields, type FieldKey } from "./fields";

type EnvMap = Record<string, string | undefined>;

/** Build-time `VITE_*` env vars exposed by Vite. */
function readBuildTimeEnv(): EnvMap {
  const metaEnv =
    typeof import.meta !== "undefined" ? (import.meta.env as EnvMap) : {};
  return {
    [Fields.API_BASE_URL]: metaEnv.VITE_API_BASE_URL,
    [Fields.LOG_LEVEL]: metaEnv.VITE_LOG_LEVEL,
    [Fields.I18N_LOCALE]: metaEnv.VITE_I18N_LOCALE,
  };
}

class AppConfig {
  private readonly _buildTime: EnvMap;

  constructor() {
    this._buildTime = readBuildTimeEnv();
  }

  /** Typed accessor: API base URL — used by every fetch client. */
  apiBaseUrl(): string {
    return this._resolve(Fields.API_BASE_URL, Const.API_BASE_FALLBACK);
  }

  /** Typed accessor: log level — used wherever client-side logging
   *  gates on level. */
  logLevel(): string {
    return this._resolve(Fields.LOG_LEVEL, Const.LOG_LEVEL);
  }

  /** Typed accessor: i18n locale — R32 will consume this. R27 seeded
   *  the placeholder so R32 has no retrofit cost. */
  i18nLocale(): string {
    return this._resolve(Fields.I18N_LOCALE, Const.DEFAULT_LOCALE);
  }

  /** Generic dotted-key access — drifted-style API. */
  get(fieldKey: FieldKey, defaultValue: string = ""): string {
    return this._resolve(fieldKey, defaultValue);
  }

  private _resolve(fieldKey: string, defaultValue: string): string {
    const v = this._buildTime[fieldKey];
    return v !== undefined && v !== "" ? v : defaultValue;
  }
}

/** Pre-created singleton. Import this everywhere. */
export const appConfig = new AppConfig();
