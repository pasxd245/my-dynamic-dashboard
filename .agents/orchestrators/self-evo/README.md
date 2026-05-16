# @self/orchestrator — `self-evo`

Multi-agent orchestrator that drives **PDCA rounds on this repo itself**.
Each run takes a topic + requirements, walks a fixed pipeline of agents:

- scan → scope → classify → plan → patch → verify → judge → HITL → round-writer
- and pauses at a human-in-the-loop gate for approve / revise / quit.

Built on **LangGraph.js** (`StateGraph` + `interrupt()` + `SqliteSaver`) for orchestration and (from R-D onwards) **Mem0** for cross-round memory.

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

## Pipeline (R-A: all stubs)

```
START → intake → repo-scanner → boundary-scoper → change-classifier
      → plan-writer → patch-author → verifier
      → judge ──refine──▶ revertTo
               └─approve──▶ HITL interrupt
HITL: approve → round-writer → END
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

## See also

- [.agents/AGENTS.md](../../AGENTS.md) — repo-wide agent guide
- [.agents/plan/PDCA.md](../../plan/PDCA.md) — PDCA methodology
  this orchestrator enacts
- [ROLLOUT.md](./ROLLOUT.md) — multi-round delivery plan + handoff
  notes for the next session
