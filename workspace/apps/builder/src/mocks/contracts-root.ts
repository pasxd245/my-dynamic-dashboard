// R45: on-disk root of @mdd/contracts. Resolved via Node's package
// resolver so future moves of apps/builder or packages/contracts
// don't invalidate `../../../..` counts at call sites.
//
// All node:* imports MUST be dynamic — Vite externalizes them as
// throw-on-access stubs for the browser bundle; static imports
// crash module-load even when the call site is IS_NODE-gated.
// IS_NODE checks `import.meta.url`'s scheme (file: vs http(s):)
// because both `process` (Vite shim) and `window` (happy-dom shim)
// lie. Browser → CONTRACTS_ROOT = ""; consumers no-op via their
// own gates.

const IS_NODE = import.meta.url.startsWith("file:");

async function loadContractsRoot(): Promise<string> {
  if (!IS_NODE) return "";
  const { createRequire } = await import("node:module");
  const { dirname } = await import("node:path");
  return dirname(
    createRequire(import.meta.url).resolve("@mdd/contracts/package.json"),
  );
}

export const CONTRACTS_ROOT: string = await loadContractsRoot();
