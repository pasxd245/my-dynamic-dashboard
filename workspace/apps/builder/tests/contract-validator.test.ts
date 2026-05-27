// R43: stress-test the R42 MSW contract validator. Drive the validator
// through deliberate handler-drift scenarios via `server.use(...)`
// overrides and assert each fires `ContractDriftError` with a useful
// `instancePath`. R42 landed the validator but never exercised the
// failure path; today's `getDatasetRows` handler conforms, so the
// drift-detector has been dormant. This file proves it fires.
//
// MSW v2 swallows resolver throws; R43 added a buffer in
// `tests/setup.ts` (`mswUnhandledExceptions`) that surfaces handler
// exceptions as test failures. These tests drain that buffer locally
// so they can assert on the captured `ContractDriftError` instead of
// letting it fail the afterEach guard.
//
// Passthrough regression: confirm 204 / 4xx / non-JSON responses
// still bypass the validator unwrapped, so R42's content-type and
// status-code guards in `contract-validator.ts:140-144` don't
// silently break.

import { HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import {
  ContractDriftError,
  validateResponse,
  withContractValidation,
} from "@/mocks/contract-validator";
import { MOCK_DATASET } from "@/mocks/fixtures";
import { server } from "@/mocks/server";

import { mswUnhandledExceptions } from "./setup";

// R45: every JSON-2xx handler in src/mocks/handlers.ts is wrapped
// with `withContractValidation` using one of these operationIds.
// The coverage smoke test below asserts the validator has a loaded
// schema for each — proving (a) the contract YAML compiled, (b)
// AJV rejects an obviously-wrong body. If a new handler is wrapped
// in handlers.ts, add its operationId here.
const WRAPPED_OPS = [
  "listWorkspaces",
  "createWorkspace",
  "renameWorkspace",
  "listDatasets",
  "getDataset",
  "renameDataset",
  "getDatasetRows",
  "commitDatasetsBatch",
  "createTempUpload",
  "parseTempUpload",
] as const;

const ROWS_PATH = "*/datasets/:id/rows";
const OP_ID = "getDatasetRows";
const URL = `http://localhost:8000/datasets/${MOCK_DATASET.id}/rows`;

// A well-formed response body, used as the base for negative
// scenarios that selectively drift one field.
const WELL_FORMED = {
  rows: [["D-0001", "12400", "2026-03-01", "won", "0.95", "true", "2026-02-28T14:02:00Z", "quick close, no contention"]],
  page: 1,
  pageSize: 50,
  total: 1,
};

// Trigger the override, then drain the MSW exception buffer (so the
// setup.ts afterEach guard sees an empty queue) and return the single
// captured ContractDriftError. Fails the test if zero or >1 errors
// were captured.
async function captureDrift(): Promise<ContractDriftError> {
  await fetch(URL);
  const errs = mswUnhandledExceptions.splice(0);
  expect(errs).toHaveLength(1);
  expect(errs[0]).toBeInstanceOf(ContractDriftError);
  return errs[0] as ContractDriftError;
}

describe("MSW contract validator — drift scenarios fire ContractDriftError", () => {
  it("positive control: well-formed override passes the validator", async () => {
    server.use(
      withContractValidation("get", ROWS_PATH, OP_ID, () =>
        HttpResponse.json(WELL_FORMED),
      ),
    );
    const res = await fetch(URL);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(mswUnhandledExceptions).toHaveLength(0);
  });

  it("drift: missing required field (`total` dropped) throws", async () => {
    const { total: _drop, ...withoutTotal } = WELL_FORMED;
    server.use(
      withContractValidation("get", ROWS_PATH, OP_ID, () =>
        HttpResponse.json(withoutTotal),
      ),
    );
    const err = await captureDrift();
    expect(err.operationId).toBe(OP_ID);
    expect(err.errors[0].keyword).toBe("required");
    expect(err.errors[0].params.missingProperty).toBe("total");
  });

  it("drift: wrong type (`total` as string instead of integer) throws", async () => {
    server.use(
      withContractValidation("get", ROWS_PATH, OP_ID, () =>
        HttpResponse.json({ ...WELL_FORMED, total: "1" }),
      ),
    );
    const err = await captureDrift();
    expect(err.errors[0].keyword).toBe("type");
    expect(err.errors[0].instancePath).toBe("/total");
  });

  it("drift: extra property violates `additionalProperties: false`", async () => {
    server.use(
      withContractValidation("get", ROWS_PATH, OP_ID, () =>
        HttpResponse.json({ ...WELL_FORMED, unexpected: "key" }),
      ),
    );
    const err = await captureDrift();
    expect(err.errors[0].keyword).toBe("additionalProperties");
    expect(err.errors[0].params.additionalProperty).toBe("unexpected");
  });

  it("drift: wrong nested shape (cells as objects, not arrays) throws", async () => {
    server.use(
      withContractValidation("get", ROWS_PATH, OP_ID, () =>
        HttpResponse.json({
          ...WELL_FORMED,
          rows: [{ id: "D-0001", amount: "12400" }],
        }),
      ),
    );
    const err = await captureDrift();
    // The first AJV error points into /rows/0 — the row item that
    // failed the `items: { type: array }` constraint.
    expect(err.errors[0].instancePath).toBe("/rows/0");
    expect(err.errors[0].keyword).toBe("type");
  });
});

describe("MSW contract validator — passthrough regression (R42 guards)", () => {
  it("204 no-content response bypasses validation", async () => {
    server.use(
      withContractValidation(
        "get",
        ROWS_PATH,
        OP_ID,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    const res = await fetch(URL);
    expect(res.status).toBe(204);
    expect(mswUnhandledExceptions).toHaveLength(0);
  });

  it("4xx response bypasses validation (loose envelope)", async () => {
    server.use(
      withContractValidation("get", ROWS_PATH, OP_ID, () =>
        HttpResponse.json(
          { detail: [{ msg: "bad", type: "value_error", loc: [] }] },
          { status: 422 },
        ),
      ),
    );
    const res = await fetch(URL);
    expect(res.status).toBe(422);
    // Even though the body shape doesn't match the rows-get 200 schema,
    // the validator skips because the response is non-2xx — proves
    // the status guard at contract-validator.ts:142 still works.
    const body = await res.json();
    expect(body.detail).toBeDefined();
    expect(mswUnhandledExceptions).toHaveLength(0);
  });

  it("non-JSON 200 response bypasses validation (content-type guard)", async () => {
    server.use(
      withContractValidation(
        "get",
        ROWS_PATH,
        OP_ID,
        () =>
          new HttpResponse("not-json-body", {
            status: 200,
            headers: { "content-type": "text/plain" },
          }),
      ),
    );
    const res = await fetch(URL);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("not-json-body");
    expect(mswUnhandledExceptions).toHaveLength(0);
  });
});

describe("MSW contract validator — coverage smoke (R45)", () => {
  // Direct probe of `validateResponse`: bypass MSW. For every wrapped
  // operationId, prove (a) the schema loaded from the contract YAML,
  // (b) AJV rejects an obviously-wrong body. The single negative
  // assertion combines both — `ok: true` would mean either the
  // schema didn't load (no validator → no-op true) or AJV thought
  // `{ obviously: 'wrong' }` was acceptable (catastrophic). Either
  // failure mode fails the test.
  it.each(WRAPPED_OPS)(
    "%s has a loaded schema that rejects obviously-wrong bodies",
    (opId) => {
      const result = validateResponse(opId, { obviously: "wrong" });
      expect(result.ok).toBe(false);
    },
  );
});
