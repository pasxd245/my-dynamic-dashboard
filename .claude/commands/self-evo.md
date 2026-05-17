---
description: Run the @self/orchestrator — start a round, resume a run, or query memories.
argument-hint: "round <topic>", "resume <runId>", "memories list", or "help"
---

# /self-evo

Dispatch to the self-evolution orchestrator.

## User Input

```text
$ARGUMENTS
```

The first token of `$ARGUMENTS` selects the sub-command:

| Sub-command               | Example                                                      |
| ------------------------- | ------------------------------------------------------------ |
| `round <topic>`           | `round "Replace upload-flow state" --req "Keep tests green"` |
| `resume <runId>`          | `resume 2026-05-16-abcdef`                                   |
| `memories list`           | `memories list --type insight --limit 10`                    |
| `memories search <query>` | `memories search "upload flow"`                              |
| `help`                    | `help`                                                       |

If `$ARGUMENTS` is empty, default to `help`.

## Behavior

1. Forward the full argument string to the dispatcher:

   ```bash
   bash .agents/orchestrators/self-evo/scripts/self-evo.sh $ARGUMENTS
   ```

2. The dispatcher ensures the TypeScript build is up-to-date, then runs
   `node dist/cli.js` with the forwarded arguments.
3. Stream stdout/stderr back to the user as-is.

## Output

```text
self-evo: <sub-command>
Status: <success | gate-hit | error>
Detail: <one-line summary from the orchestrator>
```

## Notes

- The dispatcher lives at `.agents/orchestrators/self-evo/scripts/self-evo.sh`;
  it auto-rebuilds when `src/` is newer than `dist/cli.js`.
