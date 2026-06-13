# Round 60: Design-corpus audit — surface 5, `workspace-shell` (canonical + `.target`)

**Status**: Complete
**Date started**: 2026-06-01
**Date completed**: 2026-06-01

## Goal

**Inherits from ← [Round_59](Round_59.md)**: audit surface 5 of the
**design-corpus conformance audit**
([program plan](../programs/design-corpus-audit.plan.md)) —
[workspace-shell.md](../../design/_platform/workspace-shell.md)
(canonical) **and**
[workspace-shell.target.md](../../design/_platform/workspace-shell.target.md)
(its horizon/target doc) — against the **stable rubric**.

**Two firsts this round**: (a) the first **multi-doc** surface; (b) the
first **target doc** — a different artifact type. The rubric was written
for canonical specs; this round is where it meets the **target-doc
category** the program's gap #1 ("doctrine assumes new-build, not audit")
and the original `revisit-trigger` ("an artifact category this doctrine
did not anticipate") anticipated. **Expect a method/calibration finding on
target-doc handling — that is an output, not a failure.**

_Track: 2 (agent-method). Pulled by: design-corpus-audit program, surface
5 + R59 completion._

## Flow (audit reframe — see program plan)

- **`workspace-shell.md` (canonical)** — already shipped → standard rubric
  §A–§D, same as surfaces 1–4.
- **`workspace-shell.target.md` (target)** — a **horizon** artifact, not a
  shipped surface. Apply a **target-aware pass** per the
  [design README § `<concept>.target.md`](../../design/README.md): it
  SHOULD carry a TARGET-NOT-CURRENT banner, `(future)` surface rows, and a
  fold-back/retire lifecycle clause. **Do NOT** score `(future)` rows or
  horizon state as "drift" — that is the doc working as designed.

## Why `workspace-shell` fifth

It is the **chrome every audited surface renders inside** — filters,
detail, datasets, and workspaces all cite `workspace-shell.target.md` as
"the chrome this lives inside." Auditing it checks the **shell vocabulary
the whole corpus depends on** (sidebar/NAV_GROUPS, PageHeader/PageCard,
the fixed-viewport layout-shell math `dataset-detail` cited). And it forces
the rubric to confront the **target-doc artifact type** for the first time.

## Plan (by gate)

1. **Design (audit)** — rubric §A + §B (`ui-design`, hardened) on the
   **canonical** doc. On the **target** doc, run a **target-aware §A**
   (banner present? `(future)` rows marked? lifecycle/retire clause?) —
   record where the standard rubric items do / don't apply.
2. **Contract/FE/BE (verify)** — §C (shell vocabulary vs the consumers
   that cite it: `NAV_GROUPS`, PageCard `variant="fill"`, layout-shell
   math; cross-links via `markdown-check-link`) + §D (spot-verify one
   highest-risk claim — candidate: the `NAV_GROUPS` structure or the
   layout-shell chrome math vs the live shell component).
3. **Integration** — fold findings into the gap-log; apply in-round
   **doc-conformance fixes only**; **log** UX/product gaps (firewall).
   **Confirm + bump** the systematic cluster if it recurs.
4. **Method finding** — record how the rubric did / didn't fit the
   **target-doc category**; propose the rubric/doctrine note (this is the
   program's anticipated revisit-trigger surfacing). Log, don't remediate
   mid-program.

## Acceptance criteria (Design-gate exit for this round)

- [x] Rubric §A–§D run against `workspace-shell.md` (canonical);
      per-item pass/gap recorded.
- [x] Target-aware §A pass run against `workspace-shell.target.md`;
      per-item applicable / n-a / gap recorded.
- [x] `ui-design` design-spec facet report attached (canonical).
- [x] §C horizontal (shell vocab vs consumers) + one §D spot-verify done.
- [x] Findings appended to the [program gap-log](../programs/design-corpus-audit.plan.md);
      "Seen in" bumped on any recurring gap.
- [x] In-round doc fixes applied; UX/product gaps logged (not fixed).
- [x] **Target-doc method finding recorded** (how the rubric fits the
      target-doc category).

## What is OUT of scope

- Redesigning the shell UX (firewall — defer to a feature round).
- Auditing any other surface; re-auditing done surfaces.
- **Remediating the systematic A1/A2/A3/A6 cluster** — deferred to
  program close per the [Lifecycle](../programs/design-corpus-audit.plan.md#lifecycle)
  (2026-06-01 decision). Confirm + bump only.
- Re-opening the rubric for general calibration — BUT the target-doc
  method finding is an expected, in-scope **output** (logged, not applied
  mid-program).

## Risks / unknowns

- **Target doc is a new artifact category** — standard rubric items
  (A6 "shipped status", A2 "acceptance criteria") may be **n-a** or need a
  target-specific reading. Mislabelling horizon state as "drift" is the
  trap; the target-aware pass is the mitigation.
- **Two docs, one round** — keep them distinct in the Do log; don't let
  canonical findings bleed into target findings.
- **Audit→redesign creep** — firewall.

---

> **PAUSED for review at the Design gate.** Per "one surface per round,
> pause at review to confirm/fix": confirm this plan — especially the
> **target-aware pass** for the `.target` doc — before the Do-phase runs.
> Do / Check / Act below are filled once the round executes.

## Do

**Flow**: audit reframe. Two docs — canonical (standard rubric) + target
(target-aware pass).

### Canonical — `workspace-shell.md`

- **§A**: A1 **gap** (Reusability `feature` off-README — *but* Purity
  correct `data constant`, unlike the dataset cluster's `data type`) · A2
  **partial gap** (no acceptance-criteria section) · A3 **PASS ✅
  gold-standard** (cites `themeTokens.ts` + AntD seed; values marked
  informational; "no new token") · A4 **pass** (exemplary — 2 mermaid +
  wireframes) · A5 **pass** (explicit IN/OUT; even defers full-a11y with a
  trigger) · A6 **gap → fixed in-round** ("Draft (Round 07 Plan-phase)" →
  "Accepted (R07 design; shipped R07–R09)").
- **§B (hardened)**: **all 6 PASS** — first clean §B. Keyboard declared
  (Tab/Enter/Space); full-a11y honestly deferred; token map cited.

### Target — `workspace-shell.target.md` (target-aware §A)

A1 **pass** (all README-valid Reusability + correct `(future)` markings) ·
A2 **n-a** (horizon doc — Named-pulls chain, not acceptance criteria) · A3
**n-a** (tokens belong to the canonical) · A4 **pass** · A5 **pass**
(explicit Out-of-scope) · A6 **PASS** (status "Target horizon" accurate;
TARGET-NOT-CURRENT banner present). **Conformant *for its type*.**

### §C — Horizontal

- **C1 pass** on `NAV_GROUPS` (NavGroup shape consistent across
  shell/datasets/workspaces). **PageCard variant**: live =
  `default|flush|fill`; `dataset-detail` uses `fill` (correct); the target
  doc lists `default|flush` (frozen by design, predates `fill`). No
  consumer drift; logged a coverage note (PageCard has no canonical doc).
- **C2 / C3 / C4 pass** (links exit 0).

### §D — Spot-verify (PageCard variant vs live primitive) — PASS

`PageCard.tsx:48` = `variant?: "default" | "flush" | "fill"`. Consumers
match; the target's omission of `fill` is by-design freeze, not drift.

### Fixes applied in-round (firewall)

1. Canonical A6 status header.

### Logged, NOT fixed

- Systematic cluster (A1/A2/A6) → **5/5 canonical**. **A3 NOT bumped** —
  `workspace-shell.md` PASSES it (the model).
- **Method finding (anticipated)**: rubric mis-fits the target-doc type
  (A2/A3 n-a) — needs an artifact-type-aware variant. Concrete instance of
  gap #1 + the original revisit-trigger.
- **Correction logged**: R58/R59's "conformance tracks age" is REFUTED
  (oldest doc = most conformant). Maintenance, not age.
- PageCard coverage (no canonical doc; capture `fill` at target fold-back).

### Method-gap-watch verdict

**Did NOT recur** (PageCard consumers correct; no unguarded-mirror drift).
Stays at **3 instances**.

## Check

- Acceptance criteria: all seven met (ticked above).
- §D verified: PageCard live variant set `default|flush|fill`
  (`PageCard.tsx:48`); consumers correct.
- Links: `markdown-check-link` clean on both docs.
- **Firewall held**: only canonical A6 fixed; method/coverage findings
  logged (defer-to-close).
- **Target-aware pass applied**: no `(future)`/horizon state mis-scored
  as drift.

## Act

**Two earlier framings corrected this round — the real headline:**

1. **"Conformance tracks doc age" is REFUTED.** `workspace-shell.md` (R07,
   the *oldest* audited) is the *most* conformant — A3 gold-standard, §B
   clean. The laggards (datasets R14, workspaces R11) were *un-maintained*,
   not merely old. Real variable: **maintenance / author-care**.
   Close-triage by conformance, not date.
2. **A3 "systematic" was over-stated.** The corpus already holds the
   canonical token-citation pattern — `workspace-shell.md` cites
   `themeTokens.ts` + AntD seed, values informational. **Decide-canonical
   for A3 is resolved**: backfill the 4 non-conformant docs to this model.

**The anticipated method finding landed.** The rubric assumes the
canonical-doc artifact type; A2/A3 are n-a for target docs. The target is
fully conformant *for its type* — the canonical rubric would have falsely
flagged it. Concrete instance of gap #1 / the original revisit-trigger →
at close, the rubric needs an **artifact-type-aware variant** (canonical /
target / preview).

**Systematic cluster** A1/A2/A6 → 5/5 canonical (defer-to-close holds).
**Method-gap** stays 3 instances. **PageCard** coverage logged for the
target's fold-back.

**Disposition**: surface 5 audited (both docs); rubric stable for
canonical, needs a target variant (logged).
**Feeds into → surface 6 (`upload`)**.
