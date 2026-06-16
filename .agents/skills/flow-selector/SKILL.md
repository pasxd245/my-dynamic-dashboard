---
name: flow-selector
description: Choose the DCFBI or DFCFBI phase chain for a feature round by running R47's 2-of-5 selector against the round's Design exit state. Records the selection (with which conditions fired) in the round file's Do log.
when_to_use: User or a primary skill needs to pick the round's phase chain at Design exit. Trigger phrases include "pick the flow", "DCFBI or DFCFBI", "run the flow selector", "is this DCFBI", or when a feature round reaches Design exit without a recorded Flow line.
argument-hint: <round-file-path>
allowed-tools: Read, Grep, Bash(grep *)
metadata:
  author: hand-authored-r49
  version: '1.1'
---

## Trigger

Run this skill **immediately after a feature round's Design exit
gate closes**, before declaring the phase chain. The round file
must already have a documented Design exit (journeys + testable
acceptance criteria in the design markdown the round implements
against).

Do not run this skill when:

- The round is not a feature round (process / docs / tooling
  rounds skip the selector). _Note: a feature round that changes the
  contract / backend but adds **no new UI surface** (a refactor, a
  field rename) still runs — see step 1's no-UI branch; it lands
  DCFBI._
- The Design gate has not yet closed (gate-walker for Design
  comes first).
- The round file already has a `Flow:` line recorded — that
  decision is locked once written.

## Procedure

### 1. Locate the round file and its design source

Read the round file at `$ARGUMENTS` (path to `Round_NN.md`).
Identify which design artifact the round implements against
— the round's Goal section names it (e.g.
`.agents/design/data-management/dataset-filters.md`).

If the design source is unclear or the round has no design
section, **stop** and report: Cannot run flow-selector — Design
gate not closed.

**No-UI / refactor branch.** If the round is a feature round that
changes the contract / backend / data layer but introduces **no new UI
surface** (e.g. a wire-field rename, a persistence refactor), the
"design source" is the round file's **resolved judgment calls +
acceptance criteria**, not a UI design doc. Do **not** stop — evaluate
the five conditions against it; being UX-framed, they read vacuously
**no**, so the round lands **DCFBI**. Record the run anyway (the audit
trail is the point) and note "no-UI round → DCFBI by construction."

### 2. Evaluate each condition

Run R47's [Flow selector (2-of-5)](../../decisions/2026-05-28-hybrid-flow-governance.md)
against the design source. For **each** of the five conditions,
record `yes` / `no` plus a one-sentence justification grounded in
the design content (not in author intuition):

1. **More than 3 independent interactive states or branches?**
   Count branches in the design's state model (not button
   variants, not visual states). Cite the state-model section.
2. **New interaction pattern not previously used in product?**
   Compare against existing
   [`.agents/design/`](../../design/) artifacts. New screen with
   same pattern = no. Genuinely new pattern (e.g., first
   drag-and-drop, first multi-step wizard) = yes. If the pattern
   is ambiguous, invoke the [`research`](../research/SKILL.md)
   skill to check prior art before tallying.
3. **High user-error risk if flow is unclear?** Destructive
   actions, irreversible commits, multi-step wizards where
   misstep cost is high → yes. Read-mostly views, low-stakes
   inputs → no.
4. **Contract shape depends on unresolved UI behavior
   decisions?** If you cannot write the YAML schema without first
   answering "how does the user do X" → yes. If the request /
   response shape is obvious from the journey → no.
5. **Team confidence in UX is below agreed threshold?**
   Subjective — but if the round author or design reviewer would
   say "I'm not sure this is the right UX," count it. If the
   design has been through prior-art review with no open
   questions → no.

### 3. Tally and emit the result

Count the yeses:

- **0 or 1 condition fires** → `Flow: DCFBI` (default).
- **2 or more conditions fire** → `Flow: DFCFBI (triggers N, M[, …])`
  where `N, M` are the 1-indexed condition numbers that fired.

### 4. Write the result to the round's Do log

Append the following block to the round file's `## Do` section,
under a new sub-heading `**Flow selector run**`:

```markdown
**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification  |
| ------------------------------------ | ------ | -------------- |
| 1. >3 independent states/branches    | yes/no | <one sentence> |
| 2. New interaction pattern           | yes/no | <one sentence> |
| 3. High user-error risk              | yes/no | <one sentence> |
| 4. Contract depends on unresolved UI | yes/no | <one sentence> |
| 5. UX confidence below threshold     | yes/no | <one sentence> |

Result: **Flow: DCFBI** (or **Flow: DFCFBI (triggers N, M)**)
```

The `Flow:` line is what [`gate-walker`](../gate-walker/SKILL.md)
reads to decide whether F1/F2 gates apply.

## Quality Bar

- **Do not** decide ad-hoc without recording all 5 condition
  outcomes — the audit trail is the point.
- **Do not** skip the per-condition justification. "No" without
  evidence reads the same as "yes without evidence" to a future
  auditor; both are worthless.
- **Do not** run if the Design gate has not closed — the
  selector measures Design output, which doesn't exist yet.
- **Do not** rewrite a previously-recorded `Flow:` line.
  Re-decision is a scope amendment; treat it like any other
  amendment to a Review-status round.
- **Do not** invoke `research` for conditions 1, 3, 4, or 5 —
  they read off the design markdown directly. Condition 2 is
  the only one where prior-art research is appropriate.
