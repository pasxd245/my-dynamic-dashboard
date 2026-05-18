# `.agents/plan/meta/` — Meta-PDCA rounds

This directory holds `Meta_NN.md` rounds — PDCA cycles whose subject is the **agent infrastructure itself** (self-evo orchestrator, autoagent harness, master-agent workflow docs, skills, memory). Sibling: [`../cycles/`](../cycles/) holds `Round_NN.md` rounds that drive `my-dynamic-dashboard` (the product under `apps/`, `packages/`) toward production-readiness.

## Conventions

- File naming: `Meta_NN.md`, zero-padded. Numbered independently of `cycles/Round_NN.md`.
- Round template: [`../PDCA.md`](../PDCA.md) + **one extra required section: `## Product-velocity justification`** answering "which next ≥3 product rounds does this shorten or de-risk?". Without it, the round is vanity (per workflow rule 2).
- Verification levels (`auto` / `demo` / `user`): [`../DoD.md`](../DoD.md).
- Promotions log (shared with `cycles/`): [`../promotions.md`](../promotions.md). One audit trail across both tracks.
- Authority: master-agent only authors `Meta_NN.md`. Self-evo executing on its own internals is the recursion failure mode the workflow doc is built to avoid.
- Rule of thumb for Round vs Meta: "does this change make today's product build, ship, or run differently?" — yes → Round, no → Meta.

## What counts as Meta

Open a `Meta_NN.md` when the work changes:

- `.agents/orchestrators/**` — orchestrator code, prompts, state schema
- `.agents/skills/**` — skill definitions or new skills
- `.agents/memory/**` — non-promotion memory edits (promotions go through the shared log)
- `docs/agents/**` — workflow docs, governance rules
- `.claude/commands/autoagent.md` — autoagent harness contract
- CI gates or hooks that enforce agent-system rules

Anything else (primarily `apps/`, `packages/`, product specs, product-facing docs) → [`../cycles/`](../cycles/).

## Warm-start — 2026-05-18

This track was opened on 2026-05-18 as part of the warm-start commit, after `Round_01..08` (the 2026-05-17/18 self-evo bootstrap rounds) were found to be miscategorised under the product `cycles/` namespace and deleted. The Meta series starts cleanly at `Meta_01` here.

## See also

- [`../cycles/README.md`](../cycles/README.md) — sibling directory for product rounds
- [`../PDCA.md`](../PDCA.md) — round template + governance
- [`../../memory/purpose-hierarchy.md`](../../memory/purpose-hierarchy.md) — why product outranks meta
- [`../../../docs/agents/workflows/agent-architecture.workflow.md`](../../../docs/agents/workflows/agent-architecture.workflow.md) — full agent system contract
