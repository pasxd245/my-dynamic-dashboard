---
name: PDCA next step
description: On /pdca, read .agents/plan artifacts and return the single highest-priority next PDCA action.
argument-hint: Optional scope note, such as "Round_19 only" or "full check including compaction"
agent: agent
---

# /pdca

Determine what to do next in PDCA execution.

## Instructions

1. Use the `pdca-next` skill.
2. Read `.agents/plan/PDCA.md`, `.agents/plan/COMPACTION_LOG.md`, and current
   round files in `.agents/plan/cycles/`.
3. Return exactly one next action, not a full roadmap.
4. Include active round, phase, and compaction status.
5. If governance is blocked (`Deferred`/`Superseded`), ask for a human decision
   before proposing implementation work.

## Output

- Active round: `Round_XX` (`Status`)
- Phase: `Plan|Do|Check|Act`
- Next action: `<single imperative action>`
- Reason: `<one line>`
- Compaction: `not due|due|blocked (+ reason)`
