---
name: llm-mode-taxonomy
description: LLMClient.mode is a TRANSPORT taxonomy ("local" | "subprocess" | "api"), not a PROVIDER taxonomy. Provider (claude/codex/gemini/copilot/ollama) is config, not type.
metadata:
  type: project
---

The `LLMClient.mode` union in
[.agents/orchestrators/self-evo/src/llm/client.ts](../orchestrators/self-evo/src/llm/client.ts)
is a **transport** taxonomy, not a provider taxonomy.

**Correct shape**:

```ts
readonly mode: "local" | "subprocess" | "api";
```

- `local` — local LLM runtime (ollama, lmstudio, llama.cpp). HTTP to
  `localhost`; offline-capable; no auth.
- `subprocess` — CLI wrapping a vendor's subscription/session (claude,
  codex, gemini, copilot). Spawn binary, pipe prompt via stdin, read
  stdout. Auth is whatever the CLI does (login session, gh auth, etc.).
- `api` — direct HTTP API with a vendor key (Anthropic, OpenAI, Google,
  GitHub). Bearer-token auth.

**Provider** (which vendor's model is being invoked) is **config**, not
type. The same `subprocess` adapter can wrap claude, codex, gemini, or
copilot by varying `command` + `args`. The same `api` adapter can hit
Anthropic, OpenAI, or Google by varying base URL + auth header.

**The mistake to avoid** (made on 2026-05-18 Round 07): adding `"codex"`
as a third mode variant. This conflates transport with provider, and
causes a combinatorial explosion — each new vendor wants its own mode
(`"codex"`, `"gemini"`, `"copilot"`, ...), each transport-axis change
multiplies (`"openai-api"`, `"google-api"`, ...).

**Today's state** (2026-05-18): Round 07 landed `src/llm/codex.ts` and
widened the mode union to include `"codex"`. **This is wrong and should
be reverted.** `codex.ts` is structurally a clone of `subprocess.ts`
with different default `command` + `args` — it should be deleted, and
the `"codex"` mode reverted from `client.ts`. Codex/gemini/copilot
become subprocess-mode config presets in
[config/llm.example.yaml](../orchestrators/self-evo/config/llm.example.yaml),
not new adapters.

**How master-agent applies this** when authoring queue topics:

- New LLM provider → **config preset under existing transport**, NOT
  a new adapter file. Queue a one-line `llm.example.yaml` addition.
- New transport (e.g., adding `local` for ollama) → new adapter file
  is justified; provider variation within that transport is config.
- Resolver dispatch keys on `mode` (transport), then picks per-provider
  defaults from config. Not the other way around.

Open round candidate: revert Round 07's `codex.ts` + mode-union widen;
re-cast codex as a subprocess config preset; add `local.ts` if HTTP-to-
localhost is meaningfully different from `api` (open question — see
the workflow doc's "Routing rules" for the criterion).

Related: [[agent-tier-taxonomy]], [[verifier-trust-gap]], [[round-cadence]].
