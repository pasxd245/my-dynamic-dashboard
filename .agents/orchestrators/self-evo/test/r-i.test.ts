import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { Command, isInterrupted } from "@langchain/langgraph";
import { applyPatch, createWorktree, removeWorktree } from "../src/tools/worktree.js";
import { makeApplyVerifierNode } from "../src/nodes/apply-verifier.js";
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
import type { SelfEvoStateT } from "../src/state.js";

function exec(
  cmd: string,
  args: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      stdio: ["ignore", "ignore", "pipe"],
    });
    const errChunks: Buffer[] = [];
    child.stderr.on("data", (c) => errChunks.push(Buffer.from(c)));
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        code: code ?? 0,
        stderr: Buffer.concat(errChunks).toString("utf8"),
      });
    });
  });
}

async function makeGitRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "selfevo-ri-"));
  const env = {
    GIT_AUTHOR_NAME: "self-evo",
    GIT_AUTHOR_EMAIL: "self-evo@test.local",
    GIT_COMMITTER_NAME: "self-evo",
    GIT_COMMITTER_EMAIL: "self-evo@test.local",
  };
  await exec("git", ["init", "-q", "-b", "main"], { cwd: root });
  await exec("git", ["config", "commit.gpgsign", "false"], { cwd: root });
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src/hello.txt"), "hello\n", "utf8");
  await exec("git", ["add", "."], { cwd: root });
  await exec("git", ["commit", "-q", "-m", "init"], { cwd: root, env });
  return root;
}

const VALID_DIFF = `--- a/src/hello.txt
+++ b/src/hello.txt
@@ -1 +1 @@
-hello
+world
`;

const PASS: ShellCommand = { bin: "true", args: [] };

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

test("worktree: createWorktree isolates from main checkout", async () => {
  const repo = await makeGitRepo();
  try {
    const handle = await createWorktree({
      repoRoot: repo,
      basePath: join(repo, ".self-evo-wt"),
      symlinks: [],
    });
    const sRepo = await readFile(join(repo, "src/hello.txt"), "utf8");
    const sWt = await readFile(join(handle.path, "src/hello.txt"), "utf8");
    assert.equal(sRepo, sWt);

    const r = await applyPatch(handle.path, VALID_DIFF);
    assert.equal(r.ok, true);

    const sRepoAfter = await readFile(join(repo, "src/hello.txt"), "utf8");
    const sWtAfter = await readFile(join(handle.path, "src/hello.txt"), "utf8");
    assert.equal(sRepoAfter, "hello\n", "main untouched");
    assert.equal(sWtAfter, "world\n", "worktree patched");

    await removeWorktree(repo, handle.path);
    const exists = await stat(handle.path).then(() => true).catch(() => false);
    assert.equal(exists, false, "worktree removed");
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("worktree: applyPatch surfaces failures with stderr", async () => {
  const repo = await makeGitRepo();
  try {
    const handle = await createWorktree({
      repoRoot: repo,
      basePath: join(repo, ".self-evo-wt"),
      symlinks: [],
    });
    const r = await applyPatch(handle.path, "this is not a diff\n");
    assert.equal(r.ok, false);
    assert.ok(r.error && r.error.length > 0);
    await removeWorktree(repo, handle.path);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

function stateWithPatch(diff: string, runId: string): SelfEvoStateT {
  return {
    runId,
    topic: "apply test",
    requirements: [],
    priorMemories: [],
    findings: [],
    scope: {
      inScope: ["src"],
      outScope: [],
      assumptions: [],
      allowedFiles: ["src/**"],
    },
    changeType: "feature",
    plan: [],
    patches: [{ path: "src/hello.txt", diff, applied: false }],
    verification: undefined,
    appliedVerification: undefined,
    appliedWorktree: undefined,
    verdict: undefined,
    hitl: undefined,
    round: undefined,
    judgeIterations: 0,
  };
}

test("apply-verifier: applies patches and runs verifier inside worktree", async () => {
  const repo = await makeGitRepo();
  const wsRoot = await mkdtemp(join(tmpdir(), "selfevo-ri-ws-"));
  try {
    const runId = newRunId();
    const layout = layoutFor(runId, wsRoot);
    await ensureWorkspace(layout);

    const resolver = new LLMResolver(DEFAULT_LLM_CONFIG);
    resolver.for = () => new FakeLLM({});
    resolver.skillsFor = () => [];
    const services: AgentServices = {
      resolver,
      skillsRoot: "/nonexistent",
      repoRoot: repo,
      workspaceRoot: wsRoot,
    };

    const node = makeApplyVerifierNode(services, {
      defaultChannels: ["lint"],
      byChangeType: { feature: ["lint"] },
      commands: { lint: [PASS] },
      symlinks: [], // no node_modules in the test repo
      preserveWorktree: false,
    });
    const out = await node(stateWithPatch(VALID_DIFF, runId));
    assert.ok(out.appliedVerification);
    assert.equal(out.appliedVerification!.checks.length, 1);
    assert.equal(out.appliedVerification!.checks[0]!.status, "pass");
    assert.equal(out.patches!.length, 1);
    assert.equal(out.patches![0]!.applied, true);

    // Main repo is untouched (worktree was cleaned up).
    const main = await readFile(join(repo, "src/hello.txt"), "utf8");
    assert.equal(main, "hello\n");
  } finally {
    await rm(repo, { recursive: true, force: true });
    await rm(wsRoot, { recursive: true, force: true });
  }
});

test("apply-verifier: records per-patch apply failures without throwing", async () => {
  const repo = await makeGitRepo();
  const wsRoot = await mkdtemp(join(tmpdir(), "selfevo-ri-ws-"));
  try {
    const runId = newRunId();
    const layout = layoutFor(runId, wsRoot);
    await ensureWorkspace(layout);

    const resolver = new LLMResolver(DEFAULT_LLM_CONFIG);
    resolver.for = () => new FakeLLM({});
    resolver.skillsFor = () => [];
    const services: AgentServices = {
      resolver,
      skillsRoot: "/nonexistent",
      repoRoot: repo,
      workspaceRoot: wsRoot,
    };
    const node = makeApplyVerifierNode(services, {
      defaultChannels: ["lint"],
      byChangeType: { feature: ["lint"] },
      commands: { lint: [PASS] },
      symlinks: [],
      preserveWorktree: false,
    });
    const out = await node(stateWithPatch("not a diff at all\n", runId));
    assert.equal(out.patches![0]!.applied, false);
    assert.ok(
      out.appliedVerification!.failureExcerpts.some((e) => /apply/.test(e)),
      "failure excerpt mentions apply",
    );
  } finally {
    await rm(repo, { recursive: true, force: true });
    await rm(wsRoot, { recursive: true, force: true });
  }
});

test("end-to-end: round → apply → re-pause at HITL → approve → Round_NN.md", async () => {
  const repo = await makeGitRepo();
  const wsRoot = await mkdtemp(join(tmpdir(), "selfevo-ri-e2e-"));
  try {
    await mkdir(join(repo, ".agents/plan/cycles"), { recursive: true });

    const llmJson = JSON.stringify({
      diffs: [{ path: "src/hello.txt", explanation: "ok", diff: VALID_DIFF }],
    });
    const fake = new FakeLLM({
      "repo-scanner": JSON.stringify({
        findings: [{ source: "inference", claim: "edit hello", evidence: "test" }],
      }),
      "boundary-scoper": JSON.stringify({
        inScope: ["src"],
        outScope: [],
        assumptions: ["green at HEAD"],
        allowedFiles: ["src/**"],
      }),
      "change-classifier": '{"changeType":"feature"}',
      "plan-writer": JSON.stringify({
        plan: [{ id: "P1", text: "change hello to world" }],
      }),
      "patch-author": llmJson,
    });
    const resolver = new LLMResolver(DEFAULT_LLM_CONFIG);
    resolver.for = () => fake;
    resolver.skillsFor = () => [];
    const services: AgentServices = {
      resolver,
      skillsRoot: "/nonexistent",
      repoRoot: repo,
      workspaceRoot: wsRoot,
    };

    const runId = newRunId();
    const layout = layoutFor(runId, wsRoot);
    await ensureWorkspace(layout);

    const graph = compileGraph(services, makeCheckpointer(layout), {
      verifier: {
        defaultChannels: ["lint"],
        byChangeType: { feature: ["lint"] },
        commands: { lint: [PASS] },
      },
      applyVerifier: {
        defaultChannels: ["lint"],
        byChangeType: { feature: ["lint"] },
        commands: { lint: [PASS] },
        symlinks: [],
        preserveWorktree: false,
      },
      judge: { approveThreshold: 0.5, maxIterations: 3 },
    });
    const cfg = { configurable: { thread_id: runId } };

    // 1) initial → pauses at HITL
    const r1 = await graph.invoke(
      { runId, topic: "End-to-end apply", requirements: [] },
      cfg,
    );
    assert.equal(isInterrupted(r1), true);

    // 2) apply → applies patch in worktree, re-verifies, pauses again
    const r2 = await graph.invoke(new Command({ resume: { kind: "apply" } }), cfg);
    assert.equal(isInterrupted(r2), true, "pauses again after apply");
    const snapAfterApply = await graph.getState(cfg);
    const v = (snapAfterApply.values as {
      appliedVerification?: { checks: Array<{ status: string }> };
      patches: Array<{ applied: boolean }>;
    });
    assert.ok(v.appliedVerification, "appliedVerification populated");
    assert.equal(v.appliedVerification!.checks[0]!.status, "pass");
    assert.equal(v.patches[0]!.applied, true);

    // Main repo is still untouched.
    const main = await readFile(join(repo, "src/hello.txt"), "utf8");
    assert.equal(main, "hello\n");

    // 3) approve → round-writer runs to END
    const r3 = await graph.invoke(new Command({ resume: { kind: "approve" } }), cfg);
    assert.equal(isInterrupted(r3), false, "completes after approve");

    const final = await graph.getState(cfg);
    const round = (final.values as { round?: { number: number; path: string } }).round;
    assert.ok(round, "state.round populated");
    const written = await readFile(round.path, "utf8");
    assert.match(written, /Post-patch \(worktree, after `apply`\)/);
    assert.match(written, /\*\*lint\*\* — pass/);
  } finally {
    await rm(repo, { recursive: true, force: true });
    await rm(wsRoot, { recursive: true, force: true });
  }
});
