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

### Topic: Clean dist-test/ before recompile in @self/orchestrator's build:test

- req: Boundary: only `.agents/orchestrators/self-evo/package.json` may be modified
- req: The `build:test` npm script currently runs `tsc -p tsconfig.test.json` (or equivalent) which leaves stale compiled `.js` files in `dist-test/` when source `.ts` files are renamed, moved, or deleted. Today's Round 06 exposed this: yesterday's reverted Round 06b left `dist-test/test/codex.test.js` + `dist-test/src/llm/codex.js` even though no `.ts` source exists, and the verifier picked them up as fake test failures.
- req: Modify the `build:test` script to remove `dist-test/` before invoking tsc. Use a portable approach — prefer `rm -rf dist-test && tsc -p tsconfig.test.json` over installing a `rimraf` dependency. If you need a Node-native alternative, `node -e "require('node:fs').rmSync('dist-test',{recursive:true,force:true})" && tsc -p tsconfig.test.json` is acceptable.
- req: After the change, `pnpm --filter @self/orchestrator test` must still pass cleanly on the current `test/` directory contents (12 test files, no codex/gemini/copilot tests yet).
- req: Do NOT add new dependencies. Do NOT touch tsconfig.test.json. Do NOT modify any test file.

### Topic: Add OpenAI Codex CLI adapter — file only (codex.ts + LLMClient union widen)

- req: Boundary: only `.agents/orchestrators/self-evo/src/llm/codex.ts` (new) and `.agents/orchestrators/self-evo/src/llm/client.ts` (one-line edit) may be modified. NO resolver.ts changes. NO test file in this round.
- req: client.ts edit: widen the `LLMClient.mode` union from `"subprocess" | "api"` to `"subprocess" | "api" | "codex"`. That's it — one line.
- req: codex.ts MUST mirror src/llm/subprocess.ts byte-for-byte structurally — same `LLMClient` shape (`mode`, `capabilities`, async `complete`), same `spawn(command, args, { stdio: ["pipe", "pipe", "pipe"], env })`, same setTimeout+SIGTERM timeout pattern, same `child.stdin.write(buildPrompt(req)); child.stdin.end()` to pipe the prompt, same stdout-chunks-to-string accumulation. **Prompt is piped via stdin, never passed as positional argv.**
- req: Exported factory is `makeCodexClient(opts: CodexClientOptions = {})`. Defaults: `command = "codex"`, `args = ["exec", "-"]` (verified: `codex exec` reads prompt from stdin when prompt arg is `-`; `codex exec --help` documents this). `mode: "codex"` in the returned client.
- req: Plan-writer MUST emit exactly 2 plan steps (one per file). DO NOT decompose either file into sub-steps. The codex.ts factory is small enough (~60 lines mirroring subprocess.ts) to fit in one patch-author call.
- req: Do NOT introduce any positional-argv code path. Do NOT add `stdio: ["ignore", ...]`. Do NOT bypass `child.stdin`. If tempted to deviate from subprocess.ts's shape: don't.
- req: Existing tests (12 files) must still pass — `makeCodexClient` is unused dead code at this point, which is fine.

### Topic: Add codex.test.ts — exercises the stdin→stdout transport via `cat`

- req: Boundary: only `.agents/orchestrators/self-evo/test/codex.test.ts` (new) may be modified. NO src/ changes. NO resolver wiring.
- req: Use Node's built-in `test` + `assert` modules: `import { test } from "node:test"; import assert from "node:assert/strict";`. Match the import style of `test/skeleton.test.ts` or `test/r-g.test.ts`.
- req: Construct the client with `command: "cat"`, `args: []` (cat echoes stdin → stdout regardless of args). Call `await client.complete({ user: "hello from codex test" })`. Assert `result.text.includes("hello from codex test")`. ONE test case is enough — don't add timeout / multi-prompt / non-zero-exit tests in this round (those tripped up the last attempt).
- req: Plan-writer MUST emit exactly 1 plan step. This is one ~15-line test file.
- req: After the patch, `pnpm --filter @self/orchestrator test` must report 13 test files (12 existing + 1 new), all passing.

### Topic: Wire codex adapter into resolver.ts

- req: Boundary: only `.agents/orchestrators/self-evo/src/llm/resolver.ts` may be modified.
- req: Two small edits: (1) widen the `LLMMode` type alias to include `"codex"`; (2) add a `case "codex": return makeCodexClient(opts)` (or equivalent map entry) to the existing `ProviderAdapter` dispatch landed in Round 05. Import `makeCodexClient` from `./codex.js`.
- req: Plan-writer MUST emit exactly 1 plan step. This is two related edits to one file.
- req: After the patch, `pnpm --filter @self/orchestrator test` must still pass cleanly (the new codex.test.ts continues to pass via the `cat`-as-binary trick; no resolver-level test is required in this round).

### Topic: Add Google Gemini CLI transport adapter to self-evo

- req: Boundary: only `.agents/orchestrators/self-evo/src/llm/gemini.ts` (new) and `.agents/orchestrators/self-evo/src/llm/resolver.ts` may be modified, plus a new test at `.agents/orchestrators/self-evo/test/gemini.test.ts`
- req: gemini.ts MUST mirror src/llm/subprocess.ts (and the freshly-landed codex.ts) structurally — stdin-pipe transport, same `LLMClient` shape, same timeout pattern
- req: Exported factory is `makeGeminiClient(opts: GeminiClientOptions = {})`. Defaults: `command = "gemini"`, `args = ["-p", ""]` (verified: `gemini -p <prompt>` is the documented non-interactive mode, and the help text states the prompt arg is "Appended to input on stdin (if any)" — so an empty `-p` value plus stdin works). `mode: "gemini"` in the returned client.
- req: resolver.ts adapter map gains `gemini` → `makeGeminiClient(opts)`. Tests-via-cat pattern identical to codex.test.ts.
- req: Same anti-patterns barred as codex: no positional-argv prompt, no `stdio: ["ignore"]`, no bypassing stdin.

### Topic: Add GitHub Copilot CLI transport adapter to self-evo

- req: Boundary: only `.agents/orchestrators/self-evo/src/llm/copilot.ts` (new) and `.agents/orchestrators/self-evo/src/llm/resolver.ts` may be modified, plus a new test at `.agents/orchestrators/self-evo/test/copilot.test.ts`
- req: copilot.ts MUST mirror subprocess.ts/codex.ts/gemini.ts structurally — same stdin-pipe transport
- req: Exported factory is `makeCopilotClient(opts: CopilotClientOptions = {})`. Defaults: `command = "copilot"` (NOT `gh copilot` — verified: a top-level `copilot` binary is on PATH, the modern GitHub Copilot CLI), `args = ["-p", "", "--allow-all-tools", "-s"]` (verified from `copilot --help`: `-p <text>` is non-interactive mode, `--allow-all-tools` is required for non-interactive, `-s/--silent` strips stats for clean stdout). `mode: "copilot"` in the returned client.
- req: resolver.ts adapter map gains `copilot` → `makeCopilotClient(opts)`. Tests use `command: "cat"`, `args: []`, same `"hello" in stdout` assertion.
- req: Same anti-patterns barred. NOTE: copilot's real CLI may not read stdin — that's a runtime concern for the user, NOT a reason to deviate from the stdin transport contract in this round. The test only exercises the transport via `cat`.

### Topic: Document multi-provider routing in llm.example.yaml and the self-evo README

- req: Boundary: only .agents/orchestrators/self-evo/config/llm.example.yaml and .agents/orchestrators/self-evo/README.md may be modified
- req: Show one example node routed to each new provider (codex, gemini, copilot) with brief notes on when to use each
- req: README's "Recommended LLM setup" section gains a "Other providers" subsection
