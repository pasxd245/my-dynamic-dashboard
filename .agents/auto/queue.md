# Autoagent topic queue

Two roles:

1. **Human override.** Add an un-checked `### Topic:` to pin a
   specific action; the master-agent will pop it before consulting
   the priority tree.
2. **Audit log.** After each iteration the master-agent appends a
   one-line entry under `## Audit log` recording the action taken.

## Override format

```markdown
### Topic: <one-line topic>

- kind: round # optional; round (default) | meta
- req: <requirement 1>
- req: <requirement 2>
```

Mark consumed entries with `[x]` after the round closes:

```markdown
### [x] Topic: (consumed)
```

Autoagent picks the first un-checked `### Topic:` heading as
priority 0, before the round-state / master-plan / meta / memory /
brainstorm tree.

## Optional fields on `### Topic:`

- `- kind: round | meta` — defaults to `round`. `meta` = topic targets
  `.agents/`, `.claude/`, `docs/agents/`, or workflow docs. Sets the
  branch prefix (`Round_NN` vs `Meta_NN`).
- `- req: <text>` — repeated; each becomes a `--req` flag if the
  master-agent picks self-evo as the executor.

See [.claude/commands/autoagent.md](../../.claude/commands/autoagent.md)
for the full state machine, self-lock list, and critical-security
path globs.

---

<!-- enqueue rounds below this line -->

<!-- end of seeded topics -->

## Audit log

<!-- master-agent appends one line per iteration:
- [<ISO8601>] <Kind>_<NN> via <executor> — <topic> (source: <priority-key>)
-->

- [2026-05-18T22:50Z] Round_01 via self-evo (dry-run, skipped executor) — continue/close Round_01 @mdd/ui package ship (source: round-state)
- [2026-05-19T10:00Z] Round_01 via direct-edit (self-evo dispatched, quit at HITL — partial-patch escape) — close Round 01 @mdd/ui package ship (source: round-state)
