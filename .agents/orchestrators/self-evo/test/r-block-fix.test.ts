import test from "node:test";
import assert from "node:assert/strict";
import { truncateUserPrompt } from "../src/nodes/repo-scanner.js";

const TRAILER = "Produce findings as described in the system prompt.";

test("truncateUserPrompt: returns input unchanged when under the cap", () => {
  const short = "Topic: x\n\nRipgrep hits: (none)\n\n" + TRAILER;
  assert.equal(truncateUserPrompt(short, 1000), short);
});

test("truncateUserPrompt: truncates over-cap prompts while keeping head + trailer", () => {
  const head = "Topic: big\n\nRequirements:\n- R01: keep me\n\nRipgrep hits:\n";
  // 50 KB of filler simulating an explosion of probe + hit content.
  const filler = "X".repeat(50_000);
  const prompt = head + filler + "\n\n" + TRAILER;
  const out = truncateUserPrompt(prompt, 4000);
  assert.ok(out.length <= 4000, `length ${out.length} should be <= cap`);
  assert.ok(out.startsWith("Topic: big"), "head survives");
  assert.ok(out.includes(TRAILER), "trailer survives");
  assert.ok(out.includes("[truncated by repo-scanner"), "truncation marker present");
});

test("truncateUserPrompt: degenerate cap still produces output within budget", () => {
  const prompt = "x".repeat(2000);
  const out = truncateUserPrompt(prompt, 200);
  assert.ok(out.length <= 200);
});
