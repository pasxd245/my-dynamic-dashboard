# @self/orchestrator — `self-evo`

Multi-agent orchestrator that drives **PDCA rounds on this repo itself**.
Each run takes a topic + requirements, walks a fixed pipeline of agents:

- scan → scope → classify → plan → patch → verify → judge → HITL → round-writer
- and pauses at a human-in-the-loop gate for approve / revise / quit.

Built on **LangGraph.js** (`StateGraph` + `interrupt()` + `SqliteSaver`)
for orchestration and (from R-D onwards) **Mem0** for cross-round
memory.

## Status

This is **R-A**: skeleton + LangGraph wiring. Every node is a stub.
No real LLM calls yet. The graph compiles, walks every node, and
pauses at the HITL interrupt. See [ROLLOUT.md](./ROLLOUT.md) for the
multi-round plan and what each subsequent round adds.

## Quick start

```sh
pnpm install
pnpm --filter @self/orchestrator build
scripts/self-evo.sh round "smoke test" --req "stub"
# → prints runId + state-json path + HITL prompt
echo "approve" | scripts/self-evo.sh resume <runId>
```

## Pipeline

```text
START → intake → repo-scanner → boundary-scoper → change-classifier
      → plan-writer → patch-author → verifier
      → judge ──refine──▶ revertTo
               └─approve──▶ HITL interrupt
HITL: approve → round-writer → END
      apply   → apply-verifier → HITL (re-pause with delta)
      revise  → reset(stage) → re-enter
      quit    → END
```

## Layout

```text
src/
  state.ts         # SelfEvoState — LangGraph Annotation.Root
  graph.ts         # StateGraph wiring (nodes + edges)
  nodes/           # one file per pipeline stage
  persistence/     # SqliteSaver factory, run workspace helpers
  cli.ts           # `round <topic>` / `resume <runId>`
  config.ts        # INI loader
test/              # node:test
config/self-evo.ini
scripts/self-evo.sh
runs/              # gitignored; one folder per run
```

## Recommended LLM setup

Out of the box, every node calls `claude -p` as a subprocess. Zero
setup, uses your Claude Code auth — but startup overhead is ~30 s
per call. For most nodes that's fine; for `patch-author` (which loops
once per plan step and emits unified diffs) it adds up fast.

Recommended setup:

1. Copy `config/llm.example.yaml` → `config/llm.yaml`.
2. Set `ANTHROPIC_API_KEY` in the environment.
3. Patch-author now runs against the Anthropic SDK directly with
   `maxTokens: 16384`. Everything else stays on subprocess.

The `[llm] configPath` line in `config/self-evo.ini` auto-discovers
`config/llm.yaml` next to it — no other change needed.

If you don't have an API key handy, leave the layout as-is; rounds
still close, just slower at the patch-author stage.

## LangSmith tracing (opt-in)

Self-evo auto-exports spans to LangSmith when the standard LangChain
env vars are set — no flag in `self-evo.ini` needed. Each invoke is
tagged `self-evo` + `run:<runId>` and named `self-evo:<runId>` so
threads are easy to find.

```sh
export LANGCHAIN_TRACING_V2=true
export LANGCHAIN_API_KEY=<your-key>
export LANGCHAIN_PROJECT=self-evo        # optional
# LANGCHAIN_ENDPOINT=https://your-self-hosted-langsmith  # optional
scripts/self-evo.sh round "your topic"
```

Leave the env vars unset and zero network calls happen.

## See also

- [.agents/AGENTS.md](../../AGENTS.md) — repo-wide agent guide
- [.agents/plan/PDCA.md](../../plan/PDCA.md) — PDCA methodology
  this orchestrator enacts
- [ROLLOUT.md](./ROLLOUT.md) — multi-round delivery plan + handoff
  notes for the next session
