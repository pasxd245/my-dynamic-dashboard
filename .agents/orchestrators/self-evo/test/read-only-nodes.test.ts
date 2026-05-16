import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isInterrupted } from "@langchain/langgraph";
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
import { extractRipgrepPatterns } from "../src/nodes/repo-scanner.js";

// Fake LLM that returns canned JSON keyed off the node `tag`. Each
// node calls llm.complete({tag: "<node>"}) so we can route here
// without parsing the prompt.
class FakeLLM implements LLMClient {
  readonly mode = "subprocess" as const;
  readonly capabilities = { supportsParallel: false, maxConcurrency: 1 };
  public calls: LLMRequest[] = [];
  constructor(private readonly responses: Record<string, string>) {}
  async complete(req: LLMRequest) {
    this.calls.push(req);
    const text = this.responses[req.tag ?? ""];
    if (text === undefined) {
      throw new Error(`FakeLLM: no canned response for tag=${req.tag}`);
    }
    return { text };
  }
}

function makeFakeServices(fake: FakeLLM, workspaceRoot: string): AgentServices {
  const resolver = new LLMResolver(DEFAULT_LLM_CONFIG);
  resolver.for = () => fake;
  resolver.skillsFor = () => [];
  return {
    resolver,
    skillsRoot: "/nonexistent-skills-dir",
    repoRoot: workspaceRoot,
    workspaceRoot,
  };
}

async function withTempRoot<T>(fn: (root: string) => Promise<T>): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), "selfevo-rc-"));
  try {
    return await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("repo-scanner keyword extraction picks quoted phrases first", () => {
  const patterns = extractRipgrepPatterns({
    topic: 'Replace "upload-flow" state machine',
    requirements: [
      { id: "R01", text: 'Keep "uploadStageModel" intact' },
      { id: "R02", text: "boundary: builder upload" },
    ],
  } as any);
  assert.ok(patterns.includes("upload-flow"));
  assert.ok(patterns.includes("uploadStageModel"));
  assert.ok(patterns.length <= 8);
});

test("read-only nodes walk end-to-end with a fake LLM and pause at HITL", async () => {
  await withTempRoot(async (root) => {
    const runId = newRunId();
    const layout = layoutFor(runId, root);
    await ensureWorkspace(layout);

    const fake = new FakeLLM({
      "repo-scanner": JSON.stringify({
        findings: [
          { source: "apps/builder/x.ts", claim: "uses upload-flow", evidence: "line 12" },
          { source: "inference", claim: "tests must stay green", evidence: "PDCA rule" },
        ],
      }),
      "boundary-scoper": JSON.stringify({
        inScope: ["upload-flow state machine"],
        outScope: ["dashboard"],
        assumptions: ["tests are green at HEAD"],
        allowedFiles: ["apps/builder/src/components/upload-flow/**"],
      }),
      "change-classifier": JSON.stringify({
        changeType: "refactor",
        reason: "behaviour-preserving",
      }),
      "plan-writer": JSON.stringify({
        plan: [
          { id: "P1", text: "Extract state model into pure function" },
          { id: "P2", text: "Rewire UploadFlowPage to consume it" },
        ],
      }),
      "patch-author": '{"diffs":[]}',
    });

    const services = makeFakeServices(fake, layout.root);
    const checkpointer = makeCheckpointer(layout);
    const graph = compileGraph(services, checkpointer);
    const cfg = { configurable: { thread_id: runId } };

    const result = await graph.invoke(
      {
        runId,
        topic: "Replace upload-flow state machine",
        requirements: [
          { id: "R01", text: 'Keep "uploadStageModel" intact' },
        ],
      },
      cfg,
    );

    assert.equal(isInterrupted(result), true, "pauses at HITL");

    const snap = await graph.getState(cfg);
    const values = snap.values as {
      findings: unknown[];
      scope: { allowedFiles: string[] };
      changeType: string;
      plan: Array<{ id: string; text: string; done: boolean }>;
    };
    assert.equal(values.findings.length, 2);
    assert.equal(
      values.scope.allowedFiles[0],
      "apps/builder/src/components/upload-flow/**",
    );
    assert.equal(values.changeType, "refactor");
    assert.equal(values.plan.length, 2);
    const first = values.plan[0];
    assert.ok(first, "plan[0] exists");
    assert.equal(first.id, "P1");
    assert.equal(first.done, false);

    // Verify each real node hit the fake LLM exactly once.
    const cmp = (a: string, b: string) => a.localeCompare(b);
    const tags = fake.calls
      .map((c) => c.tag ?? "")
      .toSorted(cmp);
    const expected = [
      "boundary-scoper",
      "change-classifier",
      "patch-author",
      "plan-writer",
      "repo-scanner",
    ].toSorted(cmp);
    assert.deepEqual(tags, expected);
  });
});

test("change-classifier falls back to 'spike' on unknown label", async () => {
  await withTempRoot(async (root) => {
    const runId = newRunId();
    const layout = layoutFor(runId, root);
    await ensureWorkspace(layout);

    const fake = new FakeLLM({
      "repo-scanner": '{"findings":[]}',
      "boundary-scoper": '{"inScope":[],"outScope":[],"assumptions":[],"allowedFiles":[]}',
      "change-classifier": '{"changeType":"banana","reason":"nope"}',
      "plan-writer": '{"plan":[]}',
      "patch-author": '{"diffs":[]}',
    });

    const services = makeFakeServices(fake, layout.root);
    const checkpointer = makeCheckpointer(layout);
    const graph = compileGraph(services, checkpointer);
    const cfg = { configurable: { thread_id: runId } };

    await graph.invoke({ runId, topic: "x", requirements: [] }, cfg);
    const snap = await graph.getState(cfg);
    assert.equal((snap.values as { changeType: string }).changeType, "spike");
  });
});

test("repo-scanner tolerates fence-wrapped JSON", async () => {
  await withTempRoot(async (root) => {
    const runId = newRunId();
    const layout = layoutFor(runId, root);
    await ensureWorkspace(layout);

    const fake = new FakeLLM({
      "repo-scanner":
        "Here you go:\n```json\n" +
        JSON.stringify({
          findings: [{ source: "inference", claim: "ok", evidence: "yes" }],
        }) +
        "\n```\n",
      "boundary-scoper": '{"inScope":[],"outScope":[],"assumptions":[],"allowedFiles":[]}',
      "change-classifier": '{"changeType":"doc"}',
      "plan-writer": '{"plan":[]}',
      "patch-author": '{"diffs":[]}',
    });

    const services = makeFakeServices(fake, layout.root);
    const checkpointer = makeCheckpointer(layout);
    const graph = compileGraph(services, checkpointer);
    const cfg = { configurable: { thread_id: runId } };

    await graph.invoke({ runId, topic: "fences", requirements: [] }, cfg);
    const snap = await graph.getState(cfg);
    const findings = (snap.values as { findings: unknown[] }).findings;
    assert.equal(findings.length, 1);
  });
});
