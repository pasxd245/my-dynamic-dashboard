---
name: bug-fix
description: >
  Classify incoming feedback (bug report, UX complaint, architecture
  concern, requirement change) and propose a minimal patch plan before
  touching code. Pairs with the PDCA Trajectory frame: clarifies which
  prior decisions still hold, which assumptions are now invalid, what
  the smallest fix is, and what must explicitly stay untouched.
metadata:
  author: human
  version: '1.0'
---

## Trigger

Activate when any of the following holds:

- The user reports a defect ("broken", "doesn't work", "still wrong",
  "regression").
- The user asks for a "fix", "patch", "tweak", or course correction.
- The user pastes an error message, screenshot of a broken UI, or a
  failing test.
- The user gives feedback that could span "local bug" vs "global
  redesign" and the boundary is not yet established.

Do NOT activate for greenfield work, new features, or rounds whose Plan
is already locked — those go through `pdca-next`.

If unclear whether this is a bug-fix or a new-feature request, default
to running this skill — the classification step is the entire point.

---

## Operating Principle

> Before changing code, classify the feedback. Then propose a patch
> plan. Only then edit.

A bug fix that quietly absorbs a UX redesign or an architecture
correction is the most common source of scope creep and broken rounds
(see `.agents/plan/PDCA.md` § Trajectory and § Check-trajectory). This
skill makes the classification explicit and recorded _before_ code
moves.

---

## Procedure

### Step 1 — Restate the feedback

Quote the user's exact words for the symptom. Do not paraphrase yet.
Pull in any error message, stack trace, screenshot description, or
test output verbatim.

If the user's report is ambiguous ("it's broken", "doesn't look
right"), ask **one** clarifying question with the smallest set of
options that disambiguates. Otherwise proceed.

### Step 2 — Classify the change

Pick exactly one primary class. Multi-class feedback is the signal
that this should be split into multiple fixes — surface that.

| Class                       | Meaning                                                                 | Default scope                                                  |
| --------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Local bug fix**           | Wrong behaviour in a single function / component vs. its existing spec. | One file, often one function. No public API changes.           |
| **UX adjustment**           | Visual or interaction tweak inside the existing design language.        | One or two components. Tokens / styles only.                   |
| **Architecture correction** | Existing structural decision is wrong; needs a refactor.                | Multiple files, possibly a new module. **Gate** — not a "fix". |
| **Requirement change**      | The spec itself is now different.                                       | New round / spec amendment. **Gate** — not a "fix".            |

Architecture corrections and requirement changes are **gates**, not
patches. Stop and surface them to the user before editing — the
appropriate response is a new PDCA round, not a quiet patch.

### Step 3 — Inventory prior decisions

Two short lists. Each item is a single line.

**Decisions that remain valid** — explicit things that should NOT be
revisited as part of this fix. Examples: "token system in
`antdTheme.ts`", "TanStack Table on `/saved-queries`", "PageCard
wrapper for every route".

**Assumptions now invalidated** — what the feedback proves was wrong.
Examples: "Round 33 assumed `hover:bg-slate-50` would work on every
stage button — it collapses contrast on the active one."

If the "invalidated" list is empty, the feedback is probably a UX
adjustment or a misreading — re-check Step 2.

### Step 4 — Define the minimal change

Write the **smallest** change that resolves the feedback without
disturbing anything else:

- Exact file(s) to edit, with line ranges when known.
- One-sentence description of the edit per file.
- One-sentence description of the expected post-fix behaviour.
- What you will NOT change, even though it's tempting (see Step 5).

Bias toward the smallest reversible edit. A 3-line fix that closes
the ticket beats a 30-line refactor that closes it "properly" — the
refactor is a separate round.

### Step 5 — Declare the "do-not-touch" boundary

Explicitly list what must not change in this patch, even if you
notice it could be improved:

- Other files / components.
- Tests that already pass.
- Public APIs / contracts.
- Tokens / styles that the feedback did not call out.

This mirrors PDCA § Trajectory · Allowed Change Boundary. If the
minimal change requires touching something on this list, stop and
surface a gate — that's an architecture correction, not a bug fix.

### Step 6 — Surface the patch plan, then edit

Output the patch plan in this exact shape **before** running Edit /
Write:

```text
Patch plan
- Class: <one of the four classes>
- Symptom: <one-line restatement>
- Decisions kept: <bulleted, short>
- Assumptions invalidated: <bulleted, short>
- Files to change:
    - path/to/file.ts — <one-line description>
- Files to leave alone: <bulleted, short>
- Post-fix verification: <test or manual check>
```

If auto mode is on AND the class is **Local bug fix** or **UX
adjustment** AND the patch plan touches ≤ 3 files AND no item on
"Files to leave alone" is implicated, proceed directly to editing
after surfacing the plan.

Otherwise (architecture correction, requirement change, ≥ 4 files, or
boundary conflict) stop and ask the user to confirm or reclassify.

### Step 7 — Verify against the plan

After editing:

- Run the verification step you declared.
- `git diff --stat` and confirm no files outside "Files to change"
  were modified.
- If you discovered a change you had to make outside the declared
  scope, surface it as a gate — do not silently expand the boundary.

---

## Anti-patterns

- **"While I'm here…" refactors.** A bug fix is not a refactor.
  Document the smell, leave it.
- **Skipping the classification.** "It's obviously a small fix" is
  exactly when a UX adjustment turns into an architecture rewrite.
- **Rewriting the goal to match the patch.** If the patch needs the
  goal restated, it isn't a patch — it's a new round.
- **Silent dependency upgrades.** Bumping a library version inside a
  bug-fix patch is an architecture correction.
- **Implicit assumption changes.** If the fix only works because some
  unstated invariant is now different, write the invariant down before
  editing.

---

## Pairing with PDCA

- Step 2 (Classify) maps to PDCA § Trajectory · Feedback Scope.
- Step 3 + Step 5 map to PDCA § Trajectory · Immutable Intent and
  Allowed Change Boundary.
- Step 7 maps to PDCA § Check-trajectory — verify the fix did not
  silently drift.

When a bug surfaces inside an active PDCA round, this skill runs
_inside_ that round's Do phase. The patch plan is logged under `## Do`
of the active round. Architecture corrections and requirement changes
surfaced here become candidate next rounds, never silent absorptions.
