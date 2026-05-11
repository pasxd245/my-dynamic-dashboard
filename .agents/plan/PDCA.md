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

Check is split into two complementary classes. **Both** must pass before
the round can move to `Review`. A round that satisfies Check-result but
fails Check-trajectory is not Done — it has drifted, and the drift is a
gate, not a pass.

#### Check-result — "Does the code run correctly?"

Verifies the implementation produces the intended _output_:

- Run `speckit.analyze` first. CRITICAL findings are a human gate.
- Verify `tasks.md` is 100% checked. If not → return to **Do**.
- Run repo-required verification (tests, lint, type-check, contract
  checks, manual validation). Any failure → return to **Do**.
- The Do↔Check loop is bounded: after 3 round-trips inside one `/pdca`
  invocation without convergence, surface a gate.

#### Check-trajectory — "Is the code still on the original trajectory?"

Verifies the implementation still respects the trajectory set at Plan
(see [Trajectory](#trajectory) above). Even when tests pass, the round
can have silently drifted off course:

- **Immutable Intent** — does the delivered work still serve the goal
  stated in `## Goal`? Re-read it. If the implementation answers a
  different question, that is drift.
- **Current Architecture State** — is the delivered code consistent
  with the architecture state recorded at Plan? Unannounced framework
  swaps, new global dependencies, or contract changes are drift.
- **Feedback Scope** — did any mid-round feedback get absorbed without
  classification? Look for changes that smell like a global redesign
  but were treated as local fixes.
- **Allowed Change Boundary** — did Do touch any file outside the
  declared boundary? A `git diff --stat` against the round-start
  baseline answers this directly.

Any trajectory drift → surface a gate, do not auto-fix. Drift is
either ratified (the round's trajectory is amended with human
approval) or reverted (the out-of-boundary changes are rolled back).
Never quietly rewrite the goal to match what was built.

#### Common closure

- Update round records with what is complete, what failed, what
  remains, and any trajectory observations.
- Status: `Review` (only after Check-result passes **and**
  Check-trajectory reports no unresolved drift).

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
