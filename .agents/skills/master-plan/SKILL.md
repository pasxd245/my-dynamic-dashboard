---
name: master-plan
description: Produce a full-feature master plan for a non-trivial repo change as `docs/agents/plan/<name>.plan.md`, always paired with a `docs/agents/workflows/<name>.workflow.md` (via the `repo-explainer` skill) and at least one derived PDCA round at `.agents/plan/cycles/Round_NN.md`. Use before multi-step features, refactors, migrations, or Spec Kit implementation work. Skip for one-shot fixes and narrow docs edits.
metadata:
  author: a2scaffold
  version: '2.0'
---

## Trigger

Activate this skill when the request matches **all** of:

- The change touches multiple files or concerns (not a single-spot fix).
- The work can be staged so each round leaves the repo in a usable state.
- The user has not already given you an explicit plan / phase breakdown.

Skip for typo fixes, single-function tweaks, or docs-only edits — the
planning overhead exceeds the work.

For feature work covered by Spec Kit, use the existing spec/plan/tasks as
the source of truth and turn them into executable PDCA rounds instead of
creating a competing plan.

## Output contract

Every `master-plan` invocation emits **three artifacts** with a shared
`<name>` slug (kebab-case, derived from the feature: `packages-ui`,
`backend-ruff-cleanup`, `upload-profiles`, …):

| Artifact                                   | Owner                  | Purpose                                                                                       |
| ------------------------------------------ | ---------------------- | --------------------------------------------------------------------------------------------- |
| `docs/agents/plan/<name>.plan.md`          | this skill             | **Full-feature master plan** — end-state surface, invariants spanning rounds, round chain map |
| `docs/agents/workflows/<name>.workflow.md` | `repo-explainer` skill | Mermaid diagrams + narrative of how the feature flows through the codebase                    |
| `.agents/plan/cycles/Round_NN.md` (≥ 1)    | this skill             | First executable PDCA round derived from the plan, per [PDCA.md](../../plan/PDCA.md)          |

All three are produced in one invocation. The plan must be convertible
to at least one PDCA round; if it isn't, the scope is too vague.

## Naming

- Use one shared `<name>` slug for all three artifacts (`packages-ui` →
  `packages-ui.plan.md`, `packages-ui.workflow.md`, and one or more
  `Round_NN.md`).
- Round numbers come from `.agents/plan/cycles/` — pick the next
  unused.

## Procedure

### 1. Restate the goal in one sentence

Write the end state in the form: `<verb> <subject> so that <outcome>`.

If you can't compress it to one sentence, the scope is too broad — ask
the user to split the request before planning.

### 2. List invariants

Enumerate what must stay true across **every** round of this plan:

- Existing user workflows remain intact unless a round explicitly
  changes them.
- Public API contracts, query semantics, and saved metadata remain
  compatible unless compatibility is the stated goal.
- Spec Kit artifacts stay aligned for feature work.
- The relevant package gate passes after each round.
- Any invariants the user called out explicitly.

These become the acceptance gates for every round derived from this
plan.

### 3. Derive the full-feature surface

Enumerate the **end state** — not what round 1 ships, but what the
finished feature looks like:

- File tree of new/changed paths (group by package).
- Public API / subpath exports / route table / schema / etc.
- Per-subsystem touch summary.
- Out-of-scope list (what is _not_ in the end state, so future rounds
  don't drift).

This is the part that distinguishes "master plan" from "round plan".
A master plan shows the destination; a round plan shows one leg of
the trip.

### 4. Map the round chain

Lay out the round chain as a table:

| Round | Goal | Touches | Status |
| ----- | ---- | ------- | ------ |

Respect [[round-cadence]]: **one feature per round**. Signals that the
chain must split into multiple rounds:

- End state involves migrating an existing consumer ("ship the
  package" + "migrate `apps/builder` onto it" → two rounds).
- End state mixes "create new" with "delete old".
- The full-feature surface has more than ~4 top-level units.

A single-round plan is valid — write it as a one-row chain.

### 5. Write `docs/agents/plan/<name>.plan.md`

Template:

```markdown
# Master Plan — <Title>

**Owner**: <user> · **Drafted**: YYYY-MM-DD · **Status**: <Awaiting approval | Approved — RNN cleared to start>

## End state

<2–4 paragraphs describing the destination, key stack alignment table if relevant>

## Full-feature surface (locked target)

<file tree, subpath exports, per-round delivery table>

## Invariants (apply to every round)

- <invariant 1>
- <invariant 2>

## Round chain

<the table from step 4>

## Decisions / sign-offs

<questions blocking R01 start; flip to "signed off DATE" once approved>

## Out of scope

<bullet list — what must NOT creep in>

## Companions

- Workflow: [docs/agents/workflows/<name>.workflow.md](../workflows/<name>.workflow.md)
- First round: [.agents/plan/cycles/Round_NN.md](../../../.agents/plan/cycles/Round_NN.md)
```

### 6. Always trigger `repo-explainer` for the workflow doc

Invoke the `repo-explainer` skill with the instruction to produce
`docs/agents/workflows/<name>.workflow.md`. The workflow doc must:

- Diagram how the feature flows through the codebase (component or
  sequence diagram, per `repo-explainer` § 3).
- Reference real file paths from the current code, not invented
  abstractions.
- Stay in sync with the master plan's end-state surface.

`repo-explainer` already writes to `docs/agents/workflows/` using the
`<name>.workflow.md` convention — do not override the location.

### 7. Derive and write the first PDCA round

Per [.agents/plan/PDCA.md](../../plan/PDCA.md), write
`.agents/plan/cycles/Round_NN.md` for the **first** entry of the
round chain. Use PDCA.md's round template (`Goal` / `Trajectory` /
`Plan` / `Do` / `Check` / `Act`). Each step in `Plan` corresponds to
a phase in this round; phases must:

- Have a verb-led title.
- Be reviewable in isolation — no phase depends on a later phase to
  pass its gate.
- Name the files touched (paths, not vague areas).
- State the acceptance gate.

Target 3–6 phases per round. More than 6 means the round is too big
and should split into the next round in the chain.

Use package-aware gates:

| Area          | Typical gate                                                        |
| ------------- | ------------------------------------------------------------------- |
| Backend       | `pytest` or focused backend tests + API smoke for changed endpoints |
| Builder       | typecheck/test command from `package.json` + affected UI smoke      |
| Dashboard     | Streamlit import/smoke + export/chart behavior check                |
| Data layer    | migration/schema compatibility check + representative query         |
| Docs/specs    | markdown/spec checklist + link/path sanity check                    |
| Cross-package | smallest combination that proves the touched contracts still work   |

### 8. Confirm with the user before executing

Post the round chain + first-round phase list back. Wait for explicit
approval (or amendments) before starting Phase 1 of Round NN.

### 9. Execute one phase at a time (when approved)

For each phase:

1. Make the edits.
2. Run the phase gate.
3. If the user asked for commits, commit with a conventional message
   matching [commitlint.config.mjs](../../../commitlint.config.mjs).
4. Record verification notes in the round file.
5. Report completion and move to the next phase.

If a gate fails, **stop** and report. Do not skip phases or amend a
green commit to squeeze in later work.

### 10. Close the round, advance the chain

After the final phase of Round NN lands:

1. Update the round file's `Status`, `Check`, and `Act` sections.
2. Append to [.agents/plan/promotions.md](../../plan/promotions.md)
   only when a memory, context, skill, or other governed artifact was
   promoted.
3. If the chain has further rounds, derive the next
   `.agents/plan/cycles/Round_NN+1.md` from the master plan and
   confirm with the user before starting.
4. When the final round closes, mark the master plan `Status:
Shipped`.

## Anti-patterns

- ❌ Producing only a `Round_NN.md` when scope spans multiple rounds.
  The companion `<name>.plan.md` + `<name>.workflow.md` are
  mandatory.
- ❌ Letting the plan drift from the workflow doc. After a round
  changes the end state, regenerate the workflow.
- ❌ More than 6 phases per round, or more than ~6 rounds per master
  plan. Either is a sign the scope was wrong; split or close.
- ❌ Producing a master plan that cannot be decomposed into at least
  one concrete PDCA round.

## Example shape

For `packages-ui`:

- `docs/agents/plan/packages-ui.plan.md` — end state of `@mdd/ui`,
  full file tree, per-round delivery table, decisions.
- `docs/agents/workflows/packages-ui.workflow.md` — diagram of
  `MddUIProvider → NavigationContext → MasterLayout → routed app`.
- `.agents/plan/cycles/Round_01.md` — ship `@mdd/ui` package,
  4 phases.
- (Future) `.agents/plan/cycles/Round_02.md` — migrate `apps/builder`
  onto `@mdd/ui`.
