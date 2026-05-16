import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, stat, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command, isInterrupted } from "@langchain/langgraph";
import { compileGraph } from "../src/graph.js";
import {
  ensureWorkspace,
  layoutFor,
  newRunId,
  writeStateSnapshot,
} from "../src/persistence/workspace.js";
import { makeCheckpointer } from "../src/persistence/checkpointer.js";
import { LLMResolver, DEFAULT_LLM_CONFIG } from "../src/llm/resolver.js";
import type { AgentServices } from "../src/agent-services.js";
import type { LLMClient } from "../src/llm/client.js";

// Skeleton tests don't exercise real LLM calls — the read-only nodes
// branch on "if LLM, call it" and the in-R-A stubs short-circuit
// before the LLM is touched. But the resolver is constructed eagerly,
// so we replace `for(node)` with a noop client to be safe.
class StubLLM implements LLMClient {
  readonly mode = "subprocess" as const;
  readonly capabilities = { supportsParallel: false, maxConcurrency: 1 };
  async complete() {
    return { text: '{"findings":[],"plan":[],"changeType":"spike","inScope":[],"outScope":[],"assumptions":[],"allowedFiles":[]}' };
  }
}

function stubServices(workspaceRoot: string): AgentServices {
  const resolver = new LLMResolver(DEFAULT_LLM_CONFIG);
  // Monkey-patch `for` to always return the stub.
  resolver.for = () => new StubLLM();
  resolver.skillsFor = () => [];
  return {
    resolver,
    skillsRoot: "/nonexistent-skills-dir",
    repoRoot: workspaceRoot,
    workspaceRoot,
  };
}

async function withTempRun<T>(
  fn: (ctx: { runId: string; layout: ReturnType<typeof layoutFor> }) => Promise<T>,
): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), "selfevo-r-a-"));
  try {
    const runId = newRunId();
    const layout = layoutFor(runId, root);
    await ensureWorkspace(layout);
    return await fn({ runId, layout });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("graph pauses at HITL after walking every stub node", async () => {
  await withTempRun(async ({ runId, layout }) => {
    const checkpointer = makeCheckpointer(layout);
    const graph = compileGraph(stubServices(layout.root), checkpointer);
    const cfg = { configurable: { thread_id: runId } };

    const result = await graph.invoke(
      {
        runId,
        topic: "smoke",
        requirements: [{ id: "R01", text: "stub" }],
      },
      cfg,
    );
    assert.equal(
      isInterrupted(result),
      true,
      "expected graph to interrupt at hitl",
    );

    const snap = await graph.getState(cfg);
    await writeStateSnapshot(layout, snap.values);

    // state.json + checkpoint.sqlite must exist.
    const s1 = await stat(layout.statePath);
    assert.ok(s1.isFile(), "state.json was written");
    const s2 = await stat(layout.checkpointPath);
    assert.ok(s2.isFile(), "checkpoint.sqlite was written");

    // Intake stamped the topic + requirements.
    const persisted = JSON.parse(await readFile(layout.statePath, "utf8"));
    assert.equal(persisted.topic, "smoke");
    assert.equal(persisted.requirements.length, 1);
    assert.equal(persisted.requirements[0].id, "R01");
    // Judge stub approved.
    assert.equal(persisted.verdict?.verdict, "approve");
  });
});

test("resume with approve runs to END", async () => {
  await withTempRun(async ({ runId, layout }) => {
    const checkpointer = makeCheckpointer(layout);
    const graph = compileGraph(stubServices(layout.root), checkpointer);
    const cfg = { configurable: { thread_id: runId } };

    await graph.invoke(
      { runId, topic: "smoke", requirements: [] },
      cfg,
    );
    const out = await graph.invoke(
      new Command({ resume: { kind: "approve" } }),
      cfg,
    );
    assert.equal(isInterrupted(out), false, "second pass should run to END");
    assert.equal(out.hitl?.kind, "approve");
  });
});

test("resume with revise <stage> resets downstream fields", async () => {
  await withTempRun(async ({ runId, layout }) => {
    const checkpointer = makeCheckpointer(layout);
    const graph = compileGraph(stubServices(layout.root), checkpointer);
    const cfg = { configurable: { thread_id: runId } };

    await graph.invoke(
      { runId, topic: "smoke", requirements: [] },
      cfg,
    );

    // Revise from plan-writer; graph should walk plan-writer →
    // patch-author → verifier → judge → hitl-gate again and pause.
    const out = await graph.invoke(
      new Command({ resume: { kind: "revise", stage: "plan-writer" } }),
      cfg,
    );
    assert.equal(
      isInterrupted(out),
      true,
      "expected second HITL pause after revise",
    );
  });
});
