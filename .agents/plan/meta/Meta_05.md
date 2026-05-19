# Meta 05: Move Write-tool discipline rule from workflow-doc table cell to a memory file

**Status**: Complete
**Date started**: 2026-05-19
**Date completed**: 2026-05-19

## Goal

Fix the placement choice from [Meta_04](Meta_04.md). The "Lessons learned — 2026-05-19 session" table now points to a real durable home ([[write-tool-discipline]] memory entry) instead of inlining the rule into the table cell itself. Restores the 2026-05-18-table pattern where the table is an **index**, not a body.

## Product-velocity justification

This is a sub-round of meta work; per principle P8 it must justify itself in product-velocity terms.

- **Why fix instead of leave**: Meta_04's placement let the rule live only as a one-line bullet inside a table cell — no `[[name]]` link, no memory entry, no body section. A future master-agent reading the table can't load the rule into context (no slug to fetch), and a future lessons-learned closure can't follow the same pattern without re-introducing the inconsistency. Cost of leaving = the convention erodes across the next ≥3 sessions.
- **Cost to fix**: one new memory file + one table row rewrite + one MEMORY.md index line. ~10 min.
- **Velocity gain**: future memory-aware tooling (self-evo's `lessonLearnLoopUnwired` work, when it lands) can now ingest this rule by slug like any other.

## Scope (immutable)

- New file: `~/.claude/projects/-home-ubuntu-pf-my-dynamic-dashboard/memory/feedback_write_tool_discipline.md` — feedback-type memory with the rule body (rule + Why + How to apply).
- Updated file: `~/.claude/projects/-home-ubuntu-pf-my-dynamic-dashboard/memory/MEMORY.md` — one index line under the existing 5 entries.
- Edited file: [docs/agents/workflows/agent-architecture.workflow.md](../../../docs/agents/workflows/agent-architecture.workflow.md) — single table row rewritten to point to `[[write-tool-discipline]]` with destination = "memory".
- **Not in scope**: backfilling other 2026-05-18 / 2026-05-19 rows, editing Meta_04's body (Meta_04 stays as-is — its goal of "close `writeToolNeedsReadFirstForOverwrite`" was met; only the placement choice was suboptimal), or touching `state.json` (the observation is already resolved by Meta_04; this round just relocates where the rule lives).

## Decisions baked in

1. **Memory over workflow-doc body**. The rule is operational discipline (sits next to [[round-cadence]] thematically), not architecture. The "master-agent — the coding agent" section of the workflow doc holds load-bearing architectural rules (e.g., "always re-validate after self-evo 'approve'"); a Read-Write tool-quirk fits memory better.
2. **Frontmatter matches existing convention** (`type: feedback` at top level), not the newer nested `metadata: type:` form, because the other three project feedback memories all use the top-level form.
3. **Meta_04 not amended**. Per the autoagent.md rule "Always create NEW commits rather than amending", Meta_05 is a forward-correction commit, not a `git commit --amend`.

## Validation

- `pnpm md:lint` clean across the workflow-doc edit (memory files are outside the lint glob — see [.markdownlintignore](../../../.markdownlintignore) and the `markdownlint-cli2` ignore list).
- Critical-security check: ✅ (markdown + memory-dir file, both outside path-globs; no runtime dep adds; no `child_process` / `eval` / `vm`).
- Memory-dir file lives under `~/.claude/projects/...` — outside the repo. It's not staged in this branch's commit; the commit captures the workflow-doc + Meta_05.md edits only. (The memory-dir is per-machine; this is consistent with how the existing 5 memory files were created.)

## State of the world after this round

- [[write-tool-discipline]] memory entry exists; indexed in MEMORY.md.
- Workflow doc 2026-05-19 lessons table is now a proper index (Destination + Memory file columns are meaningful).
- Pattern preserved for next 2026-05-19 lessons-learned closure (e.g., `coldModeUnvalidated`, `autoagentMdPathDrifted`): each gets a memory file + one table row pointing to it.
