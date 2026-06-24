# Round 92: canvas query×query UX — the symmetric "join anything to anything" canvas (D + F1 feel-check)

**Status**: In Progress (Plan + **Design gates closed** 2026-06-24 — DFCFBI front half; **F1 next**)
**Date started**: 2026-06-24
**Date completed**: —
**Flow**: **DFCFBI front half — [D + F1 + design-sync]** per [[dfcfbi-two-round-split]] (isolate the
F1 feel-review risk); the back half (**C + B + F2 + Integration**) is **R93**. Recorded at the Design
gate via `flow-selector` → **DFCFBI (triggers 1, 2, 5)** (see the Do log); the Do-log block is the
authoritative audit trail.

## Goal

**Inherits from ← [Round_91](Round_91.md)** — the query×query **model truth** shipped and is
agent-verified on the real stack: a saved Query joins in on a hop's right (`rightSourceId`
polymorphic; the resolver routes the right through `resolve_source`), `composition_cycle`-guarded,
effective columns qualified. R91 deliberately shipped **no new UI**; R92 builds the **canvas UX**
that lets a user *draw* the relations the engine can already resolve.

R92 realizes the [[query-is-virtual-dataset]] "a query is just another readable table-source"
direction **at the interaction level** — the canvas should let a user join **any source to any
source**, not only datasets. The visual north-star (a human-supplied reference, 2026-06-24) is
Attio's data-model canvas: clean source cards with a node-header **type `<Tag>`**, **field-level
edge anchoring**, and **"+ N more" progressive disclosure** of attributes.

_Track: 1 (product — the canvas UX that completes the relationships theme R88→R91). Pulled by ←
[Round_91](Round_91.md) "Feeds into → Round_92" + the carried-forward decisions 3, 8–11 + the R91
`ui-design` design-spec + [[query-is-virtual-dataset]] + [[query-owned-relationships]]. Per the
[Evolution Rule](../../AGENTS.md)._

## Plan-gate framing — the relation space, re-grounded (brainstorm, 2026-06-24)

The human reframed the theme as the full **source×source** relation space (the Attio canvas is
one *model*-only species; ours has two — **dataset** + **query**):

| | join in a **model** (`ds_`) | join in a **query** (`qr_`) |
| --- | --- | --- |
| **model**-rooted | ✅ baseline (governed + free-form `ds_↔ds_`) | ✅ R91 (model→query) |
| **query**-rooted (composed base) | ✅ composed base + inner-`ds_` left | ✅ composed base + R91 right-poly |

**Key finding (grounded in the resolver, not assumed):** all four cells are **already expressible
on R91's current wire**. The model is asymmetric by design — the **right** of a hop brings in a
*whole source* (`ds_|qr_`, R91), while the **left** names a *dataset already in the tree*, matched
by membership ([queries.py:205](../../../workspace/apps/backend/app/routers/queries.py#L205)),
**including a dataset nested inside a composed base**
([queries.py:181](../../../workspace/apps/backend/app/routers/queries.py#L181)). So "joining *off*
a query" is modeled as `leftSourceId = an inner dataset of that query` — **not** `left = the query`.

→ The single genuinely-missing wire enabler is **column provenance** (the add R91's own Amendment
named, [Round_91.md:215](Round_91.md#L215)): `resolvedColumns` does not carry, per effective
column, which inner `(ds_, column)` owns it. Without it the canvas can *render* a query node's
handles but cannot translate "drag from the query's `customer_id`" into a legal
`leftSourceId=ds_…/leftColumn`. **Provenance is the enabler — not `qr_`-on-the-left** (R91 decision
2's deferral does **not** block the 2×2).

**This tightens decision 8.** "Render the query as a handle-bearing node closes both gaps" holds
**only with** the provenance add; rendering alone is necessary-not-sufficient. Sealed wording moves
to the Design gate.

**Honest boundary (not vague "left-poly later"):** provenance suffices only while **every
effective column traces 1:1 to a single inner `(ds_, col)`**. A **derived/aggregate** column (no
single owner) cannot be a left join key on provenance — *that* is the case that would need real
`qr_`-on-left or a materialization step. We have no aggregation today (deferred dashboards/analytics
theme), so provenance is enough now; record the boundary, don't pre-build for it.

**UX reframe (to ratify):** present this as **two choices**, not four edge species — _(a)_ what's
the **root** (a table or a query); _(b)_ what you **join in** (tables or queries), onto any column
already on the canvas. Same expressive power, one fewer concept to teach.

## Scope posture — north-star feel vs. F1-in-scope (the no-MVP-rush guard)

Attio is the **feel** reference, not a paint-job mandate ([[dont-mvp-rush-a-roadmap-home-surface]]
in reverse — don't over-build either). Our canvas already shares the bones: **column-to-column
handle dragging exists** ([canvas.md:115-116](../../design/data-management/queries/canvas.md#L115-L116)).
R92's F1 proves the **new interactions** on those bones; fuller visual fidelity is deliberate
F2/later polish so the feel-check stays about *interaction*, not pixels.

| Element (from the reference) | R92 F1 (interaction) | Deferred (polish / later) |
| --- | --- | --- |
| Node-header type `<Tag>` (`Dataset`/`Query` + 🔎) | ✅ — decision 9 distinction | — |
| Field-level edge anchoring | ✅ (already built) | — |
| **"+ N more" progressive disclosure** | ✅ — needed: a `qr_` exposes many effective columns | — |
| Per-field column-type glyphs | — | F2 desirability |
| Curved/rounded edge styling | — | F2 desirability |
| Top saved-view tabs | — | out of scope (a later saved-views/dashboards concept) |

## Carried forward from R91 (the Design-gate input)

Decisions **3, 8 (tightened above), 9, 10, 11** carry forward verbatim from
[Round_91](Round_91.md#L135) (query×query UX: query node + 🔎 marker, `[+ Add a source]` offering
`qr_`, draw-to-`qr_` free-form define, Promote-suppression on `qr_` edges, the query-unavailable
node state, Form-tab parity). The `ui-design` **design-spec** already run at R91's Design gate is
R92's Design input (re-confirm, don't re-run from scratch).

## Plan (by gate — DFCFBI front half: D + F1 + design-sync)

1. **Plan gate** — theme (R92 canvas UX, not the dashboards pivot — human, 2026-06-24) + the 2×2
   reframe + the provenance-not-`qr_`-left finding + the two-round-split scope. _(THIS DRAFT —
   awaiting human ratification + the **scope-fork** confirm: front-half [D+F1+design-sync] vs.
   whole-round.)_
2. **Design gate** — seal the canvas UX: carried decisions 3, 8 (tightened), 9–11 + the **"+ N
   more" disclosure** + the node type-`<Tag>` + the two-choice mental model; re-confirm the carried
   `ui-design` design-spec; run `flow-selector` (expect **DFCFBI**); `gate-walker` close.
3. **F1 gate** — prototype on the **real builder** (pre-Contract, so **mock provenance** — keeps F1
   contract-safe per [[dfcfbi-f1-precedes-contract]]): a query node renders 🔎 + a `Query` `<Tag>`
   + effective-column handles (**sourcing the `qr_` node's effective columns is net-new** — today
   `dsColumnsById` is dataset-only, see Risks; + decide view/edit of an existing `qr_` edge:
   in-scope vs. named deferral); `[+ Add a source]` offers `qr_` (disambiguated from `ds_`);
   draw-to-`qr_` free-form define; Promote suppressed on `qr_` edges; the query-unavailable node
   state; **"+ N more" disclosure** (incl. the reveal-to-draw affordance); **Form-tab parity**.
   **Human feel-check — the DFCFBI hard-stop** ([[dfcfbi-f1-needs-human-review]]; only humans flip).
4. **design-sync** — re-sync [canvas.md](../../design/data-management/queries/canvas.md) to the
   F1-proven design (per [[design-docs-are-source-code]]).

_(Back half → **R93**: the **provenance** Contract+Backend slice (so the drawn joins resolve for
real) + F2 polish + real-stack Integration.)_

## Acceptance criteria (front half)

+ [ ] **Design sealed** — carried decisions 3, 8 (tightened: render + provenance), 9–11 + "+ N more"
      disclosure + node type-`<Tag>` + the two-choice model; `ui-design` design-spec re-confirmed;
      `flow-selector` recorded (expect DFCFBI); `gate-walker` closed.
+ [ ] **F1 feel proven** — the symmetric "join anything to anything" interaction works on the real
      builder with **mock provenance** (query node + handles + `qr_` picker + draw-to-`qr_` +
      "+ N more" reveal + Form-tab parity); **human feel-checked**.
+ [ ] **No wire change this round** — provenance + the resolver wiring land at **R93**; F1 mocks
      provenance only (contract-safe — MSW `additionalProperties:false` stays green).
+ [ ] **canvas.md re-synced** to the F1-proven design.

## Risks / unknowns

+ **Provenance shape** (how each effective column names its inner `(ds_, col)`) — F1 **mocks** it;
  the real shape is sealed at R93's Contract gate. _Risk: F1's mock diverges from what's cheap to
  wire — mitigate by sketching the provenance field at Design, even though it lands R93._
+ **"+ N more" × handles** — drawing a join to a *collapsed* column needs a reveal/search affordance;
  F1 must prove it, or the disclosure hides joinability. _The crux interaction of this round._
+ **Mock-provenance over-promising** — F1 could feel like it supports derived-column left-keys that
  the real wire won't. _Mitigate: F1 demo uses only 1:1-owned columns; the derived-column boundary
  is documented, not demoed._
+ **Scope creep into a visual reskin** — bounded above to interaction; glyphs/curvature are F2.
+ **`qr_` node has no columns/handles today** (the gap behind "the canvas is build-only for
  query×query" — confirmed with the human 2026-06-24). `dsColumnsById` is **dataset-only**
  ([QueryCanvas.tsx:462](../../../workspace/apps/builder/src/features/data-management/queries/QueryCanvas.tsx#L462))
  and a node's columns come from `dsColumnsById.get(id) ?? []`
  ([:562](../../../workspace/apps/builder/src/features/data-management/queries/QueryCanvas.tsx#L562)),
  so a `qr_` id renders a **bare card**. Two F1 consequences the plan now owns: _(a)_ F1 must
  **source the query node's effective columns** (fed by the mock provenance) — this is net-new, not
  "add handles to an existing card"; _(b)_ **viewing/editing an already-saved `qr_` edge** (a saved
  query is hydrated onto the canvas via
  [useQueryBuilder.ts:124-133](../../../workspace/apps/builder/src/features/data-management/queries/useQueryBuilder.ts#L124-L133))
  must be decided **in-scope or a named deferral** — decision 11's "query-unavailable node state"
  may need to cover a *resolvable-but-columnless* `qr_` node, not only the unresolvable case.
  _Note: existing `ds_↔ds_` rels already view+edit fine (edges with delete/promote/resync,
  [QueryCanvas.tsx:582-611](../../../workspace/apps/builder/src/features/data-management/queries/QueryCanvas.tsx#L582-L611)); the gap is `qr_`-specific._

## Do

### Plan-gate draft — opened from R91's feeds-into (2026-06-24)

Opened on the human's instruction ("plan next round"). At the [next-theme fork](Round_91.md#L321)
the human chose **R92 = the canvas query×query UX** over the deferred **dashboards** pivot. We then
**brainstormed the relation model in-conversation** before locking scope (the human's call —
"bear with me on brainstorming before we lock-in R92"): the 2×2 source×source frame, the
resolver-grounded finding that **all four cells are expressible on R91's wire** and the real enabler
is **column provenance, not `qr_`-on-left**, the **decision-8 tightening**, and the
**derived-column boundary**. The Attio reference was adopted as the **feel** north-star (interaction,
not paint-job). **Awaiting Plan-gate ratification** + the **scope-fork** confirm (front-half
[D+F1+design-sync] vs. whole-round — the human flagged a discussion; the brainstorm above argues for
the front-half split because the provenance C+B is a clean seam F1 should not depend on).

> _Open process question (not part of this round's build): should the in-conversation brainstorm be
> formalized as a **`brainstorm` skill** (Track 2)? The pull would be "ambiguity at a round becomes
> tech/biz debt later." **Deferred to a separate decision** — see the discussion after this draft;
> not pre-adopted here (Evolution Rule: default = don't add)._

### Plan-gate ratified — cold-reviewer pass + `qr_`-node grounding (2026-06-24)

The human ran the parked **`cold-reviewer`** skill (mix mode) against this draft before locking. The
six-anchor pass came back clear/grounded: the load-bearing claims were re-verified against the real
code (left matched by membership incl. inner-of-composed-base
[queries.py:181](../../../workspace/apps/backend/app/routers/queries.py#L181),[:205](../../../workspace/apps/backend/app/routers/queries.py#L205);
right polymorphic via `resolve_source` [:214](../../../workspace/apps/backend/app/routers/queries.py#L214);
the **provenance gap** confirmed and if anything understated — `Column` is `{name,dtype}` with
`extra="forbid"` and `build_effective_columns` drops per-column ownership). The pre-mortem surfaced
the F1 mock-provenance/`resolveConnect` seam (the left-orientation must consume provenance, not the
node id) as the crux to keep honest at Design; counter-case (whole-round vs. split) broke against
R91's own amendment lesson, so the **front-half split holds**.

Then the human added a grounded observation — *the canvas is build-only for query×query*. Verified:
the literal "can't view/edit current rels" is **false for `ds_↔ds_`** (existing edges render with
delete/promote/resync, and a saved query hydrates onto the canvas), but **true for `qr_`** — a query
node renders columnless because `dsColumnsById` is dataset-only. Folded into **Risks** + the **F1
step** above. Human confirmed the framing.

**Lock (human, 2026-06-24):** "R92 is correct and good to go." → **Plan gate ratified**; the
**front-half scope-fork** ([D + F1 + design-sync], back half = R93) is **confirmed**. Next: the
Design gate.

### Design gate — sealed (2026-06-24)

Per [[design-docs-are-source-code]] the design docs (canvas.md) are **not** rewritten here — they
stay code-true and re-sync to the actual build at the design-sync step. The Design deliverable is
this sealed canvas UX + the `ui-design` design-spec re-confirm + the flow selection (below).

**Carried from R91 (human-ratified, re-affirmed):**

+ **Dec 3** — `qr_` edges are **free-form-only, non-promotable**; the canvas **suppresses Promote**
  on any edge with a `qr_` side; divergence-warn does not apply (no governed origin).
+ **Dec 8 (tightened)** — rendering the query as a **handle-bearing node closes both gaps _only with_
  column provenance**; rendering alone is necessary-not-sufficient (the [Plan framing](#L52)).
+ **Dec 9 / 10 / 11** — query node carries a **🔎 marker**; `[+ Add a source]` offers `qr_`
  (disambiguated from `ds_`) + draw-to-`qr_` free-form define; a **query-unavailable node state**
  for an **unresolvable** `qr_` (composition_cycle / stale / deleted).

**Sealed new this round (all named in the ratified plan):**

+ **"+ N more" progressive disclosure** of a `qr_`'s many effective columns — **including the
  reveal-to-draw affordance** (drawing a join to a collapsed column). _The crux interaction; F1 must
  prove it or the disclosure hides joinability._
+ **Node-header type `<Tag>`** — `Dataset` / `Query` (+ 🔎) on the card header.
+ **Two-choice mental model** — _(a)_ the **root** is a table or a query; _(b)_ what you **join in**
  is tables or queries, onto any column already on the canvas. Same expressive power as the 2×2, one
  fewer concept to teach.

**Sealed new this round — the `qr_`-node scope resolution (the only genuinely-new call; grounded):**

Rendering the `qr_` node's **effective columns** (fed by **mock provenance** at F1) is the single
enabler, and it delivers **create + view + edit** of `qr_` joins together — so view/edit of an
existing `qr_` edge is **IN F1 scope, not a separate deferral**:

+ **Create** — draw to/from a `qr_` column → `defineJoin` (free-form), via the provenance-aware
  `resolveConnect` left-orientation (the F1 mock seam; see Risks).
+ **View** — an existing `qr_` edge **already renders** via `builtEdges`
  ([QueryCanvas.tsx:582-611](../../../workspace/apps/builder/src/features/data-management/queries/QueryCanvas.tsx#L582-L611)); the only gap is the **columnless node**, which the enabler fills.
+ **Edit** — leaf-delete already works **type-agnostically**
  ([:377-389](../../../workspace/apps/builder/src/features/data-management/queries/QueryCanvas.tsx#L377-L389)); **Promote-suppression on `qr_` edges (Dec 3) is a real F1 build item** — Promote
  currently renders **unconditionally** ([:352-364](../../../workspace/apps/builder/src/features/data-management/queries/QueryCanvas.tsx#L352-L364)), so a user could today promote a `qr_` edge that Dec 3 forbids.
+ **Dec 11 stays scoped to _unresolvable_ `qr_`** — the enabler eliminates the
  *resolvable-but-columnless* case, so the unavailable state needn't cover it.

**Provenance** — mock at F1 (FE-only, contract-safe per [[dfcfbi-f1-precedes-contract]]); the real
wire add + the `resolveConnect` consumer land at **R93**. Sketch the provenance field shape at this
gate (cold-reviewer pre-mortem) so the F1 mock doesn't diverge from what R93 can cheaply emit.

**Deferred (named boundaries):** per-field column-type glyphs + curved/rounded edges → F2
desirability; derived/aggregate-column left-keys → only if aggregation arrives; `qr_`-on-left →
unneeded while every effective column traces 1:1 to a single inner `(ds_, col)`.

**Model check (Design gate)** (per [[design-gate-noun-vs-mode]]):

+ **Noun-vs-mode:** **mode of an existing surface** (the `QueryCanvas`) — rendering a query as a
  source node + handles extends the shipped canvas; it reuses `resolveConnect` / `builtEdges` /
  `useQueryBuilder` and adds **no new route or noun**. Reuse over a parallel page.
+ **Discovered-vs-imposed:** **discovered** — the resolver **already** expresses all four
  source×source cells ([queries.py:181](../../../workspace/apps/backend/app/routers/queries.py#L181),[:205](../../../workspace/apps/backend/app/routers/queries.py#L205),[:214](../../../workspace/apps/backend/app/routers/queries.py#L214)); the UX surfaces a capability the engine
  already has. The one imposed element (**column provenance**) is de-risked by the DFCFBI F1 (mock)
  with the real wire deferred to R93 — not locked here. _NOTE (gate-walker limit): this records that
  the modeling question was answered, not that the answer is right — the commission check is the
  human's._

### Flow selector run (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md), 2026-06-24)

Run against the sealed canvas UX above (the Design output). This is R92's own formal run — R91's
DFCFBI(2,5) read was for *this* UX but is recorded against R91; R92 gets its own audit trail.

| Condition                            | Fired? | Justification |
| ------------------------------------ | ------ | ------------- |
| 1. >3 independent states/branches    | **yes** | The drawn-connection router `resolveConnect` branches across copy-on-pick / free-form-define / self / cyclic / disconnected / incomplete ([joinGraph.ts](../../../workspace/apps/builder/src/features/data-management/queries/joinGraph.ts)), plus the new `qr_` column-disclosure (collapsed / revealed / reveal-to-draw) and node states (resolvable / unavailable) — well over 3. |
| 2. New interaction pattern           | **yes** | "+ N more" progressive disclosure with **reveal-to-draw** onto a `qr_`'s effective columns is a genuinely new gesture, not previously in product. |
| 3. High user-error risk              | no     | Joins are non-destructive and reversible (leaf-delete); a wrong cardinality is advisory + confirmable; the model rejects illegal draws with a warn, mints nothing. |
| 4. Contract depends on unresolved UI | no     | **No wire change this round** — F1 mocks provenance; the real shape is sealed at R93's Contract gate, deliberately *after* the F1 feel-check. |
| 5. UX confidence below threshold     | **yes** | The reveal-to-draw × "+ N more" crux is explicitly the round's risk ("F1 must prove it or the disclosure hides joinability"); confidence is exactly what F1 exists to establish. |

Result: **Flow: DFCFBI (triggers 1, 2, 5)** — confirms the planned front-half [D + F1 + design-sync];
back half (C + B + F2 + Integration) = R93.

### `ui-design` design-spec — re-confirm (2026-06-24)

Per the plan, **re-confirm** the R91 design-spec (canvas surface), don't re-run from scratch; the
carried decisions 3/9–11 passed at R91's Design gate. Focused check on the **new** affordances:

| Facet | New affordance | Verdict |
| --- | --- | --- |
| **Findability** | node type `<Tag>` (Dataset/Query) + 🔎 distinguishes a `qr_` source at a glance | declared ✓ |
| **Usability** | "+ N more" disclosure keeps a wide `qr_` node legible; reveal-to-draw keeps collapsed columns joinable | declared ✓ — F1 must prove the reveal-to-draw (fidelity backstop) |
| **Accessibility** | the reveal control needs keyboard/SR reach (a column hidden behind "+ N more" must be focusable to draw to) | declared as an **F1 must-prove**; flagged so fidelity catches it |
| **Credibility** | unavailable-node state for an unresolvable `qr_` (Dec 11) signals *why* a source can't be joined | declared ✓ |
| **Utility** | the two-choice model (root: table/query; join-in: tables/queries) makes the full source×source space reachable | declared ✓ |
| **Desirability** | glyphs / curved edges deliberately **deferred to F2** — interaction-first | bounded ✓ (not a gap) |

No new gaps that block the gate; one **F1 fidelity watch-item**: the reveal-to-draw affordance's
keyboard/SR reach (Accessibility) — recorded so the F1 `ui-design --fidelity` pass checks it.

### Design gate — `gate-walker` (2026-06-24)

Ran `gate-walker Design`. Result: **all checks pass once this gate is committed → Design gate
CLOSED.** (`gate-walker` first held it OPEN on the commit seam; the human OK'd lifting the
keep-uncommitted hold for this gate, 2026-06-24, so the seam is created by the commit that carries
this very block — a gate-close line cannot cite its own SHA, per the skill's step-4 note.)

**Passing checks:**

+ **Exit criterion** ✓ — canvas UX sealed (carried 3/8–11 + "+ N more" + node `<Tag>` + two-choice
  model + the `qr_`-scope resolution, each grounded in `QueryCanvas.tsx` / the resolver); deferrals
  named with a why; testable acceptance criteria present.
+ **Model check** ✓ — Noun-vs-mode + Discovered-vs-imposed recorded above (structural only; the
  modeling answer's correctness stays the human's call).
+ **`ui-design` re-confirm** ✓ — one F1 fidelity watch-item (reveal-to-draw keyboard/SR reach),
  non-blocking. **Flow: DFCFBI (1,2,5)** recorded.

**Commit seam — resolved:**

+ **Commit seam** ✓ — initially ✗ (round file untracked, zero history — the R69 shape; the skill's
  `git diff --quiet` probe false-"OK"s an untracked file, so the empty `git log` was the real
  signal). The human OK'd committing this gate's work (lifting the keep-uncommitted hold for the
  Design seam), creating the revert point. **Design gate → CLOSED.** Next: **F1** — the prototype
  build + the **DFCFBI human feel-check hard-stop** ([[dfcfbi-f1-needs-human-review]]); F1 may now
  begin.

### F1 prep — mock-provenance shape (sketched at Design, 2026-06-24)

The cold-reviewer pre-mortem: F1 mocks provenance, so pin the shape **now** against what R93 can
cheaply emit — else the feel-check blesses an interaction the real wire can't deliver.

**Wire shape (R93 Contract target).** Extend each *effective* column entry with the leaf it traces to:

```json
{ "name": "Deals.id", "dtype": "...", "ownerSourceId": "ds_abcd1234", "sourceColumn": "id" }
```

+ `ownerSourceId` is always a **leaf `ds_`** — matches the resolver's left-matching, which tests
  `leftSourceId ∈ dataset_id_sets` (leaf `ds_` ids) at
  [queries.py:205](../../../workspace/apps/backend/app/routers/queries.py#L205).
+ `sourceColumn` is the **pre-qualification** name on that leaf; the collision-qualified display
  `name` (`Deals.id`) is for the header, the join key uses `sourceColumn`.

**Cheap to emit — clean recursion, no engine reshape:**

+ `resolve_source` ([queries.py:99](../../../workspace/apps/backend/app/routers/queries.py#L99))
  returns a `provenance` list aligned with `columns`: a `ds_` leaf →
  `[{ownerSourceId: <this ds_>, sourceColumn: c.name} …]` (1:1, exact); a `qr_` → pass up
  `payload["provenance"]` (its effective columns already carry it).
+ `build_effective_columns`
  ([rows_reader.py:137](../../../workspace/apps/backend/app/ingest/rows_reader.py#L137))
  concatenates each source's provenance alongside `effective`, qualifying `name` only
  (owner/`sourceColumn` untouched) → `effective[i] ↔ provenance[i]`; `_resolved_columns` attaches it.

**F1 mock constraint** (contract-safe per [[dfcfbi-f1-precedes-contract]]): pre-Contract, MSW
response-validation is `additionalProperties:false`, so the mock must live as **FE-derived state**,
**not** a field on the MSW response. Mock the `{ownerSourceId, sourceColumn}` map FE-side; it moves
onto the wire at R93.

**Consumer to wire at F1:** `resolveConnect`
([joinGraph.ts:121](../../../workspace/apps/builder/src/features/data-management/queries/joinGraph.ts#L121))
today sets `leftSourceId` from the **node id** — for a `qr_` node it must instead read the dragged
column's provenance: `leftSourceId = ownerSourceId`, `leftColumn = sourceColumn`.

**Boundary:** only **1:1-owned** columns get provenance; a derived/aggregate column has no single
owner → no provenance → not a legal left key. No aggregation exists today, so the demo uses only 1:1
columns and the derived-column case is documented, not demoed.

## Check

+ [x] **Plan gate** — theme + 2×2 reframe + **front-half scope-fork** ratified by the human
      (2026-06-24, "good to go"); cold-reviewer pass run + the `qr_`-node gap folded into Risks/F1.
+ [x] **Design gate** — **closed** (`gate-walker`, 2026-06-24): exit criterion ✓ + Model check ✓ +
      `ui-design` re-confirm ✓ + `flow-selector` → **DFCFBI (1,2,5)** ✓ + commit seam ✓ (human OK'd
      the gate commit). Canvas UX sealed, grounded in `QueryCanvas.tsx` / the resolver.
+ [ ] **F1 gate** — **next**; the prototype build + the **DFCFBI human feel-check hard-stop**.
+ [ ] **design-sync** — pending (after F1).

## Act

_Pending — round not yet ratified/started._

## Feeds into → Round_93 (provenance C+B + F2 + Integration — DFCFBI back half)

R93 lands the **column-provenance** Contract+Backend slice (so the joins drawn at F1 resolve for
real against the live stack), the **F2** polish batch (per-field glyphs, edge styling — the deferred
Attio fidelity), and the real-stack **Integration** gate. Beyond the theme: the **derived-column**
left-key boundary (only if aggregation arrives) and then the deferred **dashboards / value-out**
theme.
