# Promotion Log

> Append-only log of memory entries promoted to `context/` or `skills/`.
> See [PDCA.md](PDCA.md) for methodology and [AGENTS.md](../AGENTS.md) for promotion criteria.

---

<!-- Append new entries below this line using the format:

## YYYY-MM-DD: [Topic] → [Destination]

**Source**: memory/[filename]
**Rationale**: [1-2 sentences]
**Promoted by**: [Human name]

-->

## 2026-05-08: skill-creator → .agents/skills/

**Source**: human-authored (extends external skill-creator behavior)
**Rationale**: Prefer reproducible `a2scaffold` usage for new skill structures while allowing validated manual edits to existing skill prose. Adds an explicit user-confirmation gate before governed skill scaffolding runs.
**Promoted by**: human curated

## 2026-05-08: master-plan → .agents/skills/

**Source**: human-reviewed skill draft
**Rationale**: Add a reusable phase-planning workflow for non-trivial repo changes, with package-aware gates and Spec Kit alignment.
**Promoted by**: human curated

## 2026-05-08: repo-explainer → .agents/skills/

**Source**: human-reviewed skill draft
**Rationale**: Add a reusable explanation workflow for repository and subsystem walkthroughs using current-code reading and Mermaid diagrams.
**Promoted by**: human curated

## 2026-05-08: research → .agents/skills/

**Source**: human-reviewed skill draft
**Rationale**: Add a reusable sourced-research workflow for comparisons, investigations, tradeoff analysis, and current-evidence recommendations.
**Promoted by**: human curated

## 2026-05-08: tools (crg) → .agents/context/

**Source**: human-authored awareness note
**Rationale**: Make agents aware of `./scripts/crg` (code-review-graph wrapper + MCP) so they can recommend it for cross-repo investigation/impact-tracing alongside SDD, without promoting it to a full skill until repeatable usage patterns emerge.
**Promoted by**: human curated

## 2026-05-09: pdca-next + /pdca prompt → .agents/skills/ + .agents/prompts/

**Source**: human-authored request (implemented by agent)
**Rationale**: Add a reusable PDCA next-action helper that reads plan governance artifacts and returns one concrete next step, including compaction checkpoint awareness.
**Promoted by**: human curated

## 2026-05-09: PDCA governance clarification → .agents/skills/ + .agents/plan/

**Source**: user-reported workflow correction (implemented by agent)
**Rationale**: Clarify that multiple open round candidates require explicit user confirmation, and align Plan/Do/Check/Act with prepare -> implement -> analyze/verify -> plan-next behavior for Spec-Kit rounds.
**Promoted by**: agent at explicit user request

## 2026-05-17: Add a /self-evo Claude Code slash command stub

**Source**: .agents/plan/cycles/Round_01.md
**Rationale**: auto-emitted by `self-evo` round-writer; human curates before promotion
**Promoted by**: self-evo (auto)
