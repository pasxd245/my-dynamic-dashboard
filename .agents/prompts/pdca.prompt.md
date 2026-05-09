---
name: PDCA executor
description: On /pdca, drive the active PDCA round to its next human-decision gate via the pdca-next skill (executor mode).
argument-hint: Optional scope note, such as "Round_19 only" or "dry-run"
agent: agent
---

# /pdca

Drive the active PDCA round forward.

## Behavior

1. Invoke the `pdca-next` skill (executor mode — see `.agents/skills/pdca-next/SKILL.md`).
2. The skill will:
   - Deterministically select the lowest-numbered open round (or stop at a
     selection gate if multiple are open).
   - Treat `Complete ✅` as complete via a leading whole-status match
     (`^\s*(complete|completed)\b`); treat `Deferred`, `Superseded`, and
     `Rejected` as inactive unless explicitly targeted by the user.
   - Advance Plan → Do → Check → Act, looping Do↔Check until all spec tasks
     are checked and verification passes.
   - Reconcile `specs/NNN-*/tasks.md` itself after each `/speckit.implement`
     run (do not trust speckit to tick boxes).
   - Stop at human gates only: ambiguous selection, missing spec slug,
     persistent task failure, critical analyze finding, or round completion.

## Output (single block)

```
PDCA cycle: Round_XX (<phase>)
Last action: <what just ran>
Status: ran-to-gate | gate-hit | round-complete
Gate (if any): <what's needed from user>
Next on resume: <what /pdca will do next time>
Compaction: not due | due | blocked
```

## Notes

- If the user passes `Round_NN only`, treat that as an explicit target. If the
  round is Deferred/Superseded/Rejected, stop and ask whether to reopen/resume,
  supersede, or create the next round before editing implementation files.
- If the user passes `dry-run`, report the plan of action without editing
  files.
