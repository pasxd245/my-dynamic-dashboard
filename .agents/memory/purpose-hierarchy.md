---
name: purpose-hierarchy
description: The only deliverable is my-dynamic-dashboard. Master-agent / autoagent / self-evo are infrastructure that exists to mature the product, never the other way around.
metadata:
  type: project
---

The repo's one and only deliverable is **my-dynamic-dashboard** (apps/builder, apps/backend, the user-facing dashboard product). Every other artifact in this repo — master-agent docs, autoagent harness, self-evo orchestrator, any future worker — is infrastructure that exists to help mature the product toward production-readiness.

**Implications master-agent must hold every session**:

1. Product work outranks agent work. A round that improves the dashboard always wins against a round that polishes the orchestrator, all else equal.
2. A meta-round (one that improves the agent system itself) must justify itself in product-velocity terms: does it shorten or de-risk the next ≥3 product rounds? If not, it's vanity.
3. Queue mix is a leading indicator. `.agents/auto/queue.md` should be majority product topics. >50% meta = drift signal; refocus.
4. When the product is blocked on human-only decisions, the agents idle. They do NOT use that gap to keep working on themselves.

**Failure mode to watch for**: a session that ends with N hours invested in agent infrastructure and zero changes to the dashboard. Today's 2026-05-18 session was an example — entirely meta-rounds, zero product work — defensible only because the agent infrastructure was actively wedged (Round 06 blocker) and unwedging it was a prerequisite for the next product round running through it.

**Round numbering convention** (adopted 2026-05-18): product PDCA rounds continue the existing `Round_NN.md` series (last was Round 40, builder upload step-model rewrite). Agent meta-rounds use a separate `Meta_NN.md` namespace. The 2026-05-17/18 self-evo rounds currently miscategorised as `Round_01..07` under [.agents/plan/cycles/](../plan/cycles/) should be renamed to `Meta_01..07` before product Round 41 starts.

Canonical doc with the full rule set: [docs/agents/workflows/agent-architecture.workflow.md](../../docs/agents/workflows/agent-architecture.workflow.md), under "Purpose hierarchy".

Related: [[agent-tier-taxonomy]], [[round-cadence]].
