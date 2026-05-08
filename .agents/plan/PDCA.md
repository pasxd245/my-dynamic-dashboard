# PDCA Methodology — Skill Generation Lifecycle

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

- Define the **goal** (what and why)
- List concrete **steps** to achieve the goal
- Identify **risks** and unknowns
- Status: `Planning`

### Do

- Execute the steps
- Log progress, blockers, and deviations from the plan
- Status: `In Progress`

### Check

- Verify outcomes against the goal
- Run tests, review output, gather feedback
- Document what worked and what didn't
- Status: `Review`

### Act

- Promote validated learnings to `.agents/context/` or `.agents/skills/`
- Log promotions in `promotions.md`
- Archive the round
- Status: `Complete`

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

- **Rounds are append-only** — do not delete or rewrite history (except compacted batches; see Compaction Policy below)
- **Promotions** from Act phase are logged in [promotions.md](promotions.md)
- **Promotion criteria** are defined in [AGENTS.md](../AGENTS.md)
- Agents may update the `Do` and `Check` sections of active rounds
- Only humans may move a round to `Complete` status

---

## Spec-Kit Integration (New Governance Model)

**Purpose Shift** (as of Round_16+):

- Rounds transition from execution logs to **requirement/brainstorm documents**
- Each round defines requirements for Spec-Kit, then executes and validates the output
- **Check phase**: Validates Spec-Kit artifacts against round requirements (repair if needed)
- **Act phase**: Brainstorms next steps and proposes action

**Workflow**:

1. **Plan round**: Brainstorm goal, list requirements, identify blockers
   - Example (Round_16): "Implement Spec 003 (Query Builder) — evaluate feasibility, prioritize user stories"
2. **Do**: Execute Spec-Kit end-to-end based on round requirements
   - Run `/speckit.specify` → `/speckit.plan` → `/speckit.tasks`
   - Log spec artifacts and status in round `Do` section
3. **Check**: Verify Spec-Kit output meets round requirements
   - If spec artifacts pass requirements → proceed to Act
   - If spec artifacts need repair → iterate on Spec-Kit (re-run specify/plan/tasks until requirements met)
4. **Act**: Brainstorm next round and propose action
   - Summarize learnings and decisions from this round
   - Brainstorm next round (e.g., "implement Spec 004" or "refactor based on findings")
   - Propose action and await user confirmation or auto-proceed if pre-approved
5. **Complete round**: Move to next round with confirmed goal

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
3. If both yes → auto-compact and increment compaction point
4. If batch size met but rounds incomplete → **human curation required**: finish incomplete rounds first, or proceed with compaction?

**Example**:

- Default: Last compaction point = Round_00 (initial)
- In Round_21 Plan phase: Check if all Rounds_01-20 are Complete
  - If yes: Auto-compact Rounds_01-20 → `Rounds_01_20.compacted.md`, delete individuals, set last_compaction_point = 20
  - If no (e.g., Round_15 still In Progress): Pause compaction, ask user: finish Round_15 first, or compact anyway?
- Manual compaction: User triggers `compact-docs` on Rounds_01-05, but only if all are Complete
  - Sets last_compaction_point = 05
  - Then in Round_26 Plan/Act: Check Rounds_06-25 all Complete?

**Process** (during Plan or Act phase):

1. Check status of all rounds from `(last_compaction_point + 1)` through `(X - 1)`
2. If all Complete → proceed with auto-compaction:
   - Auto-run `compact-docs` skill
   - Output: `Rounds_XX_YY.compacted.md` (condensed summary + key decisions)
   - Delete individual round files that were compacted
   - Update `COMPACTION_LOG.md` with new compaction point
3. If any incomplete → pause and require human curation:
   - List incomplete rounds (status, title)
   - Propose: finish them first, or defer compaction until they're complete?

**Compaction format**:

- Table of contents with round titles and dates
- 1-2 line summary of each round's goal and outcome
- Key decisions and learnings (condensed)
- No audit links (individual rounds deleted post-compaction)
