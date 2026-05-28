---
name: gate-walker
description: Verify a named Hard Gate (Design, F1, Contract, F2, Backend, or Integration) has its exit criterion documented as met in the round file. Block phase advance with a remediation pointer if the gate is open. DCFBI/DFCFBI branching reads the round's Flow line; F1/F2 gates are skipped on the DCFBI path.
when_to_use: User or a primary skill needs to verify a phase gate before flipping the round's active phase. Trigger phrases include "is Design closed", "check the Contract gate", "can we advance to Backend", "run gate-walker for X", or any pre-advance audit.
argument-hint: <gate-name> <round-file-path>
arguments: gate round
allowed-tools: Read, Grep, Bash(grep *)
metadata:
  author: hand-authored-r49
  version: '1.0'
---

## Trigger

Run this skill **before flipping a feature round's active phase**.
The Hard Gates are checkpoints, not theater — every phase exits
through its named gate, and the round cannot advance until the
gate's exit criterion is documented as met in the round file
(per [R47 § Hard gates](../../decisions/2026-05-28-hybrid-flow-governance.md)).

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

| Gate | Exit criterion |
|---|---|
| **Design** | User journeys + testable acceptance criteria documented in the design artifact |
| **F1** *(DFCFBI only)* | Interaction decisions frozen for this round; open UX questions resolved or explicitly deferred |
| **Contract** | Request / response / error shapes frozen; MSW handlers aligned; YAML committed |
| **F2** *(DFCFBI only)* | Confirmation pass complete against contract-derived MSW; any shape change re-routed as contract v2 |
| **Backend** | Contract conformance tests pass; per-endpoint behavior tests pass |
| **Integration** | FE-vs-BE verified end-to-end; shared conformance tests pass against both MSW and real backend |

Look in the round file for evidence that the criterion is met.
Acceptable evidence forms:

- A `**<Gate> gate closed**` line in the `## Do` section with a
  one-sentence pointer to where the evidence lives (file path,
  commit hash, test name).
- A `## Check` checklist item ticked `[x]` whose text matches
  the gate's criterion.
- A passing CI run / test count documented in `## Do` for
  Contract / Backend / Integration gates.

The skill is a **structural** check — it verifies *evidence is
cited*, not that the evidence is *truthful*. Truthfulness is the
round author's responsibility.

### 4. Return Gate-closed or Gate-open

**Closed**: at least one acceptable evidence form is present and
the evidence pointer resolves (file exists, commit is reachable,
test name is greppable).

Return:

```text
Gate $0 closed. Evidence: <pointer cited in round file>.
Round may advance to <next-gate-name>.
```

**Open**: no evidence form is present, or the cited pointer does
not resolve.

Return:

```text
Gate $0 open. Missing: <what's not documented>.

Remediation:
- For Design: add user journeys + acceptance criteria to <design markdown>.
- For F1: freeze interaction decisions; resolve or defer open UX Qs explicitly.
- For Contract: commit the YAML, align MSW handlers, document shape freeze.
- For F2: run the confirmation pass; route shape changes as contract v2.
- For Backend: run conformance + endpoint behavior tests; document pass count.
- For Integration: verify FE-vs-BE end-to-end; document shared conformance pass.

Round must NOT advance until the gate is closed.
```

### 5. Do not auto-advance

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
