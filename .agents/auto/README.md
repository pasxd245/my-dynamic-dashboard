# `.agents/auto/` — autoagent operating directory

Runtime state for the [`/autoagent`](../../.claude/commands/autoagent.md)
overnight loop. Most of this directory is gitignored — only this README
and `queue.md` are tracked, because the queue is the durable input
humans use to enqueue rounds.

## Files

| Path                                    | Tracked | Purpose                                                           |
| --------------------------------------- | ------- | ----------------------------------------------------------------- |
| `README.md`                             | ✅      | this file                                                         |
| `queue.md`                              | ✅      | round queue. Edit to enqueue. `[x]` prefix marks done.            |
| `state.json`                            | ❌      | supervisor state — last round, mode, started-at, budget remaining |
| `blockers.md`                           | ❌      | written on tier-2 stop. Clear by hand after fixing.               |
| `STOP`                                  | ❌      | touch this file to stop the current run cleanly between rounds    |
| `reports/<yyyymmdd>/round_NN.report.md` | ❌      | per-round morning-review report                                   |

## Usage

```sh
# enqueue a topic
$EDITOR .agents/auto/queue.md

# in Claude Code chat:
/autoagent --once --dry-run        # smoke test the loop on first queue entry
/autoagent --budget 3 --until 02:00  # short overnight
/autoagent                          # full run (default budget 6, deadline 06:00)

# stop mid-run from outside
touch .agents/auto/STOP

# stop because something went wrong (tier-2)
cat .agents/auto/blockers.md         # read the reason, fix, rm the file
```

## Authority model

- **Tier 1** — automatic: round patches that apply cleanly and pass
  self-validation; no-op rounds; round-writer's own artifacts.
- **Tier 2** — hard-stop: touches to self-locked files, real
  pre→post regressions in lint/smoke, judge `refine` after cap,
  empty queue.

See [.claude/commands/autoagent.md](../../.claude/commands/autoagent.md)
for the full state machine and self-lock list.
