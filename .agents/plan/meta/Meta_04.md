# Meta 04: Promote Write-tool-Read-first discipline to a workflow rule

**Status**: Complete
**Date started**: 2026-05-19
**Date completed**: 2026-05-19

## Goal

Add one durable rule to [docs/agents/workflows/agent-architecture.workflow.md](../../../docs/agents/workflows/agent-architecture.workflow.md) so the Write-tool gotcha surfaced in Round_04 (2026-05-19) becomes a prevented mistake instead of a re-discovered one. Closes `state.json.openObservations.writeToolNeedsReadFirstForOverwrite`.

## Product-velocity justification

This is meta work; per principle P8 in [.agents/context/principles.md](../../../.agents/context/principles.md) it must justify itself in product-velocity terms.

- **Concrete near-term beneficiary**: every direct-edit round that touches files already in the working tree — the dominant executor for the next ≥3 product rounds per the 2026-05-19 reliability ratio (7/7 direct-edit success vs. 1 self-evo HITL-quit, captured in Meta_03).
- **Failure mode it prevents**: silent stale state. In Round_04 the Write tool's "Read-before-Write" guard interacted badly with a same-iteration `git rm`, producing a stale snapshot of file contents. The rule below makes the pairing illegal, so a future round can't repeat it.
- **Cost**: one paragraph in workflow doc + one row in the 2026-05-19 lessons table. No code, no flags, no infrastructure.

## Scope (immutable)

- Edited file: [docs/agents/workflows/agent-architecture.workflow.md](../../../docs/agents/workflows/agent-architecture.workflow.md) — add a new `## Lessons learned — 2026-05-19 session` table below the existing `## Lessons learned — 2026-05-18 session` table, containing one row for the Write-tool discipline rule.
- Updated file: [.agents/auto/state.json](../../../.agents/auto/state.json) — `openObservations.writeToolNeedsReadFirstForOverwrite` flipped to a `__RESOLVED_2026_05_19` key citing this Meta.
- **Not in scope**:
  - Backfilling other 2026-05-19 lessons into the new table (the four other open observations stay open for their own meta rounds).
  - Editing the Write tool itself — that's not in this codebase; it's a Claude Code harness affordance.
  - Adding hook enforcement — the rule is master-agent discipline, same tier as P5 (cold-start).

## Decisions baked in

1. **The rule is master-agent discipline, not infrastructure**. Same posture as Meta_04 (dry-run)'s recommendation on `--cold`: don't ship enforcement until self-policing visibly breaks. The workflow-doc row is the discipline contract.
2. **A new 2026-05-19 section**, not an extension of the 2026-05-18 table. Date-tagged sections preserve session provenance and make compaction cleaner later.
3. **Rule wording targets the pairing**, not the Write tool in isolation. Read+Write alone is safe; `git rm` + Write in the same iteration is what produced the stale snapshot in R04.

## Validation

- `pnpm md:lint` clean on both edited files.
- No code patches — markdown + JSON only. No type-check or test changes expected.
- Critical-security check: no path hits (markdown doc + autoagent state.json, both outside the path-glob list and not adding runtime deps or `child_process` / `eval` / `vm`).

## State of the world after this round

- `state.json.openObservations.writeToolNeedsReadFirstForOverwrite` → resolved.
- Workflow doc now hosts the 2026-05-19 lessons-learned section, ready to absorb future 2026-05-19 closures (`autoagentMdPathDrifted`, `dryRunMissedDiffContentHalf`, `coldModeUnvalidated`) in their own meta rounds.
- One step toward the open follow-up "Meta_04 candidate: --cold enforcement" from [Meta_03](Meta_03.md): we now have two 2026-05-19 lessons-learned candidates (this one + cold-mode validation) heading into a shared table.
