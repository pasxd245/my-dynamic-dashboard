# Round 57: Design-corpus audit — surface 2, `dataset-detail`

**Status**: Complete
**Date started**: 2026-06-01
**Date completed**: 2026-06-01

## Goal

**Inherits from ← [Round_56](Round_56.md)** (the pilot): audit surface 2
of the **design-corpus conformance audit**
([program plan](../programs/design-corpus-audit.plan.md)) —
[dataset-detail](../../design/data-management/dataset-detail.md) — against
the **R56-hardened rubric** (A3 owns token-conformance; B6 defers to it).

Single output this round: `dataset-detail` audited. The rubric is no
longer under calibration (R56 settled it), so this is a straight
conformance pass — **not** a second calibration round.

_Track: 2 (agent-method). Pulled by: design-corpus-audit program, surface
2 + R56 pilot completion._

## Flow (audit reframe — see program plan)

Not a delivery chain — `dataset-detail` is already shipped (R33→R36+).
**D** = does the doc conform to gate + README format; **C/F/B/I** = verify
the shipped FE/BE/test still match the doc. Depth = doc-conformance **+
one** highest-risk traceability spot-check (decision #2).

## Why `dataset-detail` second

It is the **parent surface** `dataset-filters` extends — R56's doc cited
it repeatedly (Read/write boundary, `?q=` row-search, the
fixed-viewport layout shell, the concurrent-delete 404 race). Auditing
the parent right after the child stresses the **horizontal axis (§C)**
hardest: the just-audited child gives a concrete consistency partner, so
shared vocabulary (`?q=` semantics, the layout-shell contract, `formatCell`,
`col_N` dataIndex convention) gets checked from both ends.

## Plan (by gate)

1. **Design (audit)** — run rubric §A (vertical conformance) + §B
   (`ui-design` design-spec, 6 facets) against the doc. Apply the
   **hardened rubric**: A3 scores token-conformance; B6 only checks a
   token map is declared. Record per-item pass/gap.
2. **Contract/FE/BE (verify)** — §C (horizontal: shared vocabulary vs
   `dataset-filters` + the exemplar — `?q=`, layout-shell, `formatCell`,
   `col_N`; cross-links via `markdown-check-link`) + §D (spot-verify the
   one highest-risk claim — candidate: the `?q=` row-search contract /
   the R36 cell-rendering `dtype` hook vs the shipped FE/BE).
3. **Integration** — fold findings into the rolling gap-log; apply
   in-round **doc-conformance fixes only**; **log** any UX/product gap as
   a deferred feature round (firewall — no redesign here). **Bump "Seen
   in"** on any R55/R56 gap that recurs here (frequency drives the pull).
4. **Method-gap watch** — R56 surfaced "design-doc code/table mirrors are
   unguarded by parity tests." If `dataset-detail` shows a second
   instance, bump it toward a Track-2 round (2 surfaces = a pattern).

## Acceptance criteria (Design-gate exit for this round)

- [x] Rubric §A–§D run against `dataset-detail`; per-item pass/gap
      recorded in this round's Do.
- [x] `ui-design` design-spec facet report attached (hardened B6).
- [x] Horizontal check vs `dataset-filters` + exemplar done; one
      spot-verify (§D) executed.
- [x] Findings appended to the [program gap-log](../programs/design-corpus-audit.plan.md);
      "Seen in" bumped where an R55/R56 gap recurs.
- [x] In-round doc fixes applied; UX/product gaps logged (not fixed).
- [x] Method-gap-watch verdict recorded (did the doc-mirror gap recur?).

## What is OUT of scope

- Redesigning `dataset-detail` UX (firewall — defer to a feature round).
- Auditing any other surface (one per round).
- Re-auditing `advanced-query` (exemplar) or `dataset-filters` (done R56).
- Re-opening the rubric for calibration (R56 settled it; this round
  *uses* the hardened rubric, doesn't change it).
- Acting on the gap-log's recurring entries (the program triages at close).

## Risks / unknowns

- **`dataset-detail` predates the audit reframe** — likely the same
  A6-style stale-status / path-drift gaps R56 found; expected, log + fix
  in-round per the firewall.
- **Audit→redesign creep** — firewall is the mitigation; watch at
  Integration.

---

> **PAUSED for review at the Design gate.** Per "one surface per round,
> pause at review to confirm/fix": confirm this plan + the hardened
> rubric before the audit Do-phase runs. Do / Check / Act below are
> filled once the round executes.

## Do

**Flow**: audit reframe (not a delivery chain). Hardened rubric — A3 owns
token-conformance; B6 only checks a token map is declared.

### §A — Vertical conformance

- **A1** Surface-declaration table — **gap (recurs from R56)**:
  Reusability uses `feature`/`backend` (off README set); Purity `data
  type` vs `data constant`.
- **A2** Design-gate exit — **partial gap (recurs)**: no explicit
  user-journeys / testable-acceptance-criteria section.
- **A3** Token map — **gap (recurs)**: cites `tokens.css`; inline
  `#f5f5f5`/`#e6f4ff`/`#1677ff`/`6px`.
- **A4** ASCII + behavior states — **pass** (5 states + mermaid).
- **A5** Scope boundary — **pass**.
- **A6** Status header — **gap → fixed in-round**: was "Draft (Round 33
  design-only)" though shipped R34–R36; now "Accepted (R33 design;
  shipped R34–R36)".

### §B — UX-honeycomb (hardened) — GAP (2 facets)

Findability **pass** · Usability **pass** · Accessibility **gap**
(hover-only dtype-badge full name, no keyboard/SR path, doc:144–146) ·
Credibility **gap** (the 422 claim — see §D) · Utility **pass** ·
**Desirability pass** (token map declared; detail is A3's — the R56
dedupe working as intended).

### §C — Horizontal

- **C1** vocabulary — **pass**: `?q=`, layout-shell, `formatCell` agree
  across detail ↔ filters ↔ exemplar.
- **C2** tokens/naming — **pass** (consistent across siblings; the
  authority deviation is A3's).
- **C3** cross-links — **pass** (`markdown-check-link` exit 0).
- **C4** surface-decl semantics — **pass**: detail's Layer paths are
  accurate; the `filters/`-subdir drift was filters-specific and did
  **not** recur here.

### §D — Spot-verify (rows-GET contract)

- ✅ `operationId getDatasetRows` + response `[rows, page, pageSize,
  total]` match the doc verbatim.
- ❌ **Drift → fixed in-round**: doc's 422 claimed "page beyond
  `ceil(total/pageSize)` → 422", but the shipped contract returns **200
  with empty rows** (`rows-get.contract.yaml:77,326`); 422 is only
  `page_size`-outside-enum. Doc 422 description corrected.

### Fixes applied in-round (firewall: doc-conformance only)

1. A6 status header.
2. §D 422 description (page-beyond is 200-empty, not 422).

### Logged, NOT fixed (firewall)

- **a11y → feature round**: hover-only dtype tooltip (B3).
- **gap-log (frequency)**: A1/A2/A3/A6 all **recurred** → bumped to
  "Seen in R56, R57" (2 surfaces = systematic); the doc-mirror method-gap
  recurred in a new form → Track-2 candidate.

### Method-gap-watch verdict

**RECURRED.** R56's "doc mirrors are unguarded by parity tests" appeared
again — this time doc-prose contract vs the authoritative YAML (the §D
422 drift). 2 instances, 2 mirror-pair forms → promote toward a Track-2
round.

## Check

- Acceptance criteria: all six met (ticked above).
- Fixes verified against the source-of-truth: 422 wording now matches
  `rows-get.contract.yaml`; status header matches shipped reality.
- Links: `markdown-check-link` clean on the edited doc.
- **Firewall held**: no UX redesign; the a11y gap logged, not fixed.

## Act

**Cross-surface signal (the real R57 output):** the R56 vertical gaps are
**not one-offs** — A1 (Reusability vocab), A2 (no acceptance-criteria
section), A3 (`tokens.css` + inline values), A6 (stale status) **all
recur on `dataset-detail`**. At 2/2 surfaces these are **systematic**;
per "frequency drives the pull" they are now doctrine / doc-template /
Track-2 candidates, not per-doc fixes.

**Rubric calibration confirmed**: the A3⇄B6 dedupe behaved as designed —
Desirability passed (map declared) while A3 carried the single token gap.
No new rubric ambiguity surfaced.

**Method-gap promoted to pattern**: doc↔source-of-truth mirrors are
unguarded (2 instances) — strongest standalone Track-2 candidate.

**Disposition**: surface 2 audited; rubric stable. **Program-triage
(decided 2026-06-01)**: the A1/A2/A3/A6 cluster stays **deferred to
program close** per the
[program Lifecycle](../programs/design-corpus-audit.plan.md#lifecycle) —
a mid-program doctrine/template fix was considered and **declined**.
Surfaces 3–7 continue per-surface; the gap-log's "Seen in" frequency
carries the recurring cluster to close-triage (incl. the decide-canonical
questions: is the doc, the README, or the rubric the stale party for
A1/A2/A3?). Per-doc A6/§D conformance fixes still apply in-round.

**Feeds into → next audit round** (surface 3, `datasets`).
