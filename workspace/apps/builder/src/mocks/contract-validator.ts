// MSW handler decorator that validates response bodies against the
// contract YAMLs (R42 → R43 → R45). loadSchemas reads YAMLs at
// module load, dereferences cross-file $ref via swagger-parser, and
// compiles each 2xx JSON schema with AJV. withContractValidation
// wraps a handler so drift throws ContractDriftError, caught by
// MSW's unhandledException event and re-surfaced as a test failure
// via tests/setup.ts's buffer-and-drain.
//
// Anchors the TS mock to the YAML, reducing the R41 three-impl
// drift surface (YAML + Python + TS mock) to two. Node-only;
// browser builds tree-shake the mocks tree from prod, and dev-mode
// mocks get debug listeners (start.ts) instead of validation.
//
// All node:* and swagger-parser imports are dynamic inside
// loadSchemas — static imports crash Vite's browser bundle (see
// contracts-root.ts).

import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import type { HttpHandler, HttpResponseResolver } from "msw";
import { http } from "msw";

import { CONTRACTS_ROOT } from "./contracts-root";

// ─── Schema loading ──────────────────────────────────────────────────

// IS_NODE via import.meta.url scheme — see contracts-root.ts.
const IS_NODE = import.meta.url.startsWith("file:");

type OpenApiDoc = {
  paths?: Record<
    string,
    Record<
      string,
      {
        operationId?: string;
        responses?: Record<
          string,
          { content?: { "application/json"?: { schema?: object } } }
        >;
      }
    >
  >;
};

// First 2xx JSON schema. wrappedResolver checks the actual response
// status at request time, so per-code disambiguation isn't needed here.
function pickSuccessSchema(
  op: { responses?: Record<string, { content?: { "application/json"?: { schema?: object } } }> },
): object | null {
  for (const [status, def] of Object.entries(op.responses ?? {})) {
    if (!/^2\d\d$/.test(status)) continue;
    const schema = def.content?.["application/json"]?.schema;
    if (schema) return schema;
  }
  return null;
}

// Side-effect on `map` (vs return) keeps loadSchemas flat for SonarJS.
function registerDocSchemas(
  doc: OpenApiDoc,
  ajv: Ajv,
  map: Map<string, ValidateFunction>,
): void {
  for (const methods of Object.values(doc.paths ?? {})) {
    for (const op of Object.values(methods)) {
      const opId = op.operationId;
      if (!opId) continue;
      const schema = pickSuccessSchema(op);
      if (schema) map.set(opId, ajv.compile(schema));
    }
  }
}

async function loadSchemas(): Promise<Map<string, ValidateFunction>> {
  const map = new Map<string, ValidateFunction>();
  if (!IS_NODE) return map;

  // Dynamic-import keeps node:* and swagger-parser out of Vite's
  // browser static graph (see contracts-root.ts). Parallel to keep
  // first-import latency under the 5s vitest default per-test ceiling.
  const [fs, pathMod, urlMod, swaggerMod] = await Promise.all([
    import("node:fs"),
    import("node:path"),
    import("node:url"),
    import("@apidevtools/swagger-parser"),
  ]);
  const { existsSync, readFileSync, readdirSync } = fs;
  const { resolve } = pathMod;
  const { fileURLToPath, pathToFileURL } = urlMod;
  const SwaggerParser = swaggerMod.default;

  if (!existsSync(CONTRACTS_ROOT)) return map;

  // *.contract.yaml; `_shared/` files (no suffix) follow via $ref.
  // Inlined to close over the dynamic-imported readdirSync / resolve.
  function findContractFiles(root: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      const full = resolve(root, entry.name);
      if (entry.isDirectory()) {
        out.push(...findContractFiles(full));
      } else if (entry.isFile() && entry.name.endsWith(".contract.yaml")) {
        out.push(full);
      }
    }
    return out;
  }

  const ajv = new Ajv({ strict: false, allErrors: true });

  // Force file resolver + disable HTTP: happy-dom shims window.location,
  // so swagger-parser's default heuristic picks the HTTP resolver and
  // tries `http://localhost:3000/<path>`. Explicit readFileSync sidesteps.
  const parserOpts = {
    resolve: {
      http: false as const,
      file: {
        canRead: true,
        read: (file: { url: string }) =>
          readFileSync(fileURLToPath(file.url), "utf8"),
      },
    },
  };

  for (const yamlPath of findContractFiles(CONTRACTS_ROOT)) {
    // dereference inlines cross-file $ref into _shared/ so AJV can
    // compile the schema directly.
    const fileUrl = pathToFileURL(yamlPath).href;
    const doc = (await SwaggerParser.dereference(
      fileUrl,
      parserOpts,
    )) as OpenApiDoc;
    registerDocSchemas(doc, ajv, map);
  }
  return map;
}

// Top-level await: consumers see a populated Map at import time;
// browser short-circuits to the empty map via IS_NODE.
const schemas = await loadSchemas();

// ─── Validator ───────────────────────────────────────────────────────

export type ValidationResult =
  | { ok: true }
  | { ok: false; errors: readonly ErrorObject[] };

export function validateResponse(
  operationId: string,
  body: unknown,
): ValidationResult {
  const validate = schemas.get(operationId);
  if (!validate) return { ok: true }; // no schema → no-op
  if (validate(body)) return { ok: true };
  return { ok: false, errors: validate.errors ?? [] };
}

export class ContractDriftError extends Error {
  constructor(
    public readonly operationId: string,
    public readonly errors: readonly ErrorObject[],
  ) {
    super(
      `ContractDriftError: MSW handler for ${operationId} returned a body ` +
        `that does not match the contract YAML. Errors: ` +
        JSON.stringify(errors, null, 2),
    );
    this.name = "ContractDriftError";
  }
}

// ─── Handler decorator ───────────────────────────────────────────────

type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

// Wrap an MSW handler with 2xx-JSON response-body validation.
// Browser dev (no IS_NODE) returns the response unchanged.
export function withContractValidation(
  method: HttpMethod,
  path: string,
  operationId: string | null,
  resolver: HttpResponseResolver,
): HttpHandler {
  const wrappedResolver: HttpResponseResolver = async (info) => {
    const response = await resolver(info);
    if (!IS_NODE || !operationId) return response;
    if (!(response instanceof Response)) return response;
    // Skip 204, 4xx (loose envelopes), non-JSON.
    if (response.status < 200 || response.status >= 300) return response;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) return response;

    // Clone before consuming so the caller still gets a readable stream.
    const cloned = response.clone();
    let body: unknown;
    try {
      body = await cloned.json();
    } catch {
      return response;
    }
    const result = validateResponse(operationId, body);
    if (!result.ok) {
      throw new ContractDriftError(operationId, result.errors);
    }
    return response;
  };

  return http[method](path, wrappedResolver);
}
