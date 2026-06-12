# Round 63: Design-corpus audit — **program close** (triage + fold)

**Status**: Complete
**Date started**: 2026-06-04
**Date completed**: 2026-06-04

## Goal

**Inherits from ← [Round_62](Round_62.md)** (final surface audited): execute
the **program close** of the
[design-corpus conformance audit](../programs/design-corpus-audit.plan.md).
All 7 surfaces are audited (R56–R62); the
[close-triage agenda](Round_62.md#close-triage-agenda-drafted-the-program-close-step-executes-it)
is drafted. This round **decides + sequences** that agenda into a backlog of
Track-2 rounds and **folds** the program plan — it does **not** execute the
promoted work.

_Track: 2 (agent-method). Pulled by: design-corpus-audit program reaching
close (R62 disposition: "**Feeds into → program close**")._

## What "close" is (and is not)

The program close is a **triage + decision** step, not a build. Its output is:

1. **Decisions** on the two open forks the audit surfaced (below).
2. A **sequenced backlog** — the 7 drafted agenda items turned into ordered,
   scoped Track-2 round stubs (each its own future round, per cadence).
3. The program plan **folded** into a closing note / decision artifact and its
   status flipped to **Closed**.

It does **NOT** write the doc-template, build parity tooling, backfill token
maps, or run the deferred UX rounds — those are the promoted rounds.

**Decision (2026-06-04, user):** the remaining **format cluster**
(A1 vocab / A2 acceptance / A3 token maps) is **NOT hand-fixed in close** — it
is fixed as the *template-conformance pass* inside the promoted template+lint
round, after **D-1/D-2** are decided and the `workspace-shell.md` model is the
backfill target. Rationale: the audit proved 7/7 that per-doc hand-maintenance
does not stick without a lint, and A1 is blocked on D-1. The **correctness**
drifts (name-length, `resourceLabel`, id-format, 422 prose, `/batch`, A6
headers) were already fixed in-round R56–R62 — nothing factually-wrong is left
unfixed. Decision-independent stragglers (2× missing A5 "out" sections, stale
DuckDB backend-stub illustration, `WorkspaceCard` `@mdd/ui` name verify) fold
into their relevant promoted round, not a standalone fix.

## Decisions required at close (the two forks)

These are the "**decide first**" calls the agenda flagged — they gate the
template work and need a user call at review:

- **D-1 (A1 vocab — README vs docs):** the Reusability/Purity columns are
  **inconsistent** across 7 surfaces; README likely the stale party. Decide
  which is canonical before a lint can enforce it. _(Agenda #1.)_
- **D-2 (rubric artifact-type variants):** adopt R60's canonical / target /
  preview variants (so A2+A3 aren't falsely flagged on horizon docs) and fold
  the absent-map A3⇄B6 calibration residual. _(Agenda #3 + #5 residual.)_

## Plan

1. **Triage** the 7 drafted agenda items into: **promote** (own Track-2
   round), **fold-in** (handle inside another promoted round), or **defer**
   (feature-round backlog, firewalled). Record disposition per item.
2. **Sequence** the promoted items into ordered round stubs with a one-line
   scope + dependency note each (e.g. D-1 decision precedes the
   template+lint round; rubric variants precede the token-map backfill).
3. **Fold** the program plan: write the closing note (what the audit proved —
   the 7/7 systematic A-cluster, the 4-instance doc-mirror method-gap, the
   "format-convention not upkeep" finding), promote the rolling gap-log's
   recurring rows, flip program **Status → Closed**.
4. **Cross-refs**: update the program plan's Lifecycle section to point at the
   sequenced backlog; confirm `markdown-check-link` clean.

## Acceptance criteria

- [x] Each of the 7 agenda items has a recorded disposition (promote / fold /
      defer) with a one-line rationale.
- [x] Promoted items are sequenced as scoped Track-2 round stubs with
      dependencies noted.
- [x] D-1 and D-2 forks resolved (or explicitly carried into a named first
      round with the decision as its goal). → **carried into R64** (the
      template round's Design gate) per the "or" branch.
- [x] Program plan folded: closing note written, recurring gap-log rows
      promoted, **Status → Closed**.
- [x] Links clean (`markdown-check-link`); no broken cross-refs after the fold.

## What is OUT of scope

- **Executing** any promoted item (template+lint, parity tooling, token-map
  backfill, the deferred UX/a11y rounds) — each is its own round.
- **Re-auditing** any surface (all 7 done) or re-opening the rubric for
  calibration beyond the D-2 artifact-type decision.
- Redesigning any UX (firewall holds through close).

## Risks / unknowns

- **Over-bundling:** the close itself could balloon into doing the template.
  Mitigation — the close **only decides + sequences**; the firewall + cadence
  hold (one feature per round).
- **D-1/D-2 need a user call:** if unresolved at review, carry them as the
  explicit goal of the first promoted round rather than guessing.

---

> **PAUSED for review at the Plan gate.** Per "one feature per round, pause at
> review to confirm/fix": confirm this close plan (and make the D-1/D-2 calls)
> before the Do-phase runs. Do / Check / Act are filled once the round
> executes.

## Do

**Flow**: program close — **triage + sequence + fold**. Not a DCFBI build.
D-1/D-2 **carried into R64** (the template round's Design gate) per the
acceptance "or" branch — not guessed here.

### Triage — the 7 drafted agenda items

| # | Agenda item | Disposition | Rationale |
| - | ----------- | ----------- | --------- |
| 1 | Doc-template + lint (A-cluster fix) | **promote → R64** | highest-value; kills A1/A2/A3/A5/A6 systematically (hand-maintenance proven not to, 7/7); its Design gate resolves D-1 + D-2 |
| 2 | Doc↔source-of-truth parity tooling | **promote → R66** | the 4-instance doc-mirror method-gap; independent of the template thread |
| 3 | Rubric artifact-type variants (R60) + A3⇄B6 residual | **fold → R64 Design** | = **D-2**; the template's Design gate decides which artifact types get A2/A3 |
| 4 | Token-map backfill (6 docs) | **promote → R65** | the deferred **format-cluster conformance pass**; needs R64's template + the `workspace-shell.md` model to backfill against |
| 5 | Coverage gaps (`PageCard` doc, `WorkspaceCard` name, stale stub) | **fold → R65** | decision-independent stragglers; R65 already touches every doc |
| 6 | Deferred UX/a11y feature rounds (B3, 422, list loading) | **defer → feature backlog** | product/UX — different track; firewall holds, each is its own feature round |
| 7 | Fold program plan (+ exemplar flip) | **done here (R63)** | the close action; the `advanced-query` exemplar-status flip is **conditional** — carried to R64, only if a doctrine revision lands |

### Sequenced backlog (Track-2)

1. **R64 — `data-management` doc-template + markdown lint.** Design gate
   resolves **D-1** (README-vs-docs canonical vocab — reconcile the README)
   and **D-2** (adopt R60 canonical/target/preview rubric variants; fold the
   A3⇄B6 absent-map residual). Then build the template + lint enforcing:
   status lifecycle vocab, a token map citing `themeTokens.ts`, an explicit
   "does NOT cover" section, Surface-table Reusability/Purity from the README
   enumerated set, a user-journeys/acceptance-criteria section.
   _Deps: none (first)._ Folds in agenda #1, #3, #7-conditional.
2. **R65 — Template-conformance backfill.** Apply the R64 template to the 6
   non-conforming canonical docs; backfill A3 token maps against the
   `workspace-shell.md` model; add the 2 missing A5 "out-of-scope" sections;
   fold the coverage stragglers (`PageCard` `fill` variant, `WorkspaceCard`
   `@mdd/ui` name verify, stale DuckDB backend-stub illustration in
   `workspaces.md`). **This is where the deferred format cluster is fixed.**
   _Deps: R64._ Folds in agenda #4, #5.
3. **R66 — Doc↔source-of-truth parity linter.** A doc-fence linter that checks
   fenced snippets citing a named constant/contract against the live value
   (guards the 4-instance doc-mirror gap: R56 FE-type, R57 contract-prose,
   R59 id-format, R62 name-length). _Deps: none (parallel-OK)._ Folds in
   agenda #2.
4. **Feature backlog (deferred — product track, not Track-2):** the firewalled
   B3 a11y cluster (icon-only triggers, color-only danger, chip/SR names),
   the 422 FE surface, list-page loading/fetch-error states. Each is its own
   **feature** round.

### Fold

- Closing note written (Act below + program-plan close section).
- Recurring gap-log rows promoted — mapping table added to the program plan.
- Program plan **Status → Closed**.

## Check

- All **7** agenda items dispositioned (table above): 2 promote, 2 fold,
  1 defer, 1 done-here, 1 fold (+ conditional flip).
- Promoted items sequenced with deps: **R64 → R65** (template precedes
  backfill); **R66** independent (parallel-OK).
- **D-1/D-2** explicitly carried into R64's Design gate (acceptance "or"
  branch) — not guessed at close.
- Program plan folded: closing note + promotions table written;
  **Status → Closed**; Lifecycle points at the backlog.
- `markdown-check-link` clean (no broken cross-refs after the fold).
- **Firewall held through close**: no UX redesign; the format cluster was
  *not* hand-fixed (deferred to R65 per the 2026-06-04 user decision).

## Act

**The design-corpus conformance audit is closed.** Across 7 surfaces
(R56–R62) it proved three things and converted them into a 3-round Track-2
backlog:

1. **The A-cluster is systematic, not incidental — and format-convention
   adherence, not content upkeep, is the variable.** A6 7/7, A2 7/7, A1 7/7;
   A3 6/7 absent (+ `workspace-shell.md` the lone model); A5 inconsistent
   (5/7). Heavily-maintained docs (`upload.md`, `crud-hygiene.md`) still fail
   format — so per-doc hand-maintenance demonstrably won't fix it. **→ R64
   template + lint** is the only durable fix; **R65** applies it.

2. **Doc↔source-of-truth drift appears exactly where no parity test guards —
   4 instances** (R56 FE-type, R57 contract-prose, R59 id-format, R62
   name-length). R58's dtype mirror did *not* drift precisely because a test
   asserts it. **→ R66 parity linter** extends parity coverage to
   doc-declared claims.

3. **The rubric itself assumes a new-build, canonical-doc artifact type**
   (gap #1; R60's target-doc instance). **→ R64 D-2** adds artifact-type
   variants so horizon docs aren't falsely flagged.

**Firewall verdict: held across R56–R63.** Every audit round emitted only
doc-conformance fixes in-round + logged UX/product gaps; no redesign leaked
in. The correctness drifts were all fixed in-round; the **format** cluster is
the only deferred doc work, and by decision (2026-06-04) it is fixed once via
the R65 template pass — not hand-patched.

**Disposition: program CLOSED.** Backlog promoted: **R64** (template+lint,
resolves D-1/D-2) → **R65** (conformance backfill) ; **R66** (parity linter,
independent) ; feature backlog (B3 a11y / 422 / list-loading) deferred to
product-track rounds. **Next pull → R64.**

---

## Feeds into → Round_64

> **Correction (2026-06-12, appended by [R67](Round_67.md) round-lint
> backfill).** This Complete round predates `plan:lint` enforcement and
> shipped without the template's outbound `Feeds into →` section — its
> successor was named only inline as "Next pull → R64" above. Appended
> here for conformance; the round history above is unchanged
> (append-only governance).

R63 hands forward to **[Round_64](Round_64.md)** the design-corpus
audit's program-close disposition: the doc-format remediation backlog
(template + lint, resolving D-1/D-2). R64 picks it up via its
`Pulled by ← R63 program close` cross-link.
