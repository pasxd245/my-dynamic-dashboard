import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import {
  extractPathFromDiff,
  gitApplyCheck,
  withinBoundary,
} from "../src/tools/patch.js";
import { makePatchAuthorNode } from "../src/nodes/patch-author.js";
import { LLMResolver, DEFAULT_LLM_CONFIG } from "../src/llm/resolver.js";
import type { AgentServices } from "../src/agent-services.js";
import type { LLMClient, LLMRequest } from "../src/llm/client.js";
import type { SelfEvoStateT } from "../src/state.js";
import {
  ensureWorkspace,
  layoutFor,
  newRunId,
} from "../src/persistence/workspace.js";

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
  const root = await mkdtemp(join(tmpdir(), "selfevo-patch-"));
  const env = {
    GIT_AUTHOR_NAME: "self-evo",
    GIT_AUTHOR_EMAIL: "self-evo@test.local",
    GIT_COMMITTER_NAME: "self-evo",
    GIT_COMMITTER_EMAIL: "self-evo@test.local",
  };
  await exec("git", ["init", "-q", "-b", "main"], { cwd: root });
  await exec("git", ["config", "commit.gpgsign", "false"], { cwd: root });
  await mkdir(join(root, "apps/builder/src"), { recursive: true });
  await writeFile(join(root, "apps/builder/src/hello.txt"), "hello\n", "utf8");
  await writeFile(join(root, "apps/dashboard.txt"), "dash\n", "utf8");
  await exec("git", ["add", "."], { cwd: root });
  await exec("git", ["commit", "-q", "-m", "init"], { cwd: root, env });
  return root;
}

const VALID_DIFF = `--- a/apps/builder/src/hello.txt
+++ b/apps/builder/src/hello.txt
@@ -1 +1 @@
-hello
+world
`;

const OUT_OF_SCOPE_DIFF = `--- a/apps/dashboard.txt
+++ b/apps/dashboard.txt
@@ -1 +1 @@
-dash
+board
`;

const NONAPPLY_DIFF = `--- a/apps/builder/src/hello.txt
+++ b/apps/builder/src/hello.txt
@@ -1 +1 @@
-nonsense-base-line
+world
`;

// FakeLLM keyed by request `tag`. R-M's chunked patch-author calls
// `llm.complete({ tag: "patch-author:<stepId>" })` once per plan step,
// so tests register one canned response per step. A throwable per-tag
// entry lets us exercise the LLM-failure rejection path.
class FakeLLM implements LLMClient {
  readonly mode = "subprocess" as const;
  readonly capabilities = { supportsParallel: false, maxConcurrency: 1 };
  public calls: LLMRequest[] = [];
  constructor(
    private readonly canned: Record<string, string | { throws: string }>,
  ) {}
  async complete(req: LLMRequest) {
    this.calls.push(req);
    const entry = this.canned[req.tag ?? ""];
    if (entry === undefined) {
      throw new Error(`FakeLLM: no canned for tag=${req.tag}`);
    }
    if (typeof entry === "object" && "throws" in entry) {
      throw new Error(entry.throws);
    }
    return { text: entry };
  }
}

function servicesFor(
  repoRoot: string,
  workspaceRoot: string,
  canned: Record<string, string | { throws: string }>,
): { services: AgentServices; fake: FakeLLM } {
  const resolver = new LLMResolver(DEFAULT_LLM_CONFIG);
  const fake = new FakeLLM(canned);
  resolver.for = () => fake;
  resolver.skillsFor = () => [];
  const services: AgentServices = {
    resolver,
    skillsRoot: "/nonexistent",
    repoRoot,
    workspaceRoot,
  };
  return { services, fake };
}

function stateFor(
  allowedFiles: string[],
  plan: { id: string; text: string }[] = [{ id: "P1", text: "change hello to world" }],
): SelfEvoStateT {
  return {
    runId: "test-run",
    topic: "edit hello.txt",
    requirements: [],
    priorMemories: [],
    findings: [],
    scope: {
      inScope: ["apps/builder/src"],
      outScope: [],
      assumptions: [],
      allowedFiles,
    },
    changeType: "feature",
    plan: plan.map((p) => ({ id: p.id, text: p.text, done: false })),
    patches: [],
    verification: undefined,
    appliedVerification: undefined,
    appliedWorktree: undefined,
    verdict: undefined,
    hitl: undefined,
    round: undefined,
    judgeIterations: 0,
  };
}

function stepResp(diff: string | null, path?: string): string {
  return JSON.stringify({
    diff,
    path: path ?? null,
    explanation: diff ? "candidate" : "non-code step",
  });
}

// R-M tests live below the legacy tests so they share `stateFor` /
// fixtures with the original suite.

test("extractPathFromDiff reads the +++ b/<path> header", () => {
  assert.equal(extractPathFromDiff(VALID_DIFF), "apps/builder/src/hello.txt");
  assert.equal(extractPathFromDiff("no header here"), undefined);
  assert.equal(
    extractPathFromDiff("--- a/x\n+++ /dev/null\n@@ -1 +0 @@\n-x\n"),
    undefined,
  );
});

test("withinBoundary respects glob list, fails closed on empty", () => {
  assert.equal(
    withinBoundary("apps/builder/src/x.ts", ["apps/builder/**"]),
    true,
  );
  assert.equal(
    withinBoundary("apps/dashboard.txt", ["apps/builder/**"]),
    false,
  );
  assert.equal(withinBoundary("anywhere", []), false);
});

test("gitApplyCheck reports ok for a valid diff and error for stale base", async () => {
  const root = await makeGitRepo();
  try {
    const ok = await gitApplyCheck(VALID_DIFF, root);
    assert.equal(ok.ok, true);

    const bad = await gitApplyCheck(NONAPPLY_DIFF, root);
    assert.equal(bad.ok, false);
    assert.ok(bad.error && bad.error.length > 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("patch-author lands the in-boundary diff, drops the other two", async () => {
  const repo = await makeGitRepo();
  const wsRoot = await mkdtemp(join(tmpdir(), "selfevo-ws-"));
  try {
    // R-M: one LLM call per plan step. 3 steps × 3 diff candidates;
    // only the in-boundary, applies-cleanly one survives the filter.
    const canned = {
      "patch-author:P1": stepResp(VALID_DIFF, "apps/builder/src/hello.txt"),
      "patch-author:P2": stepResp(OUT_OF_SCOPE_DIFF, "apps/dashboard.txt"),
      "patch-author:P3": stepResp(NONAPPLY_DIFF, "apps/builder/src/hello.txt"),
    };
    const { services, fake } = servicesFor(repo, wsRoot, canned);

    const runId = "test-run";
    const layout = layoutFor(runId, wsRoot);
    await ensureWorkspace(layout);

    const node = makePatchAuthorNode(services);
    const out = await node(
      stateFor(["apps/builder/src/**", "apps/builder/**/*.txt"], [
        { id: "P1", text: "change hello to world (valid)" },
        { id: "P2", text: "edit out-of-scope file" },
        { id: "P3", text: "non-applying diff" },
      ]),
    );

    assert.equal(fake.calls.length, 3, "one LLM call per plan step");
    const cmp = (a: string, b: string) => a.localeCompare(b);
    assert.deepEqual(
      fake.calls.map((c) => c.tag ?? "").sort(cmp),
      ["patch-author:P1", "patch-author:P2", "patch-author:P3"],
    );

    assert.ok(out.patches, "patches present");
    assert.equal(out.patches!.length, 1, "only the in-boundary, applies-cleanly diff lands");
    assert.equal(out.patches![0]!.path, "apps/builder/src/hello.txt");
    assert.equal(out.patches![0]!.applied, false, "dry-run: applied stays false");

    const files = await readdir(layout.patchesDir);
    assert.equal(files.length, 1, "exactly one patch on disk");
    const onDisk = await readFile(join(layout.patchesDir, files[0]!), "utf8");
    assert.match(onDisk, /apps\/builder\/src\/hello.txt/);
    // R-M: per-step filename should embed the stepId so a glance at
    // runs/<id>/patches/ tells you which plan step produced it.
    assert.match(files[0]!, /-P1-/);

    // Sanity: repo is unchanged (dry-run).
    const helloAfter = await readFile(join(repo, "apps/builder/src/hello.txt"), "utf8");
    assert.equal(helloAfter, "hello\n");
  } finally {
    await rm(repo, { recursive: true, force: true });
    await rm(wsRoot, { recursive: true, force: true });
  }
});

test("patch-author treats `diff: null` as a non-code step (no rejection)", async () => {
  const repo = await makeGitRepo();
  const wsRoot = await mkdtemp(join(tmpdir(), "selfevo-ws-"));
  try {
    const canned = {
      "patch-author:P1": stepResp(VALID_DIFF, "apps/builder/src/hello.txt"),
      "patch-author:P2": stepResp(null),
    };
    const { services, fake } = servicesFor(repo, wsRoot, canned);

    const runId = "test-run";
    const layout = layoutFor(runId, wsRoot);
    await ensureWorkspace(layout);

    const node = makePatchAuthorNode(services);
    const out = await node(
      stateFor(["apps/builder/src/**"], [
        { id: "P1", text: "code change" },
        { id: "P2", text: "verification reminder, no code" },
      ]),
    );

    assert.equal(fake.calls.length, 2);
    assert.equal(out.patches!.length, 1, "only the coding step produced a diff");
    assert.equal(out.patches![0]!.path, "apps/builder/src/hello.txt");
  } finally {
    await rm(repo, { recursive: true, force: true });
    await rm(wsRoot, { recursive: true, force: true });
  }
});

test("patch-author records a rejection when the LLM call throws", async () => {
  const repo = await makeGitRepo();
  const wsRoot = await mkdtemp(join(tmpdir(), "selfevo-ws-"));
  try {
    const canned = {
      "patch-author:P1": stepResp(VALID_DIFF, "apps/builder/src/hello.txt"),
      "patch-author:P2": { throws: "fake transport timeout" },
    };
    const { services } = servicesFor(repo, wsRoot, canned);

    const runId = "test-run";
    const layout = layoutFor(runId, wsRoot);
    await ensureWorkspace(layout);

    // Suppress the stderr noise the node emits when it logs rejections.
    const origError = console.error;
    console.error = () => undefined;
    try {
      const node = makePatchAuthorNode(services);
      const out = await node(
        stateFor(["apps/builder/src/**"], [
          { id: "P1", text: "ok step" },
          { id: "P2", text: "step that errors" },
        ]),
      );
      assert.equal(out.patches!.length, 1, "the successful step still lands");
    } finally {
      console.error = origError;
    }
  } finally {
    await rm(repo, { recursive: true, force: true });
    await rm(wsRoot, { recursive: true, force: true });
  }
});

test("patch-author skips entirely when state.plan is empty", async () => {
  const repo = await makeGitRepo();
  const wsRoot = await mkdtemp(join(tmpdir(), "selfevo-ws-"));
  try {
    const { services, fake } = servicesFor(repo, wsRoot, {});
    const runId = "test-run";
    const layout = layoutFor(runId, wsRoot);
    await ensureWorkspace(layout);
    const origError = console.error;
    console.error = () => undefined;
    try {
      const node = makePatchAuthorNode(services);
      const out = await node(stateFor(["apps/builder/src/**"], []));
      assert.equal(out.patches!.length, 0);
      assert.equal(fake.calls.length, 0, "no LLM call for empty plan");
    } finally {
      console.error = origError;
    }
  } finally {
    await rm(repo, { recursive: true, force: true });
    await rm(wsRoot, { recursive: true, force: true });
  }
});

test("patch-author skips LLM call when scope.allowedFiles is empty", async () => {
  const repo = await makeGitRepo();
  const wsRoot = await mkdtemp(join(tmpdir(), "selfevo-ws-"));
  try {
    let called = 0;
    const resolver = new LLMResolver(DEFAULT_LLM_CONFIG);
    const counting: LLMClient = {
      mode: "subprocess",
      capabilities: { supportsParallel: false, maxConcurrency: 1 },
      async complete() {
        called++;
        return { text: '{"diffs":[]}' };
      },
    };
    resolver.for = () => counting;
    resolver.skillsFor = () => [];
    const services: AgentServices = {
      resolver,
      skillsRoot: "/nonexistent",
      repoRoot: repo,
      workspaceRoot: wsRoot,
    };

    const layout = layoutFor("test-run", wsRoot);
    await ensureWorkspace(layout);

    const node = makePatchAuthorNode(services);
    const out = await node(stateFor([]));
    assert.deepEqual(out.patches, []);
    assert.equal(called, 0, "LLM is not invoked with empty allowedFiles");
  } finally {
    await rm(repo, { recursive: true, force: true });
    await rm(wsRoot, { recursive: true, force: true });
  }
});
