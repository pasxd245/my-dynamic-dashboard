import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { composeSystemPrompt } from "../src/skills/compose.js";
import {
  bundleFingerprint,
  loadSkills,
  SkillNotFoundError,
} from "../src/skills/loader.js";
import { makeSubprocessClient } from "../src/llm/subprocess.js";
import { LLMResolver, DEFAULT_LLM_CONFIG } from "../src/llm/resolver.js";

async function withSkillsDir<T>(
  spec: Array<{ name: string; description: string; body: string }>,
  fn: (dir: string) => Promise<T>,
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "selfevo-skills-"));
  try {
    for (const s of spec) {
      await mkdir(join(dir, s.name), { recursive: true });
      await writeFile(
        join(dir, s.name, "SKILL.md"),
        `---\nname: ${s.name}\ndescription: ${s.description}\n---\n\n${s.body}\n`,
        "utf8",
      );
    }
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("loadSkills reads SKILL.md, strips frontmatter, fingerprints stable", async () => {
  await withSkillsDir(
    [
      { name: "alpha", description: "first", body: "alpha-body-1" },
      { name: "beta", description: "second", body: "beta-body-2" },
    ],
    async (dir) => {
      const skills = await loadSkills(["alpha", "beta"], { dir });
      assert.equal(skills.length, 2);
      assert.equal(skills[0]!.name, "alpha");
      assert.equal(skills[0]!.description, "first");
      assert.equal(skills[0]!.body.trim(), "alpha-body-1");
      assert.match(skills[0]!.fingerprint, /^[0-9a-f]{64}$/);

      // Same content → same fingerprint
      const again = await loadSkills(["alpha"], { dir });
      assert.equal(skills[0]!.fingerprint, again[0]!.fingerprint);

      // Different content → different bundle fingerprint
      const fp1 = bundleFingerprint(skills);
      const fp2 = bundleFingerprint([skills[0]!]);
      assert.notEqual(fp1, fp2);
    },
  );
});

test("loadSkills throws SkillNotFoundError for unknown skill", async () => {
  await withSkillsDir([], async (dir) => {
    await assert.rejects(
      () => loadSkills(["missing"], { dir }),
      (err: unknown) => err instanceof SkillNotFoundError,
    );
    const ok = await loadSkills(["missing"], { dir, ignoreMissing: true });
    assert.equal(ok.length, 0);
  });
});

test("composeSystemPrompt wraps each skill with delimiters + fingerprint", async () => {
  await withSkillsDir(
    [{ name: "alpha", description: "x", body: "RULE-1" }],
    async (dir) => {
      const skills = await loadSkills(["alpha"], { dir });
      const out = composeSystemPrompt("BASE", skills);
      assert.match(out, /BASE/);
      assert.match(out, /<!-- skill:alpha@[0-9a-f]{8} BEGIN -->/);
      assert.match(out, /RULE-1/);
      assert.match(out, /<!-- skill:alpha@[0-9a-f]{8} END -->/);
    },
  );
});

test("composeSystemPrompt with no skills returns base unchanged", () => {
  assert.equal(composeSystemPrompt("BASE", []), "BASE");
});

test("subprocess client runs `cat` and echoes prompt", async () => {
  // Use `cat` as the canned subprocess — it just echoes stdin to stdout.
  const client = makeSubprocessClient({ command: "cat", args: [] });
  const res = await client.complete({ system: "SYS", user: "USR" });
  assert.match(res.text, /SYS/);
  assert.match(res.text, /USR/);
  assert.equal(client.mode, "subprocess");
  assert.equal(client.capabilities.maxConcurrency, 1);
});

test("subprocess client surfaces non-zero exit codes", async () => {
  const client = makeSubprocessClient({ command: "false", args: [] });
  await assert.rejects(
    () => client.complete({ system: "", user: "x" }),
    /exited 1/,
  );
});

test("LLMResolver merges default + node + env overrides", () => {
  const cfg = {
    default: { mode: "subprocess" as const, command: "claude", args: ["-p"] },
    nodes: {
      "plan-writer": { skills: ["a", "b"], command: "claude-plan" },
    },
  };
  const r = new LLMResolver(cfg);
  const eff = r.effective("plan-writer");
  assert.equal(eff.command, "claude-plan");
  assert.deepEqual(r.skillsFor("plan-writer"), ["a", "b"]);
  assert.deepEqual(r.skillsFor("repo-scanner"), []);

  // Env override
  process.env.SELFEVO_LLM_PLAN_WRITER_MODEL = "claude-opus-4-7";
  try {
    const eff2 = r.effective("plan-writer");
    assert.equal(eff2.model, "claude-opus-4-7");
  } finally {
    delete process.env.SELFEVO_LLM_PLAN_WRITER_MODEL;
  }
});

test("LLMResolver.for() returns subprocess client by default", () => {
  const r = new LLMResolver(DEFAULT_LLM_CONFIG);
  const client = r.for("repo-scanner");
  assert.equal(client.mode, "subprocess");
});
