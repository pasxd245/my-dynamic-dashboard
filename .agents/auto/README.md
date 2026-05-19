# `.agents/auto/` — autoagent operating directory

Runtime state for the [`/autoagent`](../../.claude/commands/autoagent.md)
overnight loop. `/autoagent` is **time-expansion + init params** for
a master-agent loop — each iteration the master-agent reads project
context (round state, master-plan, meta, memory, lesson-learn), picks
one action by priority, picks an executor (self-evo / `/master-plan`
/ `/research` / direct edit), and commits on its own branch.

Most of this directory is gitignored — only this README and
`queue.md` are tracked, because the queue is the durable
human-override + audit-log channel.

## Files

| Path                                     | Tracked | Purpose                                                               |
| ---------------------------------------- | ------- | --------------------------------------------------------------------- |
| `README.md`                              | ✅      | this file                                                             |
| `queue.md`                               | ✅      | human-override topics + per-iteration audit log                       |
| `state.json`                             | ❌      | supervisor state — last iteration, mode, started-at, budget remaining |
| `blockers.md`                            | ❌      | written on tier-2 stop. Clear by hand after fixing.                   |
| `STOP`                                   | ❌      | touch this file to stop the current run cleanly between iterations    |
| `reports/<yyyymmdd>/<kind>_NN.report.md` | ❌      | per-iteration morning-review report (`<kind>` ∈ round, meta)          |

## Usage

```sh
# (optional) pin a specific topic
$EDITOR .agents/auto/queue.md

# in Claude Code chat:
/autoagent --once --dry-run             # one action, no commits — first thing to try
/autoagent --budget 3 --until 02:00     # short overnight
/autoagent                              # full run (default budget 6, deadline 06:00)

# stop mid-run from outside
touch .agents/auto/STOP

# stop because something went wrong (tier-2)
cat .agents/auto/blockers.md            # read the reason, fix, rm the file
```

## Per-iteration priority tree

The master-agent picks ONE action per iteration. First match wins:

0. Human override — un-checked `### Topic:` in `queue.md`.
1. Active round (Round_NN.md in Planning / Doing) — continue/close.
2. Active master-plan with outstanding steps — make next Round_NN.
3. Open meta items (`.agents/plan/meta/`, `state.json.openObservations`) — meta round.
4. Memory / lesson-learn signals — brainstorm a meta round.
5. Nothing else — brainstorm a master-plan or topic research.
6. Priorities 1–5 all dry — stop (normal exit).

## Authority model

- **Tier 1** — automatic: round/meta patches that apply cleanly, pass
  self-validation, and clear the critical-security check; no-op
  rounds; non-code artifacts (research notes, draft plans) committed
  directly.
- **Tier 2** — hard-stop: touches to self-locked files, **any
  critical-security path hit**, real pre→post regressions in
  lint/smoke, judge `refine` after cap, degenerate idle state.

See [.claude/commands/autoagent.md](../../.claude/commands/autoagent.md)
for the full state machine, self-lock list, critical-security path
globs, and branch chain rules.
