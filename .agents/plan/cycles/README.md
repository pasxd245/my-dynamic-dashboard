# `.agents/plan/cycles/` — Product PDCA rounds

This directory holds `Round_NN.md` rounds — PDCA cycles that drive `my-dynamic-dashboard` (the product under `apps/`, `packages/`) toward production-readiness. Sibling: [`../meta/`](../meta/) holds `Meta_NN.md` rounds for self-evo / agent-infra work.

## Conventions

- File naming: `Round_NN.md`, zero-padded (`Round_01.md`, `Round_02.md`, …).
- Round template + governance: [`../PDCA.md`](../PDCA.md).
- Verification levels (`auto` / `demo` / `user`): [`../DoD.md`](../DoD.md).
- Promotions log (shared with `meta/`): [`../promotions.md`](../promotions.md).
- Rule of thumb for Round vs Meta: "does this change make today's product build, ship, or run differently?" — yes → Round, no → Meta. Full rubric in [`../meta/README.md`](../meta/README.md).

## Warm-start — 2026-05-18

This directory was reset on 2026-05-18 as the warm-up of the repo's PDCA practice. Two prior series are now history-only (git log):

- `Round_01..40` — original product series, deleted in commit `c6d63bd`
- `Round_01..08` — 2026-05-17/18 self-evo bootstrap (miscategorised under product cadence), deleted in commit `70c2fc8` and the warm-start commit

The post-reset product series restarts at `Round_01` and shares no numbers with either prior series.

## Baseline

State the warm-start anchors to (snapshot taken 2026-05-18):

- 4 deep-scan reports under [`tmp/deep-scan/`](../../../tmp/deep-scan/) — product health 7.5/10; 42 Ruff + 13 TS errors open; frontend coverage 1–3%
- 5 promoted memory files under [`../../memory/`](../../memory/) — [[agent-tier-taxonomy]], [[purpose-hierarchy]], [[round-cadence]], [[verifier-trust-gap]], [[llm-mode-taxonomy]]
- 8 skills under [`../../skills/`](../../skills/)
- Agent architecture workflow at [`docs/agents/workflows/agent-architecture.workflow.md`](../../../docs/agents/workflows/agent-architecture.workflow.md)
- Self-evo orchestrator at R-I (12 nodes, 65/65 tests) at [`../../orchestrators/self-evo/`](../../orchestrators/self-evo/)

Long-form routing decisions that produced the seeded queue live in [`tmp/deep-scan/brainstorming.md`](../../../tmp/deep-scan/brainstorming.md) (scratch — kept for traceability, not promoted).

## Seeded queue

Initial topics in [`../../auto/queue.md`](../../auto/queue.md), product-first per [[purpose-hierarchy]] (60% product / 40% meta):

| Order | Topic                                                       | Track   |
| ----- | ----------------------------------------------------------- | ------- |
| 1     | `Round_01` — backend Ruff cleanup + CI gate                 | Product |
| 2     | `Round_02` — frontend TypeScript zero-errors + CI gate      | Product |
| 3     | `Round_03` — first frontend test ring (QueryBuilder)        | Product |
| 4     | `Meta_01` — verify apply-verifier patch with one real round | Meta    |
| 5     | `Meta_04` — plan-writer maxPlanSteps post-validator         | Meta    |

**First pull**: master-agent's call. `Meta_01` (~30 min, unblocks every subsequent autoagent round) or `Round_01` (~2 hr, first product hygiene win) are both defensible.

## See also

- [`../meta/README.md`](../meta/README.md) — sibling directory for Meta rounds
- [`../PDCA.md`](../PDCA.md) — round template + governance + compaction policy
- [`../../AGENTS.md`](../../AGENTS.md) — agent system overview
- [`../../memory/purpose-hierarchy.md`](../../memory/purpose-hierarchy.md) — why product outranks meta
