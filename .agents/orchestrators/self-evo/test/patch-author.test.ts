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

class FakeLLM implements LLMClient {
  readonly mode = "subprocess" as const;
  readonly capabilities = { supportsParallel: false, maxConcurrency: 1 };
  constructor(private readonly canned: string) {}
  async complete(_req: LLMRequest) {
    return { text: this.canned };
  }
}

function servicesFor(repoRoot: string, workspaceRoot: string, llmText: string): AgentServices {
  const resolver = new LLMResolver(DEFAULT_LLM_CONFIG);
  const llm = new FakeLLM(llmText);
  resolver.for = () => llm;
  resolver.skillsFor = () => [];
  return {
    resolver,
    skillsRoot: "/nonexistent",
    repoRoot,
    workspaceRoot,
  };
}

function stateFor(allowedFiles: string[]): SelfEvoStateT {
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
    plan: [{ id: "P1", text: "change hello to world", done: false }],
    patches: [],
    verification: undefined,
    verdict: undefined,
    hitl: undefined,
    round: undefined,
    judgeIterations: 0,
  };
}

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
    const llmJson = JSON.stringify({
      diffs: [
        { path: "apps/builder/src/hello.txt", explanation: "valid", diff: VALID_DIFF },
        { path: "apps/dashboard.txt", explanation: "out of scope", diff: OUT_OF_SCOPE_DIFF },
        { path: "apps/builder/src/hello.txt", explanation: "wrong base", diff: NONAPPLY_DIFF },
      ],
    });
    const services = servicesFor(repo, wsRoot, llmJson);

    const runId = "test-run";
    const layout = layoutFor(runId, wsRoot);
    await ensureWorkspace(layout);

    const node = makePatchAuthorNode(services);
    const out = await node(
      stateFor(["apps/builder/src/**", "apps/builder/**/*.txt"]),
    );

    assert.ok(out.patches, "patches present");
    assert.equal(out.patches!.length, 1, "only the in-boundary, applies-cleanly diff lands");
    assert.equal(out.patches![0]!.path, "apps/builder/src/hello.txt");
    assert.equal(out.patches![0]!.applied, false, "dry-run: applied stays false");

    const files = await readdir(layout.patchesDir);
    assert.equal(files.length, 1, "exactly one patch on disk");
    const onDisk = await readFile(join(layout.patchesDir, files[0]!), "utf8");
    assert.match(onDisk, /apps\/builder\/src\/hello.txt/);

    // Sanity: repo is unchanged (dry-run).
    const helloAfter = await readFile(join(repo, "apps/builder/src/hello.txt"), "utf8");
    assert.equal(helloAfter, "hello\n");
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
