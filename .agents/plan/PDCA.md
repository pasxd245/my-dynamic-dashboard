# PDCA Methodology — Spec-Kit Delivery Lifecycle

> Plan-Do-Check-Act framework for iteratively building, deploying, and
> refining AI agent skills across this project.

---

## Purpose

PDCA (Plan-Do-Check-Act) provides a structured, repeatable cycle for
evolving this project. Each initiative (feature, refactor, investigation)
is tracked as a **round** so that decisions, outcomes, and learnings
are captured and reviewable.

---

## Cycle Template

Each round follows four phases:

### Plan

- Define the **goal** (what and why) — single, unambiguous goal per round.
- **Spec bootstrap** (Spec-Kit rounds): if the round references `Spec NNN`,
  verify `specs/NNN-<slug>/{spec.md,plan.md,tasks.md}` all exist. For each
  missing artifact, run the corresponding command before entering Do:
  - missing `spec.md` → `/speckit.specify`
  - missing `plan.md` → `/speckit.plan`
  - missing `tasks.md` → `/speckit.tasks`
- List prerequisites, inputs, blockers, decision gates, and readiness criteria.
- Tick every `- [ ]` in the Plan checklist before transitioning. A blocked
  item is a human gate, not a checkbox to skip.
- Status: `Planning` → flip to `In Progress` when all Plan items checked
  and all spec artifacts exist.

### Do

- Execute the planned work to actual completion. Real code, not artifacts.
- For Spec-Kit rounds: run `/speckit.implement` against the spec's tasks.
- **Task reconciliation (mandatory)**: `/speckit.implement` does NOT
  reliably tick boxes in `specs/NNN-<slug>/tasks.md`. After each implement
  run, the agent MUST:
  1. Re-read `tasks.md`.
  2. For every `- [ ]`, verify the acceptance evidence (file/test/function)
     exists in the codebase.
  3. Edit the line to `- [x]` when evidence is present.
  4. Leave unchecked when evidence is absent.
- Loop `/speckit.implement` + reconcile until `tasks.md` is 100% checked,
  or progress stalls (same unchecked task set across two consecutive
  iterations) — stalls are a human gate.
- Log commands run, files changed, blockers, and deviations.
- Status: `In Progress`

### Check

- Run `speckit.analyze` first. CRITICAL findings are a human gate.
- Verify `tasks.md` is 100% checked. If not → return to **Do**.
- Run repo-required verification (tests, lint, contract checks, manual
  validation). Any failure → return to **Do**.
- The Do↔Check loop is bounded: after 3 round-trips inside one `/pdca`
  invocation without convergence, surface a gate.
- Update round records with what is complete, what failed, what remains.
- Status: `Review` (only after analyze + tests + 100% tasks all pass).

### Act

- Write the round's learnings and unresolved items into `## Act` based on
  observed Do/Check evidence (not speculation).
- Evaluate compaction (see Compaction Policy below).
- Decide the next round, remediation round, or defer/close action.
- When more than one next-round candidate exists, **require user
  confirmation** — never auto-pick.
- Promote validated learnings to `.agents/context/` or `.agents/skills/`.
- Log promotions in `promotions.md`.
- Status: `Complete` (stamp `**Date completed**`).

---

## Naming Convention

Rounds live in `.agents/plan/cycles/` and follow this pattern:

```text
cycles/
  Round_01.md   — First initiative
  Round_02.md   — Second initiative
  Round_XX.md   — Subsequent rounds
```

Use zero-padded two-digit numbering. Each file uses the round template
below.

---

## Round Template

```markdown
# Round XX: [Title]

**Status**: Planning | In Progress | Review | Complete
**Date started**: YYYY-MM-DD
**Date completed**: YYYY-MM-DD

## Goal

[1-2 sentences: what we're building/fixing and why]

## Plan

- [ ] Step 1
- [ ] Step 2
- [ ] ...

## Do

[Progress log — update as work proceeds]

## Check

- [ ] Verification item 1
- [ ] Verification item 2

## Act

**Learnings**:

- ...

**Promotions**:

- [ ] → context/ : [topic]
- [ ] → skills/ : [topic]
```

---

## Governance

- **Rounds are append-only** — do not delete or rewrite history without explicit human confirmation (including compaction; see Compaction Policy below)
- **Promotions** from Act phase are logged in [promotions.md](promotions.md)
- **Promotion criteria** are defined in [AGENTS.md](../AGENTS.md)
- Agents may update the `Do`, `Check`, and `Act` sections of active rounds
- `pdca-next` may move a round to `Complete` only after Check passes and Act notes are written; otherwise only humans may complete or close rounds

---

## Spec-Kit Integration

Rounds are **implementation-driving delivery rounds** — each one prepares,
executes, validates, and plans next. The `pdca-next` skill is the executor:
it drives the active round to its next human gate per the phase contract
above. See `.agents/skills/pdca-next/SKILL.md` for the deterministic state
machine (round selection, spec bootstrap, Do↔Check loop, task reconciliation,
gate definitions).

## Sequential Round Selection (Deterministic)

The active round is selected by this exact algorithm — no heuristics:

1. Glob `.agents/plan/cycles/Round_*.md`.
2. Parse the integer round number from each filename via regex
   `Round_(\d+)\.md`. Sort **numerically ascending** (not lexicographically —
   `Round_9` precedes `Round_10`).
3. Read each file's `**Status**:` line. Lowercase and trim.
4. Classify by a leading whole-status match, because existing files may
   include markers like `Complete ✅`:
   - matches `^\s*(complete|completed)\b` → terminal complete
   - matches `^\s*deferred\b` → inactive deferred
   - matches `^\s*superseded\b` → inactive superseded
   - matches `^\s*rejected\b` → inactive rejected
   - otherwise → actionable open
5. `open_rounds` = actionable open rounds only.
6. Selection:
   - 0 open → ask user to brainstorm `Round_<max+1>`.
   - 1 open → that's the active round.
   - 2+ open → **stop**. List all open rounds with status; ask user which to
     continue and which to defer / supersede / leave open. Never auto-pick.

`Deferred`, `Superseded`, and `Rejected` rounds are inactive by default and do
not block the next actionable round. If the user explicitly targets one, ask
whether to reopen/resume it, supersede it, or create the next round before
doing implementation work.

---

## Compaction Policy

**Trigger**: Check compaction need only during **Plan or Act phases** (decision points), not during active execution (Do/Check)

**When to Check**:

- **Plan phase** (starting new round): Before planning Round_X, check if previous batch needs compaction
- **Act phase** (completing round): When proposing next round, check if compaction should happen before creating it
- **Not during Do/Check**: No compaction checks during active Spec-Kit execution

**Dynamic Batch Calculation**:

1. Track the **last compaction point** (stored in `.agents/plan/COMPACTION_LOG.md`)
2. When checking (during Plan or Act):
   - Is `X > (last_compaction_point + 20)`?
   - Are ALL rounds from `(last_compaction_point + 1)` through `(X - 1)` marked `Status: Complete`?
3. If both yes → recommend compaction and ask for explicit human confirmation
4. If batch size met but rounds incomplete → **human curation required**: finish incomplete rounds first, or proceed with compaction?

**Example**:

- Default: Last compaction point = Round_00 (initial)
- In Round_21 Plan phase: Check if all Rounds_01-20 are Complete
  - If yes: Recommend compacting Rounds_01-20 → `Rounds_01_20.compacted.md`; only delete individuals and set last_compaction_point = 20 after explicit confirmation
  - If no (e.g., Round_15 still In Progress): Pause compaction, ask user: finish Round_15 first, or compact anyway?
- Manual compaction: User triggers `compact-docs` on Rounds_01-05, but only if all are Complete
  - Sets last_compaction_point = 05
  - Then in Round_26 Plan/Act: Check Rounds_06-25 all Complete?

**Process** (during Plan or Act phase):

1. Check status of all rounds from `(last_compaction_point + 1)` through `(X - 1)`
2. If all Complete → surface a compaction gate:
   - Ask the user to confirm running `compact-docs`
   - Output: `Rounds_XX_YY.compacted.md` (condensed summary + key decisions)
   - Delete individual round files only after explicit confirmation
   - Update `COMPACTION_LOG.md` with new compaction point only after confirmed compaction
3. If any incomplete → pause and require human curation:
   - List incomplete rounds (status, title)
   - Propose: finish them first, or defer compaction until they're complete?

**Compaction format**:

- Table of contents with round titles and dates
- 1-2 line summary of each round's goal and outcome
- Key decisions and learnings (condensed)
- No audit links (individual rounds deleted post-compaction)
