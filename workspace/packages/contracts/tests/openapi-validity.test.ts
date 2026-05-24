import { readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import SwaggerParser from "@apidevtools/swagger-parser";
import { describe, it, expect } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PKG_ROOT = join(__dirname, "..");

function findContractYamls(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      // Skip node_modules, dot dirs, and _shared (those are referenced via
      // $ref, not validated standalone — they have no `paths` block).
      if (entry === "node_modules" || entry.startsWith(".") || entry === "_shared") continue;
      out.push(...findContractYamls(full));
    } else if (entry.endsWith(".contract.yaml")) {
      out.push(full);
    }
  }
  return out;
}

const contractFiles = findContractYamls(PKG_ROOT);

describe("OpenAPI contract YAML files", () => {
  it("discovers at least one contract", () => {
    expect(contractFiles.length).toBeGreaterThan(0);
  });

  for (const file of contractFiles) {
    const rel = relative(PKG_ROOT, file);
    it(`validates ${rel} as OpenAPI 3.1`, async () => {
      // SwaggerParser.validate() both dereferences $refs and validates
      // the result against the OpenAPI 3.x meta-schema. Throws on any
      // structural problem.
      const api = await SwaggerParser.validate(file);
      expect(api.openapi).toMatch(/^3\.[01]\./);
      expect(api.info).toBeDefined();
      expect(api.paths).toBeDefined();
      expect(Object.keys(api.paths ?? {}).length).toBeGreaterThan(0);
    });
  }
});
