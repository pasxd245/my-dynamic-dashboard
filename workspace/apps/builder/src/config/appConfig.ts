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
    [Fields.UPLOAD_MAX_BYTES]: metaEnv.VITE_UPLOAD_MAX_BYTES,
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

  /** Typed accessor: i18n locale — R32 consumes this via
   *  `src/i18n/index.ts` `init({ lng })`. */
  i18nLocale(): string {
    return this._resolve(Fields.I18N_LOCALE, Const.DEFAULT_LOCALE);
  }

  /** Typed accessor: upload byte limit. Rendered from
   *  `backend.upload_max_bytes` so the FE display tracks whatever the
   *  BE enforces. Number parsed once; the underlying env value is a
   *  numeric string. */
  uploadMaxBytes(): number {
    const raw = this._resolve(Fields.UPLOAD_MAX_BYTES, "");
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : Const.UPLOAD_MAX_BYTES_FALLBACK;
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
