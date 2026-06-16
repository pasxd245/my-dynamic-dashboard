---
name: gate-walker
description: Verify a named Hard Gate (Design, F1, Contract, F2, Backend, or Integration) has its exit criterion documented as met in the round file, that the gate's commit seam exists (gate = commit boundary), and — at the Design gate — that the noun-vs-mode / discovered-vs-imposed model check is recorded. Block phase advance with a remediation pointer if the gate is open. DCFBI/DFCFBI branching reads the round's Flow line; F1/F2 gates are skipped on the DCFBI path.
when_to_use: User or a primary skill needs to verify a phase gate before flipping the round's active phase. Trigger phrases include "is Design closed", "check the Contract gate", "can we advance to Backend", "run gate-walker for X", or any pre-advance audit.
argument-hint: <gate-name> <round-file-path>
arguments: gate round
allowed-tools: Read, Grep, Bash(grep *), Bash(git rev-parse *), Bash(git cat-file *), Bash(git log *)
metadata:
  author: hand-authored-r49
  version: '1.3'
---

## Trigger

Run this skill **before flipping a feature round's active phase**.
The Hard Gates are checkpoints, not theater — every phase exits
through its named gate, and the round cannot advance until the
gate's exit criterion is documented as met in the round file
(per [R47 § Hard gates](../../decisions/2026-05-28-hybrid-flow-governance.md)).

Since the **2026-06-13 amendment**
([§ Amendment](../../decisions/2026-05-28-hybrid-flow-governance.md#amendment-2026-06-13-r69-post-mortem)),
a gate also carries **two enforced invariants** this skill checks:

- **Gate = commit boundary.** Each closed gate has a commit it can
  point to. A round that reaches a late gate with nothing committed
  has no revert seam — the R69 failure. This skill verifies the
  commit exists and resolves (it cannot, and does not, judge that the
  commit's *content* is correct).
- **Design model check (Design gate only).** The round file must
  record the **noun-vs-mode** and **discovered-vs-imposed** answers.
  This is a forcing-function for the modeling judgment, not a
  correctness check: it ensures the question was *asked and written*,
  not that the answer is *right* (a confidently-wrong model still
  passes — that catch stays human, see
  [specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)).

Do not run this skill when:

- The round is not a feature round (process / docs / tooling
  rounds don't use the gates).
- The `gate` argument is not one of the six recognized names
  (Design, F1, Contract, F2, Backend, Integration).
- The round has no recorded `Flow:` line yet and the gate is
  F1 or F2 — run [`flow-selector`](../flow-selector/SKILL.md)
  first so the branching is deterministic.

## Procedure

### 1. Validate arguments

`$0` is the gate name; `$1` is the round file path.

Recognized gate names (case-insensitive):
`Design`, `F1`, `Contract`, `F2`, `Backend`, `Integration`.

If `$0` is not in this set → **stop** and report:
`Unknown gate "$0" — expected one of Design, F1, Contract, F2, Backend, Integration.`

### 2. Read the round file and recorded Flow

Read `$1`. Locate the `Flow:` line in the round's `## Do`
section. If absent → **stop** and report:
`No Flow line recorded in $1 — run flow-selector first.`

Two branches:

- `Flow: DCFBI` → recognized gates are `Design`, `Contract`,
  `Backend`, `Integration`. **F1 and F2 are skipped on this
  path** — if `$0` is F1 or F2 under DCFBI, return:
  `Gate $0 is skipped on the DCFBI path; advance directly to the next non-skipped gate.`
- `Flow: DFCFBI (...)` → all six gates apply.

### 3. Check the gate's exit criterion

Each gate's exit criterion is documented in
[R47's Hard Gates table](../../decisions/2026-05-28-hybrid-flow-governance.md):

| Gate                   | Exit criterion                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| **Design**             | User journeys + testable acceptance criteria documented in the design artifact (**no-UI / refactor round**: journeys N/A — accept the resolved design judgment calls + testable acceptance criteria in the round file) |
| **F1** _(DFCFBI only)_ | Interaction decisions frozen for this round; open UX questions resolved or explicitly deferred     |
| **Contract**           | Request / response / error shapes frozen; MSW handlers aligned; YAML committed                     |
| **F2** _(DFCFBI only)_ | Confirmation pass complete against contract-derived MSW; any shape change re-routed as contract v2 |
| **Backend**            | Contract conformance tests pass; per-endpoint behavior tests pass                                  |
| **Integration**        | FE-vs-BE verified end-to-end; shared conformance tests pass against both MSW and real backend      |

Look in the round file for evidence that the criterion is met.
Acceptable evidence forms:

- A `**<Gate> gate closed**` line in the `## Do` section with a
  one-sentence pointer to where the evidence lives (file path,
  commit hash, test name).
- A `## Check` checklist item ticked `[x]` whose text matches
  the gate's criterion.
- A passing CI run / test count documented in `## Do` for
  Contract / Backend / Integration gates.

The skill is a **structural** check — it verifies _evidence is
cited_, not that the evidence is _truthful_. Truthfulness is the
round author's responsibility.

### 4. Verify the commit seam (all gates)

Per the 2026-06-13 amendment, **each gate is a commit boundary** — the
point is that closing a gate leaves a **real revert point** (the R69
failure was work spanning phases, committed nowhere). What matters is
that the gate-closed state is **committed**, not that the round file
quotes its own SHA (a line can never cite the commit that contains it).

Verify the revert point *exists*:

```bash
# (a) the gate-closed edit is committed — not dangling in the working tree
git diff --quiet -- "$1" && git diff --cached --quiet -- "$1" \
  && echo "seam OK: round file committed" \
  || echo "seam MISSING: gate-close is uncommitted"
# (b) the round has per-gate commit history (the revert points)
git log --oneline -- "$1"
```

- **Round file clean + history present** → the seam exists: there is a
  commit to revert to for this gate.
- **Round file dirty or staged** → the gate-close is uncommitted, the
  R69 shape (documented, nothing to revert to). **Hard miss** — commit
  before advancing, then re-run.

This verifies a revert point *exists* — not that the commit's content
is correct (same structural-not-truthful discipline as step 3). Run
this **after** committing the gate; if you author the gate-close and
audit before committing, expect (a) to say MISSING — that is the check
doing its job.

### 5. Design gate — model check (required field)

**Applies only when `$0` is `Design`.** The round file must record
the modeling judgment, as two lines in the round's `## Do` (Design
phase) or the design artifact:

```text
**Model check** (Design gate):
- Noun-vs-mode: <new noun | mode of <existing surface>> — <one-line justification>
- Discovered-vs-imposed: <evidence found, independent of this design | imposed → de-risked via D-only round / spike>
```

Grep **tolerantly** for both labels — case-insensitive, and accepting
either a `:` or a `→` separator (rounds vary the phrasing; the answer,
not the punctuation, is the point):

```bash
grep -iE 'noun-vs-mode\s*[:→]' "$1" && grep -iE 'discovered-vs-imposed\s*[:→]' "$1"
```

The colon form in the template above is the **canonical** spelling, but
the tolerant grep avoids a false "gate open" on `noun-vs-mode → …`.

- **Both present and non-empty** → model check recorded.
- **Either missing or blank** → the Design gate is **open**. This is
  a forcing-function only: a recorded answer can still be *wrong*
  (R69 would have written "new noun" and passed). The skill confirms
  the question was answered, not that the answer is correct — flag
  this limit in the return so the human reviewer owns the commission
  check.

### 6. Return Gate-closed or Gate-open

A gate closes only when **all applicable checks** pass:

1. **Exit criterion** (step 3) — at least one acceptable evidence
   form present and its pointer resolves.
2. **Commit seam** (step 4) — a cited commit SHA resolves.
3. **Model check** (step 5) — *Design gate only* — both
   `Noun-vs-mode:` and `Discovered-vs-imposed:` recorded and
   non-empty.

**Closed**: every applicable check above passes.

Return:

```text
Gate $0 closed. Evidence: <pointer cited in round file>. Commit: <sha>.
[Design only] Model check recorded — NOTE: structural only; the
modeling answer's correctness is the human reviewer's call.
Round may advance to <next-gate-name>.
```

**Open**: any applicable check fails (missing evidence, unresolved
pointer, missing/unresolved commit SHA, or — at Design — a missing
model-check line).

Return:

```text
Gate $0 open. Missing: <which check(s) failed>.

Remediation:
- Exit criterion:
  - For Design: add user journeys + acceptance criteria to <design markdown>.
  - For F1: freeze interaction decisions; resolve or defer open UX Qs explicitly.
  - For Contract: commit the YAML, align MSW handlers, document shape freeze.
  - For F2: run the confirmation pass; route shape changes as contract v2.
  - For Backend: run conformance + endpoint behavior tests; document pass count.
  - For Integration: verify FE-vs-BE end-to-end; document shared conformance pass.
- Commit seam (any gate): commit this gate's work and cite the SHA on
  the gate-closed line. A gate with no commit has no revert seam.
- Model check (Design only): record the Noun-vs-mode and
  Discovered-vs-imposed lines (see § 5).

Round must NOT advance until the gate is closed.
```

### 7. Do not auto-advance

The skill **verifies**; the round author **advances**. Even on a
Gate-closed return, the skill does not flip the round's active
phase or any status fields. That action is the round author's,
informed by the verification result.

## Quality Bar

- **Do not** accept "I'm sure it's done" without a citable
  evidence pointer. The whole point of gates is the citation;
  without it, gates collapse into self-reporting.
- **Do not** verify content truthfulness — only structural
  presence. "Tests pass" is the round author's claim to make;
  the skill confirms the claim was made, not that it's correct.
- **Do not** advance the round on closed-gate result. Return,
  let the author advance. Auto-advance hides the gate moment
  from the human reviewer.
- **Do not** infer the Flow if the line is missing. Refer back
  to [`flow-selector`](../flow-selector/SKILL.md). A
  silently-defaulted DCFBI for a round that should have been
  DFCFBI is exactly the failure R47 is designed to prevent.
- **Do not** run on non-feature rounds. Process / tooling /
  documentation rounds use the PDCA template directly without
  the Hard Gates.
- **Do not** close a gate whose work is done but uncommitted.
  "Done but not committed" is the R69 shape — the seam only exists
  once the commit does. A cited SHA that does not `git rev-parse`
  is a hard miss, not a warning.
- **Do not** oversell the Design model check. It confirms the
  Noun-vs-mode / Discovered-vs-imposed answers were *written*, never
  that they are *right*. Always state this limit in the return so the
  commission check stays with the human — a confidently-wrong model
  passes this skill, by design.
