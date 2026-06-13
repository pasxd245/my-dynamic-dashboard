# Round 72: The interactive query-construction surface — make a joined Query buildable, not just create-able

**Status**: In Progress
**Date started**: 2026-06-13
**Date completed**:

## Goal

**Inherits from ← [Round_71](Round_71.md)** — R71 shipped join **execution** end
to end (the `QueryDefinition.join` step, the new `query_joined_rows` engine,
server-computed `resolvedColumns`, and the `409 relationship_stale` run gate), and
**deferred the interactive construction surface as J-1** with a named trigger:

> _The interactive multi-source construction surface (visual cross-source
> predicate building, multiple joins, a builder canvas) → R72. Trigger: a Query
> must be built from more than one minimal join + the saved filters._
> ([joins.md § Scope](../../design/data-management/queries/joins.md))

R71's hand-off named R72 the **likely DFCFBI** round: the visual multi-source
builder is a genuinely new interaction pattern with real UX uncertainty (the
conditions R71's scope cut kept quiet). R72 fills the
[query-builder.md trajectory](../../design/data-management/queries/query-builder.md#the-trajectory-what-queries-grows-into)
step reserved as **"R72 construction surface"** — the fourth step of the critical
path (`data → relationships → joins → **construction** → dashboards`).

**The risk axis flipped from R71.** R71 carried **model**-altitude risk (was the
`Relationship` edge the right shape?) and earned the **design-model confidence
valve** (seal-at-Design + the truth-test). R72's data model is **settled and
twice-validated** — the edge passed its truth-test, and `QueryDefinition.join` +
`query_joined_rows` + `resolvedColumns` already shipped and ran in a live
cross-process round-trip. So R72 does **not** re-open the model. Its risk is
**UX / interaction** — _"is this the right way for a user to build a join +
cross-source predicates?"_ — which is exactly the
[2-of-5 flow-selector / F1 timebox](../../decisions/2026-05-28-hybrid-flow-governance.md#flow-selector-2-of-5)
axis, **not** the design-model valve. Naming the correct valve is itself a
guard against ceremony misapplied (the
[dynamic-equilibrium brake](../../context/purpose.md#dynamic-equilibrium): add
only the mechanism the named failure mode pulls).

_Track: 1 (product feature). Pulled by ← R71 J-1 deferral + the
[query-builder.md trajectory](../../design/data-management/queries/query-builder.md#the-trajectory-what-queries-grows-into)
("R72 construction surface") + [purpose.md](../../context/purpose.md) critical
path + key decision #4 (relationships/joins are central, not fixed). Scoped by
the [dynamic-equilibrium brake](../../context/purpose.md#dynamic-equilibrium) and
"one feature per round": the **editable single-join builder** only — multi-join
chaining and a visual canvas are deferred (J-1′). Opened as a **Plan + Design
pass that seals the construction-surface design at the Design gate, then STOPS**
for the human's go-ahead before any C/F1/F2/B/I (J-2)._

## Judgment calls

### Resolved with the human at the Plan gate (2026-06-13)

| #    | Question          | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| J-1  | **Scope** of R72  | **Editable single-join builder** (ratified). Turn R71's **read-only** join summary + predicate summary into an **editable** builder on the **reused** `/queries/:id` detail: add / change / remove the join (single, within-workspace, **inner**), build predicates across the **combined `left ++ right` column space** (R71's `resolvedColumns`), and **live-preview** the joined rows before Save. Honors "one feature per round" + the [brake](../../context/purpose.md#dynamic-equilibrium): it makes the join Query _buildable_ on the engine R71 shipped, without minting a new engine or a new noun. |
| J-2  | **Round shape**   | **Seal at Design, then STOP** (ratified). Plan + Design only this pass: author + seal the construction-surface design at the Design gate, run `flow-selector` + `ui-design` (design-spec), commit the Design seam, and **STOP** for the human's explicit go-ahead before any Contract / F1 / F2 / Backend / Integration. The cheapest revert seam (a committed design doc) ahead of the build, mirroring R71's J-3 — but here it brakes **UX**-uncertainty, not model-uncertainty (the model is settled).                                                                                                    |
| J-1′ | **Sub-scope cut** | **Deferred → R73** (ratified): **multiple joins** (chaining 2+ relationships — needs a multi-hop engine `query_joined_rows` does not yet have), a **visual builder canvas / source graph**, **left / outer joins**, **composite / multi-column keys**, **self-joins**, **cross-workspace** joins, **Query × Query composition**, and **workflow (YAML + polars)**. R71's named triggers hold; R72 stays single-edge, within-workspace, inner — it makes that join **editable + previewable**, nothing wider.                                                                                                 |

### Deferred to the Design gate — resolved with the closed design (J-3, J-4)

| #   | Question                                                     | Held open for the Design pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J-3 | **Live-preview run path** (contract-shape, **UX-dependent**) | The editable builder wants to **preview rows before Save**. R71's run route (`GET /queries/{id}/rows`) requires a **saved** Query. Two candidates: **(a) save-then-run** (no new route; the builder Saves a draft, then runs it — weaker UX, possible orphan drafts); **(b) a stateless preview endpoint** (`POST …/queries/preview` with a `QueryDefinition` body → `RowsPage`, never persisted). Because the contract shape **depends on the chosen UX**, this is a textbook [selector condition 4](../../decisions/2026-05-28-hybrid-flow-governance.md#flow-selector-2-of-5) → flagged for the Design gate, then the Contract gate. Lean: (b), if the F1 prototype shows save-before-preview is the wrong feel. |
| J-4 | **Home (noun-vs-mode)**                                      | The builder is an **editable mode of the existing query detail**, **not** a new noun / parallel `/builder` page — the [reuse invariant](../../design/data-management/queries/query-builder.md#the-reuse-invariant-the-one-rule-this-domain-holds) + the [noun-vs-mode default](../../memory/2026-06-13-design-gate-noun-vs-mode.md). The Design pass picks the **doc home** (a new `query-construction.md` mode doc the trajectory reserved, vs. extending `saved-query.md` / `joins.md`) and the **edit affordance** (inline-editable detail vs. a `/queries/:id/edit` mode) — sealed at Design, the home/mechanism free to deviate from the lean per [[design-altitude-vs-build-home]].                           |

**Invariant (the R69 → R71 anti-duplication rule):** every new/extended surface is
**reuse** of an existing component / layout / engine, never a parallel page or a
re-invented predicate / dtype / join engine
([specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)). The
builder **edits** the `QueryDefinition` R71 sealed and **runs** the
`query_joined_rows` engine R71 shipped — it adds construction UX, not a new model.

## Plan (by gate)

1. **Plan gate** — ratify J-1, J-2, J-1′ with the human; record J-3, J-4 as
   **held open** for the Design gate. Commit the ratified round file as the
   Plan-gate seam.
2. **Design gate — seal the construction-surface design (the round's core):**
   - **Author the construction-surface design** (home chosen per J-4 — a
     `queries/` **mode** doc, not a parallel page): the **editable** builder over
     the existing query-mode detail — the join editor (add / change / remove the
     single `rel_` edge; the eligible-relationships `<Select>` reused from R71's
     create modal), the **cross-source predicate builder** over the combined
     `resolvedColumns` space (reusing the shipped `FilterPredicate` / `aq`
     vocabulary + the chip / advanced surfaces — **no** new predicate engine), the
     **live-preview** affordance, Save / discard-changes semantics, the states,
     and Accessibility declared (not inferred). Each acceptance criterion → ≥1
     future F/B/I test.
   - **Resolve J-3 (live-preview path)** at the design level: state the UX intent
     and the **contract question** it raises (save-then-run vs. a stateless
     preview endpoint), flagged for the Contract gate (not pre-decided) — the
     [parked-question discipline](../../memory/2026-06-13-specious-model-lock-in.md)
     R69/R70/R71 used.
   - **Resolve J-4 (home + edit affordance)**; update
     [query-builder.md](../../design/data-management/queries/query-builder.md)
     (trajectory: R72 construction surface → its new home; R73 reserved for
     multi-join canvas) and cross-link [joins.md](../../design/data-management/queries/joins.md)
     (its read-only summary becomes the builder's editable surface).
3. **Design-gate verification** — noun-vs-mode check (an editable **mode**, not a
   new page); `ui-design` (design-spec) on the construction surface;
   `design:lint` / `design:tokens` / `plan:lint` / `markdown-check-link`;
   `gate-walker` confirms the Design exit criterion; run **`flow-selector`** to
   sequence the build chain (expected **DFCFBI** — new interaction + the
   UX-dependent contract shape) for the next session — and **STOP** (J-2).

## Acceptance criteria (this round = Plan + Design gates only)

- [ ] **J-1, J-2, J-1′ ratified** with the human and recorded in Do; **J-3, J-4
      recorded as held open** for the Design gate.
- [ ] **Construction-surface design authored** (a `queries/` **mode** doc per J-4,
      not a parallel page) specifying: the editable join editor, the cross-source
      predicate builder over `resolvedColumns` (reusing the shipped predicate
      vocabulary — no new engine), the **live-preview** affordance + Save / discard
      semantics, the states, Accessibility, and the contract intent (with **J-3
      live-preview path** flagged for the Contract gate).
- [ ] **Noun-vs-mode check passes**: the builder is declared as an **editable mode
      of the existing query detail** (reuse), not a parallel `/builder` page or a
      re-invented predicate / join engine — [noun-vs-mode](../../memory/2026-06-13-design-gate-noun-vs-mode.md) + [specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md).
- [ ] **Model is NOT re-opened**: the design records that R72 **edits** the sealed
      `QueryDefinition` and **runs** the shipped `query_joined_rows` engine — the
      design-model confidence valve is **not** invoked (UX risk, not model risk);
      the F1 timebox is the correct valve if `flow-selector` returns DFCFBI.
- [ ] Gates green: `design:lint` 0, `design:tokens` 0, `plan:lint` 0,
      `markdown-check-link` 0 broken; `ui-design` (design-spec) per-facet report
      attached (PASS, 0 gaps); `gate-walker` confirms the Design exit criterion met.
- [ ] Plan gate and the Design seam **committed separately** (revert seams);
      `flow-selector` run recorded; round **STOPS** at the Design gate (J-2) — no
      C/F1/F2/B/I this round.

## What is OUT of scope

- **Any C/F1/F2/B/I code** — the editable builder UI, any preview endpoint, the
  contract for it, tests. Sequenced by `flow-selector` at Design exit; built in
  later per-gate commits **on the human's go-ahead** (J-2).
- **Multiple joins / a visual builder canvas / source graph** → **R73** (J-1′).
  _Trigger: a Query must chain more than one relationship (a multi-hop join the
  current single-edge `query_joined_rows` cannot express)._
- **Left / outer joins, composite / multi-column keys, self-joins,
  cross-workspace joins** — R70/R71 deferred these with named triggers; they stay
  deferred. R72 makes the **single-column, within-workspace, inner** join
  **editable**, nothing wider.
- **Query × Query composition** (a Query as a join input) → later; this is also
  why the **unified `ds_`/`qr_` table-source resolver** (R71 J-2′) stays deferred.
- **Workflow / complex query (YAML + polars)** → later.
- **Result materialization / pinned snapshots; Excel export; dashboards** → live
  re-run only (the R69 execution discipline); downstream value-out.

## Risks / unknowns

- **UX-altitude risk (the central one).** R72 introduces the product's first
  **interactive cross-source predicate** construction; getting the interaction
  wrong is the expensive error here (not the model). _Mitigation: J-2 seal-at-D +
  STOP; `flow-selector` expected to return **DFCFBI**, whose **F1 timebox**
  (≤2 working days, one FE author) is the right valve for UX uncertainty — built
  on the go-ahead, not this round._
- **Live-preview contract shape depends on UX (J-3).** Whether a stateless
  preview endpoint is needed can't be settled until the preview UX is chosen —
  [selector condition 4](../../decisions/2026-05-28-hybrid-flow-governance.md#flow-selector-2-of-5).
  _Mitigation: design states the UX intent + flags the contract question for the
  Contract gate; default lean to a `POST …/preview` stateless run if save-first
  feels wrong in F1._
- **Scope creep toward the canvas (J-1′).** "Interactive builder" tempts building
  the full multi-join canvas now. _Mitigation: J-1′ pins R72 to a single editable
  edge + predicates; the canvas is R73 with a named trigger (multi-hop join)._
- **Predicate-engine reuse must hold.** The cross-source predicate builder must
  reuse the shipped `FilterPredicate` / `aq` vocabulary + chip/advanced surfaces
  over `resolvedColumns`, **not** fork a join-aware predicate engine.
  _Mitigation: an explicit noun-vs-mode / reuse acceptance criterion; R71 already
  proved predicates resolve over the effective combined space (side-qualified)._
- **Edit-vs-create overlap.** R71 shipped a create-only `JoinWithRelatedModal`;
  R72's editable builder must **subsume / reconcile** it, not add a parallel path.
  _Mitigation: a Design-gate decision (does create fold into the builder, or stay
  the entry point that opens it?), recorded in the design doc._

## Do

### Plan-gate ratification (2026-06-13)

- **J-1 → Editable single-join builder**: make R71's read-only join + predicate
  summary an **editable** builder on the reused `/queries/:id` detail (edit the
  single `rel_` edge, build cross-source predicates over `resolvedColumns`,
  live-preview before Save). One feature per round.
- **J-2 → Seal at Design, then STOP**; build on the human's go-ahead in a later
  session. The cheap revert seam ahead of the build — but braking **UX**
  uncertainty (the F1/selector axis), **not** model uncertainty: R72 does not
  re-open the twice-validated join model.
- **J-1′ → Deferred to R73**: multiple joins / visual canvas / outer + composite
  - self + cross-workspace joins / Query×Query composition / workflow. R71's
    named triggers hold.
- **J-3 → live-preview path held open** for the Design gate (then Contract): the
  contract shape (save-then-run vs. a stateless `POST …/preview`) **depends on
  the chosen preview UX** — selector condition 4. Lean: stateless preview if
  save-first feels wrong in F1.
- **J-4 → home/affordance held open** for the Design gate: an **editable mode of
  the existing query detail** (reuse invariant + noun-vs-mode default), not a new
  noun/page; the doc home + inline-vs-`/edit` affordance picked at Design.
- **Invariant:** reuse existing layouts / validators / engines; the builder
  **edits** the sealed `QueryDefinition` and **runs** the shipped
  `query_joined_rows` — it never duplicates a page or re-invents the
  predicate / join engine.

## Check

- [ ] **J-1, J-2, J-1′ ratified** with the human (Plan gate); **J-3, J-4 held
      open** for the Design gate.
- [ ] **Construction-surface design authored** (a `queries/` mode doc): editable
      join editor + cross-source predicate builder over `resolvedColumns`
      (reused vocabulary) + live-preview + Save/discard + states + Accessibility +
      contract intent (J-3 flagged for Contract).
- [ ] **Noun-vs-mode check recorded** — an editable mode of the query detail
      (reuse), no parallel page, no re-invented engine.
- [ ] **Model NOT re-opened** recorded — R72 edits the sealed `QueryDefinition` +
      runs `query_joined_rows`; the design-model valve is not invoked.
- [ ] `design:lint` 0 · `design:tokens` 0 · `plan:lint` 0 ·
      `markdown-check-link` 0 broken · `markdownlint` 0.
- [ ] `ui-design` (design-spec) on the construction-surface doc — PASS, 0 gaps.
- [ ] `flow-selector` run + result recorded (expected **DFCFBI**).
- [ ] **`gate-walker` (Design gate)** — exit criterion + noun-vs-mode check +
      commit seam recorded.
- [ ] Plan gate and Design seam **committed separately**; round STOPPED at the
      Design gate (J-2) until the human's go-ahead.

## Act

_Pending the Design pass (this session continues to the Design gate, then STOPS
per J-2). The Plan gate ratifies scope (editable single-join builder), round-shape
(seal-at-Design then STOP), and the sub-scope cut (canvas → R73); it records that
R72's risk is **UX**, not model — so the F1 timebox, not the design-model valve,
is the brake the build will use._

## Feeds into → Round_73 (multi-join construction — the builder canvas)

R73 builds the **multi-join canvas** R72 deferred (J-1′): chaining 2+
relationships into a source graph, on top of R72's now-shipped editable
single-join builder. Its named trigger is a Query that must chain **more than one
relationship** — a **multi-hop join** the current single-edge `query_joined_rows`
cannot express, so R73 also extends the engine (the first time the join engine
grows past a single edge). The J-2′ **unified `ds_`/`qr_` table-source resolver**
stays deferred until **Query × Query composition** needs to resolve a mixed
source by id. R70's `Relationship` model remains twice-validated — no revision
pending.
