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

### Topic: Add OpenAI Codex CLI transport adapter to self-evo

- req: Boundary: only `.agents/orchestrators/self-evo/src/llm/codex.ts` (new) and `.agents/orchestrators/self-evo/src/llm/resolver.ts` may be modified, plus a new test file at `.agents/orchestrators/self-evo/test/codex.test.ts` (note: under `test/`, NOT under `src/llm/__tests__/`)
- req: codex.ts MUST mirror src/llm/subprocess.ts byte-for-byte structurally — same `LLMClient` shape (`mode`, `capabilities`, async `complete`), same `spawn(command, args, { stdio: ["pipe", "pipe", "pipe"], env })`, same setTimeout+SIGTERM timeout pattern, same `child.stdin.write(buildPrompt(req)); child.stdin.end()` to pipe the prompt, same stdout-chunks-to-string accumulation. **Prompt is piped via stdin, never passed as positional argv.**
- req: Exported factory is `makeCodexClient(opts: CodexClientOptions = {})`. Defaults: `command = "codex"`, `args = ["exec", "-"]` (verified: `codex exec` reads prompt from stdin when prompt arg is `-`; `codex exec --help` documents this). `mode: "codex"` in the returned client.
- req: resolver.ts gains a new case in its adapter map: `codex` → `makeCodexClient(opts)`. No other resolver changes.
- req: New test at `test/codex.test.ts` constructs the client with `command: "cat"`, `args: []` (cat echoes stdin to stdout regardless of args, exercising the stdin→stdout transport), calls `complete({ user: "hello" })`, and asserts the response text contains `"hello"`. Test must compile under `tsconfig.test.json` and pass via `pnpm --filter @self/orchestrator test`.
- req: Do NOT introduce any positional-argv code path. Do NOT add `stdio: ["ignore", ...]`. Do NOT bypass `child.stdin`. If the LLM is tempted to deviate from subprocess.ts's shape: don't.

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
