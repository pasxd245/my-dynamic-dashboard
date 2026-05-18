---
name: agent-tier-taxonomy
description: master-agent / autoagent / worker three-tier model. Canonical contract at docs/agents/workflows/agent-architecture.workflow.md.
metadata:
  type: project
---

The repo's agent system has three tiers with non-overlapping
responsibilities. Confusing them is how scope bleeds and design errors
slip through worker rounds.

**Prerequisite framing**: the agent system exists to mature
my-dynamic-dashboard, not for its own sake. See [[purpose-hierarchy]]
before applying any of the rules below.

- **master-agent** = this Claude Code chat. Judgment, design review,
  scope, smart-autopilot triage, queue authorship, memory writes. Single
  instance per conversation. Decides what work to do and whether the
  work is conceptually right.
- **autoagent** = generic continuation harness at
  [.claude/commands/autoagent.md](../../.claude/commands/autoagent.md).
  Worker-agnostic state machine: per-round branches, HITL gate handling,
  tier-1/tier-2 authority, blockers.md, reports. Drives a registered
  worker; does NOT judge the work itself.
- **workers** = skilled executors. Currently one registered:
  **self-evo** (PDCA worker at [.agents/orchestrators/self-evo/](../orchestrators/self-evo/)).
  Future workers (doc-updater, flake-fixer) plug in via the worker
  contract. Workers cannot judge whether their assigned topic is
  correctly scoped — that's master-agent's job.

**Canonical doc**:
[docs/agents/workflows/agent-architecture.workflow.md](../../docs/agents/workflows/agent-architecture.workflow.md).
Load it before invoking `/autoagent` or `scripts/self-evo.sh` so the
boundaries are loaded into the session's working context.

**Smart-autopilot triage rule of thumb** (full flowchart in the doc):

- Tight boundary + testable success criterion + within a worker's core
  skill → **enqueue for the worker**
- Boundary unclear, decision is conceptual, or touches the worker's own
  brain → **handle in master-agent (with human)**
- Methodology / process rule that binds future sessions → **workflow doc**
- Persistent project fact that should survive a session reset → **memory**

Related: [[verifier-trust-gap]], [[llm-mode-taxonomy]], [[round-cadence]].
