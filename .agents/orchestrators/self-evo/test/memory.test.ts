import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isInterrupted } from "@langchain/langgraph";
import { InMemoryMemoryClient } from "../src/memory/in-memory.js";
import { FileMemoryClient } from "../src/memory/file.js";
import { buildMemoryClient } from "../src/memory/factory.js";
import { overlapScore, tokenize } from "../src/memory/scoring.js";
import { SELF_EVO_USER_ID } from "../src/memory/types.js";
import { compileGraph } from "../src/graph.js";
import {
  ensureWorkspace,
  layoutFor,
  newRunId,
} from "../src/persistence/workspace.js";
import { makeCheckpointer } from "../src/persistence/checkpointer.js";
import { LLMResolver, DEFAULT_LLM_CONFIG } from "../src/llm/resolver.js";
import type { AgentServices } from "../src/agent-services.js";
import type { LLMClient, LLMRequest } from "../src/llm/client.js";

class FakeLLM implements LLMClient {
  readonly mode = "subprocess" as const;
  readonly capabilities = { supportsParallel: false, maxConcurrency: 1 };
  constructor(private readonly canned: Record<string, string>) {}
  async complete(req: LLMRequest) {
    const text = this.canned[req.tag ?? ""];
    if (!text) throw new Error(`no canned for ${req.tag}`);
    return { text };
  }
}

const CANNED_LLM_ALL_EMPTY = {
  "repo-scanner": '{"findings":[]}',
  "boundary-scoper": '{"inScope":[],"outScope":[],"assumptions":[],"allowedFiles":[]}',
  "change-classifier": '{"changeType":"spike"}',
  "plan-writer": '{"plan":[]}',
  "patch-author": '{"diffs":[]}',
};

function servicesWithMemory(
  mem: AgentServices["memory"],
  workspaceRoot: string,
): AgentServices {
  const resolver = new LLMResolver(DEFAULT_LLM_CONFIG);
  const llm = new FakeLLM(CANNED_LLM_ALL_EMPTY);
  resolver.for = () => llm;
  resolver.skillsFor = () => [];
  return {
    resolver,
    skillsRoot: "/nonexistent",
    repoRoot: workspaceRoot,
    workspaceRoot,
    memory: mem,
  };
}

test("scoring: tokenize drops stopwords, short tokens, numerics", () => {
  const toks = tokenize("The upload-flow state machine is broken at 1234");
  assert.deepEqual(toks.sort(), ["broken", "flow", "machine", "state", "upload"].sort());
});

test("scoring: overlapScore returns 0 for disjoint, > 0 for shared tokens", () => {
  assert.equal(overlapScore("apple banana cherry", "xyz"), 0);
  assert.ok(overlapScore("upload flow", "the upload flow is broken") > 0);
  assert.equal(overlapScore("", "anything"), 0);
});

test("InMemoryMemoryClient: add → search → list round-trip", async () => {
  const mem = new InMemoryMemoryClient();
  await mem.add({
    text: "Upload-flow state machine refactored in Round 12",
    user_id: SELF_EVO_USER_ID,
    metadata: { round: 12, type: "decision" },
  });
  await mem.add({
    text: "Dashboard typecheck broke after polars upgrade",
    user_id: SELF_EVO_USER_ID,
    metadata: { round: 13, type: "pitfall" },
  });
  await mem.add({
    text: "Unrelated other-user note",
    user_id: "other",
    metadata: {},
  });

  const all = await mem.list({ user_id: SELF_EVO_USER_ID });
  assert.equal(all.length, 2);

  const hits = await mem.search("upload flow", { user_id: SELF_EVO_USER_ID });
  assert.equal(hits.length, 1);
  assert.match(hits[0]!.text, /Upload-flow/);
  assert.ok((hits[0]!.score ?? 0) > 0);

  // Type filter
  const onlyPitfall = await mem.list({ user_id: SELF_EVO_USER_ID, type: "pitfall" });
  assert.equal(onlyPitfall.length, 1);
});

test("InMemoryMemoryClient: namespace isolation by user_id", async () => {
  const mem = new InMemoryMemoryClient();
  await mem.add({ text: "x", user_id: "a", metadata: {} });
  await mem.add({ text: "y", user_id: "b", metadata: {} });
  const a = await mem.list({ user_id: "a" });
  assert.equal(a.length, 1);
  assert.equal(a[0]!.text, "x");
});

test("FileMemoryClient: writes JSONL, reads back across instances", async () => {
  const root = await mkdtemp(join(tmpdir(), "selfevo-mem0-"));
  try {
    const path = join(root, "memories.jsonl");
    const a = new FileMemoryClient({ path });
    await a.add({
      text: "Polars 1.x broke schema inference in upload",
      user_id: SELF_EVO_USER_ID,
      metadata: { round: 7, type: "pitfall" },
    });
    await a.add({
      text: "Use stub-mode smoke for builder PRs",
      user_id: SELF_EVO_USER_ID,
      metadata: { round: 9, type: "convention" },
    });

    // Different instance — must see the same records.
    const b = new FileMemoryClient({ path });
    const hits = await b.search("polars schema", { user_id: SELF_EVO_USER_ID });
    assert.equal(hits.length, 1);
    assert.match(hits[0]!.text, /Polars/);

    const all = await b.list({ user_id: SELF_EVO_USER_ID });
    assert.equal(all.length, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("FileMemoryClient: malformed lines don't crash readAll", async () => {
  const root = await mkdtemp(join(tmpdir(), "selfevo-mem0-"));
  try {
    const path = join(root, "memories.jsonl");
    const c = new FileMemoryClient({ path });
    await c.add({ text: "good", user_id: SELF_EVO_USER_ID });
    // Manually append a bad line.
    const { appendFile } = await import("node:fs/promises");
    await appendFile(path, "not-json\n", "utf8");
    const all = await c.list({ user_id: SELF_EVO_USER_ID });
    assert.equal(all.length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("factory: builds InMemory for mode=memory, File for mode=file, throws for cloud", () => {
  const a = buildMemoryClient({ mode: "memory" });
  assert.equal(a.mode, "memory");
  const b = buildMemoryClient({ mode: "file", file: "/tmp/x.jsonl" });
  assert.equal(b.mode, "file");
  assert.throws(() => buildMemoryClient({ mode: "cloud" }));
});

test("intake populates priorMemories when services.memory is wired", async () => {
  const root = await mkdtemp(join(tmpdir(), "selfevo-rd-"));
  try {
    const mem = new InMemoryMemoryClient();
    await mem.add({
      text: "upload-flow state model lives in uploadStageModel.ts",
      user_id: SELF_EVO_USER_ID,
      metadata: { round: 40, type: "convention" },
    });

    const runId = newRunId();
    const layout = layoutFor(runId, root);
    await ensureWorkspace(layout);
    const services = servicesWithMemory(mem, root);
    const graph = compileGraph(services, makeCheckpointer(layout));
    const cfg = { configurable: { thread_id: runId } };

    const result = await graph.invoke(
      {
        runId,
        topic: "Replace upload-flow state model",
        requirements: [{ id: "R01", text: "Keep uploadStageModel intact" }],
      },
      cfg,
    );

    assert.equal(isInterrupted(result), true);
    const snap = await graph.getState(cfg);
    const priors = (snap.values as { priorMemories: { text: string }[] }).priorMemories;
    assert.equal(priors.length, 1);
    assert.match(priors[0]!.text, /uploadStageModel/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("intake yields empty priorMemories when services.memory is undefined", async () => {
  const root = await mkdtemp(join(tmpdir(), "selfevo-rd-"));
  try {
    const runId = newRunId();
    const layout = layoutFor(runId, root);
    await ensureWorkspace(layout);
    const services = servicesWithMemory(undefined, root);
    const graph = compileGraph(services, makeCheckpointer(layout));
    const cfg = { configurable: { thread_id: runId } };

    await graph.invoke(
      { runId, topic: "anything", requirements: [] },
      cfg,
    );
    const snap = await graph.getState(cfg);
    const priors = (snap.values as { priorMemories: unknown[] }).priorMemories;
    assert.equal(priors.length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
