import { useEffect, useState } from "react";
import { Const } from "./const";
import { Fields } from "./fields";

const LOCALSTORAGE_PREFIX = "cfg:";
const RUNTIME_CONFIG_URL = "/api/v1/config";
const RUNTIME_FETCH_TIMEOUT_MS = 3000;

type ConfigSource = "build-time" | "runtime" | "localStorage";

interface ConfigEntry {
  key: string;
  value: string;
  source: ConfigSource;
}

/** Runtime config shape returned by /api/v1/config */
interface RuntimeConfig {
  apiBaseUrl?: string;
  logLevel?: string;
  i18nLocale?: string;
}

/**
 * AppConfig — three-layer precedence configuration manager.
 *
 * Layer 1 (lowest):  build-time VITE_* environment variables
 * Layer 2 (middle):  runtime /api/v1/config fetch on AppConfig.init()
 * Layer 3 (highest): localStorage key-value overrides (prefix: "cfg:")
 *
 * Usage:
 *   await AppConfig.init();         // call once in main.tsx before render
 *   appConfig.apiBaseUrl();         // read resolved value
 *   appConfig.all();                // debug: see all values with source attribution
 */
export class AppConfig {
  private static _instance: AppConfig | null = null;

  private _buildTime: Record<string, string> = {};
  private _runtime: Record<string, string> = {};
  private _initialized = false;

  private constructor() {
    this._buildTime = this._readBuildTimeEnv();
  }

  static getInstance(): AppConfig {
    if (!AppConfig._instance) {
      AppConfig._instance = new AppConfig();
    }
    return AppConfig._instance;
  }

  /** Reset singleton — for testing only. */
  static _reset(): void {
    AppConfig._instance = null;
  }

  /**
   * Initialize AppConfig: fetch runtime config from /api/v1/config.
   * Gracefully falls back to build-time values if fetch fails or times out.
   * Must be called once before mounting the React root.
   */
  static async init(): Promise<void> {
    const instance = AppConfig.getInstance();
    if (instance._initialized) {
      return;
    }
    await instance._fetchRuntimeConfig();
    instance._initialized = true;
  }

  // ── Accessors ──────────────────────────────────────────────────────────────

  apiBaseUrl(): string {
    return this._resolve(Fields.API_BASE_URL, Const.API_BASE);
  }

  logLevel(): string {
    return this._resolve(Fields.LOG_LEVEL, Const.LOG_LEVEL);
  }

  i18nLocale(): string {
    return this._resolve(Fields.I18N_LOCALE, Const.DEFAULT_LOCALE);
  }

  /**
   * Returns all config entries with source attribution.
   * Useful for debugging in browser console: `appConfig.all()`
   */
  all(): ConfigEntry[] {
    const allKeys = new Set<string>([
      ...Object.keys(this._buildTime),
      ...Object.keys(this._runtime),
      ...this._localStorageKeys(),
    ]);

    return Array.from(allKeys).map((key) => {
      const lsValue = this._readLocalStorage(key);
      if (lsValue !== null) {
        return { key, value: lsValue, source: "localStorage" };
      }
      const runtimeValue = this._runtime[key];
      if (runtimeValue !== undefined) {
        return { key, value: runtimeValue, source: "runtime" };
      }
      return {
        key,
        value: this._buildTime[key] ?? "",
        source: "build-time",
      };
    });
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _resolve(fieldKey: string, defaultValue: string): string {
    // Layer 3 — localStorage (highest precedence)
    const lsValue = this._readLocalStorage(fieldKey);
    if (lsValue !== null) {
      return lsValue;
    }
    // Layer 2 — runtime fetch
    if (this._runtime[fieldKey] !== undefined) {
      return this._runtime[fieldKey];
    }
    // Layer 1 — build-time env
    if (this._buildTime[fieldKey] !== undefined) {
      return this._buildTime[fieldKey];
    }
    return defaultValue;
  }

  private _readBuildTimeEnv(): Record<string, string> {
    const env: Record<string, string> = {};
    // Use globalThis to allow mocking in tests
    const metaEnv =
      typeof import.meta !== "undefined" ? import.meta.env : {};

    if (metaEnv.VITE_API_BASE_URL) {
      env[Fields.API_BASE_URL] = metaEnv.VITE_API_BASE_URL as string;
    }
    if (metaEnv.VITE_LOG_LEVEL) {
      env[Fields.LOG_LEVEL] = metaEnv.VITE_LOG_LEVEL as string;
    }
    if (metaEnv.VITE_I18N_LOCALE) {
      env[Fields.I18N_LOCALE] = metaEnv.VITE_I18N_LOCALE as string;
    }
    return env;
  }

  private async _fetchRuntimeConfig(): Promise<void> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        RUNTIME_FETCH_TIMEOUT_MS,
      );

      const response = await fetch(RUNTIME_CONFIG_URL, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return; // fallback silently
      }

      const data = (await response.json()) as RuntimeConfig;
      this._applyRuntimeConfig(data);
    } catch {
      // Network error or timeout — fall back to build-time values silently
    }
  }

  private _applyRuntimeConfig(data: RuntimeConfig): void {
    if (data.apiBaseUrl) {
      this._runtime[Fields.API_BASE_URL] = data.apiBaseUrl;
    }
    if (data.logLevel) {
      this._runtime[Fields.LOG_LEVEL] = data.logLevel;
    }
    if (data.i18nLocale) {
      this._runtime[Fields.I18N_LOCALE] = data.i18nLocale;
    }
  }

  private _readLocalStorage(fieldKey: string): string | null {
    try {
      return globalThis.localStorage?.getItem(
        `${LOCALSTORAGE_PREFIX}${fieldKey}`,
      ) ?? null;
    } catch {
      return null;
    }
  }

  private _localStorageKeys(): string[] {
    try {
      const keys: string[] = [];
      const storage = globalThis.localStorage;
      if (!storage) return keys;
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k?.startsWith(LOCALSTORAGE_PREFIX)) {
          keys.push(k.slice(LOCALSTORAGE_PREFIX.length));
        }
      }
      return keys;
    } catch {
      return [];
    }
  }
}

/** Pre-created singleton for direct import. */
export const appConfig = AppConfig.getInstance();

/**
 * React hook that returns the appConfig singleton.
 * Triggers a re-render when AppConfig.init() completes after mount.
 */
export function useAppConfig(): AppConfig {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    let cancelled = false;
    AppConfig.init().then(() => {
      if (!cancelled) {
        forceUpdate((n) => n + 1);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return appConfig;
}
