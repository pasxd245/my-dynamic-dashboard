# Round 61: Design-corpus audit — surface 6, `upload`

**Status**: Complete
**Date started**: 2026-06-01
**Date completed**: 2026-06-01

## Goal

**Inherits from ← [Round_60](Round_60.md)**: audit surface 6 of the
**design-corpus conformance audit**
([program plan](../programs/design-corpus-audit.plan.md)) —
[upload](../../design/data-management/datasets/upload.md) — against the **stable
rubric** (A3 owns tokens; B6 defers). Straight conformance pass; carries
R60's two corrections forward (judge by conformance not age; A3 has a
known model in `workspace-shell.md`).

_Track: 2 (agent-method). Pulled by: design-corpus-audit program, surface
6 + R60 completion._

## Flow (audit reframe — see program plan)

Not a delivery chain — `upload` is already shipped (R14–R17 chain). **D** =
does the doc conform to gate + README format; **C/F/B/I** = verify the
shipped FE/BE/contract still match the doc. Depth = doc-conformance **+
one** §D spot-verify (decision #2).

## Why `upload` sixth

It is the **verb** that *creates* datasets —
[datasets.md](../../design/data-management/datasets/datasets.md) is the noun,
`upload.md` the verb. It **assigns `Dataset.columns[].dtype` via parse
inference** (the production side of the dtype vocabulary the cluster
consumes — R56/R57/R58 checked the consumer side; this checks the
*producer of the values*) and owns the **batch-commit contract**
(`POST /workspaces/{id}/datasets/batch`) that `datasets.md` references.
Auditing it closes the data-creation side of the cluster.

## Plan (by gate)

1. **Design (audit)** — rubric §A (vertical) + §B (`ui-design`,
   hardened). Record per-item pass/gap. **Check A3 against the R60 model**
   (`workspace-shell.md` cites `themeTokens.ts`): does `upload.md` conform,
   cite `tokens.css`, or lack a map?
2. **Contract/FE/BE (verify)** — §C (horizontal: the **dtype-inference**
   vocabulary + the batch-commit contract vs `datasets.md`/`column.yaml`;
   cross-links via `markdown-check-link`) + §D (spot-verify one
   highest-risk claim — candidate: the batch-commit contract
   `operationId`/shape, or the inferred-dtype set vs `column.yaml`).
3. **Integration** — fold findings into the gap-log; apply in-round
   **doc-conformance fixes only**; **log** UX/product gaps (firewall).
   **Confirm + bump** the systematic cluster (A1/A2/A6) if it recurs.
4. **Method-gap watch** — record whether the doc↔source-of-truth mirror
   gap recurs (still 3 instances after R60).

## Acceptance criteria (Design-gate exit for this round)

- [x] Rubric §A–§D run against `upload`; per-item pass/gap recorded.
- [x] `ui-design` design-spec facet report attached (hardened B6).
- [x] §C horizontal (dtype-inference + batch-commit vs the cluster) +
      one §D spot-verify executed.
- [x] A3 verdict recorded **relative to the R60 model** (conforms /
      tokens.css / absent).
- [x] Findings appended to the [program gap-log](../programs/design-corpus-audit.plan.md);
      "Seen in" bumped on any recurring gap.
- [x] In-round doc fixes applied; UX/product gaps logged (not fixed);
      method-gap-watch verdict recorded.

## What is OUT of scope

- Redesigning the upload UX (firewall — defer to a feature round).
- Auditing any other surface; re-auditing done surfaces.
- **Remediating the systematic A1/A2/A3/A6 cluster** — deferred to
  program close per the [Lifecycle](../programs/design-corpus-audit.plan.md#lifecycle)
  (2026-06-01 decision). Confirm + bump only.
- Re-opening the rubric for calibration (settled R56; the target-doc
  variant and absent-map residual are logged for close).

## Risks / unknowns

- **`upload` is a wizard** — richer interaction (drop zone, multi-step,
  parse preview, sheet selection, error states) than the list/detail
  surfaces; §B may surface more state-credibility detail. Judge by
  conformance, **not age** (R60 correction) — don't presume gaps.
- **Audit→redesign creep** — firewall is the mitigation.

---

> **PAUSED for review at the Design gate.** Per "one surface per round,
> pause at review to confirm/fix": confirm this plan before the audit
> Do-phase runs. Do / Check / Act below are filled once the round
> executes.

## Do

**Flow**: audit reframe. Stable rubric. `upload.md` is heavily
content-maintained (R14→R32) — a direct test of R60's "maintenance"
hypothesis.

### §A — Vertical conformance

- **A1** Surface table — **gap (6/6)**: Reusability `feature`/`backend`
  off-README; Purity also off-README here (`pure (data)`, `data type`).
- **A2** Design-gate exit — **partial gap (6/6)**: no explicit
  journeys/acceptance section (rich "Open questions" tables instead).
- **A3** Token map — **gap (absent)**: no token map despite heavy
  maintenance → format-convention adherence, not upkeep.
- **A4** ASCII + behavior — **pass**: all wizard steps + an ASCII state
  machine; the corpus's richest layout doc.
- **A5** Scope boundary — **partial gap**: Read/write boundary
  (covered/deferred) present, but **no explicit "does NOT cover"
  section** → recurs with `datasets.md`; **corrects R59** (A5 is not
  datasets-only — 4 of 6 have it).
- **A6** Status header — **gap → fixed in-round** ("Draft (Round 14
  design-only…)" → "Accepted (R14 design; shipped R15–R17; extended
  R19/R21/R30/R32)").

### §B — UX-honeycomb (hardened) — GAP (3 facets)

Findability **pass** · Usability **pass** · Accessibility **gap**
(source-type cards no keyboard/role) · Credibility **gap** (loading/
pending under-declared — though **failure states are the best in the
corpus**: per-sheet ✗, partial-fail, commit-alert) · Utility **pass** ·
Desirability **gap** (no token map = A3).

### §C — Horizontal (dtype-inference + batch-commit)

- **C1 pass**: override dtype set `string·integer·float·boolean·date·
  datetime` ≡ `column.yaml`; `ColumnOverride.dtype: Dtype`;
  `sourceFormat` ≡ `dataset.yaml`. The producer-of-values is in sync.
  _Minor intra-doc inconsistency: `/datasets` vs `/datasets/batch`
  (§D, fixed)._
- **C2 / C3 / C4 pass** (links exit 0).

### §D — Spot-verify (batch-commit contract) — fixed in-round

- ✅ Live contract `commitDatasetsBatch` @ `/workspaces/{id}/datasets/
  batch` with `items`/`ParseOptions`/`ColumnOverride`/`excluded_columns`
  — matches `upload.md`'s main declarations.
- ❌ 2 in-doc refs dropped `/batch` → **fixed in-round** (aligned to the
  contract). Intra-doc, not mirror drift.

### Fixes applied in-round (firewall)

1. A6 status header. 2. Two `/batch` endpoint refs.

### Logged, NOT fixed

- Systematic cluster A1/A2/A6 → **6/6**; A3 → **5 of 6 gap** (+
  workspace-shell model); A5 corrected to **inconsistent** (4 of 6
  have it).
- a11y (source cards), Credibility (loading/pending).
- **Maintenance hypothesis refined**: upload is heavily
  content-maintained yet format-non-conformant → the variable is
  doc-format-convention adherence, not upkeep. A template+lint fixes it;
  maintenance won't.

### Method-gap-watch verdict

**Did NOT recur** (doc↔truth clean): the batch-commit doc↔contract is in
sync; the `/batch` omission was intra-doc. Stays at **3 instances**.

## Check

- Acceptance criteria: all six met (ticked above).
- §D verified: batch contract `commitDatasetsBatch` @ `.../datasets/batch`
  (`batch-post.contract.yaml:14-16`); shape matches.
- Links: `markdown-check-link` clean.
- **Firewall held**: A6 + 2 endpoint refs fixed; format/UX gaps logged
  (defer-to-close).

## Act

**The "maintenance, not age" correction, sharpened.** `upload.md` is the
*most* content-maintained doc in the corpus (R19 parse-options chain, R21,
R30 sweep, R32 i18n) yet still fails A1/A2/A3/A5/A6. So conformance to the
**doc-format conventions** is independent of content upkeep — authors
maintain *substance* but never revisit *format*. **Close-triage
confirmed**: only a doc-template + a lint (status lifecycle, required
token-map citing `themeTokens.ts`, scope section, vocab) fixes this
systematically; per-doc maintenance demonstrably does not.

**Earlier call corrected**: A5 is *not* datasets-only (upload also lacks
the explicit out-of-cover) — it's inconsistent (4 of 6 have it).

**Cluster tally after 6 surfaces**: A6 6/6 (all fixed in-round) · A2 6/6 ·
A1 6/6 · A3 5/6 gap + 1 model · A5 2/6 gap. Method-gap holds at **3
instances** (no recurrence R58/R60/R61). Firewall intact throughout.

**Disposition**: surface 6 audited. **One surface remains** —
`crud-hygiene` (R62) — then the program reaches **close**, where the
deferred cluster, the rubric artifact-type variant, the doc-mirror parity
tooling, and the PageCard coverage get triaged.
**Feeds into → surface 7 (`crud-hygiene`) — the last.**
