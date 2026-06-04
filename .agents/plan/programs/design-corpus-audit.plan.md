# Program plan: Design-corpus conformance audit

**Status**: Active (all 7 surfaces audited — R56–[R62](../cycles/Round_62.md); `crud-hygiene` was the last → **program close** is the next step, triage agenda drafted in [R62 Act](../cycles/Round_62.md#act))
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
  inline values). _Token-conformance owner — B6 defers here (R56 calibration)._
- **A4 ASCII layout + behavior** (state transitions) present where the
  surface warrants.
- **A5 Scope boundary**: covered / deferred / out — explicit.
- **A6 Status header** accurate (concept · round · draft/accepted/superseded).

### B. UX-honeycomb (run `ui-design` design-spec mode)

- **B1–B6** — does the doc **declare** affordances for Findability,
  Usability, Accessibility, Credibility, Utility, Desirability? Record
  the per-facet pass/gap. _B6 (Desirability) checks only that a token
  map is **declared**; the inline-value / source-citation detail is
  **A3's** — B6 does not re-score it (R56 calibration: avoids
  double-counting the same token gap on two axes)._

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
| 1 | `dataset-filters` | audited ✓ | [R56](../cycles/Round_56.md) |
| 2 | `dataset-detail` | audited ✓ | [R57](../cycles/Round_57.md) |
| 3 | `datasets` | audited ✓ | [R58](../cycles/Round_58.md) |
| 4 | `workspaces` | audited ✓ | [R59](../cycles/Round_59.md) |
| 5 | `workspace-shell` (+ `.target`) | audited ✓ | [R60](../cycles/Round_60.md) |
| 6 | `upload` | audited ✓ | [R61](../cycles/Round_61.md) |
| 7 | `crud-hygiene` | audited ✓ | [R62](../cycles/Round_62.md) |

Round 1 (`dataset-filters`) was also the **rubric calibration** — R56
hardened the rubric above (A3⇄B6 token-check dedupe) before surface 2.
The method-gap it surfaced (design-doc code/table mirrors are unguarded
by parity tests) is logged below for frequency-tracking.

## Rolling gap-log

Method-gaps surfaced by the audit. **Frequency drives the pull**: a gap
in many surfaces → its own Track-2 round; a one-off → an in-round fix.
Seeded from R51→R55 (pre-audit):

| Gap | Axis | Seen in | Disposition |
| --- | ---- | ------- | ----------- |
| Doctrine assumes new-build, not audit (gap #1) | D-gate / doctrine | —, R60 | open — may revise hybrid-flow doctrine. _R60 gave a concrete instance: the rubric also assumes the **canonical-doc artifact type** — see target-doc row below._ |
| Vocabulary drift via hand-mirrored copies (`OPS_BY_DTYPE` ×4) | C1 | R55, R56 | **mitigated** — FE+BE parity tests enforce; `advanced-query` imports the FE map (no copy). Residual: the doc-table is an unguarded mirror → see R56 snippet-drift row |
| Test selectors not contracted (`data-component` improvised) | C-gate | R55 | open — Track-2 candidate (C-gate enrichment) |
| `_predicate_sql` cognitive complexity (flat if-chain) | (code, R55 seed) | R55 | open — Track-2 candidate (refactor / lint-debt) |
| `FilterPopover` hardcoded narrowing allow-lists | (code, R55 seed) | R55 | open — Track-2 candidate (derive from shared maps) |
| Status header stale — shipped doc still read "Draft / design-only" | A6 | R56–R62 | **fixed in-round** (R56–R62, canonical docs). **7 surfaces = systematic (all canonical docs)** — every shipped canonical doc is stale; doctrine/template candidate. (Target docs exempt: `workspace-shell.target.md` status "Target horizon" is correct.) _R62 `crud-hygiene.md`: "Draft (Round 23 design-only)" → "Accepted (R23 design; shipped R24–R26; extended R30/R32/R33)"._ |
| Embedded FE-types snippet drifted from vocab table + live type (missing R55 `ne`/`gte`/`lte`) | A2 / §D | R56 | **fixed in-round** (R56). Method-gap: design-doc code snippets are unguarded mirrors (parity tests cover code↔code, not doc↔code) — Track-2 candidate |
| Surface-table Layer paths predate the `filters/` subdir reorg | C4 | R56 | open — systematic; in-round fix deferred (per-row verify needed) |
| Token map non-conformant: cites `tokens.css` + inline hex (R56/R57), or **absent** (R58/R59/R61/R62) | A3 | R56–R59, R61, R62 | open — **6 of 7 surfaces gap** (only `workspace-shell.md` passes), **but the canonical pattern already exists**: R60 `workspace-shell.md` **PASSES** (cites `themeTokens.ts` + AntD seed, values informational). → decide-canonical **resolved**: that is the model; backfill the 6. _R61 `upload.md` + R62 `crud-hygiene.md` lack a map despite heavy maintenance → format-convention adherence, not upkeep._ |
| Reusability column vocab (`feature`/`backend`) outside README's enumerated set | A1 | R56–R62 | open — **7 surfaces**; decide canonical. _Docs mix README-valid (`shared cross-domain`, `builder-only`) with off-README (`feature`/`backend`); Purity also varies — correct `data constant` (R60) vs off-README `data type`/`pure (data)` (R61) → vocab usage is **inconsistent**, README likely the stale party. R62 `crud-hygiene.md` uses `shared`/`feature`/`backend` (Reusability) + `glue (server-data)` (qualified Purity). `workspace-shell.target.md`'s A1 is fully README-valid._ |
| Chip `×` / "Clear all" accessible name not declared | B3 | R56 | logged UX/a11y — deferred to a feature round (firewall) |
| 422 filter-validation error has no declared FE surface | B4 | R56 | logged UX — deferred to a feature round (firewall) |
| Inactive filter entry-point (muted chevron) discoverability weak | B1 (UX) | R56 | logged UX/product — deferred to a feature round (firewall) |
| Design-gate exit (A2): docs lack an explicit user-journeys / testable-acceptance-criteria section (criteria implied via impl/test bullets) | A2 | R56–R62 | open — **7 surfaces = systematic** (canonical docs); rubric/doc-template addition candidate. _R62 `crud-hygiene.md` substitutes an R23 HIxAI Q&A decision table — rich, but not testable acceptance criteria. n-a for target docs (see target-doc rubric row)._ |
| Doc 422 description contradicts shipped contract (page-beyond → 200 empty, not 422) | §D / contract | R57 | **fixed in-round** (R57). Clarifies R56's B4 — the doc-declared 422 is unreachable from the UI |
| Doc mirrors of a source-of-truth are unguarded by parity tests (R56 doc-snippet↔FE-type; R57 doc-prose-contract↔YAML; R59 doc `Workspace.id` format↔`workspace.yaml`+BE; R62 doc `RenameBody max_length=80`↔`NAME_LENGTHS`/`dataset.yaml`) | method | R56, R57, R59, R62 | **Track-2 candidate — 4 instances**; extend parity coverage to doc-declared contract/identifier claims. _Mechanism confirmed again: drift appears exactly where no parity test guards — R58's dtype mirror did NOT drift **because** `dataset-detail.test.tsx` asserts it; R62's max-length snippet DID drift (no doc↔constant parity test). The R29 `NAME_LENGTHS` cross-language constant guards code↔code (BE/FE/contract) but not doc↔code._ |
| Dtype-badge full name is hover-only (no keyboard / SR path) | B3 | R57 | logged UX/a11y — deferred to a feature round (firewall) |
| Scope boundary (A5): no explicit "does NOT cover" section (covered/deferred present, explicit *out* absent) | A5 | R58, R61 | open — **inconsistent** (not systematic, not one-off): `datasets.md` + `upload.md` lack it; filters/detail/`workspaces.md`/`workspace-shell.md`/`crud-hygiene.md` HAVE it (**5 of 7**). _R62 `crud-hygiene.md` has a strong "Out of scope (deferred with named triggers)" section. Corrects R59's "datasets-only" call._ |
| Credibility: list page declares no loading / fetch-error state | B4 / Cred | R58, R59 | logged UX — older-doc gap (`datasets.md`, `workspaces.md`); defer |
| Source-format conveyed icon-only in the list (no text / aria) | B3 | R58 | logged UX/a11y — deferred to a feature round (firewall) |
| Rubric calibration residual: A3⇄B6 dedupe doesn't cover the **absent-map** case — with no token map, A3 and B6 both fire (`datasets.md`, `workspaces.md`) | calibration | R58, R59 | note — refine at close: B6 defers *all* token concern to A3 (presence included), not just the citation detail |
| Doc `Workspace.id` declared "ULID or UUID" (+ stub `ulid.new()`) but contract/BE use `ws_<8 hex>` (`secrets.token_hex(4)`); dataset FK agrees | §D / C1 / contract | R59 | **fixed in-round** (R59 — type comment + stub id line) |
| Clickable `WorkspaceCard` declares no keyboard / role / accessible-name path | B3 | R59 | logged UX/a11y — deferred to a feature round (firewall) |
| `WorkspaceCard` `@mdd/ui` naming open-question left unresolved in-doc ("R13 commits the name") | C4 / A1 | R59 | open — verify at close: doc may name a primitive that shipped renamed (e.g. `ListCard`) |
| Backend-stub illustration stale (shows in-memory `_WORKSPACES`; live BE is DuckDB-backed) | (doc, R59) | R59 | logged — separate from the id-format fix; backfill at close |
| Rubric mis-fits the **target-doc artifact type**: A2 (acceptance criteria) + A3 (token map) are **n-a** for a horizon doc; applying the canonical rubric verbatim would falsely flag them. `workspace-shell.target.md` is conformant *for its type* (TARGET-NOT-CURRENT banner, `(future)` rows, named-pulls, retire clause) | method / doctrine | R60 | **the round's anticipated finding** — concrete instance of gap #1 + the original `revisit-trigger`. Rubric needs an artifact-type-aware variant (canonical / target / preview). Log; refine at close |
| **"Conformance tracks doc age" (R58/R59) REFUTED; refined R61** | meta | R58–R61 | R60: `workspace-shell.md` (oldest, R07) is the **most** conformant → not age. R61 refines: `upload.md` is **heavily content-maintained** (R19/R21/R30/R32) yet **format-non-conformant** (A1/A2/A3/A5/A6) → the real variable is **doc-format-convention adherence**, independent of content upkeep. → close: a doc-template + lint enforces it; content-maintenance won't |
| `PageCard` has no canonical doc — design lives only in the **frozen** `workspace-shell.target.md` (`default`/`flush`), which under-documents the live primitive (`default`/`flush`/**`fill`**, used correctly by `dataset-detail`) | C / coverage | R60 | log — not drift (target frozen by design); ensure `fill` is captured when the target folds into a canonical record |
| `upload.md` in-doc endpoint inconsistency: 2 refs dropped `/batch` (`POST .../datasets` vs the contract's `.../datasets/batch`, `commitDatasetsBatch`) | §D / C1 | R61 | **fixed in-round** (R61). Doc↔contract for the batch *shape* is in sync (path/operationId/items/ParseOptions/ColumnOverride) — this was intra-doc, not mirror drift |
| Upload source-type cards declare no keyboard / role / accessible-name path | B3 | R61 | logged UX/a11y — deferred to a feature round (firewall) |
| Credibility: loading/pending UI during init/parse/commit mutations not explicitly declared (failure states ARE richly specced — best in corpus) | B4 / Cred | R61 | logged UX — minor; defer |
| Doc declares a single shared `RenameBody(max_length=80)` + "1-80 characters" for **both** resources; live splits per-resource (workspace 80 / dataset **120**) via `RenameWorkspaceBody`/`RenameDatasetBody`, sourced from R29's `NAME_LENGTHS`. Dataset 120 has held since R15 `dataset.yaml` | §D / C1 / contract | R62 | **fixed in-round** (R62 — snippet now reflects per-resource limits + cites `NAME_LENGTHS` as source of truth). Same mechanism as the doc-mirror method-gap row (4th instance) |
| Consumer doc cites the modal prop as `resource="dataset"`; live prop is `resourceLabel` (`resource` is the *translated* string, internal). `crud-hygiene.md`'s own prose ("parameterized by resource label") is accurate | C4 / C1 | R62 | **fixed in-round** (R62 — `dataset-detail.md` ×2: `resource=` → `resourceLabel=`). §C deliverable: provider-side vocab is consistent; one consumer citation had drifted |
| Accessibility: overflow `⋮` trigger declares no accessible-name / keyboard path; Delete destructiveness conveyed by red color only (`danger` styling) — no text/aria differentiation | B3 | R62 | logged UX/a11y — deferred to a feature round (firewall). Recurs with the corpus icon-only / color-only pattern (R56/R57/R58/R59/R61) |

_(Append one row per audit finding; bump "Seen in" when a gap recurs.)_

## Lifecycle

Active until all 7 surfaces are audited. At program close, the gap-log's
recurring entries are promoted to their own Track-2 rounds / a doctrine
revision; this file folds into a closing note or a decision artifact.
