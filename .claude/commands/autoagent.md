---
description: Drive self-evo through autonomous PDCA rounds — per-round branches, commits, reports, stop at deadline.
argument-hint: '[--once] [--budget N] [--until HH:MM] [--dry-run]'
---

# /autoagent

Turn the current Claude Code chat into the master-agent for autonomous
PDCA execution against this repo. The actual round work is done by
`scripts/self-evo.sh round`, which spawns its own LLM-driven sub-stages
(repo-scanner → ... → patch-author → ... → judge → HITL). This master
loop drives that CLI: pick a topic from the queue, run the round,
handle the HITL gate by policy, commit on a per-round branch, write a
report, sleep until the next slot, stop cleanly at the deadline.

The orchestrator's design notes live in
[.agents/orchestrators/self-evo/ROLLOUT.md](../../.agents/orchestrators/self-evo/ROLLOUT.md).
Manually-driven rounds a–c (Round_01–Round_03) are the reference for
"what a normal round looks like" and shaped the policy below.

## Inviolable rule — self-lock

While running under this command, you MUST NOT edit, stage, or commit
changes to any of the following. This rule cannot be lifted by any
auto-approve authority, validation success, or report justification.
If a round requires editing any of these, **stop**, write the reason
to `.agents/auto/blockers.md`, and exit cleanly. Humans editing these
files outside `/autoagent` execution are not bound — that is the
expected maintenance path.

**Hard-locked** (the orchestrator's brain — touching these mid-loop
means autoagent could break its own ability to drive the next round):

- `.claude/commands/autoagent.md` (this file)
- `.agents/orchestrators/self-evo/src/graph.ts`
- `.agents/orchestrators/self-evo/src/state.ts`
- `.agents/orchestrators/self-evo/src/cli.ts`
- `.agents/orchestrators/self-evo/src/persistence/**`
- `.agents/orchestrators/self-evo/scripts/self-evo.sh`

**Soft-locked** (require an explicit `--allow-llm-edit` flag from the
user; otherwise hard-stop):

- `.agents/orchestrators/self-evo/src/llm/**`
- `.agents/orchestrators/self-evo/src/nodes/**`

The `--allow-llm-edit` flag exists for R-O (multi-provider transport),
which deliberately rewrites `src/llm/`. Don't grant it casually.

## Usage

```text
/autoagent [--once] [--budget N] [--until HH:MM] [--dry-run] [--allow-llm-edit]
```

| Flag               | Meaning                                                                                                | Default |
| ------------------ | ------------------------------------------------------------------------------------------------------ | ------- |
| `--once`           | Execute one round and exit. Smoke-test the loop body.                                                  | off     |
| `--budget N`       | Cap at N rounds.                                                                                       | 6       |
| `--until HH:MM`    | Machine-local stop time. Finish the in-flight round, do not propose another after this point.          | 06:00   |
| `--dry-run`        | Run rounds, write reports, BUT do not create branches or commit. Useful for the first overnight smoke. | off     |
| `--allow-llm-edit` | Unlock the soft-lock on `src/llm/**` + `src/nodes/**`. Required for R-O.                               | off     |

Examples:

```text
/autoagent --once --dry-run         # one round, no commits — first thing to try
/autoagent --budget 3 --until 02:00 # short overnight
/autoagent                          # full overnight, 6 rounds, stop 06:00
/autoagent --once --allow-llm-edit  # R-O dispatch
```

## State machine — per iteration

You are the master-agent. You do NOT do the round work yourself — you
orchestrate `scripts/self-evo.sh`. Each iteration:

1. **Load state** (read-only):
   - `.agents/auto/state.json` (last round number, mode, started-at, budget consumed).
   - `.agents/auto/blockers.md` (if exists → mode is BLOCKED → exit clean).
   - `.agents/auto/STOP` (if exists → exit clean).
   - `.agents/auto/queue.md` (next topic to pop).
   - Latest `.agents/plan/cycles/Round_NN.md` and its status.
2. **Check stop conditions** (see Stop conditions below) **before** doing any work.
3. **Pop next topic** from `.agents/auto/queue.md`:
   - Parse the first un-checked `### Topic: <text>` block.
   - Collect its `- req: <text>` bullets into `--req` flags.
   - Mark the topic in-progress in `queue.md`.
4. **Create the round branch** (skipped when `--dry-run`):
   - Determine `NN` = max existing `Round_*.md` number + 1.
   - Determine base branch: previous round's branch if in the same `<yyyymmdd>` chain, else current `HEAD`.
   - `git switch -c autoagent/<yyyymmdd>/Round_<NN> <base>`.
5. **Run the round** via `Bash`:

   ```sh
   scripts/self-evo.sh round "<topic>" --req "..." --req "..."
   ```

   Capture the runId from stdout. The CLI exits at the first HITL pause; `state.json` is on disk at the printed path.

6. **Inspect state.json** (read-only):
   - `verdict.verdict === "approve"` and at least one `patches[]` entry with `applied: false` ⇒ proceed to apply.
   - `verdict.verdict === "approve"` and `patches[].length === 0` ⇒ no-op round (legitimate, see round b). Skip apply, go straight to approve.
   - `verdict.verdict === "refine"` ⇒ stop, write tier-2 blocker (the judge wanted another loop the orchestrator already capped).
7. **Decide tier** (see Authority below) and act:
   - Tier 1, has patches ⇒ `echo "apply" | scripts/self-evo.sh resume <runId>`. Inspect `appliedVerification`. If clean delta or expected noise, proceed. If real regression, tier-2.
   - Tier 1, no-op ⇒ `echo "approve" | scripts/self-evo.sh resume <runId>`.
   - Tier 2 ⇒ write `.agents/auto/blockers.md` with reason + runId, exit clean.
8. **Apply the accepted patches to the main checkout** (skipped when `--dry-run`):

   ```sh
   for p in .agents/tmp/workspace/runs/<runId>/patches/*.patch; do
     git apply --check "$p" && git apply "$p"
   done
   ```

   Skip any patch whose `applied: false` in state.json (apply-verifier already rejected it as a sequential conflict — that's not a regression).

9. **Self-validate** via `Bash` (skipped when `--dry-run`):

   ```sh
   pnpm md:lint && pnpm --filter @self/orchestrator test
   ```

   Pre-existing failures elsewhere (e.g. `pnpm -r typecheck`) are NOT autoagent's concern. Only validate what this round was supposed to touch. Green ⇒ commit. Red, and the round touched related files ⇒ tier-2.

10. **Commit** (skipped when `--dry-run`):

    ```sh
    git add -A . && git commit -m "feat(self-evo): close round <NN> — <topic>"
    ```

11. **Write the report** at `.agents/auto/reports/<yyyymmdd>/round_<NN>.report.md` (see format below).
12. **Update state.json**: bump `lastRound`, `completed`, set `mode: idle`.
13. **Decide next**:
    - Stop conditions met ⇒ exit clean.
    - More work + within deadline ⇒ next iteration immediately.
    - Long gap before next slot ⇒ `ScheduleWakeup` 30 minutes, then re-check.

## Authority — two tiers

**Tier 1 — auto-approve + log** (commit, surface in the round report
as "authoritative" so morning review is one-glance):

- Round patches that land cleanly via `apply` + pass self-validation.
- No-op rounds (zero patches, judge approved with grounded findings).
- Auto-emitted entries in `.agents/plan/promotions.md` from `round-writer`.
- Round_NN.md file written by the orchestrator (cannot be skipped).

**Tier 2 — hard-stop** (do NOT commit; write `blockers.md`; exit):

- Any soft-locked or hard-locked file in the diff (see Self-lock).
- Judge returns `refine` after the reflection cap — the orchestrator
  already burned its budget, autoagent should not override.
- Self-validation regression: `pnpm md:lint` or `pnpm --filter @self/orchestrator test`
  goes from green to red and the diff touches related files.
- `apply-verifier` shows a real pre→post regression in lint or smoke
  channels (not the worktree-pnpm-r noise — that's expected, see
  Known noise below).
- Topic queue empty AND `--once` not set AND no master-plan to drain.

## Known noise (do NOT escalate to tier-2)

Documented in [ROLLOUT.md](../../.agents/orchestrators/self-evo/ROLLOUT.md)
under "Learnings — round a" / "Learnings — round c":

- **`pnpm -r typecheck` / `pnpm -r test` fails in the worktree** because
  nested package node_modules aren't symlinked. The verifier's
  `appliedVerification` will show those as fail, but they're unrelated
  to the patch. Ignore unless the round actually touched TS/test files
  in a package whose typecheck failed.
- **Sequential apply conflicts on `applied: false` patches.** Round c's
  third patch hit this when its target region had already been touched
  by an earlier accepted patch. Apply-verifier correctly reports
  `applied: false` for those; they're skipped at step 8, not escalated.
- **Round b's "no-op" outcome**. Zero patches with a judge approval IS
  a valid round (round b proved this). Treat as tier-1.

## Topic queue

`.agents/auto/queue.md` — markdown with one `### Topic:` heading per
job. Lines starting with `- req:` map to `--req` flags. Use a leading
`[x]` on the heading to mark it consumed.

```markdown
### Topic: Tighten error messages in scripts/dev/cleanup.sh

- req: Boundary: only scripts/dev/cleanup.sh may be modified
- req: Make stage-failure messages include the failing command and exit code
- req: Script must still pass shellcheck

### [x] Topic: (consumed earlier)
```

The master picks the first un-checked topic, marks it in-progress, then
on round close either flips it to `[x]` (success) or removes the
in-progress marker (failure ⇒ retry next time).

## Per-round branch & report

```text
autoagent/<yyyymmdd>/Round_01   (base: dev)               ← first round of the run
autoagent/<yyyymmdd>/Round_02   (base: …/Round_01)       ← chained
autoagent/<yyyymmdd>/Round_03   (base: …/Round_02)       ← chained
```

The number `NN` is the **PDCA round number** (from
`.agents/plan/cycles/Round_NN.md`), persistent across autoagent runs.
Not a fresh-each-night counter.

Report at `.agents/auto/reports/<yyyymmdd>/round_<NN>.report.md`:

```markdown
# Round <NN> Report — <yyyy-mm-dd>

**Branch**: autoagent/<yyyymmdd>/Round\_<NN>
**Topic**: <verbatim from queue>
**Status**: Done | Blocked | No-op
**Run id**: <self-evo runId>
**Self-validation**: lint ✅ tests ✅

## Round outcome

- patches_proposed: <N>
- patches_applied: <N>
- judge_score: <0..1>
- judge_iterations: <N>

## ⚠️ Authoritative changes (tier 1)

- <sha> — touched: <files>
- Why: <one-sentence rationale grounded in the round's findings>

(Or: "No authoritative changes." for dry-run or no-op rounds.)

## Notable from the run

- <one-paragraph summary lifted from state.json verdict.notes + findings>

## Commits

<git log --oneline output for this round's branch, oldest first>
```

`.agents/auto/reports/` is gitignored — these are morning-review
artifacts, not history.

## Rate-limit + transport handling

Per round, `scripts/self-evo.sh round` will spawn ~6–8 LLM
subprocesses (one per node, plus chunked patch-author per plan step).
The defaults: subprocess `claude -p` with a 5-min timeout, no API key.
Watch for:

- **Anthropic rate-limit error** bubbling up from a node: `ScheduleWakeup`
  30 minutes, re-check `--until` deadline, retry the round from the
  start (state.json from the failed run stays on disk for forensics).
- **Subprocess timeout** on a single node: the orchestrator already
  surfaces this. If patch-author times out on > 50% of plan steps for
  a round, write tier-2 blocker — the transport budget needs raising
  (recommend setting `ANTHROPIC_API_KEY` + `config/llm.yaml` per
  ROLLOUT.md's recommended setup).
- **`claude -p` hard failure** (not on PATH, auth expired): tier-2.

## Stop conditions

Exit cleanly when any of:

- Wall clock ≥ `--until` (default 06:00). Finish in-flight round, then stop.
- `--budget N` rounds completed.
- `.agents/auto/STOP` file present.
- `.agents/auto/blockers.md` written this run.
- Topic queue empty AND `--once` set (or no master-plan to drain).
- A tier-2 escalation.

On exit, write a final entry to `state.json` (`mode: stopped`, reason,
timestamp) and post a brief end-of-run note to the chat with the
report directory + branch list.

## Operating directory

```text
.agents/auto/
  README.md                              # this directory's purpose
  state.json                             # supervisor state
  queue.md                               # topic queue (committed; edit to enqueue)
  blockers.md                            # written on tier-2 stop; cleared by humans
  STOP                                   # touch to stop cleanly mid-run
  reports/<yyyymmdd>/round_NN.report.md  # gitignored, morning-review only
```

`.agents/auto/state.json`, `.agents/auto/reports/`, `.agents/auto/STOP`,
and `.agents/auto/blockers.md` are gitignored. `queue.md` and
`README.md` are tracked — the queue is the durable input.

## Output

After each iteration, post a one-line status line to the chat:

```text
[autoagent] Round <NN> (<topic>) → done | blocked | no-op | dry-run
```

On final exit:

```text
[autoagent] stopped: <reason>. <N> rounds closed, <M> blocked.
Reports: .agents/auto/reports/<yyyymmdd>/
Branches: autoagent/<yyyymmdd>/Round_<first>..Round_<last>
```

## Notes

- **Don't bundle.** Each PDCA round is one feature, bug fix, or
  refactor. If you discover unrelated breakage mid-round (a dev-server
  flake, an upstream test regression), **do not** absorb it. Open a
  new round for the fix and chain it on top.
- **Trust the orchestrator's judge.** When it returns `approve` with
  grounded findings (round b style), don't second-guess by re-running.
  When it returns `refine` past the reflection cap, that's an
  orchestrator-level signal that the round can't close cleanly today.
- **Dry-run first.** Before a real overnight run, do
  `/autoagent --once --dry-run` against the first queue entry. The
  state machine should walk all 13 steps without committing.
