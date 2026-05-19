# Meta 03: Flip self-evo to opt-in + lockfile-noise carve-out

**Status**: Complete
**Date started**: 2026-05-19
**Date completed**: 2026-05-19

## Goal

Two coordinated edits to [.claude/commands/autoagent.md](../../../../.claude/commands/autoagent.md) closing two of the three gaps surfaced after Meta_02:

1. **Executor default flips to direct-edit** for code rounds (priorities 0–1) and meta rounds (priorities 3–4). Self-evo dispatches only when the round file explicitly opts in via `**Executor**: self-evo`. Closes the contradiction between autoagent.md (had self-evo as default) and [docs/agents/workflows/agent-architecture.workflow.md](../../../../docs/agents/workflows/agent-architecture.workflow.md) (treats self-evo as opt-in support).

2. **Lockfile-noise bullet** added to the "Known noise" section: root `pnpm-lock.yaml` updates from `pnpm install` during workspace-add rounds are tier-1, not boundary violations. Closes the classifier-blocked edit from earlier today; cleaner round-writer prompts can now pre-declare lockfile as a permitted artifact.

## Justification (per workflow.md purpose hierarchy + principle P1)

This is meta work; it must justify itself in product-velocity terms (P8). The case:

- **Executor flip** saves real cycles. Tonight's session ran 8 code rounds: 1 via self-evo (failed — planner over-decomposed, judge false-positive) and 7 via direct-edit (all succeeded). Today master-agent had to invent a per-round justification for the direct-edit deviation. Making direct-edit the default codifies the observed reliability ratio and removes that per-round overhead. ~10 min × ~5 rounds/week = ~50 min/week saved.
- **Lockfile bullet** prevents future boundary-check trips on workspace-add rounds. R01 hit this; future workspace-add rounds (e.g., a second React app pulling `@mdd/ui`) will hit it too. Cheap insurance; zero downside.

Both edits align autoagent.md with the existing workflow.md design, so the meta justifies itself as alignment work rather than expansion.

## Scope (immutable)

- Edited file: [.claude/commands/autoagent.md](../../../../.claude/commands/autoagent.md) — step 4 (Pick the executor) rewritten to flip the default; "Known noise" section gains one bullet.
- **Not in scope** for this round:
  - `--cold` enforcement infrastructure (Gap 3 from the brainstorm — deferred to a future Meta_04 once `--cold` has actually been run and self-policing has been observed to break or hold).
  - Adding a `--no-autopilot` flag (no concrete use-case yet).
  - Adding `--executor` as a CLI flag (the round-file `**Executor**:` convention is cleaner because the executor choice lives with the round, not the run).
  - Editing principles.md (P2 already says self-evo is not the default; Meta_03 just makes autoagent.md match).

## Decisions baked in

1. **Direct-edit is the framework default** for every code/meta round. Self-evo is invoked only when the round file declares `**Executor**: self-evo`. This is a **breaking change** to autoagent.md but matches workflow.md's intent and tonight's observed reliability.
2. **The opt-in mechanism is a round-file field**, not a CLI flag. Rationale: executor choice lives with the work (the round file), not the invocation. A `/autoagent` run might process rounds with mixed executors; per-round declaration handles that cleanly.
3. **Criteria for opting in to self-evo are advisory, not enforced**. The round-writer's discretion; master-agent's report must justify the choice. Three guidance points listed in autoagent.md: crisp boundaries, repetitive PDCA-style work, master-agent context-window concerns.
4. **No backfill** — past rounds (R01-R05, Meta_01-\_02) stay as they are. The new default applies prospectively.

## Validation

- `pnpm md:lint` clean on the edited file.
- The autoagent.md flag table is unchanged (this round doesn't touch flags).
- No code patches — markdown only. No type-check or test changes expected.
- The classifier should accept this autoagent.md edit as in-scope of the user's explicit "go with Sequence A" authorization.

## Open follow-ups (deferred — not in this round)

- **Meta_04 candidate: `--cold` enforcement**. Wait until `/autoagent --once --cold` has been run at least once and observed; design the enforcement (report-format requirement vs. lint vs. verifier check) based on what self-policing actually misses.
- **A `**Executor**:` field convention spec**. Today's round files use ad-hoc formatting; round-writer skill (when it exists) should standardize the field's placement and parser. Capture as a queue topic if a second self-evo round materializes.
- **Backfill the round files with explicit `**Executor**: direct-edit`** (optional). Today every existing round implicitly defaulted; making it explicit would tighten the audit trail. Low priority.

## State of the world after this round

- `state.json.openObservations.autoagentMdVsWorkflowMdSelfEvoDefault` → resolved.
- Next `/autoagent` run defaults to direct-edit for everything; self-evo only dispatches when a round file says so explicitly.
- The lockfile-noise carve-out is documented in the operating manual; round-writers no longer need to plead with the boundary check.
