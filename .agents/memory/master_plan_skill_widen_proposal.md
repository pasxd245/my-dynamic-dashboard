# Proposal — widen the `master-plan` skill to cover cross-round arcs

**Status**: Implemented 2026-05-18 — see [SKILL.md v2.0](../skills/master-plan/SKILL.md). Kept for traceability.
**Author**: claude (agent), 2026-05-18
**Promotion target**: [.agents/skills/master-plan/SKILL.md](../skills/master-plan/SKILL.md)

## Observation

[.agents/skills/master-plan/SKILL.md](../skills/master-plan/SKILL.md) is named **master-plan** but its procedure produces a _single-round_ phase plan: it writes one `.agents/plan/cycles/Round_XX.md` with 3–8 phases.

On 2026-05-18 (R01 of `packages/ui`), a user asked the agent to "make a master-plan" for shipping a workspace package whose end state required at least two rounds (publish package → migrate consumer). The agent invoked the skill, produced `Round_01.md` correctly per the SKILL.md procedure, and the user replied: _"Guru where is master plan?"_ The expected artifact was the **cross-round arc** (end-state surface, per-round delivery table, invariants spanning rounds) — which the skill does not template.

## Proposed change

Add a § 0 "Scope check" to the skill that branches:

- **If the work fits in one round** (single feature, per [[round-cadence]]): proceed as today — write `Round_NN.md` only.
- **If the work chains across rounds**: also write `docs/agents/plan/<topic>-master-plan.md` _before_ the first round file, containing:
  - End-state target (file tree, API surface).
  - Per-round delivery table (which subpath / component lands in which round).
  - Invariants that apply to **every** round.
  - Out-of-scope list.
  - Sign-off questions blocking R01 start.

The heuristic for "chains across rounds": end state involves migrating an existing consumer, _or_ end state has > 4 logical features, _or_ end state mixes "create new" with "delete old".

## Why not edit the skill directly

`skills/` is READ-ONLY for agents per [AGENTS.md § Authority Rules](../../AGENTS.md). This memory is the agent-side proposal; the actual edit needs a human to apply it to `SKILL.md`.

## Related

- [[round-cadence]] — one feature per round; this proposal makes the skill respect that boundary instead of pushing chains into one round.
- [[plan-writer-overdecomposes]] — relevant: a multi-round master plan reduces the temptation to over-decompose one round.
