# Autoagent topic queue

Round topics autoagent will drain in order. Format:

```markdown
### Topic: <one-line topic>

- req: <requirement 1>
- req: <requirement 2>
```

Mark consumed entries with `[x]` after the round closes:

```markdown
### [x] Topic: (consumed)
```

Autoagent picks the first un-checked `### Topic:` heading.

---

<!-- enqueue rounds below this line -->

### [x] Topic: Add a one-line cross-link to /autoagent at the top of the self-evo README (smoke test, 2026-05-17, dry-run, Round_04)

- req: (consumed) only .agents/orchestrators/self-evo/README.md may be modified
- req: (consumed) Add a single short sentence near the top mentioning that `/autoagent` (defined at .claude/commands/autoagent.md) drives self-evo through autonomous overnight rounds
- req: (consumed) Preserve all existing sections and headings; only insert a brief reference, do not restructure
- req: (consumed) File must still pass markdownlint

### [x] Topic: Refactor LLMResolver to support pluggable provider adapters (no behaviour change) — done 2026-05-17, Round_05, autoagent/20260517/Round_05

- req: Boundary: only .agents/orchestrators/self-evo/src/llm/resolver.ts may be modified
- req: Introduce a `ProviderAdapter` interface that current subprocess + anthropic clients both satisfy; resolver picks adapter by `mode` string
- req: Keep mode = "subprocess" | "api" working with no behavioural change; tests stay green
- req: No new provider implementations in this round — only the refactor that makes the next three additive

### [x] Topic: Clean dist-test/ before recompile in @self/orchestrator's build:test — done 2026-05-18, Round_06, autoagent/20260518/Round_06

- req: Boundary: only `.agents/orchestrators/self-evo/package.json` may be modified
- req: The `build:test` npm script currently runs `tsc -p tsconfig.test.json` (or equivalent) which leaves stale compiled `.js` files in `dist-test/` when source `.ts` files are renamed, moved, or deleted. Today's Round 06 exposed this: yesterday's reverted Round 06b left `dist-test/test/codex.test.js` + `dist-test/src/llm/codex.js` even though no `.ts` source exists, and the verifier picked them up as fake test failures.
- req: Modify the `build:test` script to remove `dist-test/` before invoking tsc. Use a portable approach — prefer `rm -rf dist-test && tsc -p tsconfig.test.json` over installing a `rimraf` dependency. If you need a Node-native alternative, `node -e "require('node:fs').rmSync('dist-test',{recursive:true,force:true})" && tsc -p tsconfig.test.json` is acceptable.
- req: After the change, `pnpm --filter @self/orchestrator test` must still pass cleanly on the current `test/` directory contents (12 test files, no codex/gemini/copilot tests yet).
- req: Do NOT add new dependencies. Do NOT touch tsconfig.test.json. Do NOT modify any test file.

### [x] Topic: Add OpenAI Codex CLI adapter — file only (codex.ts + LLMClient union widen) — done 2026-05-18, Round_07, autoagent/20260518/Round_07

- req: Boundary: only `.agents/orchestrators/self-evo/src/llm/codex.ts` (new) and `.agents/orchestrators/self-evo/src/llm/client.ts` (one-line edit) may be modified. NO resolver.ts changes. NO test file in this round.
- req: client.ts edit: widen the `LLMClient.mode` union from `"subprocess" | "api"` to `"subprocess" | "api" | "codex"`. That's it — one line.
- req: codex.ts MUST mirror src/llm/subprocess.ts byte-for-byte structurally — same `LLMClient` shape (`mode`, `capabilities`, async `complete`), same `spawn(command, args, { stdio: ["pipe", "pipe", "pipe"], env })`, same setTimeout+SIGTERM timeout pattern, same `child.stdin.write(buildPrompt(req)); child.stdin.end()` to pipe the prompt, same stdout-chunks-to-string accumulation. **Prompt is piped via stdin, never passed as positional argv.**
- req: Exported factory is `makeCodexClient(opts: CodexClientOptions = {})`. Defaults: `command = "codex"`, `args = ["exec", "-"]` (verified: `codex exec` reads prompt from stdin when prompt arg is `-`; `codex exec --help` documents this). `mode: "codex"` in the returned client.
- req: Plan-writer MUST emit exactly 2 plan steps (one per file). DO NOT decompose either file into sub-steps. The codex.ts factory is small enough (~60 lines mirroring subprocess.ts) to fit in one patch-author call.
- req: Do NOT introduce any positional-argv code path. Do NOT add `stdio: ["ignore", ...]`. Do NOT bypass `child.stdin`. If tempted to deviate from subprocess.ts's shape: don't.
- req: Existing tests (12 files) must still pass — `makeCodexClient` is unused dead code at this point, which is fine.

### [x] Topic: Self-evo writes Round_NN.md after apply-verifier clean — close the lesson-learn loop's input gap — done 2026-05-18 (manual Round_08, see .agents/plan/cycles/Round_08.md)

- req: Boundary: only `.agents/orchestrators/self-evo/src/nodes/apply-verifier.ts` may be modified. Soft-locked; requires `/autoagent --allow-llm-edit`.
- req: Problem statement (grounded in code, verified 2026-05-18): the graph routes `apply-verifier → hitl-gate` (`src/graph.ts:134`). The round-writer node — which is the ONLY caller of `renderRoundMarkdown` + `writeFile` to `.agents/plan/cycles/Round_NN.md` — is reachable only via `hitl.kind === "approve"` (`src/graph.ts:127`). Result: a round closed via `apply` (today's autoagent default per `.claude/commands/autoagent.md` step 7) produces NO `Round_NN.md` PDCA artifact. Today's rounds 06 and 07 demonstrated this empirically — patches landed in main, but `.agents/plan/cycles/` got no new files. The lesson-learn loop documented in [docs/agents/workflows/agent-architecture.workflow.md](../../docs/agents/workflows/agent-architecture.workflow.md) has no input without these artifacts.
- req: Fix: extend `apply-verifier.ts` so that when `appliedVerification.checks` are all pass (or all known-noise — match the existing classification logic in the file if any), the node ALSO writes a `Round_NN.md` artifact to `<repoRoot>/.agents/plan/cycles/`. Mint the next round number by reading existing entries and matching `/^Round_(\d+)\.md$/i` (mirroring the regex at `src/nodes/round-writer.ts:27`). Render the file via `renderRoundMarkdown` from `src/renderers/round-template.js` (already used by round-writer.ts:11).
- req: Best-effort write: if the artifact write throws (permissions, disk full, etc.), catch and log via `console.error("[apply-verifier] cycles artifact write failed: …")` and continue. Do NOT fail the round on artifact-write failure.
- req: Do NOT duplicate the promotions-log append, the memory.add candidate emission, or any other side-effects of round-writer.ts. Those remain in the `approve` path. This round addresses ONLY the missing `Round_NN.md`.
- req: Update `apply-verifier.ts`'s leading comment block to describe the new behaviour: "When checks pass cleanly, also emit a `Round_NN.md` artifact so apply-closed rounds contribute to the lesson-learn loop, not just approve-closed rounds."
- req: Plan-writer MUST emit exactly 1 plan step. One file, one feature.
- req: After the patch, `pnpm --filter @self/orchestrator test` must still pass (65/65 today). Add no new test in this round — the apply-verifier test (`test/r-i.test.ts` or wherever its tests live) may need an update if the test mocks `appliedVerification.checks`; that's an in-scope adjustment to the existing test file IF strictly required to keep tests green, NOT a new test file.
- req: Justification under [[purpose-hierarchy]]: without persistent `Round_NN.md` artifacts, the lesson-learn loop has no input → every product round re-discovers the same mistakes → product velocity decays over time. Acceptable meta-cost (one round) for a permanent feedback-loop capability.

### [x] Topic: Add codex.test.ts — exercises the stdin→stdout transport via `cat` — SUPERSEDED 2026-05-18 per [[llm-mode-taxonomy]]

- req: (superseded) Wrong-taxonomy: codex.test.ts depends on codex.ts existing as a separate adapter. The locked taxonomy decision is `LLMMode = "local" | "subprocess" | "api"`; provider is config, not type. codex.test.ts should be a subprocess-mode preset test, not its own adapter test. Do not enqueue until R-O re-scope happens.

### [x] Topic: Wire codex adapter into resolver.ts — SUPERSEDED 2026-05-18 per [[llm-mode-taxonomy]]

- req: (superseded) Adds `case "codex"` to a dispatch that shouldn't key on provider.

### [x] Topic: Add Google Gemini CLI transport adapter to self-evo — SUPERSEDED 2026-05-18 per [[llm-mode-taxonomy]]

- req: (superseded) Would create gemini.ts as yet another mode variant.

### [x] Topic: Add GitHub Copilot CLI transport adapter to self-evo — SUPERSEDED 2026-05-18 per [[llm-mode-taxonomy]]

- req: (superseded) Same architectural error.

### [x] Topic: Document multi-provider routing in llm.example.yaml and the self-evo README — SUPERSEDED 2026-05-18 per [[llm-mode-taxonomy]]

- req: (superseded) Documents the wrong design.
