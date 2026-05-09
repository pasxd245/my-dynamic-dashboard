---
name: pdca-next
description: Drive the active PDCA round (Plan→Do→Check→Act) to its next human-decision gate. Deterministic round selection, spec bootstrap, speckit task reconciliation, and Do↔Check loop until tasks complete.
metadata:
  author: human
  version: '2.0'
---

## Trigger

Activate when the user invokes any of:

- `/pdca`
- `/pdca run` (alias)
- "next pdca step", "advance the round", "drive pdca"

Do **not** activate for ad-hoc feature work unless the user first asks for PDCA execution.

---

## Operating Mode

This skill is an **executor**, not an advisor. It drives the active round
through its current phase until it hits a **human gate** (decision, missing
input, persistent blocker, or round completion). On each invocation it makes
real progress, not just a recommendation.

### Human Gates (when to STOP and return control)

Stop and return a structured prompt to the user when any of these occur:

1. **Round selection ambiguity**: more than one actionable round is open.
2. **No open round**: all rounds Complete → ask user to brainstorm next round.
3. **Missing spec**: round references a spec that doesn't exist in `specs/`.
4. **Goal ambiguity**: Plan section lacks a clear, single goal.
5. **Persistent task failure**: same speckit task fails twice in a row.
6. **Critical analyze finding**: `speckit.analyze` reports a CRITICAL-severity issue.
7. **End of round (Act)**: always stop after writing Act notes — user must
   confirm compaction + brainstorm next round.

Outside of these gates, **do not stop** — keep advancing the round.

---

## Procedure

### Step 1 — Load governance

Read in order:

1. `.agents/plan/PDCA.md` (authoritative phase contract)
2. `.agents/plan/COMPACTION_LOG.md`
3. All `.agents/plan/cycles/Round_*.md`

### Step 2 — Deterministic round selection

Build the active-round set with this exact algorithm:

1. Glob `.agents/plan/cycles/Round_*.md`.
2. For each path, extract the round number with regex `Round_(\d+)\.md`.
   Cast to integer. Sort **numerically ascending** (NOT lexicographically).
3. For each round, read the file and find the first line matching
   `^\*\*Status\*\*:\s*(.+)$`. Lowercase and trim the captured value.
4. Classify status by a leading whole-status match, because existing files may
   include markers like `Complete ✅`:
   - matches `^\s*(complete|completed)\b` → terminal complete
   - matches `^\s*deferred\b` → inactive deferred
   - matches `^\s*superseded\b` → inactive superseded
   - matches `^\s*rejected\b` → inactive rejected
   - otherwise → actionable open
5. `open_rounds` = actionable open rounds only.
6. Selection:
   - `len(open_rounds) == 0` → **GATE**: ask user to brainstorm next round
     (`Round_<max+1>`). If inactive deferred/rejected/superseded rounds exist,
     mention them as resumable/reopenable context but do not auto-select them.
   - `len(open_rounds) == 1` → that's the active round. Continue.
   - `len(open_rounds) > 1` → **GATE**: list all open rounds with status
     and ask which to continue, which to defer/supersede.

**Phase mapping** (case-insensitive):

- `planning` → Plan
- `in progress` → Do
- `review` → Check
- `act` (or any explicit Act marker) → Act
- `deferred`, `superseded`, `rejected` → inactive by default. If the user
  explicitly targets one, **GATE**: ask whether to reopen/resume, supersede,
  or create the next round.

### Step 3 — Plan phase

Goal: bring the round to a state where Do can run end-to-end.

1. **Goal sanity check**: confirm round has a single clear goal in the `## Goal`
   section. If unclear or multi-goal → **GATE**.
2. **Spec bootstrap** (only for Spec-Kit rounds — round Goal references a
   `Spec NNN`):
   - Resolve the spec slug. Expected location: `specs/NNN-<slug>/`.
   - Check the three artifacts exist: `spec.md`, `plan.md`, `tasks.md`.
   - For each missing artifact, run the corresponding speckit command and log
     the invocation in the round's `Do` section header (these belong in Plan
     bootstrap, but the command log goes in Do for consistency):
     - missing `spec.md` → `/speckit.specify`
     - missing `plan.md` → `/speckit.plan`
     - missing `tasks.md` → `/speckit.tasks`
   - If the spec slug itself is undefined → **GATE**: ask user to confirm
     slug + scope before running `/speckit.specify`.
3. **Tick Plan checklist**: walk every `- [ ]` in `## Plan`. For each, do the
   item, then flip to `- [x]`. Items that are blocked by a Decision Gate or
   Risk become **GATE**.
4. **Phase transition**: when all Plan items are checked, edit the round's
   `**Status**:` line from `Planning` to `In Progress` and proceed to Do.

### Step 4 — Do phase (the critical loop)

Goal: every task in `specs/NNN-<slug>/tasks.md` is `- [x]`.

Execute this loop:

1. Read `specs/NNN-<slug>/tasks.md`. Count unchecked tasks `U`.
2. If `U == 0` → exit loop, transition to Check.
3. Run `/speckit.implement` (the speckit harness will pick remaining tasks).
4. **Reconcile tasks.md** (this is the fix for speckit not updating
   statuses — DO NOT skip this):
   a. Re-read `specs/NNN-<slug>/tasks.md`.
   b. For each task still `- [ ]`, verify whether its acceptance evidence
   exists: file created, test added, function defined, etc. Use the task
   description to identify the artifact.
   c. If evidence is present, edit the line `- [ ]` → `- [x]` yourself.
   The agent owns this reconciliation; `/speckit.implement` does NOT.
   d. If evidence is absent, leave unchecked.
5. Append a Do-log entry to the round file with: timestamp, commands run,
   files changed, count `U_before` → `U_after`, blockers.
6. **Termination conditions**:
   - `U_after == 0` → exit loop, go to Check.
   - `U_after < U_before` → progress made; loop again (max 5 iterations
     per `/pdca` invocation to avoid runaway).
   - `U_after == U_before` → no progress. If this is the second consecutive
     no-progress iteration on the same task set → **GATE** with the list of
     stuck tasks and the last error.

### Step 5 — Check phase

1. Run `/speckit.analyze`. Capture severity of findings.
2. Verify `specs/NNN-<slug>/tasks.md` is 100% checked. If not → return to Do.
3. Run repo verification commands defined in the round's `## Check` section
   (typically `pytest` with the project's PYTHONPATH, plus any compile/lint).
4. Append Check-log to the round.
5. Decision:
   - All tests pass + tasks.md 100% checked + no CRITICAL analyze findings
     → flip status `In Progress` → `Review`, proceed to Act.
   - Any failure or unchecked task → loop back to Do (cap at 3 Check→Do
     bounces per invocation).
   - CRITICAL analyze finding → **GATE**.

### Step 6 — Act phase

1. Write `Learnings` and `Promotions` notes into the round's `## Act` section
   based on what was actually observed in Do/Check (commands, files, test
   counts, deviations).
2. **Compaction check** (read `COMPACTION_LOG.md`):
   - Let `last = current_last_compaction_point`, `X = active round number`.
   - If `X > last + 20` AND all rounds in `last+1..X` are `Complete` →
     prepare a compaction recommendation (the user will confirm).
   - Otherwise: `not due` or `blocked` (list incomplete rounds).
3. Flip status `Review` → `Complete`. Stamp `**Date completed**`.
4. **GATE**: return a structured prompt asking the user to:
   - Confirm compaction action (if due).
   - Brainstorm `Round_<X+1>` goal — propose 2–3 candidate next rounds based
     on the round's "Next-round decision" section, but do not auto-pick.

### Step 7 — Output format

On every return to the user, emit this block (markdown):

```
PDCA cycle: Round_XX (<phase>)
Last action: <what the skill just did>
Status: <ran-to-gate | gate-hit | round-complete>
Gate (if any): <which gate, what's needed from user>
Next on resume: <what /pdca will do next time>
Compaction: <not due | due | blocked: ...>
```

Keep it tight — the diff in the round file and tasks.md is the real artifact.

---

## Hard rules

- **Never auto-pick** when multiple rounds are open or when Act offers
  multiple next-round candidates.
- **Always reconcile tasks.md after `/speckit.implement`** — agent owns this.
- **Never delete files** under `.agents/plan/cycles/` unless the user
  explicitly confirms compaction.
- **Status transitions** are mechanical: only flip to `Complete` after Act
  notes are written and verification has passed.
- **Stop at every human gate** even if more work seems doable — the gate
  exists because the user's judgment is required.
