# PDCA Methodology — Spec Driven Development

> Delivery Lifecycle:
> Plan-Do-Check-Act framework for iteratively building, deploying, and
> refining AI agent skills across this project.

---

## Purpose

PDCA (Plan-Do-Check-Act) provides a structured, repeatable cycle for
evolving this project. Each initiative (feature, refactor, investigation)
is tracked as a **round** so that decisions, outcomes, and learnings
are captured and reviewable.

---

## Trajectory

Every round runs inside a trajectory — the four guardrails below frame
what may change, what must not, and how to read incoming feedback. The
trajectory is set during Plan and reaffirmed at the start of each Do
iteration. Drift between trajectory and execution is a gate, not a
silent decision.

### 1. Immutable Intent

The round's goal cannot be changed unilaterally. Once Plan is locked
and the round flips to `In Progress`, the goal stated in `## Goal` is
treated as a contract. Reframing the goal mid-round requires explicit
human approval and a new round (or a documented amendment), not a
quiet rewrite of `## Goal`.

### 2. Current Architecture State

The round is executed against the architecture the system is running
on **now**, not an aspirational future state. Before starting Do, the
operator confirms the relevant code paths, libraries, and contracts as
they exist on the current branch. Decisions are anchored to that state
so that "what changed" is measurable against a known baseline.

### 3. Feedback Scope

When new feedback or a course-correction arrives mid-round, classify
it first:

- **Local fix** — fits inside the current round's intent and allowed
  change boundary. Apply, log under Do, continue.
- **Global redesign** — alters the architecture state, the round
  intent, or contracts beyond this round. Stop and surface a gate.
  Do not absorb a global redesign into an in-flight round.

Mixing the two is the most common source of scope creep and broken
rounds. If unclear, default to treating it as global and ask.

### 4. Allowed Change Boundary

Each round declares — explicitly, in Plan — which files / modules are
in-scope and which must not be touched. The boundary is read by the
operator before every Do step:

- Files inside the boundary may be created, edited, or removed under
  the round's intent.
- Files outside the boundary may be **read** for context but not
  modified. A change request that requires editing outside-boundary
  files is itself a gate (see Feedback Scope above).

When the boundary is implicit, write it down before the next Do step.
"I assumed it was fine to touch X" is not a recoverable position.

---

## Naming Convention

Rounds live in `.agents/plan/cycles/` and follow this pattern:

```text
cycles/
  Round_01.md   — First initiative
  Round_02.md   — Second initiative
  Round_XX.md   — Subsequent rounds
```

Use zero-padded numbering. Each file uses the round template
below.

---

## Cycle/Round Template

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
