---
name: pdca-next
description: Determine the next concrete PDCA action from .agents/plan artifacts (PDCA.md, COMPACTION_LOG.md, cycles/) whenever the user asks what to do next in a PDCA round.
metadata:
  author: human
  version: '1.0'
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

### 2. Identify active round

Compute active round using these rules:

1. Parse round numbers from `Round_XX.md`
2. Read each round `**Status**`
3. Build set `open_rounds` = rounds with status not equal to `Complete`
4. Active round = lowest-numbered entry in `open_rounds` (sequential execution)

If multiple open rounds exist, surface a **sequential-order blocker** before
continuing:

- Report all open rounds in ascending order with status
- Explain that work should proceed from the oldest open round first
- Propose exactly two options: close/defer later rounds, or explicitly override
  sequential mode for this run

If no active round exists, recommend creating the next round file and suggest a
Plan-phase kickoff.

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

From the active round, inspect the section corresponding to the current phase.
Pick the first unchecked item (`- [ ] ...`) as the next action.

If no unchecked items exist in the current phase, recommend exactly one phase
transition action (for example: "Move status from Planning to In Progress and
start Do step 1").

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

Return this output structure:

1. Active round and status
2. Current phase
3. Next single action (imperative sentence)
4. Why this is next (one line)
5. Compaction note (`not due`, `due`, or `blocked`)

Keep the response actionable and avoid multi-step plans unless requested.
