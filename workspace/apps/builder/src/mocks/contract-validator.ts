// R42: schema-validate MSW handler responses against the contract YAML.
//
// Scope: Node-only (vitest). Browser dev mode gets debug listeners
// instead (see start.ts) — bundling AJV + YAML files into the dev
// browser bundle is more weight than the warning is worth, and tree-
// shaking handles the production case for free.
//
// The validator reads contract YAMLs from disk at first use, extracts
// each 200-response schema keyed by operationId, and exposes a
// `withContractValidation(...)` decorator that wraps an MSW handler:
// after the handler returns, the response body is intercepted, parsed,
// validated, and either throws (test mode) or warns (dev — N/A in
// Node) on schema drift.
//
// Failure mode this guards against: FE mock handlers silently return
// a wrong-shaped body. FE tests pass against the mock, but the real
// BE response would fail to parse. R41 had three implementations of
// each contract (YAML, Python, TS mock); this anchors the TS mock to
// the YAML so the drift surface is reduced to two.

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import { load as parseYaml } from "js-yaml";
import type { HttpHandler, HttpResponseResolver } from "msw";
import { http } from "msw";

// ─── Schema loading ──────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// src/mocks → builder → apps → workspace → packages/contracts
const CONTRACTS_ROOT = resolve(__dirname, "../../../../packages/contracts");

// R43 fix: detect Node by `process.versions.node`, not `!window`.
// Vitest uses happy-dom which shims `window` globally — under the
// previous check, IS_NODE was always false in tests and `loadSchemas`
// short-circuited to an empty map, so the validator silently no-op'd
// since R42 landed. Real browser builds have neither `process` nor a
// readable filesystem; `node:fs` imports are stubbed by Vite for the
// browser bundle.
const IS_NODE =
  typeof process !== "undefined" && typeof process.versions?.node === "string";

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

let schemasByOperationId: Map<string, ValidateFunction> | null = null;

function loadSchemas(): Map<string, ValidateFunction> {
  if (schemasByOperationId) return schemasByOperationId;
  schemasByOperationId = new Map();

  if (!IS_NODE) return schemasByOperationId;
  if (!existsSync(CONTRACTS_ROOT)) return schemasByOperationId;

  const ajv = new Ajv({ strict: false, allErrors: true });

  // R42 scope: validate the rows-get response (the most complex of
  // the dataset contracts). Other contracts use $ref into _shared/
  // which would need a dereferencer; deferred until the validation
  // surfaces a real bug worth the additional work.
  const yamlPath = resolve(
    CONTRACTS_ROOT,
    "datasets/rows-get.contract.yaml",
  );
  if (!existsSync(yamlPath)) return schemasByOperationId;

  const doc = parseYaml(readFileSync(yamlPath, "utf8")) as OpenApiDoc;
  for (const methods of Object.values(doc.paths ?? {})) {
    for (const op of Object.values(methods)) {
      const opId = op.operationId;
      const schema = op.responses?.["200"]?.content?.["application/json"]?.schema;
      if (opId && schema) {
        schemasByOperationId.set(opId, ajv.compile(schema));
      }
    }
  }

  return schemasByOperationId;
}

// ─── Validator ───────────────────────────────────────────────────────

export type ValidationResult =
  | { ok: true }
  | { ok: false; errors: readonly ErrorObject[] };

export function validateResponse(
  operationId: string,
  body: unknown,
): ValidationResult {
  const schemas = loadSchemas();
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

/**
 * Wrap an MSW HTTP handler with response-body schema validation.
 * Failure mode: throws ContractDriftError in test, returns the
 * response unchanged otherwise. Non-Node environments (browser dev
 * mode) skip validation — schemas aren't loaded there.
 */
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
    // 2xx JSON only — skip 204, 4xx (loose envelopes), non-JSON.
    if (response.status < 200 || response.status >= 300) return response;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) return response;

    // Clone before consuming the body so the caller still gets a
    // readable stream.
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
