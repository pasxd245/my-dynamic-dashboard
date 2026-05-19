---
description: Drive autonomous PDCA execution — master-agent reads context, picks one action per iteration, stops at deadline.
argument-hint: '[--once] [--budget N] [--until HH:MM] [--dry-run] [--autopilot] [--cold] [--allow-llm-edit]'
---

# /autoagent

`/autoagent` is **time-expansion + init params** for a master-agent
loop. It does not itself decide what to do — each iteration the
master-agent (this chat) reads current project context, picks one
action by priority, picks an executor for that action (self-evo, a
skill like `/master-plan` or `/research`, or a direct edit), commits
on a per-iteration branch, writes a report, then either continues or
stops. `/autoagent` provides the budget, the deadline, the self-lock,
and the critical-security envelope.

The five action types, in priority order:

1. **Continue or close an active round** (Planning/Doing Round_NN.md).
2. **Make the next round from an active master-plan** — open the next
   plan step as a new Round_NN.md.
3. **Make a meta round** from open meta items (`.agents/plan/cycles/meta/`,
   `state.json.openObservations`) — orchestrator/workflow improvements.
4. **Brainstorm a meta round** from memory or lesson-learn signals —
   targets observations not yet codified as meta items.
5. **Brainstorm new work** — invoke `/master-plan` to draft a plan
   plus workflow plus first Round_NN.md, or `/research` to write a
   research note that seeds future work.

If none of the five is actionable, the loop stops. Priority 0 is a
**human override** via `.agents/auto/queue.md`: any un-checked
`### Topic:` entry wins over the priority tree.

## Inviolable rule — self-lock

The master-agent MUST NOT edit, stage, or commit changes to any of
the following — regardless of executor (self-evo, `/pdca`,
`/master-plan`, `/research`, direct edit). This rule cannot be lifted
by any auto-approve authority, validation success, or report
justification. If an action requires editing any of these, **stop**,
write the reason to `.agents/auto/blockers.md`, exit cleanly. Humans
editing these files outside `/autoagent` are not bound.

**Hard-locked** (the orchestrator's brain — touching these mid-loop
means autoagent could break its own ability to drive the next iteration):

- `.claude/commands/autoagent.md` (this file)
- `.agents/orchestrators/self-evo/src/graph.ts`
- `.agents/orchestrators/self-evo/src/state.ts`
- `.agents/orchestrators/self-evo/src/cli.ts`
- `.agents/orchestrators/self-evo/src/persistence/**`
- `.agents/orchestrators/self-evo/scripts/self-evo.sh`

**Soft-locked** (require `--allow-llm-edit`; otherwise hard-stop):

- `.agents/orchestrators/self-evo/src/llm/**`
- `.agents/orchestrators/self-evo/src/nodes/**`

The `--allow-llm-edit` flag exists for R-O (multi-provider transport)
which deliberately rewrites `src/llm/`. Don't grant it casually.

## Critical-security paths

For any action that produces a code patch, **any** of the following
is a tier-2 hard-stop — regardless of executor or the rest of the
patch's quality. A human must approve by hand.

**Path globs**:

- `**/auth/**`, `**/auth.*`
- `**/.env*`, `**/secrets/**`, `**/credentials/**`
- `**/crypto/**`, `**/keys/**`, `**/keystore/**`
- `**/permissions/**`, `**/middleware/auth*`, `**/policy/**`
- `.github/workflows/**`

**Diff-content rules** (apply on the textual patch, not just paths):

- A line adding a package name under `"dependencies"` (runtime
  deps) in any `package.json`. New `"devDependencies"` are
  **allowed** without tier-2 — that's the 2026-05-18 precedent
  (Round_01's resolution dropped `clsx` from runtime deps; the
  vitest / typing devDeps stayed). New runtime deps still warrant
  the tier-2 review because they leak into the consumer bundle.
- A new top-level `import` / `require` of `child_process`,
  `node:child_process`, or `vm`.
- Any new use of `eval(` not present pre-patch.

On hit: write `blockers.md` citing the rule + patch path, do not
commit, exit clean. Widening this list is cheap (add a glob);
narrowing it requires reviewing past blocker events.

## Usage

```text
/autoagent [--once] [--budget N] [--until HH:MM] [--dry-run]
           [--autopilot] [--cold] [--allow-llm-edit]
```

| Flag               | Meaning                                                                                                                                                                                                                                             | Default                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `--once`           | Execute one iteration (one action from the priority tree) and exit. Smoke-test.                                                                                                                                                                     | off                                    |
| `--budget N`       | Cap at N iterations.                                                                                                                                                                                                                                | 6                                      |
| `--until HH:MM`    | Machine-local stop time. Finish the in-flight iteration; do not start another after this.                                                                                                                                                           | 06:00                                  |
| `--dry-run`        | Run iterations and write reports, BUT do not create branches or commit.                                                                                                                                                                             | off                                    |
| `--autopilot`      | Turn on smart-autopilot policy — master-agent decides per the table in [agent-architecture.workflow.md § Smart-autopilot](../../docs/agents/workflows/agent-architecture.workflow.md) instead of asking the user. See "Smart-autopilot mode" below. | off (attended) / on (cron, unattended) |
| `--cold`           | Force cold-start discipline — master-agent reads disk state aggressively, dumps every decision to disk before iter end, never relies on conversation context. See "Cold-start mode" below + principle P5.                                           | off (warm)                             |
| `--allow-llm-edit` | Unlock the soft-lock on `src/llm/**` + `src/nodes/**`. Required for R-O. Hard-locks are NEVER lifted (see principle P3).                                                                                                                            | off                                    |

Examples:

```text
/autoagent --once --dry-run                # one action, no commits — first thing to try
/autoagent --once --cold                   # cold-session smoke test (does the framework survive restart?)
/autoagent --budget 3 --until 02:00        # short overnight, attended-style (master-agent asks on ambiguity)
/autoagent --autopilot --budget 6          # daytime "trust your judgment" run — smart-autopilot decides
/autoagent --autopilot --cold --until 06:00 # the real overnight pattern — fresh-disk + autonomous decisions
/autoagent --once --allow-llm-edit         # R-O dispatch (LLM-transport rewrite)
```

### Smart-autopilot mode (`--autopilot`)

Smart-autopilot is **not** a separate tier or a way to escape the safety envelope. It's master-agent's policy for **what to decide on its own** when the user isn't around to confirm. The full decision table — what gets auto-approved, what escalates to tier-2 — lives in [docs/agents/workflows/agent-architecture.workflow.md § Smart-autopilot](../../docs/agents/workflows/agent-architecture.workflow.md). Tier-2 (critical-security, hard-locks, judge `refine` past cap, related-channel regressions) still hard-stops regardless of mode.

When to set `--autopilot`:

- Daytime run where you're around but want master-agent to decide instead of pinging you.
- Cron / scheduled remote agent (auto-enables by convention; explicit flag is the safe default).
- Anytime you'd rather see a tier-2 `blockers.md` in the morning than be paged on every ambiguity.

When **not** to set it:

- First runs of a new flag combination — you want to babysit and see what gets escalated.
- After a tier-2 — you're debugging the framework, not running it.

### Cold-start mode (`--cold`)

Master-agent discipline (per principle P5 in [.agents/context/principles.md](../../.agents/context/principles.md)): every decision must be derivable from disk state. In `--cold` mode master-agent commits to this in real time:

- **At iter start**: read [state.json](../../.agents/auto/state.json), [memory/](../../.agents/memory/), the latest round files at [cycles/](../../.agents/plan/cycles/), [queue.md](../../.agents/auto/queue.md), and recent reports under [reports/](../../.agents/auto/reports/) before deriving the next action. Don't rely on conversation history even if it exists.
- **Per decision**: if a fact informing the call isn't on disk, dump it first (memory entry, state.json observation, or queue topic) before acting on it.
- **At iter end**: the report's `Notable` section must list which disk-sourced facts informed the iteration.

`--cold` is testable: at session end, the audit should show every load-bearing fact has a disk source. If master-agent finds itself making decisions on conversation-only facts, that's a regression on P5.

Why bother: the framework's whole premise — extending master-agent's working window past the human — relies on cold-start working. Tonight's session (2026-05-19) shipped 7 rounds but never validated this; `--cold` is how to find out.

## State machine — per iteration

The master-agent drives each iteration. `/autoagent` is just the
envelope around the loop.

1. **Load state** (read-only):
   - `.agents/auto/state.json` — last iteration, mode, budget consumed.
   - `.agents/auto/blockers.md` — exists ⇒ exit clean.
   - `.agents/auto/STOP` — exists ⇒ exit clean.
   - `.agents/auto/queue.md` — un-checked `### Topic:` entries (human override).
2. **Check stop conditions** before doing any work.
3. **Read context** in priority order; the first source with actionable
   state determines the action:

   | Priority | Source                                                                                                  | Action                                                                                                       |
   | -------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
   | 0        | `.agents/auto/queue.md` first un-checked `### Topic:` (human override)                                  | Pop topic; treat as the kind declared by `- kind:`                                                           |
   | 1        | Latest `.agents/plan/cycles/Round_NN.md` with status `Planning` / `Doing`                               | Continue/close the active round → `Round_NN` branch                                                          |
   | 2        | Active master-plan with steps that have no corresponding `Round_*.md` yet                               | Branch `Round_<new>`; draft `Round_<new>.md` only (iteration ends — next iter picks it up under priority 1)  |
   | 3        | Open meta items in `.agents/plan/cycles/meta/` or `state.json.openObservations`                         | Make a meta round → `Meta_NN` branch                                                                         |
   | 4        | Open observations in `~/.claude/projects/.../memory/feedback_*.md` / `project_*.md` or lesson-learn doc | Brainstorm a meta round addressing them                                                                      |
   | 5        | None of the above                                                                                       | Brainstorm-plan (`/master-plan`) OR research (`/research`) on a frontier area; either way → `Meta_NN` branch |
   | 6        | Priorities 1–5 all produced nothing actionable                                                          | Stop (tier-1 normal exit, not a tier-2 blocker)                                                              |

4. **Pick the executor** for the chosen action:
   - Code round (priorities 0–1) ⇒ default is
     `scripts/self-evo.sh round "<topic>" --req ...`. For trivially
     small changes (one-line edits, single-file refactors) the
     master-agent MAY edit directly + validate + commit, but must
     justify in the report.
   - Round-draft (priority 2 — `Round_<new>.md` doesn't exist yet) ⇒
     default is **direct-edit** by the master-agent (read the plan
     step + relevant repo files; write the Round file). Self-evo's
     `round` CLI is the wrong fit — it executes a round end-to-end,
     not drafts one. Output is `Round_<new>.md` only; the iteration
     ends after the draft. The next iteration picks it up under
     priority 1 on the **same** `Round_<new>` branch.
   - Meta round (priorities 0 with `kind: meta`, 3, 4) ⇒ same defaults
     (self-evo), or direct edit with justification. Self-lock still
     applies regardless.
   - Brainstorm-plan (priority 5) ⇒ `/master-plan` skill. Emits
     `docs/agents/plan/<name>.plan.md` + `<name>.workflow.md` + the
     first `.agents/plan/cycles/Round_<new>.md` per the v2.0 contract.
   - Research (priority 5 alternative) ⇒ `/research` skill, output
     `docs/agents/research/<slug>.md`.

5. **Create or switch to the branch** (skipped when `--dry-run`):
   - Kind = `Round` for any iteration whose artifact is `Round_NN.md`
     (drafting **or** executing). Kind = `Meta` for orchestrator /
     workflow work landing under `.agents/plan/cycles/meta/Meta_NN.md`.
   - `NN` per case:
     - Round-draft (priority 2): max existing
       `.agents/plan/cycles/Round_*.md` artifact number + 1.
     - Round-execute (priority 1 / priority 0 with `kind: round`):
       matches the active `Round_NN.md` being closed.
     - Meta round: max existing
       `.agents/plan/cycles/meta/Meta_*.md` artifact number + 1.
   - Base = the most-recent `autoagent/<yyyymmdd>/*` branch (any
     kind) if one exists for today; else current `HEAD`.
   - If `autoagent/<yyyymmdd>/<Kind>_<NN>` **already exists** (e.g. a
     Round draft created it earlier in this run and a later iteration
     is now executing it), use `git switch autoagent/<yyyymmdd>/<Kind>_<NN>`
     — do NOT re-create the branch. Otherwise:
     `git switch -c autoagent/<yyyymmdd>/<Kind>_<NN> <base>`.
   - **Chain semantic**: each branch bases on the previous in the
     same date. A `Round_NN` branch may span two iterations (draft +
     execute) and accumulate commits across both. If branch N fails,
     branches N+1, N+2, … in the same chain are tainted by
     inheritance. Recovery is a human task (rebase / cherry-pick).
     Do not break this rule.

6. **Execute the action** via the chosen executor. For self-evo, the
   round CLI exits at the first HITL pause; inspect `state.json` and
   resolve per Authority. For skill-based executors, the skill drives
   its own HITL.

7. **Critical-security check** on the proposed patch fileset (path
   globs + diff-content rules above). Hit ⇒ tier-2; write blockers,
   exit.

8. **Apply / validate**:
   - Patches that landed cleanly + `pnpm md:lint` + `pnpm --filter
@self/orchestrator test` green ⇒ commit (tier 1).
   - Non-code artifacts (research notes, draft plans) commit directly,
     no execution validation needed.
   - Any tier-2 trigger ⇒ write `blockers.md`, exit.

9. **Commit** (skipped when `--dry-run`):

   ```sh
   git add -A . && git commit -m "feat(autoagent): close <kind> <NN> — <topic>"
   ```

10. **Write the report** at
    `.agents/auto/reports/<yyyymmdd>/<kind>_<NN>.report.md`.

11. **Update state.json**: bump iteration counter, record kind +
    action source + executor, set `mode: idle`.

12. **Append audit line** to `.agents/auto/queue.md` under the
    `## Audit log` section (see Queue role).

13. **Decide next**:
    - Stop conditions met ⇒ exit clean.
    - More work + within deadline ⇒ next iteration immediately.
    - Long gap before next slot ⇒ `ScheduleWakeup` 30 min, then re-check.

## Authority — two tiers

**Tier 1 — auto-approve + log** (commit; surface in the report as
"authoritative" for one-glance morning review):

- Code/meta round patches that apply cleanly, pass self-validation,
  and pass the critical-security check.
- No-op rounds (zero patches, judge approved with grounded findings).
- Non-code artifacts (research notes, draft plans, Round_NN.md /
  Meta_NN.md files themselves) committed directly.
- Auto-emitted entries in `.agents/plan/promotions.md` from
  `round-writer` when self-evo is the executor.

**Tier 2 — hard-stop** (do NOT commit; write `blockers.md`; exit):

- Any soft-locked or hard-locked file in the diff (see Self-lock).
- Critical-security path or diff-content rule hit.
- Self-evo judge returns `refine` after the reflection cap.
- Self-validation regression: lint or orchestrator tests go from
  green to red and the diff touches related files.
- `apply-verifier` shows a real pre→post regression in lint or smoke
  channels (not the worktree-pnpm-r noise — see Known noise).
- Priority tree all dry AND `--once` not set AND budget remaining
  (degenerate idle state; stop so a human can audit why).

Note: the priority tree, including brainstorm and research, is a
work-**selection** tree, not an error-recovery tree. Tier-2 triggers
are NOT auto-resolved by selecting a different priority — they always
hard-stop.

## Branch model — inherited chain

```text
autoagent/<yyyymmdd>/Round_09   (base: dev)               ← close active Round_09 (priority 1)
autoagent/<yyyymmdd>/Round_10   (base: …/Round_09)        ← draft Round_10.md from plan (priority 2; iter ends after the draft)
autoagent/<yyyymmdd>/Round_10   (same branch, +commits)   ← next iteration executes Round_10 (priority 1; appends commits)
autoagent/<yyyymmdd>/Meta_02    (base: …/Round_10)        ← orchestrator/workflow meta (priorities 3/4)
```

A `Round_NN` branch can span **two iterations on the same ref**
(draft then execute). The second iteration uses `git switch`, not
`git switch -c`. `Meta_NN` branches are single-iteration.

Counters are **per kind**, persistent across autoagent runs. Read max
existing `Round_*.md` / `Meta_*.md` + 1. Round files live at
`.agents/plan/cycles/Round_NN.md`; Meta files at
`.agents/plan/cycles/meta/Meta_NN.md`.

A brainstorm-plan iteration runs on a `Meta_NN` branch and commits
`docs/agents/plan/<name>.plan.md` + `<name>.workflow.md` +
`Round_<new>.md` — the seed `Round_<new>.md` is consumed by a later
iteration on its own `Round_<new>` branch. (Aligning brainstorm-plan
with the priority-2 same-branch convention is a future refinement —
out of scope here.)

**Chain breaks at first failure.** If iteration N produces a tier-2
stop, iterations N+1+ in the same date's chain inherit a bad base.
Recovery is a human task. Do not auto-rebase or auto-cherry-pick.

## Topic queue — override + audit

`.agents/auto/queue.md` has two roles:

1. **Human override.** Humans pin a specific topic with an un-checked
   `### Topic:` entry. The master-agent pops the first un-checked
   entry **before** consulting the priority tree (priority 0). Use
   `- kind: round | meta` to declare the kind; defaults to `round`.
2. **Audit log.** After each iteration the master-agent appends a
   one-line entry under `## Audit log` recording the action taken:
   `- [<ISO8601>] <Kind>_<NN> via <executor> — <topic> (source: <priority-key>)`.

```markdown
### Topic: Tighten error messages in scripts/dev/cleanup.sh

- kind: round
- req: Boundary: only scripts/dev/cleanup.sh may be modified
- req: Stage-failure messages must include the failing command and exit code

### [x] Topic: (consumed earlier)

## Audit log

- [2026-05-18T22:14Z] Round_09 via self-evo — close Round 08 link (source: round-state)
- [2026-05-18T22:47Z] Meta_02 via direct-edit — autoagent reframe (source: queue)
```

Optional fields on `### Topic:`:

- `- kind: round | meta` — defaults to `round`.
- `- req: <text>` — repeated; each becomes a `--req` flag when the
  executor is self-evo.

## Report format

`.agents/auto/reports/<yyyymmdd>/<kind>_<NN>.report.md`:

```markdown
# <Kind> <NN> Report — <yyyy-mm-dd>

**Branch**: autoagent/<yyyymmdd>/<Kind>\_<NN>
**Kind**: round | meta
**Topic**: <verbatim>
**Action source**: queue | round-state | master-plan | meta-state | memory | brainstorm
**Executor**: self-evo | /pdca | /master-plan | /research | direct-edit
**Run id**: <self-evo runId, if applicable; else "—">
**Status**: Done | Blocked | No-op
**Self-validation**: lint ✅ tests ✅
**Critical-security check**: ✅ (no path hits) | ❌ blocked on <rule>

## Outcome

- patches_proposed: <N> (— for non-patch actions)
- patches_applied: <N>
- judge_score: <0..1> (— for non-self-evo executors)
- judge_iterations: <N>

## ⚠️ Authoritative changes (tier 1)

- <sha> — touched: <files>
- Why: <one-sentence rationale grounded in the iteration's findings>

(Or: "No authoritative changes." for dry-run or no-op iterations.)

## Notable

- <one-paragraph summary>

## Commits

<git log --oneline output for this iteration's branch, oldest first>
```

`.agents/auto/reports/` is gitignored — morning-review artifacts.

## Rate-limit + transport (self-evo executor only)

When self-evo is the executor:

- **Anthropic rate-limit error**: `ScheduleWakeup` 30 min, re-check
  `--until` deadline, retry the action from the start (state.json
  from the failed run stays for forensics).
- **Subprocess timeout** on > 50% of plan steps: tier-2 blocker —
  raise transport budget per ROLLOUT.md.
- **`claude -p` hard failure** (not on PATH, auth expired): tier-2.

For skill-based executors (`/master-plan`, `/research`, `/pdca`) the
skill handles its own transport.

## Known noise (do NOT escalate to tier-2)

Documented in [ROLLOUT.md](../../.agents/orchestrators/self-evo/ROLLOUT.md):

- **`pnpm -r typecheck` / `pnpm -r test` fails in the self-evo
  worktree** because nested package node_modules aren't symlinked.
  Ignore unless the round touched TS/test files in a package whose
  typecheck failed.
- **Sequential apply conflicts on `applied: false` patches.**
  Apply-verifier correctly reports these; skipped at apply time, not
  escalated.
- **Round b's "no-op" outcome.** Zero patches with judge approval is
  valid; treat as tier-1.

## Stop conditions

Exit cleanly when any of:

- Wall clock ≥ `--until` (default 06:00). Finish in-flight iteration.
- `--budget N` iterations completed.
- `.agents/auto/STOP` file present.
- `.agents/auto/blockers.md` written this run.
- Priority tree all dry (queue empty, no active round, no plan with
  outstanding steps, no meta items, no memory/lesson-learn signals,
  brainstorm/research declined or stalled).
- A tier-2 escalation.

On exit, write a final entry to `state.json` (`mode: stopped`,
reason, timestamp) and post a brief end-of-run note to chat with the
report directory + branch list.

## Operating directory

```text
.agents/auto/
  README.md                              # this directory's purpose
  state.json                             # supervisor state
  queue.md                               # override + audit log (committed)
  blockers.md                            # written on tier-2 stop; cleared by humans
  STOP                                   # touch to stop cleanly mid-run
  reports/<yyyymmdd>/<kind>_NN.report.md # gitignored, morning-review only
```

`state.json`, `reports/`, `STOP`, and `blockers.md` are gitignored.
`queue.md` and `README.md` are tracked.

## Output

After each iteration, post to chat:

```text
[autoagent] <Kind>_<NN> (<topic>) → done | blocked | no-op | dry-run
```

When the master-agent derives an action (priority > 0), also post
the derivation reasoning in one line:

```text
[autoagent] derived: priority <N> (<source>) → <one-line action>
```

On final exit:

```text
[autoagent] stopped: <reason>. <N> iterations closed, <M> blocked.
Reports: .agents/auto/reports/<yyyymmdd>/
Branches: autoagent/<yyyymmdd>/<first>..<last>
```

## Notes

- **One action per iteration.** A round, a meta, a plan-draft, or a
  research note — exactly one. If you discover unrelated breakage
  mid-iteration, do not absorb it; open a new iteration.
- **Trust the judge.** Self-evo's `approve` with grounded findings is
  authoritative; don't re-run. `refine` past cap is a real signal —
  don't override.
- **The priority tree is for work selection, not error recovery.**
  Tier-2 always hard-stops. Selecting a different priority is not a
  way around a regression or a critical-security hit.
- **Chain breaks at first failure.** If iteration N tier-2's,
  iterations N+1+ in the same chain inherit a bad base — a human
  must rebase / cherry-pick / restart the chain.
- **Dry-run first.** Before relying on autopilot overnight, do
  `/autoagent --once --dry-run`. Confirm the priority-tree read and
  chosen action match expectation before trusting unattended.
