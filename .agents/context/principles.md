# Principles

Eight load-bearing invariants. Every workflow doc, autoagent flag, sub-agent contract, or memory entry must respect these. Violating one is a regression by definition.

For the mechanics that follow from these principles, see [docs/agents/workflows/agent-architecture.workflow.md](../../docs/agents/workflows/agent-architecture.workflow.md).

---

## P1 — Purpose hierarchy

Product (`my-dynamic-dashboard`) > infrastructure (master-agent + autoagent + self-evo) > meta (rounds that improve infrastructure).

A round that polishes infrastructure must justify itself in product-velocity terms: it shortens or de-risks the next ≥3 product rounds. Otherwise it's vanity.

A healthy [.agents/auto/queue.md](../auto/queue.md) is majority product topics. > 50% meta entries = drift.

## P2 — Three roles, never interchangeable

- **master-agent** has the conversation, makes design calls, writes code (either directly or post-HITL from self-evo).
- **autoagent** is a worker-agnostic time-extension harness — it doesn't pick what to work on; it manages branches, gates, and the tier-2 envelope.
- **self-evo** is a specialist sub-agent for memory, research, and bounded PDCA execution. It is **not** the default code executor.

A change to one role's responsibility surface that bleeds into another's is a regression.

## P3 — Critical-security is absolute

No flag (`--autopilot`, `--allow-llm-edit`, `--cold`, `--no-autopilot`), authority tier, smart-autopilot decision, or "the patches all apply cleanly" justification lifts:

- The hard-locked file list (autoagent.md, self-evo's graph / state / cli / persistence / dispatcher script).
- The critical-security path globs (`**/auth/**`, `**/.env*`, `**/secrets/**`, `**/crypto/**`, `**/keys/**`, `**/permissions/**`, `**/middleware/auth*`, `**/policy/**`, `.github/workflows/**`).
- The diff-content rules (new runtime `dependencies`, `child_process` / `vm` imports, new `eval(`).

Soft-locks (`src/llm/**`, `src/nodes/**`) are lifted only by `--allow-llm-edit` with explicit per-edit user authorization.

## P4 — Smart-autopilot decides within the safe envelope

Smart-autopilot is master-agent's **policy for making decisions under uncertainty when unattended**, not permission to escape the envelope. The decision table lives in [agent-architecture.workflow.md § Smart-autopilot](../../docs/agents/workflows/agent-architecture.workflow.md). Tier-2 still hard-stops.

When the user is attended: master-agent confirms (default).
When the user is unattended (cron, `--autopilot`): master-agent decides per the table.

The default bias is **escalate when in doubt** — a tier-2 stop with a clear blocker is cheap to resolve; an autonomous wrong call is not.

## P5 — Cold-start must work

Every master-agent decision must be derivable from disk state — [state.json](../auto/state.json), [memory/](../memory/), round files at [cycles/](../plan/cycles/), [queue.md](../auto/queue.md), recent reports.

Conversation context is convenience, not load-bearing. A session ends with all decisions persisted to disk; the next session — warm or cold — must be able to pick up without re-asking the user.

`--cold` is the discipline that enforces this in real time: read disk aggressively, dump decisions eagerly, never rely on "I remember from earlier in chat."

## P6 — Lessons capture immediately to a durable home

The lesson-learn loop ([agent-architecture.workflow.md § Lesson-learn loop](../../docs/agents/workflows/agent-architecture.workflow.md)) has 5 steps; only the first 2 (surface, capture) reliably happen today. Master-agent must close the gap by routing every lesson to the right home before the session closes:

| Lesson type                                              | Destination                                |
| -------------------------------------------------------- | ------------------------------------------ |
| Process / methodology rule binding future sessions       | `docs/agents/workflows/*` + principles     |
| Persistent project fact, decision, taxonomy, gotcha      | `.agents/memory/*.md`                      |
| Tightly-scoped fix self-evo or master-agent can land     | `.agents/auto/queue.md` topic              |
| Framework observation (orchestrator bug, rule ambiguity) | `.agents/auto/state.json.openObservations` |
| Ephemeral, won't matter next session                     | Conversation only                          |

Failing to capture is a regression on this principle, even if the round otherwise lands clean.

## P7 — Boundaries are declared minimums, not maximums

A round's `Allowed change boundary` is its **intent**. Small expansions to make types compile, builds pass, or the gate succeed are accepted with audit in the round's `Do` section. Silent boundary widening — adding files that aren't needed for the gate — is a regression.

Workspace-add rounds may necessarily modify root `pnpm-lock.yaml`; round-writer should pre-declare this. (See [agent-architecture.workflow.md](../../docs/agents/workflows/agent-architecture.workflow.md) for the boundary-vs-install-artifact carve-out.)

## P8 — Meta justifies via product velocity

Repeating P1 because it's the principle most easily violated mid-session: a meta-round (`Meta_NN.md` under [`.agents/plan/meta/`](../plan/meta/)) is justified only if it shortens or de-risks the next ≥3 product rounds. Master-agent challenges every proposed meta scope against this test before the round begins.

Idle is fine. When the dashboard is blocked on human-only decisions, the agents idle. They do **not** use that gap to keep working on themselves.

---

## How master-agent uses this file

- **Session start**: read this file before starting non-trivial work. The full workflow doc is the reference; principles is the quick check.
- **Pre-round**: verify the round's scope respects P1, P2, P7. A round that fails one of these should be re-scoped before drafting begins.
- **Pre-decision under uncertainty**: P3 → does this lift a hard rule? Then no. P4 → am I attended? Then ask. P5 → can I justify this from disk? If not, capture before deciding.
- **Session end**: route every lesson per P6.

When a principle and a workflow rule disagree, the principle wins. The workflow doc is the implementation; principles is the contract.
