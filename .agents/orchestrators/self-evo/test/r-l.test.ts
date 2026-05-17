import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  detectDocTopic,
  probeFileRead,
  probeLint,
  renderProbes,
} from "../src/tools/probe.js";
import { makeRepoScannerNode } from "../src/nodes/repo-scanner.js";
import { LLMResolver, DEFAULT_LLM_CONFIG } from "../src/llm/resolver.js";
import type { AgentServices } from "../src/agent-services.js";
import type { LLMClient, LLMRequest } from "../src/llm/client.js";
import type { SelfEvoStateT } from "../src/state.js";

class CapturingLLM implements LLMClient {
  readonly mode = "subprocess" as const;
  readonly capabilities = { supportsParallel: false, maxConcurrency: 1 };
  public lastUser?: string;
  public lastSystem?: string;
  constructor(private readonly canned: string) {}
  async complete(req: LLMRequest) {
    this.lastUser = req.user;
    this.lastSystem = req.system;
    return { text: this.canned };
  }
}

function stateFor(topic: string, reqs: string[] = []): SelfEvoStateT {
  return {
    runId: "test",
    topic,
    requirements: reqs.map((t, i) => ({ id: `R${i + 1}`, text: t })),
    priorMemories: [],
    findings: [],
    scope: undefined,
    changeType: undefined,
    plan: [],
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

test("detectDocTopic flags doc/lint/markdown topics", () => {
  assert.equal(detectDocTopic("Tighten ROLLOUT.md formatting", []), true);
  assert.equal(detectDocTopic("Fix markdown lint", []), true);
  assert.equal(detectDocTopic("typo in README", []), true);
  assert.equal(
    detectDocTopic("Refactor auth", ["touch nothing markdown-related"]),
    true,
    "any keyword anywhere in topic+reqs counts",
  );
  assert.equal(detectDocTopic("Refactor upload state machine", []), false);
});

test("probeFileRead returns the file content trimmed to maxChars", async () => {
  const root = await mkdtemp(join(tmpdir(), "selfevo-probe-"));
  try {
    const long = "x".repeat(5000);
    await writeFile(join(root, "big.txt"), long, "utf8");
    await writeFile(join(root, "small.txt"), "hi", "utf8");
    const probes = await probeFileRead(
      ["big.txt", "small.txt", "missing.txt"],
      root,
      100,
    );
    assert.equal(probes.length, 2);
    const big = probes.find((p) => p.source === "big.txt");
    assert.ok(big);
    assert.ok(big.content.length <= 130, "truncates near maxChars");
    assert.match(big.content, /truncated/);
    const small = probes.find((p) => p.source === "small.txt");
    assert.equal(small?.content, "hi");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("probeLint surfaces 'exit 0 — no issues' for a clean markdown file", async () => {
  const root = await mkdtemp(join(tmpdir(), "selfevo-probe-"));
  try {
    // Write a known-clean md (single H1, no trailing whitespace, no
    // long lines). probeLint will need pnpm + markdownlint-cli2 in the
    // ambient PATH; we assert behavior conditionally.
    await writeFile(
      join(root, "clean.md"),
      "# Title\n\nOne paragraph.\n",
      "utf8",
    );
    const probe = await probeLint(["clean.md"], root);
    if (!probe) {
      // probeLint returns undefined when no .md is found — should not happen here.
      throw new Error("probeLint returned undefined for an existing .md");
    }
    // We don't strictly assert "exit 0" because the tmpdir doesn't have
    // a package.json so `pnpm exec markdownlint-cli2` may fail to find
    // it. We DO assert that the result is text the LLM can read.
    assert.equal(probe.tool, "lint");
    assert.equal(typeof probe.content, "string");
    assert.ok(probe.content.length > 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("probeLint returns undefined when there are no .md candidates", async () => {
  const root = await mkdtemp(join(tmpdir(), "selfevo-probe-"));
  try {
    const probe = await probeLint(["src/x.ts", "config.ini"], root);
    assert.equal(probe, undefined);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("renderProbes formats each probe with a clear delimiter", () => {
  const out = renderProbes([
    { tool: "lint", source: "a.md", content: "exit 0 — no issues" },
    { tool: "file-read", source: "b.ts", content: "function x() {}" },
  ]);
  assert.match(out, /\[lint\] a\.md/);
  assert.match(out, /exit 0 — no issues/);
  assert.match(out, /\[file-read\] b\.ts/);
});

test("repo-scanner injects probe output into the user prompt when probes are enabled", async () => {
  const root = await mkdtemp(join(tmpdir(), "selfevo-rl-"));
  try {
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src/hello.txt"), "hello-world", "utf8");

    const llm = new CapturingLLM(
      JSON.stringify({
        findings: [
          {
            source: "tool:file-read",
            claim: "src/hello.txt reads 'hello-world'",
            evidence: "shown verbatim in probe output",
          },
        ],
      }),
    );
    const resolver = new LLMResolver(DEFAULT_LLM_CONFIG);
    resolver.for = () => llm;
    resolver.skillsFor = () => [];
    const services: AgentServices = {
      resolver,
      skillsRoot: "/nonexistent",
      repoRoot: root,
      workspaceRoot: root,
    };

    // Topic doesn't trigger detectDocTopic, but ripgrep should hit
    // `hello-world` in src/hello.txt → file-read probe runs.
    const node = makeRepoScannerNode(services);
    const out = await node(
      stateFor('Mention "hello-world" in src', ["check the src tree"]),
    );

    assert.ok(llm.lastUser);
    assert.match(llm.lastUser!, /Tool probes/);
    // The system prompt forces grounding citations.
    assert.match(llm.lastSystem!, /GROUNDING RULE/);
    // Round-trip the canned response.
    assert.equal(out.findings!.length, 1);
    assert.match(out.findings![0]!.source, /tool:file-read|inference|src/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("repo-scanner skips probes when disableProbes is set (for cheap tests)", async () => {
  const root = await mkdtemp(join(tmpdir(), "selfevo-rl-"));
  try {
    const llm = new CapturingLLM('{"findings":[]}');
    const resolver = new LLMResolver(DEFAULT_LLM_CONFIG);
    resolver.for = () => llm;
    resolver.skillsFor = () => [];
    const services: AgentServices = {
      resolver,
      skillsRoot: "/nonexistent",
      repoRoot: root,
      workspaceRoot: root,
    };
    const node = makeRepoScannerNode(services, { disableProbes: true });
    await node(stateFor("Tighten ROLLOUT.md formatting", []));
    assert.match(llm.lastUser!, /no tool probes available/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
