# Program plan: Design-corpus conformance audit

**Status**: Active (pilot in flight — [Round_56](../cycles/Round_56.md))
**Opened**: 2026-05-31

Sweep the flow doctrine
([hybrid-flow-governance](../../decisions/2026-05-28-hybrid-flow-governance.md))
across every **live** design surface under
[.agents/design/](../../design/) (excl. `_archive`), one surface per round,
pausing each at review. Goal: make the corpus **in-sync** _and_ detect
**method-gaps** as concrete Evolution-Rule pulls.

_Track: 2 (agent-method). Pulled by: hybrid-flow `revisit-trigger`
("an artifact category this doctrine did not anticipate"); 2026-05-28
[MEMO-FINDINGS](../brainstorms/2026-05-28-hybrid-flow/MEMO-FINDINGS-2026-05-28.md);
[R55](../cycles/Round_55.md) end-of-round discussion. Decisions settled in
[brainstorm](../brainstorms/2026-05-30-design-corpus-audit/PROPOSAL-2026-05-30.md)._

## Settled decisions (user, 2026-05-31)

1. **Pilot `dataset-filters`** (adjacent to the advanced-query exemplar).
2. **Depth = doc-conformance + spot-verify** — audit the doc against the
   rubric **and** spot-check the single highest-risk traceability claim
   per surface (one contract↔doc or test↔doc link). Not a full C/F/B/I
   re-verification.
3. **Single program doc** (this file) holds the rubric + rolling gap-log;
   per-round `Round_NN.md` docs are seeded from it.

## The reframe (why this isn't a delivery chain)

The surfaces are **already shipped**. DCFBI runs here as a **conformance
audit**, not a build:

- **D** → does the doc meet the Design-gate exit criteria + the
  [design README](../../design/README.md) format?
- **C / F / B / I** → **verification** gates: does the shipped contract /
  FE / BE / conformance-test still match what the doc declares?

That the doctrine is written for new-build, not audit, is **gap #1**
(logged below).

## The rubric (applied identically to every surface)

### A. Vertical — does this doc conform?

- **A1 Surface-declaration table** present + complete (Surface · Layer ·
  Reusability · Purity · Allowed peer deps) per
  [README § File-format conventions](../../design/README.md).
- **A2 Design-gate exit**: user journeys + **testable acceptance
  criteria** documented (the [hard-gate](../../decisions/2026-05-28-hybrid-flow-governance.md)
  Design criterion).
- **A3 Token map** present; every token cites
  [themeTokens.ts](../../../workspace/packages/ui/src/themeTokens.ts) (no
  inline values).
- **A4 ASCII layout + behavior** (state transitions) present where the
  surface warrants.
- **A5 Scope boundary**: covered / deferred / out — explicit.
- **A6 Status header** accurate (concept · round · draft/accepted/superseded).

### B. UX-honeycomb (run `ui-design` design-spec mode)

- **B1–B6** — does the doc **declare** affordances for Findability,
  Usability, Accessibility, Credibility, Utility, Desirability? Record
  the per-facet pass/gap.

### C. Horizontal — is it in-sync with siblings?

- **C1 Shared vocabulary** agrees across docs (operator names, dtype
  labels, status terms). _The R55 `OPS_BY_DTYPE` drift lives here._
- **C2 Tokens / naming** consistent with the corpus + `@mdd/ui`.
- **C3 Cross-links resolve** (run `markdown-check-link`).
- **C4 Surface-declaration semantics** used the same way as peers.

### D. Spot-verify (depth decision #2)

- **D1** — pick the **one** highest-risk traceability claim the doc makes
  (a contract operationId, a `data-component` test hook, a token) and
  verify it against the live artifact. Log drift; do not fix beyond the
  doc unless trivial.

### Scoring

Each item: **pass / gap / n-a**. A *gap* is logged in the rollup with its
axis (A–D) so cross-surface frequency is visible.

## Firewall (round-cadence trap)

An audit will find the **UX itself** weak, not just the doc. Audit rounds
emit only: (a) **doc-conformance fixes in-round**, and (b) **logged**
product/UX gaps **deferred to their own feature rounds**. **Never redesign
inside an audit round.** (Same discipline as R55's "don't bundle.")

## Surfaces + order (suggestive, not binding)

`advanced-query` = the **gold-standard exemplar** (R51/54/55) — not
re-audited; every other surface is scored against it.

| # | Surface | Status | Round |
| - | ------- | ------ | ----- |
| — | `advanced-query` | exemplar (reference) | R51/54/55 |
| 1 | `dataset-filters` | **pilot — auditing** | [R56](../cycles/Round_56.md) |
| 2 | `dataset-detail` | queued | — |
| 3 | `datasets` | queued | — |
| 4 | `workspaces` | queued | — |
| 5 | `workspace-shell` (+ `.target`) | queued | — |
| 6 | `upload` | queued | — |
| 7 | `crud-hygiene` | queued | — |

Round 1 (`dataset-filters`) is also the **rubric calibration** — its
review pass hardens the rubric above before surface 2 begins.

## Rolling gap-log

Method-gaps surfaced by the audit. **Frequency drives the pull**: a gap
in many surfaces → its own Track-2 round; a one-off → an in-round fix.
Seeded from R51→R55 (pre-audit):

| Gap | Axis | Seen in | Disposition |
| --- | ---- | ------- | ----------- |
| Doctrine assumes new-build, not audit (gap #1) | D-gate / doctrine | — | open — may revise hybrid-flow doctrine |
| Vocabulary drift via hand-mirrored copies (`OPS_BY_DTYPE` ×4) | C1 | R55, R56 | **mitigated** — FE+BE parity tests enforce; `advanced-query` imports the FE map (no copy). Residual: the doc-table is an unguarded mirror → see R56 snippet-drift row |
| Test selectors not contracted (`data-component` improvised) | C-gate | R55 | open — Track-2 candidate (C-gate enrichment) |
| `_predicate_sql` cognitive complexity (flat if-chain) | (code, R55 seed) | R55 | open — Track-2 candidate (refactor / lint-debt) |
| `FilterPopover` hardcoded narrowing allow-lists | (code, R55 seed) | R55 | open — Track-2 candidate (derive from shared maps) |
| Status header stale — shipped doc still read "Draft / design-only" | A6 | R56 | **fixed in-round** (R56) |
| Embedded FE-types snippet drifted from vocab table + live type (missing R55 `ne`/`gte`/`lte`) | A2 / §D | R56 | **fixed in-round** (R56). Method-gap: design-doc code snippets are unguarded mirrors (parity tests cover code↔code, not doc↔code) — Track-2 candidate |
| Surface-table Layer paths predate the `filters/` subdir reorg | C4 | R56 | open — systematic; in-round fix deferred (per-row verify needed) |
| Token map cites `tokens.css` (not authoritative `themeTokens.ts`) + inline `#e6f4ff`/px values | A3 / B6 / C2 | R56 | open — likely corpus-wide; triage at program level |
| Reusability column vocab (`feature`/`backend`) outside README's enumerated set | A1 / C4 | R56 | open — README-vs-corpus vocab drift; decide which is canonical |
| Chip `×` / "Clear all" accessible name not declared | B3 | R56 | logged UX/a11y — deferred to a feature round (firewall) |
| 422 filter-validation error has no declared FE surface | B4 | R56 | logged UX — deferred to a feature round (firewall) |
| Inactive filter entry-point (muted chevron) discoverability weak | B1 (UX) | R56 | logged UX/product — deferred to a feature round (firewall) |

_(Append one row per audit finding; bump "Seen in" when a gap recurs.)_

## Lifecycle

Active until all 7 surfaces are audited. At program close, the gap-log's
recurring entries are promoted to their own Track-2 rounds / a doctrine
revision; this file folds into a closing note or a decision artifact.
