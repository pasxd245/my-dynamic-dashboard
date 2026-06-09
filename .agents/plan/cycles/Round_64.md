# Round 64: Doc-format remediation — `data-management` doc-template + lint (resolves D-1/D-2)

**Status**: Complete
**Date started**: 2026-06-04
**Date completed**: 2026-06-09

## Goal

**Pulled by ← [R63 program close](Round_63.md)** (design-corpus-audit
[program, now Closed](../programs/design-corpus-audit.plan.md)): the
**first promoted Track-2 round**. Establish the **enforced doc-format
standard** for [`.agents/design/data-management/`](../../design/data-management/) —
the durable fix the audit proved is the only thing that kills the systematic
A-cluster (A1/A2/A3/A5/A6 at 7/7; hand-maintenance demonstrably won't, proven
across R56–R62).

Two decisions gate the build (the close carried them here):

- **D-1 — canonical Reusability/Purity vocab.** The Surface-table columns are
  **inconsistent** across 7 surfaces; the README enumerated set is likely the
  stale party. **Decide which is canonical and reconcile.**
- **D-2 — rubric artifact-type variants.** Adopt R60's
  **canonical / target / preview** variants so A2 (acceptance) + A3 (token
  map) aren't falsely flagged on horizon docs; **fold** the A3⇄B6 absent-map
  calibration residual (B6 defers *all* token concern to A3, presence
  included).

_Track: 2 (agent-method / tooling). The lint is code → a build round._

## Flow

To be selected at the Design gate via the **R47 flow-selector** (DCFBI vs
DFCFBI). Likely **DFCFBI** — the lint is a new enforcement artifact with no
prior contract, so an F1 prototype (does a custom rule even flag the
A-cluster?) de-risks before the contract freezes.

## Plan (by gate)

1. **Design** — make the **D-1** + **D-2** calls (investigate README-vocab vs
   live doc usage; pick canonical; reconcile the README; define the 3 rubric
   variants + the A3⇄B6 fold). Specify the **template structure** and the
   **lint rule set** (status lifecycle vocab · token map citing
   [`themeTokens.ts`](../../../workspace/packages/ui/src/themeTokens.ts) ·
   explicit "does NOT cover" section · Surface-table Reusability/Purity from
   the canonical set · user-journeys/acceptance-criteria section).
   **PAUSE here for user ratification of D-1/D-2 before building.**
2. **(C/F/B/I per selected flow)** — author the `data-management` **doc
   template**; implement the **lint** (markdownlint custom rule or a script);
   wire it into the post-round audit. **Prove it**: passes the model
   ([`workspace-shell.md`](../../design/data-management/workspace-shell.md))
   and flags ≥1 known-non-conforming doc.
3. **Integration** — template + lint landed and wired. **Grandfather** the 6
   known-non-conforming canonical docs (lint warns, does not break CI) until
   **R65** backfills them. Apply the `advanced-query` exemplar-status flip
   **only if** a doctrine revision lands here.

## Acceptance criteria

- [x] **D-1 resolved**: docs canonical (README was the stale party); README
      reconciled to the base-token+qualifier model; decision recorded.
- [x] **D-2 resolved**: canonical/target/preview variants defined + encoded in
      the lint; A3⇄B6 absent-map residual folded (token presence is A3's).
- [x] `data-management` **doc template** authored ([`_TEMPLATE.md`](../../design/data-management/_TEMPLATE.md)),
      passes the lint clean (all 5 rules).
- [x] **Lint** enforces A1/A2/A3/A5/A6 ([`scripts/design-doc-lint.mjs`](../../../scripts/design-doc-lint.mjs));
      **passes** `workspace-shell.md` on its model rule (A3/L3) and **flags** the
      A-cluster (15 raw violations; matches the audit gap-log). _Caveat below:
      `workspace-shell.md` is grandfathered on L5._
- [x] Lint **wired** into the post-round audit ([PDCA.md](../PDCA.md) +
      `pnpm design:lint`); known failures **grandfathered** (warn, not block) via
      [`design-doc-lint.baseline.json`](../../../scripts/design-doc-lint.baseline.json)
      pending R65. _Actual grandfathered count = 8 docs, not the predicted 6 —
      see Check._
- [x] Flow recorded (DFCFBI; selector N/A for a tooling round) in the Do log.

## What is OUT of scope

- **Backfilling** the 6 non-conforming docs → **R65** (applies this template).
- The **doc↔source-of-truth parity linter** → **R66** (independent).
- Any **UX/a11y** remediation (firewall — feature-backlog rounds).
- Reconciling README vocab **outside** `data-management` design docs (note
  ripple if found; don't widen scope here).

## Risks / unknowns

- **D-1 ripple**: reconciling the README enumerated set may touch design docs
  beyond `data-management`. Mitigation — scope the *fix* to data-management;
  log any wider drift for a follow-on.
- **Lint scope creep**: enforcing 5 conventions in one rule set is broad.
  Mitigation — one rule per convention; grandfather existing failures so CI
  isn't broken before R65.
- **Custom-rule mechanism**: markdownlint custom rules vs a standalone script
  — decide at Design (F1 prototype de-risks).

---

> **PAUSED for review at the Plan gate.** Confirm this plan and make the
> **D-1/D-2** calls (or authorize resolving them at the Design gate) before
> the Do-phase runs. Do / Check / Act are filled once the round executes.

## Do

### Design phase — D-1/D-2 investigation (2026-06-08)

Evidence gathered by extracting the Surface-declaration tables + token-map
sections from all 9 `data-management` docs (8 canonical + 1 target).

#### D-1 — canonical Reusability/Purity vocab (investigation)

**README enumerated sets** ([README § File-format conventions](../../design/README.md)):

- Reusability: `shared cross-domain` · `domain-only` · `builder-only` · `one-off`
- Purity: `plain-UI` · `glue` · `data constant` · `feature`

**Live doc usage (de-facto), Reusability column:** `feature` (9/9 docs) ·
`builder-only` (8) · `backend` (5) · `shared cross-domain` (3) · `data type`
(7) · `shared` (1 — `crud-hygiene`, a drift of `shared cross-domain`).

**Live doc usage (de-facto), Purity column:** `plain-UI` · `glue` (+ qualifiers
`(server-data)`, `(router-aware)`, `(AntD Popover + draft state)`) ·
`data constant` · `feature` · `data type` · `pure (data)` / `pure (no react…)`
· `plain-UI (data-shaped)`.

**Finding — the README is the stale party.** The docs are *internally
consistent* across 7+ surfaces on a richer vocabulary than the README
enumerates: Reusability is used as a **layer/role** axis (`feature` ≈
domain-feature code, `backend`, `builder-only`, `shared cross-domain`,
`data type`), and Purity as the **BIZ-boundary** axis (with optional
`(qualifier)`). README's `domain-only`/`one-off` are essentially unused
(docs picked `feature` for the domain-feature case); `feature`/`backend`/
`data type` are load-bearing but absent from the README list.

**A lintable canonical model emerges — "base token + optional `(qualifier)`":**
the value before any `(…)` must be in the canonical base set; the
parenthetical is freeform annotation.

- **Reusability base set (canonical):** `shared cross-domain` · `feature` ·
  `builder-only` · `backend` · `data type`
- **Purity base set (canonical):** `plain-UI` · `glue` · `data constant` ·
  `feature` · `data type` · `pure`
- **Drift to normalize in-round:** `crud-hygiene.md` bare `shared` →
  `shared cross-domain` (one cell).
- **README reconcile:** enumerate the above base sets + the base+qualifier
  rule; deprecate unused `domain-only`/`one-off` (or map `domain-only`→
  `feature`). _Scope the README fix to what `data-management` uses; log wider
  ripple, don't chase it (per round risk note)._

#### D-2 — rubric artifact-type variants + A3⇄B6 fold (resolution)

Adopt R60's three artifact-type variants (the lint reads the doc's type):

- **canonical** (`<concept>.md`): full rubric — A1–A6 all apply; token map (A3)
  and acceptance criteria (A2) **required**.
- **target** (`<concept>.target.md`): A2 + A3 are **n-a**; instead require the
  TARGET-NOT-CURRENT banner, `(future)`-marked Surface rows, named-pulls table,
  and lifecycle/retire clause. A6 status = `Target horizon`.
- **preview** (`<concept>.preview.html`): out of the markdown lint's scope
  (HTML visual aid); README already governs its header/banner/token-parity.

**A3⇄B6 fold:** B6 (Desirability) defers **all** token concern to A3 —
*presence included*, not just the citation detail. When a token map is absent,
**only A3 fires**, never B6 (kills the R58/R59 double-count on the absent-map
case). B6 scores Desirability via its other affordances only.

### Proposed template + lint spec (built on the calls above)

**Canonical doc-template sections (1:1 with the 5 lint rules):**

1. **Status header** (A6) — `Status: <draft|accepted|superseded> (R<NN> design;
   shipped R<…>; …)`.
2. **Surface-declaration table** (A1) — `Surface · Layer · Reusability · Purity
   · Allowed peer deps`; Reusability/Purity base token ∈ canonical set.
3. **Token map** (A3) — present; each row cites `themeTokens.ts` or an AntD
   seed token; inline values informational only, never the cited source
   (the `workspace-shell.md` model).
4. **Scope boundary** (A5) — explicit "does NOT cover / out of scope".
5. **User journeys + acceptance criteria** (A2) — testable criteria section
   (the `advanced-query.md` C1–C17 shape).

**Lint rule set — one rule per convention, artifact-type-aware:**

| Rule | Gap | Checks | target-doc behavior |
| ---- | --- | ------ | ------------------- |
| L1 | A6 | status header present + matches lifecycle-vocab pattern | status = `Target horizon` |
| L2 | A1 | Surface table present; Reusability+Purity base tokens ∈ canonical set | rows may be `(future)` |
| L3 | A3 | token-map present; rows cite `themeTokens.ts`/AntD seed; flag inline-as-source | **skipped (n-a)** |
| L4 | A5 | explicit out-of-scope / "does NOT cover" section present | applies |
| L5 | A2 | acceptance-criteria section present | **skipped (n-a)**; require named-pulls + retire clause instead |

**Mechanism (round risk to settle):** recommend a **standalone Node script**
over a markdownlint custom rule — these are section-presence + table-cell-vocab
structural checks, not line-style lint, and a script is far simpler for
"section X must exist / cell ∈ set". An F1 prototype (DFCFBI) confirms a custom
rule can even flag the A-cluster before the contract freezes.

**Proof obligation (acceptance):** lint **passes** `workspace-shell.md` (the
model) and **flags** ≥1 known-non-conforming doc (e.g. `datasets.md`/
`workspaces.md` — absent token map → L3; `upload.md` — A1 vocab + absent map).

> **PAUSED at the Design gate for D-1/D-2 ratification** (these change the
> README + normalize a doc cell). On ratification: run the R47 flow-selector,
> reconcile the README, then build the template + lint.

#### Ratification (user, 2026-06-08)

- **D-1 → Docs canonical, fix README.** Adopt the de-facto base sets with the
  "base token + optional `(qualifier)`" rule; reconcile the README; normalize
  `crud-hygiene.md` `shared` → `shared cross-domain`.
- **D-2 → Adopted** (R60 canonical/target/preview variants + A3⇄B6 fold as
  specified above).
- **Lint mechanism → standalone Node script** (not a markdownlint custom rule).

**Flow** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

The R47 **2-of-5 flow-selector does not apply** — it measures *product UX*
risk (interactive states, new interaction patterns, user-error cost, UX
confidence), and this is a **Track-2 tooling round** with no UI surface. The
flow-selector skill itself excludes process/docs/tooling rounds.

The phase chain is set directly from the build's own risk: the lint is a **new
enforcement artifact with no prior contract**, and the **custom-rule mechanism
is unproven** (can a script actually flag the A-cluster?). An **F1 prototype**
de-risks this before the C phase freezes the rule-set contract.

Result: **Flow: DFCFBI** — justified by mechanism de-risking, not the UX
selector.

## Check

**Verification evidence (2026-06-08):**

- `pnpm design:lint` (corpus) → **exit 0**, 14 grandfathered warnings across
  9 docs, target doc passes clean.
- Template (`_TEMPLATE.md`) linted explicitly → **0 violations** (proves the 5
  rules are jointly satisfiable; the R65 backfill model).
- **Regression guard proven**: a synthetic new concept doc with gaps → 5 errors,
  exit 1; an injected off-canonical Reusability cell in `workspaces.md` → L2
  **error** (its L3/L5 stay grandfathered — the baseline is per-(doc, rule)).
  Both reverted.
- `markdownlint-cli2` repo-wide → **0 errors** (154 files).
- `check_links.py --changed` → **exit 0** (after fixing a placeholder
  `Round_NN.md` link in the template).

**Lint↔audit cross-check (the F1 de-risk paid off):** the lint reproduces the
closed audit's gap-log almost exactly — L2 flags *only* the `crud-hygiene`
`shared` drift D-1 named; L4 flags *only* `datasets` + `upload` (the audit's
A5 "5 of 7" finding); L5 flags all 7 audited docs, passing `advanced-query`
(A2 7/7 systematic). The mechanism question DFCFBI raised is answered: a Node
script flags the A-cluster cleanly.

**Honest divergences from the plan (for review):**

1. **Grandfathered = 8 docs, not the predicted "6."** Two extra fall out of
   strict 5-rule enforcement: **`advanced-query.md`** (the gold-standard
   exemplar) has **no token map** → fails L3; **`workspace-shell.md`** (the A3
   model) has **no acceptance-criteria section** → fails L5. No single shipped
   doc passes all five — A2 is 7/7 systematic and A3 is absent on the exemplar.
2. **"Passes `workspace-shell.md`" is true only per-rule.** It passes its model
   rule (L3 token map) but is grandfathered on L5. The acceptance criterion's
   "passes the model" is satisfied for A3 specifically, not all-five.
3. **L3 is intentionally more lenient than the audit's strict A3 reading.** It
   accepts a token map citing `themeTokens.ts` *or* an AntD seed token — so
   `dataset-filters.md`/`dataset-detail.md` (which cite via a `tokens.css`
   mirror + AntD seed) **pass** L3, where the gap-log treated only
   `workspace-shell.md` as the sole A3 pass. This matches the **README** wording
   ("a CSS variable or AntD seed token … never inline"), which D-1 made
   canonical. Flagged so R65 can tighten to themeTokens.ts-only if desired.
4. **L4 is coarse**: it checks for an explicit scope/out-of-scope *heading*, not
   the finer covered/deferred/**out** tripartite the audit scored. Gross absence
   is caught (`datasets`/`upload`); the nuance is left to manual review.
5. **`advanced-query` exemplar-status flip** (Plan step 3, conditional on a
   doctrine revision landing): a revision **did** land (README + variants), and
   the lint shows the exemplar is non-conformant on A3. **Not acted on** —
   flagged as a follow-on judgment (R65 or a doctrine note), out of this round's
   firewall.

## Act

**Landed this round:**

- **D-1/D-2 ratified + recorded** (docs-canonical vocab; artifact-type variants;
  A3⇄B6 fold).
- [`.agents/design/README.md`](../../design/README.md) — canonical
  Reusability/Purity base sets + base-token+qualifier rule (D-1 reconcile).
- [`_TEMPLATE.md`](../../design/data-management/_TEMPLATE.md) — conforming
  canonical doc-template (5 sections).
- [`scripts/design-doc-lint.mjs`](../../../scripts/design-doc-lint.mjs) +
  [`design-doc-lint.baseline.json`](../../../scripts/design-doc-lint.baseline.json)
  — artifact-type-aware conformance lint with per-(doc, rule) grandfather baseline.
- [`crud-hygiene.md`](../../design/data-management/crud-hygiene.md) — `shared`
  → `shared cross-domain` (the one in-scope L2 fix).
- Wiring: `pnpm design:lint` script + [PDCA.md](../PDCA.md) post-round audit bullet.

**Feeds into → R65** (conformance backfill — not yet drafted): apply the
template to the 8 grandfathered docs — add token maps (the absent-map cluster +
`advanced-query`), acceptance-criteria sections (all 7), the 2 missing scope
sections (`datasets`/`upload`); remove each baseline entry as it is fixed.
Carries two judgment calls surfaced here: (a) tighten L3 to `themeTokens.ts`-only
or keep the README's CSS-variable-or-seed allowance; (b) resolve `advanced-query`
exemplar status given its A3 non-conformance. **R66** (parity linter) unchanged.

> **Complete (2026-06-09).** Build self-audited (lint/markdownlint/links all
> green) and **user-audited → ratified**. Committed. Feeds → R65 (backfill).
