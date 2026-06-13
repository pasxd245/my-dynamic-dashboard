# Round 62: Design-corpus audit — surface 7, `crud-hygiene` (the last)

**Status**: Complete
**Date started**: 2026-06-01
**Date completed**: 2026-06-04

## Goal

**Inherits from ← [Round_61](Round_61.md)**: audit the **final** surface
of the **design-corpus conformance audit**
([program plan](../programs/design-corpus-audit.plan.md)) —
[crud-hygiene](../../design/data-management/_shared/crud-hygiene.md) — against the
**stable rubric**. After this round the program reaches **close**, where
the deferred findings are triaged.

_Track: 2 (agent-method). Pulled by: design-corpus-audit program, surface
7 (last) + R61 completion._

## Flow (audit reframe — see program plan)

Not a delivery chain — `crud-hygiene` is already shipped (R23+). **D** =
does the doc conform to gate + README format; **C/F/B/I** = verify the
shipped FE still matches the doc. Depth = doc-conformance **+ one** §D
spot-verify (decision #2).

## Why `crud-hygiene` last

It is the **cross-cutting shared affordance** — the rename + delete modals
(`RenameModal` / `DeleteConfirmModal`, `resource`-prop driven) that the
*page* surfaces **reuse**: `datasets.md` (R23), `dataset-detail.md`
(header actions), `workspaces.md` all cite it as the source of those
modals. Auditing it last checks the **shared CRUD vocabulary** from the
provider side, after all its consumers have been audited — the mirror of
how R58 (`datasets`) closed the dtype loop. §C is the main axis: do the
consumers reference `crud-hygiene`'s affordances consistently?

## Plan (by gate)

1. **Design (audit)** — rubric §A (vertical) + §B (`ui-design`,
   hardened). Record per-item pass/gap. Check A3 against the R60 model.
2. **Contract/FE/BE (verify)** — §C (horizontal: the shared
   rename/delete vocabulary + `resource` prop vs the consuming docs;
   cross-links via `markdown-check-link`) + §D (spot-verify one
   highest-risk claim — candidate: the `RenameModal`/`DeleteConfirmModal`
   prop contract or the mutation-hook names vs the live components).
3. **Integration** — fold findings into the gap-log; apply in-round
   **doc-conformance fixes only**; **log** UX/product gaps (firewall).
   **Confirm + bump** the systematic cluster (A1/A2/A6 → 7/7 expected).
4. **Method-gap watch** — record whether the doc↔source-of-truth mirror
   gap recurs (still 3 instances after R61).

## Acceptance criteria (Design-gate exit for this round)

- [x] Rubric §A–§D run against `crud-hygiene`; per-item pass/gap recorded.
- [x] `ui-design` design-spec facet report attached (hardened B6).
- [x] §C horizontal (shared CRUD vocab vs consumers) + one §D
      spot-verify executed.
- [x] Findings appended to the [program gap-log](../programs/design-corpus-audit.plan.md);
      "Seen in" bumped on any recurring gap.
- [x] In-round doc fixes applied; UX/product gaps logged (not fixed);
      method-gap-watch verdict recorded.
- [x] **Program-close readiness recorded**: the Act drafts the close-triage
      agenda (what the program promotes / decides at close).

## What is OUT of scope

- Redesigning the rename/delete UX (firewall — defer to a feature round).
- Auditing any other surface (all 6 others done).
- **Remediating the systematic A1/A2/A3/A6 cluster** — deferred to
  program close per the [Lifecycle](../programs/design-corpus-audit.plan.md#lifecycle)
  (2026-06-01 decision). Confirm + bump only.
- **Executing** the close-triage — R62 *drafts* the agenda; the actual
  promotions/decisions are the program-close step (its own round(s)).
- Re-opening the rubric for calibration (settled R56; variants logged).

## Risks / unknowns

- **Shared-affordance doc** — `crud-hygiene` is consumed by 3 page docs;
  §C may surface reference inconsistencies (modal prop names, mutation
  hooks, toast wording) more than vertical gaps. Judge by conformance,
  not age (R60/R61).
- **Audit→redesign creep** — firewall is the mitigation.

---

> **PAUSED for review at the Design gate.** Per "one surface per round,
> pause at review to confirm/fix": confirm this plan before the audit
> Do-phase runs. Do / Check / Act below are filled once the round
> executes. **This is the last surface — the Act sets up program close.**

## Do

**Flow**: audit reframe. Stable rubric. `crud-hygiene` is the **shared
CRUD provider** — §C (provider side, after all 3 consumers audited) is
the main axis.

### §A — Vertical conformance

- **A1** Surface table — **gap (7/7 systematic)**: Reusability uses
  `shared`/`feature`/`backend` (README set: `shared cross-domain`/
  `domain-only`/`builder-only`/`one-off`); Purity `glue (server-data)`
  is a qualified variant. `builder-only` + `plain-UI` are README-valid.
- **A2** Design-gate exit — **gap (7/7 systematic)**: no explicit
  user-journeys / testable-acceptance section. Substitutes a rich R23
  HIxAI Q&A decision table — good provenance, not testable criteria.
- **A3** Token map — **gap (absent)**: no token map at all → **6 of 7**
  gap; only `workspace-shell.md` passes (the model). Despite heavy
  maintenance (R30/R32/R33) → format-convention, not upkeep.
- **A4** ASCII + behavior — **pass**: the corpus's **richest layout
  doc** — 2 surface ASCII + 6 modal-state ASCII (rename, delete dataset,
  delete workspace empty, blocked-409, in-flight, name-taken) with
  state transitions.
- **A5** Scope boundary — **pass**: strong "Out of scope (deferred with
  named triggers)" section + "Resource scope of rename". → A5 is **5 of
  7 have it** (gap only `datasets.md`/`upload.md`).
- **A6** Status header — **gap → fixed in-round (7/7)**: "Draft (Round
  23 design-only)" → "Accepted (R23 design; shipped R24–R26; extended
  R30/R32/R33)".

### §B — UX-honeycomb (hardened) — GAP (2 facets)

Findability **pass** (always-visible `⋮`, explicitly "discoverability
over visual cleanliness") · Usability **pass** (pessimistic loading,
ESC/click-outside rules, auto-select, error-clears-on-change) ·
Accessibility **gap** (icon-only `⋮` trigger no accessible-name/keyboard
declared; Delete destructiveness = red color only) · Credibility
**pass** — **best-in-corpus failure-state spec**: 409 `name_taken`
inline, `non_empty` blocked modal with BE-authoritative count
("never trusts its own cached count"), 404 idempotent toast, **loading
state explicitly declared** (modal state 5) · Utility **pass** ·
Desirability **gap** (no token map = A3; absent-map → B6 also fires,
the logged R58/R59 calibration residual).

### §C — Horizontal (shared CRUD vocab vs the 3 consumers)

- **C1 mostly pass**: the 4 mutation-hook names, the `ApiError` code
  set (`not_found`/`name_taken`/`non_empty`), the FE-branch mapping, and
  the "three shared modals" claim all agree with the live `_shared/`
  (`RenameModal`/`DeleteConfirmModal`/`BlockedDeleteModal`). **One
  gap**: the dataset name-length declaration (see §D).
- **C4 gap (consumer citation)**: `dataset-detail.md` cited the modal
  prop as `resource="dataset"`; the live prop is `resourceLabel`
  (`resource` is the internal *translated* string). `crud-hygiene.md`'s
  own prose ("parameterized by resource label") is accurate. **Fixed
  in-round** in the consumer doc (×2).
- **C2 / C3 pass**: `markdown-check-link` clean — **14/14 links
  resolve**.

### §D — Spot-verify (modal prop contract + name-length) — fixed in-round

Highest-risk claim picked: the shared-modal prop contract + the
`RenameBody` shape vs the live components/constants.

- ✅ Hooks: `useRename/DeleteWorkspace/DatasetMutation` — all 4 exist
  exactly as declared.
- ✅ Modals: `RenameModal` + `DeleteConfirmModal` + `BlockedDeleteModal`
  = the doc's "three shared modals".
- ❌ **Name length drift**: doc declares a single shared
  `RenameBody(max_length=80)` + "1-80 characters" for **both**; live
  splits per-resource — workspace **80** / dataset **120** — via
  `RenameWorkspaceBody`/`RenameDatasetBody`, sourced from R29's
  `NAME_LENGTHS` (`WORKSPACE_MAX=80`/`DATASET_MAX=120`), which the
  contract (`datasets/patch` maxLength 120), FE Form rules, and BE
  bodies all cite. Dataset-120 has held since **R15** `dataset.yaml`.
  → **fixed in-round** (snippet now shows per-resource limits + cites
  `NAME_LENGTHS` as the source of truth).

### Fixes applied in-round (firewall)

1. A6 status header (`crud-hygiene.md`).
2. §D/C1 `RenameBody` per-resource length + `NAME_LENGTHS` citation
   (`crud-hygiene.md`).
3. C4 consumer prop citation `resource=` → `resourceLabel=` ×2
   (`dataset-detail.md`).

### Logged, NOT fixed (firewall)

- Systematic cluster A1/A2/A6 → **7/7**; A3 → **6 of 7** absent/non-conf
  (+ `workspace-shell.md` model); A5 confirmed **inconsistent** (5 of 7
  have it).
- B3 a11y (icon-only `⋮` trigger; Delete-by-color).

### Method-gap-watch verdict

**RECURRED — 4th instance.** The `RenameBody max_length=80` snippet is
an unguarded doc-mirror that drifted from the live split + `NAME_LENGTHS`
constant. `NAME_LENGTHS` (R29) guards code↔code (BE/FE/contract) but not
doc↔code. Bumped **3 → 4 instances** in the gap-log; firmly a Track-2
candidate for program close.

## Check

- Acceptance criteria: all six met (ticked above).
- §D verified against live: 4 hooks + 3 modals exist; name-length split
  confirmed at `dataset.yaml:41` (120), `_generated/constants.ts:37-38`
  (`NAME_LENGTHS`), backend `RenameWorkspaceBody`/`RenameDatasetBody`.
- Links: `markdown-check-link` clean (14/14, broken.md empty).
- **Firewall held**: 3 doc-conformance fixes (A6, length snippet, prop
  citation); format/UX gaps logged for close.

## Act

**Provider-side audit confirmed the shared CRUD vocabulary is sound.**
The 4 hooks, the error-code set + FE-branch mapping, and the three-modal
shape all match the live `_shared/`. The single real drift was a
**downstream-decision-never-stamped**: dataset names widened to 120 (R15
spec → R24 contract → R29 `NAME_LENGTHS`) but `crud-hygiene.md` (R23)
still declared the original `max_length=80` for both. Same class as
R56/R57/R59 — a doc-mirror with no parity guard. **The method-gap is now
at 4 instances and is the strongest close-promotion candidate.**

**The "format-convention, not upkeep" finding holds at 7/7.**
`crud-hygiene.md` is heavily maintained (R30/R32/R33 stamps) yet still
fails A1/A2/A3/A6 — exactly R61's `upload.md` pattern. Authors maintain
*substance*, never revisit *format*. Only a template + lint fixes it.

**Cluster tally after all 7 surfaces (program complete):** A6 7/7 (all
fixed in-round) · A2 7/7 · A1 7/7 · A3 6/7 gap + 1 model
(`workspace-shell.md`) · A5 inconsistent (5/7 have explicit *out*).
Doc-mirror method-gap **4 instances**. Firewall intact across R56–R62.

---

### Close-triage agenda (drafted — the program-close step executes it)

The program reaches **close** next. Close is its own round(s); R62 only
sets the table. Promote / decide:

1. **Doc-template + lint (the systematic A-cluster fix).** Highest-value
   promotion. A single `data-management` doc template + a markdown lint
   enforcing: (a) status lifecycle vocab, (b) a token map citing
   `themeTokens.ts` (the `workspace-shell.md` model), (c) an explicit
   "does NOT cover" section, (d) Surface-table Reusability/Purity from
   the README enumerated set, (e) a user-journeys/acceptance-criteria
   section. Kills A1/A2/A3/A5/A6 in one stroke; per-doc maintenance
   demonstrably does not (proven 7/7). **Decide first**: is the README
   vocab or the docs the stale party (A1)? Likely README — reconcile it.
2. **Doc↔source-of-truth parity tooling (the method-gap, 4 instances).**
   Extend parity coverage to doc-declared contract/identifier/constant
   claims (R56 FE-type, R57 contract-prose, R59 id-format, R62
   name-length). Mechanism proven: drift appears exactly where no parity
   test guards. Candidate: a doc-fence linter that checks fenced
   snippets citing a named constant/contract against the live value.
3. **Rubric artifact-type variants (R60).** Canonical / target / preview
   variants so A2+A3 aren't falsely flagged on horizon docs; fold the
   absent-map A3⇄B6 calibration residual in (B6 defers *all* token
   concern, presence included).
4. **Backfill the A3 token maps** on the 6 non-conforming canonical docs
   against the `workspace-shell.md` model.
5. **Coverage gaps to resolve:** `PageCard` has no canonical doc (`fill`
   variant lives only in frozen `workspace-shell.target.md`);
   `WorkspaceCard` `@mdd/ui` name open-question (R13 — verify shipped
   name); stale backend-stub illustration in `workspaces.md`.
6. **Deferred UX/a11y feature round(s):** the firewalled B3 cluster
   (icon-only triggers, color-only danger, chip/SR names), 422-surface,
   loading/fetch-error on list pages. Each is its own feature round.
7. **Fold this program plan** into a closing note or a decision artifact;
   flip `advanced-query` exemplar status if a doctrine revision lands.

**Disposition**: surface 7 audited — **all 7 done**. The
design-corpus conformance audit is functionally complete; **program
close** (executing the agenda above) is the next pull.
**Feeds into → program close.**
