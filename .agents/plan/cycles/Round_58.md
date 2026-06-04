# Round 58: Design-corpus audit — surface 3, `datasets`

**Status**: Complete
**Date started**: 2026-06-01
**Date completed**: 2026-06-01

## Goal

**Inherits from ← [Round_57](Round_57.md)**: audit surface 3 of the
**design-corpus conformance audit**
([program plan](../programs/design-corpus-audit.plan.md)) —
[datasets](../../design/data-management/datasets.md) — against the
**stable rubric** (A3 owns tokens; B6 defers). Straight conformance pass;
the rubric is settled (R56) — **not** a calibration round.

_Track: 2 (agent-method). Pulled by: design-corpus-audit program, surface
3 + R57 completion._

## Flow (audit reframe — see program plan)

Not a delivery chain — `datasets` is already shipped (R14+). **D** = does
the doc conform to gate + README format; **C/F/B/I** = verify the shipped
FE/BE/test still match the doc. Depth = doc-conformance **+ one** §D
spot-verify (decision #2).

## Why `datasets` third

It is the **catalog / collection** surface that *defines*
`Dataset.columns[].dtype` — the **vocabulary source** that both
`dataset-detail` (R57) and `dataset-filters` (R56) *consume*. Surfaces 1–2
were checked as dtype **consumers**; auditing the **producer** closes the
loop on §C C1 from the other side: does the dtype taxonomy the children
depend on actually match what this doc declares? Also stresses the
workspace-filter affordance + the workspace-card → list handoff.

## Plan (by gate)

1. **Design (audit)** — rubric §A (vertical) + §B (`ui-design`
   design-spec, hardened). Record per-item pass/gap.
2. **Contract/FE/BE (verify)** — §C (horizontal: dtype taxonomy vs
   detail/filters/exemplar; workspace-filter naming; cross-links via
   `markdown-check-link`) + §D (spot-verify one highest-risk claim —
   candidate: the `Dataset` schema / list-GET contract, or the `dtype`
   enum vs the shared `dataset.yaml`).
3. **Integration** — fold findings into the gap-log; apply in-round
   **doc-conformance fixes only**; **log** UX/product gaps (firewall).
   **Bump "Seen in"** on the systematic cluster (A1/A2/A3/A6) if it
   recurs — expected; **confirm + bump, don't re-analyze**.
4. **Method-gap watch** — a 3rd instance of "doc mirrors unguarded by
   parity tests" would strongly confirm the Track-2 pull.

## Acceptance criteria (Design-gate exit for this round)

- [x] Rubric §A–§D run against `datasets`; per-item pass/gap recorded.
- [x] `ui-design` design-spec facet report attached (hardened B6).
- [x] Horizontal check vs detail/filters/exemplar done; one §D
      spot-verify executed.
- [x] Findings appended to the [program gap-log](../programs/design-corpus-audit.plan.md);
      "Seen in" bumped on any recurring gap.
- [x] In-round doc fixes applied; UX/product gaps logged (not fixed).
- [x] Method-gap-watch verdict recorded.

## What is OUT of scope

- Redesigning `datasets` UX (firewall — defer to a feature round).
- Auditing any other surface (one per round).
- Re-auditing `advanced-query` / `dataset-filters` / `dataset-detail`.
- **Remediating the systematic A1/A2/A3/A6 cluster** — deferred to
  program close per the [Lifecycle](../programs/design-corpus-audit.plan.md#lifecycle)
  (2026-06-01 decision). This round only **confirms + bumps** frequency.
- Re-opening the rubric for calibration (settled R56).

## Risks / unknowns

- **`datasets` predates the audit reframe** — the systematic cluster
  (stale status, token citation, Reusability vocab, no acceptance
  section) is *expected* to recur; confirm + bump, log A6/§D per-doc
  fixes, don't re-litigate.
- **Audit→redesign creep** — firewall is the mitigation.

---

> **PAUSED for review at the Design gate.** Per "one surface per round,
> pause at review to confirm/fix": confirm this plan before the audit
> Do-phase runs. Do / Check / Act below are filled once the round
> executes.

## Do

**Flow**: audit reframe. Stable rubric (A3 owns tokens; B6 defers).

### §A — Vertical conformance

- **A1** Surface-declaration table — **gap (recurs, 3/3)**: Reusability
  `feature`/`backend` off README set.
- **A2** Design-gate exit — **partial gap (recurs, 3/3)**: no explicit
  journeys / acceptance-criteria section.
- **A3** Token map — **gap (recurs, stronger form)**: **absent entirely**
  — `datasets.md` (R14) predates the token-map convention.
- **A4** ASCII + behavior — **pass**: 3 states in ASCII; state-complexity
  low enough that prose behavior suffices ("where warranted").
- **A5** Scope boundary — **partial gap (NEW)**: covered (Read/write
  boundary) + deferred present, but no explicit "does NOT cover" section
  (siblings have one).
- **A6** Status header — **gap → fixed in-round**: was "Draft (Round 14
  design-only)" though shipped R15–R17; now "Accepted (R14 design;
  shipped R15–R17; extended R23, R33)".

### §B — UX-honeycomb (hardened) — GAP (3 facets)

Findability **pass** · Usability **pass** · Accessibility **gap**
(source-format icon-only in the list, no text/aria, doc:123–125) ·
Credibility **gap** (no loading / fetch-error state declared) · Utility
**pass** · Desirability **gap** (no token map — same root as A3; see
calibration residual).

### §C — Horizontal (the loop-closure this round was sequenced for)

- **C1** vocabulary — **pass ✅**: the dtype taxonomy `datasets.md`
  *produces* — `[string, integer, float, boolean, date, datetime]` —
  matches what R56/R57 *consume*; `Dataset` shape matches siblings'
  references. **Producer↔consumer loop sound.**
- **C2** tokens/naming — **pass** (naming consistent; token absence is
  A3's).
- **C3** cross-links — **pass** (`markdown-check-link` exit 0).
- **C4** surface-decl semantics — **pass** (consistent peer usage).

### §D — Spot-verify (produced vocabulary vs the contract) — PASS, no drift

- `Column.dtype` enum ≡ `column.yaml` `[string … datetime]` ≡ live FE
  `Dtype` — **verbatim**.
- `Dataset` shape ≡ shared `dataset.yaml` (required set + optional
  `sheetName`) — **verbatim**; the contract even names this doc as its
  source.
- **Unlike R56/R57, no drift** — the data-model mirror is
  contract-anchored (`additionalProperties: false`, "adding a dtype is a
  contract change").

### Fixes applied in-round (firewall)

1. A6 status header.

### Logged, NOT fixed (firewall + defer-to-close)

- **Systematic cluster → 3/3**: A1, A2, A3 (strongest form: absent), A6.
- **New older-doc gaps**: A5 (no explicit out-of-scope), Credibility (no
  loading/error state).
- **a11y → feature round**: icon-only source-format.
- **Rubric calibration residual**: A3⇄B6 dedupe doesn't cover the
  absent-map case → logged for close.

### Method-gap-watch verdict

**Did NOT recur.** §D found the data-model mirror is contract-guarded
(`column.yaml`/`dataset.yaml` + `additionalProperties: false`). The
unguarded mirrors (R56 snippet, R57 contract-prose) are *prose*, not
data-model. Method-gap stays at **2 instances**.

## Check

- Acceptance criteria: all six met (ticked above).
- §D verified against source-of-truth: dtype enum + `Dataset` shape match
  `column.yaml`/`dataset.yaml` + live FE verbatim.
- Links: `markdown-check-link` clean.
- **Firewall held**: only A6 fixed in-round; missing-section / UX gaps
  logged (defer-to-close for the systematic cluster).

## Act

**3/3 confirms systematic**: A1/A2/A6 (and A3) recur on every audited
surface — the 2026-06-01 defer-to-close decision holds; close-triage now
has 3-surface frequency behind it.

**New signal — conformance tracks doc age**: `datasets.md` (R14, the
oldest) is the *least* conformant — A3 absent (not merely mis-cited), A5
missing, no loading/error states — because it predates the token-map +
scope-boundary conventions the R33/R37 docs follow. **Close-triage
implication**: the doctrine/template backfill should prioritise the
oldest docs; the newer ones largely conform.

**Counter-signal — data-model governance is strong**: §D found zero
drift; the dtype/`Dataset` vocabulary is contract-anchored and consumed
faithfully. The audit's drift findings concentrate in
**presentation/prose** (tokens, status, states, contract-error prose),
not the data model — useful scoping for any future parity tooling.

**Rubric**: one residual calibration edge (absent-map A3⇄B6 double-count)
logged for close; not re-opened mid-program.

**Disposition**: surface 3 audited; rubric stable.
**Feeds into → surface 4 (`workspaces`)**.
