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
- [2026-05-19T10:30Z] Round_02 (draft phase; initially created as `Meta_01`, renamed post-Option-A framework edit) via direct-edit — draft Round_02.md (split master-plan R02 into R02/R03/R04 chain) (source: master-plan)
- [2026-05-19T11:30Z] Round_02 (execute phase, same branch) via direct-edit — collapse builder/antdTheme.ts → @mdd/ui/themeTokens (source: round-state)
- [2026-05-19T11:35Z] Round_03 (draft phase) via direct-edit — MasterLayout API extension (header/brand/navGroups) (source: master-plan)
- [2026-05-19T11:45Z] Round_03 (execute phase, same branch) via direct-edit — extend MasterLayout API additively (source: round-state)
- [2026-05-19T11:50Z] Round_04 (draft phase) via direct-edit — promote PageCard + PageHeader to @mdd/ui (source: master-plan)
- [2026-05-19T12:00Z] Round_04 (execute phase, same branch) via direct-edit — promote PageCard + PageHeader (source: round-state)
- [2026-05-19T12:10Z] Round_05 (draft phase) via direct-edit — swap apps/builder AppShell → @mdd/ui/MasterLayout (source: master-plan); execute phase deferred (budget 5/5 reached)
- [2026-05-19T15:30Z] Meta_04 via direct-edit — promote Write-tool-Read-first discipline to workflow rule (source: meta-state)
- [2026-05-19T15:45Z] Meta_05 via direct-edit — relocate Write-tool rule from workflow-doc table cell into [[write-tool-discipline]] memory file (source: user-feedback)
- [2026-05-19T16:00Z] Round_06 via direct-edit — fix SavedQueryLibraryPage.tsx typecheck (coerce filters.state "all" → undefined) (source: meta-state → product)
- [2026-05-19T23:35Z] Round_07 (draft phase) via direct-edit — draft Round_07.md (Button wrapper; splits plan R06 row into chain R07/R08/R09/R10) (source: master-plan)
- [2026-05-19T23:40Z] Round_07 (execute phase, same branch) via direct-edit — land @mdd/ui/Components/Button (no-op antd wrapper + 3-case test) (source: round-state)
- [2026-05-19T23:45Z] Round_08 (draft phase) via direct-edit — draft Round_08.md (Modal no-op wrapper; chain link 2/4) (source: master-plan)
- [2026-05-19T23:50Z] Round_08 (execute phase, same branch) via direct-edit — land @mdd/ui/Components/Modal (no-op antd wrapper; onCancel test → smoke fallback per round-file rule) (source: round-state)
