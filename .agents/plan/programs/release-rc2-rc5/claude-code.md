# Running this program with Claude Code

Parent: [release-rc2-rc5.plan.md](release-rc2-rc5.plan.md). How a human drives one item to done
with Claude Code in this repo. The repo's own rules (`CLAUDE.md` → `.agents/AGENTS.md`, PDCA, hard
gates) always win over this file.

## Who does what

| Step                  | Claude Code                                                                | Human                                                                                   |
| --------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Open round            | creates `Round_NN.md` seeded from the item spec, runs `flow-selector`      | approves the plan section                                                               |
| Design gate           | writes/updates the design doc, runs `ux-design` (design-spec) for UI items | reads; answers open questions                                                           |
| Contract gate         | edits `_shared/*.yaml` + contract files + MSW handlers + types; commits    | reviews the diff (one-way doors still open: 3.6, 3.7, 3.8; 2.6 and 3.2a/b have shipped) |
| Backend / Integration | implements, tests, commits per gate                                        | —                                                                                       |
| Check                 | runs all gate commands, writes the walk script                             | **runs the walk**, reports what they saw                                                |
| Act / close           | writes At a glance, Feeds into, prune check                                | flips `Complete`                                                                        |
| Tag rc                | runs the rc exit gate checklist, drafts the release note                   | tags; decides any pin change elsewhere                                                  |

Claude Code never pushes, never tags, never flips `Complete`.

**Where things stand (2026-10-17):** rc.2 built on `release/v0.0.1-rc.2` (R177–R183); rc.3 batch 1
built on `release/v0.0.1-rc.3` (R184–R187); design corpus synced; walks pending —
[walk pack](walk-rc2-rc3a.md) sessions A and B. 3.4 built (R188); next kickoff: item **3.5** on
`release/v0.0.1-rc.3` (3.6 waits for walk session B to confirm G-wf). In a cloud session the branches arrive by
bundle (`99_git_bundles/`) and leave the same way; the owner pushes with `sync.ps1`.

## Kickoff prompt (one per item)

```text
Load order per CLAUDE.md. Then read
.agents/plan/programs/release-rc2-rc5/release-rc2-rc5.plan.md and the spec for item <ID>
in .agents/plan/programs/release-rc2-rc5/rc<N>.md.

Open the next free Round_NN.md for item <ID> on branch release/v0.0.1-rc.<N>, seeded from the
spec (goal, expected outcome, risks, steps per gate). Run flow-selector and record the flow.
Stop after the Plan section and show it to me before any code.
```

## Per-gate prompt

```text
Proceed with the <Design | Contract | Backend | Integration> gate for Round_NN.
Contract-first; additive only. Run the gate commands from rc<N>.md, commit with a conventional
message "<type>(R<NN>): …" when green, then stop and summarise: what changed, test counts,
anything that deviated from the spec.
```

## Close prompt

```text
Write the walk script for Round_NN into § Check (numbered steps, expected result each).
After I report the walk, record it, write ⟢ At a glance, Feeds into, and the prune check.
Do not flip Complete.
```

## Guard rails for every session

- One item per round; anything else found goes to the program's rolling log, not into the round.
- No dependency added without naming it in the Contract gate summary (2.2 adds a markdown renderer —
  pin an exact version).
- No user data, column names, thresholds or numbers from any external dogfood in this repo; dogfood
  results are reported as "identical / N cells differ" only.
- A red gate stops the round; fix or report, never skip a gate silently.
