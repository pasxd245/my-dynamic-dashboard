---
name: pdca-next
description: Determine the next concrete PDCA action from .agents/plan artifacts (PDCA.md, COMPACTION_LOG.md, cycles/) whenever the user asks what to do next in a PDCA round.
metadata:
  author: human
  version: '1.1'
---

## Trigger

Activate this skill when the user asks any variant of:

- "what should I do next"
- "/pdca"
- "next PDCA step"
- "what is the next round action"

Do not activate for feature implementation unless the user first asks for
PDCA guidance.

## Procedure

### 1. Read PDCA governance sources

Read these files in order:

1. `.agents/plan/PDCA.md`
2. `.agents/plan/COMPACTION_LOG.md`
3. `.agents/plan/cycles/Round_*.md` (all existing rounds)

Treat `.agents/plan/PDCA.md` as authoritative for phase and compaction rules.

### 2. Identify candidate rounds

Compute candidate rounds using these rules:

1. Parse round numbers from `Round_XX.md`
2. Read each round `**Status**`
3. Build set `open_rounds` = rounds with status not equal to `Complete`
4. Sort `open_rounds` by round number ascending

Selection rules:

- If `open_rounds` is empty, recommend creating the next round file and suggest a
  Plan-phase kickoff.
- If `open_rounds` has exactly one round, that round is the active round.
- If `open_rounds` has more than one round, do **not** auto-select a round.
  Treat all open rounds as candidate rounds and require explicit user
  confirmation before continuing.

If multiple candidate rounds exist, surface a **round-selection blocker** before
continuing:

- Report all open rounds in ascending order with status
- Explain why selection is ambiguous (for example: multiple non-complete rounds,
  mixed statuses, or deferred later rounds still open)
- Ask the user exactly which round to continue
- Ask which remaining candidate rounds should be deferred, superseded, or left
  open

Default sequential order is still the lowest-numbered open round, but that is a
recommendation only. It must not be auto-executed when multiple candidate
rounds exist.

### 3. Map status to current phase

Use status-to-phase mapping:

- `Planning` -> Plan
- `In Progress` -> Do
- `Review` -> Check
- `Complete` -> Act finished (move to next round)
- `Deferred` or `Superseded` -> requires human decision before next execution

If status is `Deferred`/`Superseded`, surface that immediately as a blocker and
propose two options: resume, or open next round.

### 4. Select exactly one next action

Only do this step after there is exactly one confirmed active round.

From the active round, inspect the section corresponding to the current phase.
Pick the first unchecked item (`- [ ] ...`) as the next action.

If no unchecked items exist in the current phase, recommend exactly one phase
transition action (for example: "Move status from Planning to In Progress and
start Do step 1").

Phase-specific guidance:

- In `Plan`, next actions should prepare the round to enter `Do` (requirements,
  prerequisites, blockers, acceptance gates, and readiness inputs).
- In `Do`, next actions should advance real implementation work to completion.
  For Spec-Kit rounds, prefer the next implementation-producing step needed to
  reach a working result, including `/speckit.implement` when planning artifacts
  are already present.
- In `Check`, next actions should start with `speckit.analyze` and then any
  extra verification needed to confirm the implementation is actually complete.
  Update tasks and round records with what is done, what failed, and what still
  remains.
- In `Act`, next actions should decide the next round or remediation round and
  capture what should happen next.

### 5. Evaluate compaction checkpoint

During Plan or Act decision points, evaluate whether compaction is due:

1. Read `Current Last Compaction Point` from `.agents/plan/COMPACTION_LOG.md`
2. Let `X` be current active round number
3. Trigger check when `X > (last_compaction_point + 20)`
4. If triggered, verify all rounds in that batch are `Complete`
5. If any are not complete, mark compaction as blocked and list incomplete rounds

Never auto-delete or compact files unless the user explicitly asks to run
compaction.

### 6. Return concise guidance format

Return this output structure.

If selection is ambiguous:

1. Candidate rounds and statuses
2. Blocker: user confirmation required
3. Exact confirmation question: which round to continue, and which to
   defer/close
4. Compaction note (`not due`, `due`, or `blocked`)

If selection is unambiguous:

1. Active round and status
2. Current phase
3. Next single action (imperative sentence)
4. Why this is next (one line)
5. Compaction note (`not due`, `due`, or `blocked`)

Keep the response actionable and avoid multi-step plans unless requested.
