/**
 * AppConfig — Three-layer precedence tests (Spec 013, T020-T025)
 *
 * Layer 1 (lowest):  build-time VITE_* environment variables
 * Layer 2 (middle):  runtime /api/v1/config fetch on AppConfig.init()
 * Layer 3 (highest): localStorage overrides (prefix "cfg:")
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppConfig } from "../appConfig";
import { Const } from "../const";
import { Fields } from "../fields";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRuntimeResponse(body: Record<string, unknown>, ok = true) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(body),
  } as Response);
}

// ── Setup / teardown ───────────────────────────────────────────────────────

beforeEach(() => {
  AppConfig._reset();
  vi.stubGlobal("fetch", vi.fn());
  // Clear localStorage cfg: keys
  Object.keys(localStorage)
    .filter((k) => k.startsWith("cfg:"))
    .forEach((k) => localStorage.removeItem(k));
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── T020: Build-time env (Layer 1) ─────────────────────────────────────────

describe("T020 — Layer 1: build-time env precedence", () => {
  it("returns Const.API_BASE when no VITE_API_BASE_URL is set", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    await AppConfig.init();
    const cfg = AppConfig.getInstance();
    expect(cfg.apiBaseUrl()).toBe(Const.API_BASE);
  });
});

// ── T021: Runtime fetch (Layer 2) overrides build-time ─────────────────────

describe("T021 — Layer 2: runtime config overrides build-time env", () => {
  it("returns runtime value when /api/v1/config responds with apiBaseUrl", async () => {
    const runtimeBase = "https://staging.example.com/api/v1";
    vi.mocked(fetch).mockImplementation((url) => {
      if (String(url).includes("/api/v1/config")) {
        return makeRuntimeResponse({ apiBaseUrl: runtimeBase });
      }
      return Promise.reject(new Error("unexpected fetch"));
    });

    await AppConfig.init();
    expect(AppConfig.getInstance().apiBaseUrl()).toBe(runtimeBase);
  });
});

// ── T022: Runtime fetch failure — graceful fallback ─────────────────────────

describe("T022 — Layer 2: network failure falls back to build-time", () => {
  it("does not throw when fetch rejects; returns Const.API_BASE", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));
    await expect(AppConfig.init()).resolves.not.toThrow();
    expect(AppConfig.getInstance().apiBaseUrl()).toBe(Const.API_BASE);
  });

  it("does not throw when /api/v1/config returns non-200; returns Const.API_BASE", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 503 } as Response);
    await AppConfig.init();
    expect(AppConfig.getInstance().apiBaseUrl()).toBe(Const.API_BASE);
  });
});

// ── T023: localStorage override (Layer 3) — highest precedence ─────────────

describe("T023 — Layer 3: localStorage override wins over runtime + build-time", () => {
  it("returns localStorage override when cfg:api.baseUrl is set", async () => {
    const localOverride = "http://localhost:9999";
    localStorage.setItem(`cfg:${Fields.API_BASE_URL}`, localOverride);

    const runtimeBase = "https://staging.example.com/api/v1";
    vi.mocked(fetch).mockImplementation(() =>
      makeRuntimeResponse({ apiBaseUrl: runtimeBase }),
    );

    await AppConfig.init();
    // localStorage (layer 3) must win over runtime (layer 2)
    expect(AppConfig.getInstance().apiBaseUrl()).toBe(localOverride);
  });
});

// ── T024: appConfig.all() source attribution ───────────────────────────────

describe("T024 — appConfig.all() returns correct source attribution", () => {
  it("attributes each key to its winning layer", async () => {
    // Runtime provides logLevel; localStorage overrides apiBaseUrl.
    const localOverride = "http://localhost:7777";
    localStorage.setItem(`cfg:${Fields.API_BASE_URL}`, localOverride);

    vi.mocked(fetch).mockImplementation(() =>
      makeRuntimeResponse({
        apiBaseUrl: "https://runtime.example.com/api/v1",
        logLevel: "debug",
      }),
    );

    await AppConfig.init();
    const entries = AppConfig.getInstance().all();

    const apiEntry = entries.find((e) => e.key === Fields.API_BASE_URL);
    const logEntry = entries.find((e) => e.key === Fields.LOG_LEVEL);

    // apiBaseUrl is overridden by localStorage
    expect(apiEntry).toBeDefined();
    expect(apiEntry!.source).toBe("localStorage");
    expect(apiEntry!.value).toBe(localOverride);

    // logLevel came from runtime fetch
    expect(logEntry).toBeDefined();
    expect(logEntry!.source).toBe("runtime");
    expect(logEntry!.value).toBe("debug");
  });
});

// ── T025: init() is idempotent ─────────────────────────────────────────────

describe("T025 — AppConfig.init() idempotency", () => {
  it("only calls fetch once even if init() is called multiple times", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    await AppConfig.init();
    await AppConfig.init();
    await AppConfig.init();
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });
});
