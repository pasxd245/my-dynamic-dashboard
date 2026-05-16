import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command, isInterrupted } from "@langchain/langgraph";
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
import type { Command as ShellCommand } from "../src/tools/shell.js";
import { makeJudgeNode } from "../src/nodes/judge.js";
import { makeRoundWriterNode } from "../src/nodes/round-writer.js";
import { renderRoundMarkdown } from "../src/renderers/round-template.js";
import { InMemoryMemoryClient } from "../src/memory/in-memory.js";
import type { SelfEvoStateT } from "../src/state.js";

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

const PASS: ShellCommand = { bin: "true", args: [] };

function completeState(overrides: Partial<SelfEvoStateT> = {}): SelfEvoStateT {
  return {
    runId: "r-test",
    topic: "Test round",
    requirements: [{ id: "R01", text: "ensure x" }],
    priorMemories: [],
    findings: [
      { source: "inference", claim: "x is required", evidence: "stated" },
    ],
    scope: {
      inScope: ["src"],
      outScope: [],
      assumptions: ["tests are green at HEAD"],
      allowedFiles: ["src/**"],
    },
    changeType: "feature",
    plan: [{ id: "P1", text: "do x", done: false }],
    patches: [],
    verification: {
      checks: [{ name: "lint", status: "pass", durationMs: 5 }],
      failureExcerpts: [],
    },
    appliedVerification: undefined,
    appliedWorktree: undefined,
    verdict: undefined,
    hitl: undefined,
    round: undefined,
    judgeIterations: 0,
    ...overrides,
  };
}

test("judge: approves when scorecard >= threshold", async () => {
  const node = makeJudgeNode({} as AgentServices, {
    approveThreshold: 0.8,
    maxIterations: 3,
  });
  const out = await node(completeState());
  assert.equal(out.verdict?.verdict, "approve");
  assert.ok((out.verdict?.score ?? 0) >= 0.8);
  assert.equal(out.judgeIterations, 1);
});

test("judge: refines and points revertTo at the weakest failed stage", async () => {
  const node = makeJudgeNode({} as AgentServices, {
    approveThreshold: 0.8,
    maxIterations: 3,
  });
  // Drop scope + flag a failed check; score = 3/5 = 0.6 < 0.8 → refine.
  // First failed dim in pipeline order is boundary-scoper.
  const out = await node(
    completeState({
      scope: undefined,
      verification: {
        checks: [{ name: "lint", status: "fail", durationMs: 1, excerpt: "x" }],
        failureExcerpts: ["[lint] x"],
      },
    }),
  );
  assert.equal(out.verdict?.verdict, "refine");
  assert.equal(out.verdict?.revertTo, "boundary-scoper");
});

test("judge: force-approves once maxIterations cap is reached", async () => {
  const node = makeJudgeNode({} as AgentServices, {
    approveThreshold: 0.99, // basically impossible
    maxIterations: 2,
  });
  const state = completeState({ scope: undefined, plan: [], findings: [] });
  // First call → refine, judgeIterations becomes 1.
  const r1 = await node(state);
  assert.equal(r1.verdict?.verdict, "refine");
  assert.equal(r1.judgeIterations, 1);
  // Second call → cap hits, force approve.
  const r2 = await node({ ...state, judgeIterations: 1 });
  assert.equal(r2.verdict?.verdict, "approve");
  assert.match(r2.verdict?.notes.join(" ") ?? "", /reflection cap/);
});

test("round-template: renders all PDCA sections from state", () => {
  const md = renderRoundMarkdown(completeState(), {
    number: 41,
    startedAt: "2026-05-17",
  });
  assert.match(md, /^# Round 41: Test round/m);
  assert.match(md, /\*\*Status\*\*: Review/);
  assert.match(md, /\*\*Date started\*\*: 2026-05-17/);
  assert.match(md, /## Goal/);
  assert.match(md, /## Plan/);
  assert.match(md, /- \[ \] \*\*P1\*\* — do x/);
  assert.match(md, /## Do/);
  assert.match(md, /### Findings \(1\)/);
  assert.match(md, /### Change type: `feature`/);
  assert.match(md, /## Check/);
  assert.match(md, /\*\*lint\*\* — pass/);
  assert.match(md, /## Act/);
  assert.match(md, /Promotions/);
});

test("round-template: failure excerpts land under Check as fenced blocks", () => {
  const state = completeState({
    verification: {
      checks: [
        { name: "lint", status: "pass", durationMs: 5 },
        {
          name: "tests",
          status: "fail",
          durationMs: 12,
          excerpt: "AssertionError: nope",
        },
      ],
      failureExcerpts: ["[tests] AssertionError: nope"],
    },
  });
  const md = renderRoundMarkdown(state, { number: 1 });
  assert.match(md, /Failure excerpts/);
  assert.match(md, /AssertionError: nope/);
});

test("round-writer: mints next round number; existing Round_NN files bump the counter", async () => {
  const repo = await mkdtemp(join(tmpdir(), "selfevo-rg-"));
  try {
    const cyclesDir = join(repo, ".agents/plan/cycles");
    await mkdir(cyclesDir, { recursive: true });
    await writeFile(join(cyclesDir, "Round_01.md"), "# Round 01\n", "utf8");
    await writeFile(join(cyclesDir, "Round_07.md"), "# Round 07\n", "utf8");
    await writeFile(join(cyclesDir, "not-a-round.md"), "x", "utf8");

    const services: AgentServices = {
      resolver: new LLMResolver(DEFAULT_LLM_CONFIG),
      skillsRoot: "/nonexistent",
      repoRoot: repo,
      workspaceRoot: repo,
    };
    const node = makeRoundWriterNode(services);
    const out = await node(completeState());
    assert.equal(out.round?.number, 8);
    assert.match(out.round?.path ?? "", /Round_08\.md$/);

    const written = await readFile(out.round!.path, "utf8");
    assert.match(written, /^# Round 08: Test round/m);

    const promo = await readFile(join(repo, ".agents/plan/promotions.md"), "utf8");
    assert.match(promo, /Test round/);
    assert.match(promo, /self-evo \(auto\)/);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("round-writer: persists derived memories into services.memory", async () => {
  const repo = await mkdtemp(join(tmpdir(), "selfevo-rg-"));
  try {
    await mkdir(join(repo, ".agents/plan/cycles"), { recursive: true });
    const memory = new InMemoryMemoryClient();
    const services: AgentServices = {
      resolver: new LLMResolver(DEFAULT_LLM_CONFIG),
      skillsRoot: "/nonexistent",
      repoRoot: repo,
      workspaceRoot: repo,
      memory,
    };
    const node = makeRoundWriterNode(services);
    await node(
      completeState({
        verification: {
          checks: [
            {
              name: "tests",
              status: "fail",
              durationMs: 10,
              excerpt: "boom\nline two",
            },
          ],
          failureExcerpts: ["[tests] boom\nline two"],
        },
      }),
    );
    const all = await memory.list({ user_id: "self-evo" });
    // 1 decision (topic) + 1 convention (assumption) + 1 pitfall (failed lint)
    assert.equal(all.length, 3);
    const types = all.map((r) => r.metadata.type).sort();
    assert.deepEqual(types, ["convention", "decision", "pitfall"]);
    const pitfall = all.find((r) => r.metadata.type === "pitfall");
    assert.match(pitfall?.text ?? "", /verifier:tests failed/);
    assert.match(pitfall?.text ?? "", /boom/);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("end-to-end: round → approve → Round_NN.md lands", async () => {
  const repo = await mkdtemp(join(tmpdir(), "selfevo-rg-e2e-"));
  const wsRoot = await mkdtemp(join(tmpdir(), "selfevo-rg-ws-"));
  try {
    await mkdir(join(repo, ".agents/plan/cycles"), { recursive: true });

    const fake = new FakeLLM({
      "repo-scanner": JSON.stringify({
        findings: [{ source: "inference", claim: "ok", evidence: "fine" }],
      }),
      "boundary-scoper": JSON.stringify({
        inScope: ["src"],
        outScope: [],
        assumptions: ["green at HEAD"],
        allowedFiles: ["src/**"],
      }),
      "change-classifier": '{"changeType":"doc"}',
      "plan-writer": JSON.stringify({
        plan: [{ id: "P1", text: "write docs" }],
      }),
      "patch-author": '{"diffs":[]}',
    });
    const resolver = new LLMResolver(DEFAULT_LLM_CONFIG);
    resolver.for = () => fake;
    resolver.skillsFor = () => [];
    const memory = new InMemoryMemoryClient();
    const services: AgentServices = {
      resolver,
      skillsRoot: "/nonexistent",
      repoRoot: repo,
      workspaceRoot: wsRoot,
      memory,
    };

    const runId = newRunId();
    const layout = layoutFor(runId, wsRoot);
    await ensureWorkspace(layout);

    const graph = compileGraph(services, makeCheckpointer(layout), {
      verifier: {
        defaultChannels: ["lint"],
        byChangeType: { doc: ["lint"] },
        commands: { lint: [PASS] },
      },
      judge: { approveThreshold: 0.8, maxIterations: 3 },
    });
    const cfg = { configurable: { thread_id: runId } };

    const before = await graph.invoke(
      { runId, topic: "End-to-end smoke", requirements: [] },
      cfg,
    );
    assert.equal(isInterrupted(before), true, "pauses at HITL");

    const after = await graph.invoke(
      new Command({ resume: { kind: "approve" } }),
      cfg,
    );
    assert.equal(isInterrupted(after), false, "completes after approve");

    const snap = await graph.getState(cfg);
    const round = (snap.values as { round?: { number: number; path: string } }).round;
    assert.ok(round, "state.round populated");
    assert.match(round.path, /Round_01\.md$/);

    const written = await readFile(round.path, "utf8");
    assert.match(written, /^# Round 01: End-to-end smoke/m);
    assert.match(written, /\*\*lint\*\* — pass/);

    const memories = await memory.list({ user_id: "self-evo" });
    assert.ok(memories.length >= 1, "memories persisted on approve");
    assert.equal(memories[0]!.metadata.round, 1);

    const cycles = await readdir(join(repo, ".agents/plan/cycles"));
    assert.ok(cycles.includes("Round_01.md"));
  } finally {
    await rm(repo, { recursive: true, force: true });
    await rm(wsRoot, { recursive: true, force: true });
  }
});
