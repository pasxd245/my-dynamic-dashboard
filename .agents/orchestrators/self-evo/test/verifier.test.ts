import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isInterrupted } from "@langchain/langgraph";
import { runChecks, type Command } from "../src/tools/shell.js";
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

const ALL_EMPTY = {
  "repo-scanner": '{"findings":[]}',
  "boundary-scoper": '{"inScope":[],"outScope":[],"assumptions":[],"allowedFiles":[]}',
  "change-classifier": '{"changeType":"doc"}',
  "plan-writer": '{"plan":[]}',
  "patch-author": '{"diffs":[]}',
};

const PASS_CMD: Command = { bin: "true", args: [] };
const FAIL_CMD: Command = { bin: "false", args: [] };
const NOISY_FAIL_CMD: Command = {
  bin: "node",
  args: ["-e", "console.error('line one'); console.error('line two'); process.exit(1)"],
};

function servicesFor(repoRoot: string, workspaceRoot: string): AgentServices {
  const resolver = new LLMResolver(DEFAULT_LLM_CONFIG);
  const fake = new FakeLLM(ALL_EMPTY);
  resolver.for = () => fake;
  resolver.skillsFor = () => [];
  return {
    resolver,
    skillsRoot: "/nonexistent",
    repoRoot,
    workspaceRoot,
  };
}

test("runChecks: empty channels yields empty checks + no failures", async () => {
  const root = await mkdtemp(join(tmpdir(), "selfevo-verify-"));
  try {
    const log = join(root, "verification.log");
    const out = await runChecks({
      channels: [],
      cwd: root,
      logPath: log,
      commands: { lint: [PASS_CMD] },
    });
    assert.deepEqual(out.checks, []);
    assert.deepEqual(out.failureExcerpts, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runChecks: pass → status pass; fail → status fail with tail excerpt", async () => {
  const root = await mkdtemp(join(tmpdir(), "selfevo-verify-"));
  try {
    const log = join(root, "verification.log");
    const out = await runChecks({
      channels: ["lint", "tests"],
      cwd: root,
      logPath: log,
      commands: {
        lint: [PASS_CMD],
        tests: [NOISY_FAIL_CMD],
      },
    });
    assert.equal(out.checks.length, 2);
    assert.equal(out.checks[0]!.name, "lint");
    assert.equal(out.checks[0]!.status, "pass");
    assert.equal(out.checks[1]!.name, "tests");
    assert.equal(out.checks[1]!.status, "fail");
    assert.match(out.checks[1]!.excerpt ?? "", /line one/);
    assert.match(out.checks[1]!.excerpt ?? "", /line two/);
    assert.equal(out.failureExcerpts.length, 1);
    assert.match(out.failureExcerpts[0]!, /\[tests\]/);

    const logContent = await readFile(log, "utf8");
    assert.match(logContent, /\[tests\] line one/);
    assert.match(logContent, /\[tests\] line two/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runChecks: missing channel in table → status skip", async () => {
  const root = await mkdtemp(join(tmpdir(), "selfevo-verify-"));
  try {
    const log = join(root, "verification.log");
    const out = await runChecks({
      channels: ["unknown-channel"],
      cwd: root,
      logPath: log,
      commands: { lint: [PASS_CMD] },
    });
    assert.equal(out.checks[0]!.status, "skip");
    assert.equal(out.checks[0]!.durationMs, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runChecks: first failing command in a channel short-circuits subsequent commands", async () => {
  const root = await mkdtemp(join(tmpdir(), "selfevo-verify-"));
  try {
    let secondCalled = false;
    const flagCmd: Command = {
      bin: "node",
      args: ["-e", "process.stderr.write('SHOULD-NOT-RUN'); process.exit(0)"],
    };
    const log = join(root, "verification.log");
    const out = await runChecks({
      channels: ["tests"],
      cwd: root,
      logPath: log,
      commands: { tests: [FAIL_CMD, flagCmd] },
    });
    assert.equal(out.checks[0]!.status, "fail");
    const logContent = await readFile(log, "utf8");
    secondCalled = /SHOULD-NOT-RUN/.test(logContent);
    assert.equal(secondCalled, false, "later commands skipped after first failure");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("verifier node: writes verification with channel routing per changeType", async () => {
  const root = await mkdtemp(join(tmpdir(), "selfevo-verify-graph-"));
  const wsRoot = await mkdtemp(join(tmpdir(), "selfevo-verify-ws-"));
  try {
    // ALL_EMPTY sets changeType=doc, so verifier must use the
    // `doc` channel list when we wire one in.
    const services = servicesFor(root, wsRoot);
    const runId = newRunId();
    const layout = layoutFor(runId, wsRoot);
    await ensureWorkspace(layout);

    const graph = compileGraph(services, makeCheckpointer(layout), {
      verifier: {
        defaultChannels: ["lint"],
        byChangeType: { doc: ["lint"], feature: ["lint", "tests"] },
        commands: {
          lint: [PASS_CMD],
          tests: [FAIL_CMD],
        },
      },
    });
    const cfg = { configurable: { thread_id: runId } };

    const result = await graph.invoke(
      { runId, topic: "verify smoke", requirements: [] },
      cfg,
    );
    assert.equal(isInterrupted(result), true);

    const snap = await graph.getState(cfg);
    const v = (snap.values as {
      verification: {
        checks: Array<{ name: string; status: string }>;
        failureExcerpts: string[];
      };
    }).verification;
    assert.ok(v, "verification populated");
    assert.equal(v.checks.length, 1, "doc → only lint runs");
    assert.equal(v.checks[0]!.name, "lint");
    assert.equal(v.checks[0]!.status, "pass");
    assert.equal(v.failureExcerpts.length, 0);

    const logContent = await readFile(layout.verificationLog, "utf8");
    assert.match(logContent, /verification log/);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(wsRoot, { recursive: true, force: true });
  }
});

test("verifier node: tail excerpt surfaces at HITL when a check fails", async () => {
  const root = await mkdtemp(join(tmpdir(), "selfevo-verify-graph-"));
  const wsRoot = await mkdtemp(join(tmpdir(), "selfevo-verify-ws-"));
  try {
    const services = servicesFor(root, wsRoot);
    const runId = newRunId();
    const layout = layoutFor(runId, wsRoot);
    await ensureWorkspace(layout);

    const graph = compileGraph(services, makeCheckpointer(layout), {
      verifier: {
        defaultChannels: ["lint"],
        byChangeType: { doc: ["lint"] },
        commands: { lint: [NOISY_FAIL_CMD] },
      },
    });
    const cfg = { configurable: { thread_id: runId } };

    await graph.invoke(
      { runId, topic: "x", requirements: [] },
      cfg,
    );
    const snap = await graph.getState(cfg);
    const v = (snap.values as {
      verification: { failureExcerpts: string[] };
    }).verification;
    assert.equal(v.failureExcerpts.length, 1);
    assert.match(v.failureExcerpts[0]!, /line one/);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(wsRoot, { recursive: true, force: true });
  }
});
