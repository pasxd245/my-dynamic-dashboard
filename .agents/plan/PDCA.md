# PDCA Methodology — Skill Generation Lifecycle

> Plan-Do-Check-Act framework for iteratively building, deploying, and
> refining AI agent skills across this project.

---

## Purpose

PDCA (Plan-Do-Check-Act) provides a structured, repeatable cycle for
evolving this project. Each initiative (feature, refactor, investigation)
is tracked as a **round** so that decisions, outcomes, and learnings
are captured and reviewable.

> **All rules in this file are project policy, not constitutional law.**
> They can be revised through the same PDCA process they describe — see
> [Governance](#governance) for the current revisability stance.

---

## Cycle Template

Each round follows four phases:

### Plan

- Define the **goal** (what and why)
- List concrete **steps** to achieve the goal
- Identify **risks** and unknowns
- Status: `Planning`

### Do

- Execute the steps
- Log progress, blockers, and deviations from the plan
- Status: `In Progress`

### Check

- Verify outcomes against the goal
- Run tests, review output, gather feedback
- **Visual verification gate (UI-bearing rounds): before flipping to
  `Review`, run the app and exercise the changed flow in a browser.**
  Five browser-only bugs surfaced in R26 that no test/type/build
  pipeline caught (CORS preflight, AntD `<App>` provider, modal
  pre-fill race, lowercase-range validation, CSV reparse parity).
  Softer than R23-Q1's "Preview required" so autoagent stays
  unblocked — but skipping it on a UI round is a known-defect risk.
  Log the verification (or its explicit skip + reason) in Do.
- **Affordance check (UI-bearing rounds): run
  [`ui-design`](../skills/ui-design/SKILL.md)** against the six
  essential components of a design (Findability, Usability,
  Accessibility, Credibility, Utility, Desirability), structurally.
  **Primary use is at the Design gate** (design-spec mode, on the
  design doc) — under DCFBI the F phase only _confirms_, so the
  design is where UX is decided; catch affordance gaps in the spec
  before they're faithfully built. **Backstop use is at F1/F2**
  (fidelity mode, build vs design) — catches drift like R51's
  unlabeled advanced-query field, where the spec was complete but
  the build dropped the label + `[Clear]`. Log the per-facet report
  (or its explicit skip + reason) in Do.
- Document what worked and what didn't
- Status: `Review`

### Act

- Promote validated learnings to `.agents/context/` or `.agents/skills/`
- Log promotions in `promotions.md`
- Capture **`Feeds into → Round_NN+1`** — what this round hands
  forward (artifacts, conventions, unblocked work). The next round's
  Goal cites the same handoff via `Inherits from ← Round_NN`. Pair
  the two to make the PDCA cycle explicit.
- Run the [post-round audit](#post-round-audit) before flipping
  status to `Complete`
- Archive the round
- Status: `Review` (work done, awaiting human approval) →
  `Complete` (human-approved; only humans flip this)

---

## Status lifecycle

A round's `Status` field moves through these values exactly once,
in order:

```text
Planning → In Progress → Review → Complete
```

- `Planning` — Plan section is being drafted; no code/doc changes
  yet.
- `In Progress` — Do phase is active; agent is executing steps.
- `Review` — Do + Check finished; agent has filled Act draft;
  awaiting human sign-off + commit. Agents may flip from
  `In Progress` to `Review`.
- `Complete` — human-approved; commit landed. **Only humans flip
  to `Complete`** (per [governance.md](../context/governance.md)).

---

## Post-round audit

Before flipping a round from `Review` to `Complete`, verify:

- [ ] All Plan checkboxes flipped `[ ] → [x]` (or strike-through
      with note if the step was decided against mid-round).
- [ ] All Check items flipped `[x]` and the round's verification
      evidence (logs, screenshots, test counts) is summarized in Do.
- [ ] **Promotion items** reformatted: if a promotion _happened_,
      mark `[x]`; if it was _decided not to promote this round_,
      remove the checkbox entirely and write the decision as plain
      text — leaving `[ ]` reads as an unfinished TODO.
- [ ] `Status` field updated to `Complete` and `Date completed`
      filled.
- [ ] **Cross-links present**: Goal cites `Inherits from ← Round_NN`
      (if any); Act ends with `Feeds into → Round_NN+1` (or "(TBD)"
      if not yet drafted).
- [ ] Any new project knowledge captured in
      [.agents/memory/](../memory/) per
      [memory-placement.md](../context/memory-placement.md).
- [ ] **Context-rot check**: if the round added or extended any
      [`.agents/context/`](../context/) file, re-read the file once
      and cut what doesn't earn its place. `context/` is loaded every
      session — bullet bloat, repeated framing, and over-procedural
      lists belong in `memory/` or a skill, not here. Aim for the
      leanest expression that still teaches the rule.
- [ ] `npx markdownlint-cli2` repo-wide returns 0 errors.
- [ ] **Optional**: `python3 .agents/skills/markdown-check-link/scripts/check_links.py --changed`
      to verify the round didn't introduce link rot. The
      `--changed` flag scopes to git-changed `.md` files only
      (unstaged + staged + untracked) — the right scope for
      post-round verification. Skip if the round didn't touch
      any `.md`. See
      [`.agents/skills/markdown-check-link/SKILL.md`](../skills/markdown-check-link/SKILL.md)
      for the procedure (default-mode report at
      `.agents/tmp/markdown-check-link/broken.md`,
      ambiguous candidates in `conflicts.json`; opt-in `--fix`
      is round-author gated). A full-corpus sweep
      (without `--changed`) is a separate cleanup activity, not
      part of routine audit.

---

## Naming Convention

Rounds live in `.agents/plan/cycles/` and follow this pattern:

```text
cycles/
  Round_01.md   — First initiative
  Round_02.md   — Second initiative
  Round_XX.md   — Subsequent rounds
```

Use zero-padded two-digit numbering. Each file uses the round template
below.

---

## Brainstorm lifecycle (optional)

When a decision needs more exploration than fits inline in the
decision file's `## Why`, the pre-decision analysis lives in a
brainstorm chain:

```text
plan/brainstorms/<YYYY-MM-DD>-<slug>/
  README.md                    — chain order + one-line role per doc
  <docs that produced the decision>
```

Flow: **brainstorm chain → decision artifact → applying round**. The
brainstorm captures exploration; the decision (in `.agents/decisions/`)
is the committed paraphrase; the round (in `cycles/`) is the work that
writes the decision and any artifact edits.

The convention is **optional** — most rounds skip brainstorms and put
their full rationale inline in `## Why`. Use a chain only when the
analysis is multi-doc, multi-step, or genuinely worth preserving as
historical record. Brainstorm docs are not edited after the decision
lands.

Worked example:
[`plan/brainstorms/2026-05-28-hybrid-flow/`](brainstorms/2026-05-28-hybrid-flow/)
→ [`Round_47.md`](cycles/Round_47.md) →
`.agents/decisions/2026-05-28-hybrid-flow-governance.md` (R47 output).

---

## Round Template

```markdown
# Round XX: [Title]

**Status**: Planning | In Progress | Review | Complete
**Date started**: YYYY-MM-DD
**Date completed**: YYYY-MM-DD

## Goal

**Inherits from ← [Round_NN](Round_NN.md)** — [what this round
takes as input from the previous round: artifacts, conventions,
deferred decisions. Omit if this is Round_01 or the round has no
predecessor.]

[1-2 sentences: what we're building/fixing and why]

_Track: 1 | 2 | 3. Pulled by: [round id | memory file | named
product gap] — per [Evolution Rule](../../AGENTS.md)._

## Plan

- [ ] Step 1
- [ ] Step 2
- [ ] ...

## Risks / unknowns

- [Risk or open question]

## Do

[Progress log — update as work proceeds]

## Check

- [ ] Verification item 1
- [ ] Verification item 2

## Act

**Learnings**:

- [What worked, what surprised, what's now true that wasn't]

**Promotions** _(if none: write as plain text, not checkboxes)_:

- [ ] → `context/` : [topic — if promoting]
- [ ] → `skills/` : [topic — if promoting]

**Follow-ups (not promotions, just notes):**

- [Anything queued for a future round]

## Feeds into → Round_NN+1 (TBD)

[What this round hands forward: artifacts to consume, conventions
to inherit, unblocked work. The next round's Goal will cite this
via "Inherits from ←".]
```

---

## Governance

- **`Complete` rounds are append-only.** Once a round flips to
  `Complete`, its history is locked — do not delete, rewrite, or
  re-frame what happened. Append new content at the end of the file as follows:

  ```markdown
  <current content>

  ## Appending to Complete rounds

  <new content>
  ```

- **Active rounds are editable.** Rounds in `Planning`,
  `In Progress`, or `Review` may have any section updated as work
  proceeds — that is what those phases are for. This includes
  amending Plan or Risks mid-round when scope shifts, refining Do
  logs as steps complete, and revising Act drafts before human
  review.
- **Promotions** from Act are logged in
  [promotions.md](promotions.md). Promotion criteria are defined
  in [AGENTS.md](../AGENTS.md).
- **Status flips by actor**:
  - Agents may flip `Planning → In Progress → Review` on their
    own as work moves through the phases.
  - Flipping to `Complete` requires human approval **under the
    current policy**.
- **Revisability of these rules.** Everything above is current
  project policy, not a fixed constitution. Future rounds can
  amend any of it via the same PDCA process — including the
  human-only `Complete`-flip rule, which an autopilot/autoagent
  round may later relax (e.g., conditional auto-flip when Check
  is all green and no `.agents/context/` or `.agents/plan/`
  modifications were made). Such a change is in scope for a
  future round when the pull is real; for now the human gate
  remains the primary safety against bad rounds shipping.
