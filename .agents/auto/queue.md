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

### Topic: Refactor LLMResolver to support pluggable provider adapters (no behaviour change)

- req: Boundary: only .agents/orchestrators/self-evo/src/llm/resolver.ts may be modified
- req: Introduce a `ProviderAdapter` interface that current subprocess + anthropic clients both satisfy; resolver picks adapter by `mode` string
- req: Keep mode = "subprocess" | "api" working with no behavioural change; tests stay green
- req: No new provider implementations in this round — only the refactor that makes the next three additive

### Topic: Add OpenAI Codex CLI transport adapter to self-evo

- req: Boundary: only .agents/orchestrators/self-evo/src/llm/codex.ts (new) and src/llm/resolver.ts may be modified
- req: New mode = "codex" wraps the `codex` CLI as a subprocess; mirror the shape of llm/subprocess.ts but use codex's argument conventions
- req: Add a unit test that uses `cat` as the binary to confirm the adapter spawns and reads stdout

### Topic: Add Google Gemini CLI transport adapter to self-evo

- req: Boundary: only .agents/orchestrators/self-evo/src/llm/gemini.ts (new) and src/llm/resolver.ts may be modified
- req: New mode = "gemini" wraps the `gemini` CLI as a subprocess; same shape contract as the codex adapter
- req: Add a unit test analogous to the codex test

### Topic: Add GitHub Copilot CLI transport adapter to self-evo

- req: Boundary: only .agents/orchestrators/self-evo/src/llm/copilot.ts (new) and src/llm/resolver.ts may be modified
- req: New mode = "copilot" wraps the GitHub Copilot CLI (`gh copilot suggest` or equivalent) as a subprocess
- req: Add a unit test analogous to the codex/gemini tests

### Topic: Document multi-provider routing in llm.example.yaml and the self-evo README

- req: Boundary: only .agents/orchestrators/self-evo/config/llm.example.yaml and .agents/orchestrators/self-evo/README.md may be modified
- req: Show one example node routed to each new provider (codex, gemini, copilot) with brief notes on when to use each
- req: README's "Recommended LLM setup" section gains a "Other providers" subsection
