---
name: master-plan
description: Decompose a non-trivial repo change into numbered, reviewable phases with acceptance gates. Use before multi-step features, refactors, migrations, or Spec Kit implementation work. Skip for one-shot fixes and narrow docs edits.
metadata:
  author: a2scaffold
  version: '1.0'
---

## Trigger

Activate this skill when the request matches **all** of:

- The change touches multiple files or concerns (not a single-spot fix).
- The change can be staged so each phase leaves the repo in a usable state.
- The user has not already given you an explicit phase breakdown.

Skip for typo fixes, single-function tweaks, or docs-only edits — the
planning overhead exceeds the work.

For feature work covered by Spec Kit, use the existing spec/plan/tasks as
the source of truth and turn them into executable phases instead of creating
a competing plan.

## Procedure

### 1. Restate the goal in one sentence

Write the end state in the form:
`<verb> <subject> so that <outcome>`.

If you can't compress it to one sentence, the scope is too broad — ask
the user to split the request before planning.

### 2. List invariants

Enumerate what must stay true across every phase:

- Existing user workflows remain intact unless the phase explicitly changes
  them.
- Public API contracts, query semantics, and saved metadata remain compatible
  unless compatibility is the stated goal.
- Spec Kit artifacts stay aligned for feature work: spec, plan, tasks, and
  implementation should not contradict each other.
- The relevant package gate passes after each phase.
- Any invariants the user called out explicitly.

These become the acceptance gates for each phase.

### 3. Draft phases

One phase should be reviewable in isolation. If the user is committing each
phase, one phase usually maps to one commit. Each phase must:

- Have a verb-led title (e.g. "Phase 2 — add upload profile persistence").
- Be reviewable in isolation — no phase depends on a later phase to
  pass its gate.
- Name the files touched (paths, not vague areas).
- State the acceptance gate.

Target 3–8 phases. More than 8 means the steps are too small; fewer
than 3 means the work doesn't need this skill.

Use package-aware gates:

| Area          | Typical gate                                                        |
| ------------- | ------------------------------------------------------------------- |
| Backend       | `pytest` or focused backend tests + API smoke for changed endpoints |
| Builder       | typecheck/test command from `package.json` + affected UI smoke      |
| Dashboard     | Streamlit import/smoke + export/chart behavior check                |
| Data layer    | migration/schema compatibility check + representative query         |
| Docs/specs    | markdown/spec checklist + link/path sanity check                    |
| Cross-package | smallest combination that proves the touched contracts still work   |

### 4. Write the plan to `.agents/plan/cycles/Round_XX.md`

Use the next unused round number. Template:

```markdown
# Round XX — <one-sentence goal>

## Invariants

- <invariant 1>
- <invariant 2>

## Phases

### Phase 1 — <verb-led title>

- **Files:** `path/a.js`, `path/b.js`
- **Change:** <what happens>
- **Gate:** <package-aware test/check> + <any extra smoke check>

### Phase 2 — ...
```

### 5. Confirm with the user before executing

Post the phase list back. Wait for explicit approval (or amendments)
before starting Phase 1 when the plan will create or modify governance docs,
large architecture docs, or multiple commits. For normal implementation work,
the user may already have approved execution; in that case, state the phase
plan briefly and continue.

### 6. Execute one phase at a time

For each phase:

1. Make the edits.
2. Run the phase gate.
3. If the user asked for commits, commit with a conventional message matching
   [git commit conventions](../../../commitlint.config.mjs).
4. Record any verification notes in the round file when using
   `.agents/plan/cycles/`.
5. Report completion and move to the next phase.

If a gate fails, **stop** and report. Do not skip phases or amend
a green commit to squeeze in later work.

### 7. Close the round

After the final phase lands, update the round file with the actual outcome.
Append to [.agents/plan/promotions.md](../../plan/promotions.md) only when a
memory, context, skill, or other governed artifact was promoted. The plan file
itself stays as the record of what was planned vs. what shipped.

## Example

Example phase titles for this repo:

- Phase 1 — add backend upload-profile schema and persistence
- Phase 2 — expose upload-profile APIs to the builder
- Phase 3 — connect builder field-role UI to saved profiles
- Phase 4 — verify reconciliation and update Spec Kit traceability
