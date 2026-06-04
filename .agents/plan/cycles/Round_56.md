# Round 56: Design-corpus audit — pilot on `dataset-filters` (+ rubric calibration)

**Status**: Complete
**Date started**: 2026-05-31
**Date completed**: 2026-06-01

## Goal

**Inherits from ← [Round_55](Round_55.md)** end-of-round decision: launch
the **design-corpus conformance audit**
([program plan](../programs/design-corpus-audit.plan.md)). This is **round 1** —
the **pilot**: audit
[dataset-filters](../../design/data-management/dataset-filters.md) against
the rubric, **and** calibrate the rubric itself (round 1's review pass
hardens it before surface 2).

Two outputs, not one: (a) `dataset-filters` audited; (b) a hardened
rubric in the [program plan](../programs/design-corpus-audit.plan.md).

_Track: 2 (agent-method). Pulled by: R55 end-of-round discussion +
[design-corpus-audit brainstorm](../brainstorms/2026-05-30-design-corpus-audit/README.md).
Decisions: pilot `dataset-filters` · doc-conformance + spot-verify ·
single program doc._

## Flow (audit reframe — see program plan)

Not a delivery chain — `dataset-filters` is already shipped. **D** =
does the doc conform to gate + README format; **C/F/B/I** = verify the
shipped contract/FE/BE/test still match the doc. Depth = doc-conformance
**+ one** highest-risk traceability spot-check (decision #2).

## Why `dataset-filters` first

Adjacent to the `advanced-query` exemplar (R51/54/55) — they share the
`OPS_BY_DTYPE` / `FilterPredicate` vocabulary, so the exemplar transfers
cleanly and the **horizontal axis (C1 vocabulary)** gets stressed
immediately, which is where the richest cross-surface gaps live.

## Plan (by gate)

1. **Design (audit)** — run the rubric §A (vertical conformance) + §B
   (`ui-design` design-spec, 6 facets) against the doc. Record per-item
   pass/gap.
2. **Contract/FE/BE (verify)** — rubric §C (horizontal: shared vocab vs
   `advanced-query` + the live `OPS_BY_DTYPE`; cross-links via
   `markdown-check-link`) + §D (spot-verify the one highest-risk claim —
   candidate: the doc's operator/label vocabulary vs the shipped FE/BE
   maps, given R55's known drift seed).
3. **Integration** — fold findings into the rolling gap-log; apply
   in-round **doc-conformance fixes only**; **log** any UX/product gap as
   a deferred feature round (firewall — no redesign here).
4. **Calibrate** — note where the rubric was ambiguous/over/under-built
   against this first real doc; propose the hardening edit to the program
   plan's rubric.

## Acceptance criteria (Design-gate exit for this round)

- [x] Rubric §A–§D run against `dataset-filters`; per-item pass/gap
      recorded in this round's Do.
- [x] `ui-design` design-spec facet report attached.
- [x] Horizontal vocab check vs `advanced-query` + live `OPS_BY_DTYPE`
      done; one spot-verify (§D) executed.
- [x] Findings appended to the [program gap-log](../programs/design-corpus-audit.plan.md);
      "Seen in" bumped where a seed recurs.
- [x] In-round doc fixes applied; UX/product gaps logged (not fixed).
- [x] Rubric-calibration note proposed to the program plan.

## What is OUT of scope

- Redesigning `dataset-filters` UX (firewall — defer to a feature round).
- Auditing any other surface (one per round).
- Re-auditing `advanced-query` (it's the exemplar/reference).
- Acting on the gap-log's recurring entries (the program triages those at
  close, not in the pilot).

## Risks / unknowns

- **Rubric is unproven** — first contact with a real doc may show it's
  over- or under-built. That's expected; calibration is an explicit
  output, not a failure.
- **Audit→redesign creep** — the firewall is the mitigation; watch for it
  at the Integration gate.

---

> **PAUSED for review at the Design gate.** Per the user's "each round
> focuses on one, pause at review to confirm/fix": confirm the rubric +
> this plan before the audit Do-phase runs. Do / Check / Act below are
> filled once the pilot executes.

## Do

**Flow**: audit reframe (not a delivery chain). D = doc conformance;
C/F/B/I = verify shipped artifacts still match the doc. Depth =
doc-conformance + one §D spot-verify (decision #2).

### §A — Vertical conformance

- **A1** Surface-declaration table — **gap**: Reusability column uses
  `feature`/`backend` (outside README set: shared cross-domain ·
  domain-only · builder-only · one-off); Purity `data type` vs README
  `data constant`.
- **A2** Design-gate exit — **partial gap**: testable criteria implied
  via R38–R40 test bullets; no explicit user-journeys/acceptance section.
- **A3** Token map cites themeTokens.ts, no inline values — **gap**:
  cites `tokens.css`; inline `#e6f4ff`/`4px`/`6px`/`12px`.
- **A4** ASCII layout + behavior states — **pass**.
- **A5** Scope boundary (covered/deferred/out) — **pass** (exemplary).
- **A6** Status header accurate — **gap → fixed in-round**: was "Draft
  (Round 37 design-only)" though shipped R38–R40 + amended R55; now
  "Accepted (R37 design; shipped R38–R40; amended R55)".

### §B — UX-honeycomb (`ui-design` design-spec) — GAP (3 facets)

Findability **pass** · Usability **pass** · Accessibility **gap** (chip
×/Clear-all accessible name undeclared, doc:328/339) · Credibility
**gap** (422 filter-error has no declared FE surface, doc:576–582) ·
Utility **pass** · Desirability **gap** (token: inline values +
`tokens.css` vs `themeTokens.ts`).

### §C — Horizontal

- **C1** vocabulary — **pass**: FE `OPS_BY_DTYPE` (filters/types.ts:60)
  ≡ BE (filters.py:52), both with R55 `ne`/`gte`/`lte`; `advanced-query`
  imports the FE map (serialize.ts:15) — no copy.
- **C2** tokens/naming — **gap** (same as A3/B6).
- **C3** cross-links — **pass** (`markdown-check-link` exit 0).
- **C4** surface-decl semantics — **gap**: Layer paths predate the
  `filters/` subdir reorg (doc `datasets/types.ts` vs live
  `datasets/filters/types.ts`); systematic.

### §D — Spot-verify (highest-risk: operator vocabulary vs shipped maps)

- Doc **predicate-vocabulary table** ≡ FE map ≡ BE map, **verbatim** —
  test-guarded (`dataset-detail.test.tsx:253` + paired BE test). R55's
  ×4-copy seed is **mitigated**.
- Doc **embedded FE-types TS block** (663–671) **stale** — missing R55
  `ne` (string), `gte`/`lte` (date). **Fixed in-round** to match the
  table + live `filters/types.ts:46,50`.

### Fixes applied in-round (firewall: doc-conformance only)

1. A6 status header.
2. §D stale FE-types snippet (`ne` for string; `gte`/`lte` for date).

### Logged, NOT fixed (firewall)

- **UX/product/a11y → deferred feature rounds**: chip-aria (B3), 422 FE
  surface (B4), muted entry-point discoverability (B1).
- **Method/corpus → gap-log triage**: Layer-path drift (C4), token
  citation (A3/B6/C2), Reusability vocab (A1/C4), and the new
  method-gap (design-doc snippets are unguarded mirrors).
- All appended to the
  [program gap-log](../programs/design-corpus-audit.plan.md).

## Check

- Acceptance criteria: all six met (ticked above).
- Doc fixes verified against live code: FE-types snippet now matches
  `filters/types.ts:46,50`; status header matches shipped reality.
- Links: `markdown-check-link` clean on the edited doc.
- **Firewall held**: no UX redesign in-round; product/a11y gaps logged,
  not fixed.

## Act

**Rubric calibration (pilot output — proposed to the program plan):**

1. **A3 ⇄ B6 overlap** — token conformance is checked twice (vertical A3
   and honeycomb Desirability). Make A3 the owner; have B6 reference it.
2. **New method-gap — unguarded doc mirrors.** Parity tests cover
   code↔code (FE⇄BE); design-doc embedded snippets + the vocab table are
   doc↔code mirrors with no guard. The §D snippet drift is the first
   instance → Track-2 candidate (extend parity discipline to design
   docs). Logged in the gap-log.
3. **Rubric held up** — §A–§D produced concrete, checkable findings on a
   real doc; no item was unusably ambiguous. Calibration is light: one
   overlap to dedupe, one new axis to consider.

**Disposition**: pilot complete; rubric sound with the A3⇄B6 dedupe.

**Feeds into → next audit round** (surface 2, `dataset-detail`) per the
program surface table — begins once this round is reviewed + committed.
