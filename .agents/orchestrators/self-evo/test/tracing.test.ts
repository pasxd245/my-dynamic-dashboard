import test from "node:test";
import assert from "node:assert/strict";
import { traceableInvokeConfig, tracingEnabled } from "../src/tracing.js";

test("traceableInvokeConfig tags every invoke with runId-derived metadata", () => {
  const cfg = traceableInvokeConfig("2026-05-17-12-00-00-abcd");
  assert.equal(cfg.configurable.thread_id, "2026-05-17-12-00-00-abcd");
  assert.equal(cfg.runName, "self-evo:2026-05-17-12-00-00-abcd");
  assert.ok(cfg.tags.includes("self-evo"));
  assert.ok(cfg.tags.includes("run:2026-05-17-12-00-00-abcd"));
  assert.equal(cfg.metadata.orchestrator, "self-evo");
  assert.equal(cfg.metadata.runId, "2026-05-17-12-00-00-abcd");
});

test("tracingEnabled reflects LANGCHAIN_TRACING_V2", () => {
  const prev = process.env.LANGCHAIN_TRACING_V2;
  try {
    delete process.env.LANGCHAIN_TRACING_V2;
    assert.equal(tracingEnabled(), false);
    process.env.LANGCHAIN_TRACING_V2 = "true";
    assert.equal(tracingEnabled(), true);
    process.env.LANGCHAIN_TRACING_V2 = "1";
    assert.equal(tracingEnabled(), true);
    process.env.LANGCHAIN_TRACING_V2 = "false";
    assert.equal(tracingEnabled(), false);
  } finally {
    if (prev === undefined) delete process.env.LANGCHAIN_TRACING_V2;
    else process.env.LANGCHAIN_TRACING_V2 = prev;
  }
});
