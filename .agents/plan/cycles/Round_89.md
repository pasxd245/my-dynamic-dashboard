# Round 89: free-form canvas UX — draw-to-define + promote + divergence warn (React Flow)

**Status**: Complete
**Date started**: 2026-06-19
**Date completed**: 2026-06-19
**Flow**: **DFCFBI (triggers 1, 2, 3, 4, 5)** — set at the Design gate via `flow-selector`; recorded in
the Do log. A new draw-to-*create* interaction (React Flow) → F1 prototype + human review before Contract.

## Goal

**Inherits from ← [Round_88](Round_88.md)** — the query-owned-relationship **model** (copy-on-pick,
`QueryRelationship` with the nullable `originRelationshipId` back-ref, and the join resolver reading
query-owned specs from `QueryDefinition.relationships[]`). R88 made the model **free-form-capable**
(nullable origin, origin-agnostic resolver) but only **copy-on-pick** creates rels today.

Deliver the UX the **R87 F1 verdict** asked for: a Data Analyst draws a column→column link on the canvas
to **define** a query-owned relationship with **no governed match needed** (the gesture finally *creates*),
can **promote** a useful query-owned rel up into the governed ER (with dedup/conflict rules), and sees a
**divergence warn** when an origin governed rel has changed or been removed (warn-only, re-sync is the
user's choice). **React Flow** becomes the canvas engine, since drawing now creates.

_Track: 1 (product feature — new capability on the R88 model). Pulled by ← [Round_88](Round_88.md)
"Feeds into → Round_89", the [query-owned-relationships brainstorm §5](../brainstorms/2026-06-19-query-owned-relationships.md),
and [[query-owned-relationships]]. Per the [Evolution Rule](../../AGENTS.md)._

## Settled going in (the human's calls — do not relitigate; brainstorm §3)

1. **Back-ref / provenance** — `originRelationshipId` already on each query-owned rel (R88); free-form
   define mints one with `originRelationshipId = null`.
2. **Divergence** — **warn-only, no auto-impact.** Re-sync is the user's choice, never automatic; the
   future data-saver theme owns the "save before staling" lifecycle. R89 surfaces the warn UI + an
   opt-in re-sync affordance.
3. **Promote** — **YES, needs a small rulebook**: dedup against an equivalent governed rel; resolve
   cardinality / column conflicts.
4. **Reuse, not reinvent** — the governed `Relationship` validation (dtype-compat / acyclic / leaf) and
   the join engine are reused; free-form define and promote source the key pair from a query-owned rel.
5. **One graph engine** — React Flow, configured for the query canvas (and reusable for the workspace ER
   later); decided at this round's Design gate, not assumed here.

## Open Design-gate questions (to seal at Design)

- **React Flow adoption** — confirm the lib (vs. extending R87's hand-rolled `QueryCanvas.tsx` /
  `joinGraph.ts`); bundle-size + a11y/keyboard-equivalent plan ([[dont-mvp-rush-a-roadmap-home-surface]] —
  the canvas is a roadmap-home surface; do it right).
- **Draw-to-define gesture** — dragging a column handle to another column's handle creates a
  `QueryRelationship` (`originRelationshipId = null`); how cardinality is chosen at draw time (infer vs.
  prompt); how it reuses the existing dtype-compat / acyclic / leaf guards at draw time.
- **Promotion endpoint** — reuse `POST /workspaces/{id}/relationships` or a dedicated promote route; where
  the dedup/conflict rulebook (decision 3) lives (FE pre-check vs. BE 409).
- **Divergence detection** — how the builder compares a query-owned rel to its origin governed rel to
  raise the warn (decision 2): on read, recompute + diff the join fields/cardinality.
- **F1 scope (if DFCFBI)** — the prototype is contract-safe per [[dfcfbi-f1-precedes-contract]] (FE state +
  request-only; no new wire fields until Contract) and hard-stops for human review per
  [[dfcfbi-f1-needs-human-review]].

## Plan (by gate — pending `flow-selector` at Design)

1. **Plan gate** — ratify: scope = **free-form define + promote + divergence warn UI**, React Flow as the
   canvas engine; promote gets a small dedup/conflict rulebook; warn-only. _(This step — awaiting human
   ratification.)_
2. **Design gate** — run `flow-selector`; seal the React Flow adoption + the draw-to-define gesture + the
   promote rulebook + divergence-detection mechanism; run `ui-design` (design-spec mode) on the canvas
   surface; amend [canvas.md](../../design/data-management/queries/canvas.md) /
   [query-construction.md](../../design/data-management/queries/query-construction.md) /
   [relationships.md](../../design/data-management/workspaces/relationships.md) ([[design-docs-are-source-code]]).
3. **(F1 — if DFCFBI)** — React Flow prototype of draw-to-define + the promote affordance + the warn
   surface, contract-safe; **human review** before Contract.
4. **Contract gate** — any new wire surface for **promote** (endpoint + dedup/conflict response) and
   divergence (if a server-side diff is chosen); MSW + schema-parity.
5. **Backend gate** — promote handler (dedup against governed ER, conflict resolution); reuse the
   relationship validation; divergence diff if server-side; pytest green.
6. **(F2)** — wire the prototype to the real contract; free-form define mints query-owned rels; the warn
   UI + opt-in re-sync; vitest + MSW green.
7. **Integration** — human review: draw a column pair with no governed match → a join runs on a free-form
   rel; promote a query-owned rel and see it in the governed ER; edit/remove an origin governed rel → the
   warn fires (and the saved query still runs on its snapshot — the R88 win holds).

## Acceptance criteria (draft: sharpen at Design)

- [x] **Draw-to-define** _(FE)_ — dragging a column→column link with **no** governed match creates a
      query-owned rel (`originRelationshipId = null`); the join resolves through it. _(Built; agent-verified
      — the define modal opens + creates.)_
- [x] **Promote** _(FE+BE)_ — a query-owned rel can be promoted into the governed ER; dedup + dtype/self
      conflicts ride the existing `POST /relationships` rulebook (`409`/`422`); on success it gains the
      back-ref. _(FE built + verified on MSW; real-DB persist confirmed at R90 Integration.)_
- [x] **Divergence warn** _(FE)_ — when an origin governed rel changes/was removed, the builder warns;
      re-sync is an explicit opt-in, never automatic (the snapshot stays stable — R88). _(Built + verified.)_
- [x] **React Flow canvas** _(FE)_ — drawing *creates*; pan/zoom/drag (+ Controls/fitView) pay off; the Form
      tab stays the keyboard/SR-complete equivalent ([[dont-mvp-rush-a-roadmap-home-surface]]).
- [x] **Reuse, not reinvent** _(BE)_ — validation + join engine reused for free-form + promote (resolver
      origin-agnostic, R88); no parallel validation; no engine change.
- [x] **Design docs current** _(doc)_ — `design-sync` reconciled canvas / queries / query-construction +
      the relationships promote-target note.

**Carried to R90 (Integration):** **Snapshot win on the real stack** — editing/deleting an origin governed
rel does not break a saved query, verified against the real backend/DuckDB (not just MSW), per the
DFCFBI-as-2-rounds split.

## Out of scope (this round)

- **Dashboards / charts** over the richer queries → **R90+**.
- **Data-saver "save before staling" lifecycle** → its own future theme (R89 is warn-only; no auto re-sync).
- **Promoting the React Flow engine to the workspace ER editor** — reusable, but that surface is not in
  this round's scope.

## Risks / unknowns

- **Two parallel graph UIs** (query canvas vs. workspace ER) — _Mitigation: one engine (React Flow),
  configured for the query canvas now, reusable later (brainstorm §7)._
- **React Flow blast radius / a11y** — a graph lib must not drop R87's keyboard/SR pick path.
  _Mitigation: Design-gate adoption decision with an explicit keyboard-equivalent plan; F1 human review._
- **Promote dedup/conflict edge cases** — equivalence + cardinality conflicts. _Mitigation: a small,
  explicit rulebook sealed at Design; reuse governed-rel validation._
- **Cardinality at draw time** — free-form define must choose a cardinality without a governed source.
  _Mitigation: a Design-gate question (infer vs. prompt)._

## Do

### Plan-gate draft (2026-06-19)

Opened from [Round_88](Round_88.md)'s "Feeds into → Round_89" + the
[brainstorm §5](../brainstorms/2026-06-19-query-owned-relationships.md) + [[query-owned-relationships]].
The R88 model is in place (query-owned rels, nullable `originRelationshipId`, resolver reads query-owned
specs), so the foundation for free-form define + promote is ready.

Proposed scope = **free-form define + promote + divergence warn UI**, with **React Flow** as the canvas
engine and a small **dedup/conflict rulebook** for promote; **warn-only** divergence (no auto re-sync).
**Awaiting the human's ratification** on (a) that scope (all three capabilities in one round vs. splitting
promote out), (b) adopting React Flow as the canvas engine, and (c) the warn-only/opt-in-resync posture.
The Design gate then runs `flow-selector` (expect DFCFBI — a new draw-to-create interaction pattern) and
seals the gesture + promote rulebook + divergence mechanism.

### Plan-gate ratification (2026-06-19) — human-signed-off

The human ratified the proposal as drafted ("proceed"): **(a)** scope = all three capabilities
(**free-form define + promote + divergence warn**) in this round; **(b)** adopt **React Flow** as the
canvas engine (to confirm against the real R87 code at Design); **(c)** **warn-only** divergence with
opt-in re-sync. **Plan gate CLOSED.** Next: the Design gate (`flow-selector` + seal the gesture / promote
rulebook / divergence mechanism against real code).

### Design-gate work (2026-06-19)

**Real code re-confirmed before sealing** (the design-gate read, not assumptions — R88's handoff held):

- **Draw-to-define is FE-only — the resolver is already origin-agnostic.**
  [`_resolve_chain`](../../../workspace/apps/backend/app/routers/queries.py#L197-L225) reads each hop's
  edge from the definition's own `relationships[]` by `queryRelId` and validates `disconnected_join` /
  `cyclic_join` / dtype-compat (`relationship_stale`) against current columns — it never inspects
  `originRelationshipId`. A free-form rel (`originRelationshipId = null`) resolves **identically** to a
  copied one. So *defining* a query-owned rel from a drawn pair is **pure FE** (mint a `QueryRelationship`
  with `originRelationshipId: null` via a new `chain.ts` helper alongside `copyGovernedRel`, append to
  `draft.relationships`, add a `JoinStep`). No contract/BE change for define.
- **Promote reuses `POST /workspaces/{id}/relationships`** —
  [`create_relationship`](../../../workspace/apps/backend/app/routers/relationships.py#L110-L188) already
  enforces the whole rulebook: dataset+column existence and dtype-compat (**422** `_validation_error`),
  self-join rejection (**422**), and **dedup** via the ordered-column-pair UNIQUE constraint (**409**
  `relationship_exists`). So **promote = a thin FE call** to the existing endpoint with the query-owned
  rel's join fields; on `201` the FE stamps the returned `rel_` id onto the query-owned rel's
  `originRelationshipId` (provenance closes the loop); on `409` it surfaces "already governed" (offer to
  link the existing rel); on `422` it surfaces the conflict. **Reuse, not reinvent** (decision 4) holds —
  the only open question is whether the bare `409` suffices or the promote-conflict UX wants a richer
  payload (→ condition 4 below; settle at F1/Contract).
- **Divergence is FE-computable, no new wire field.** The builder already fetches governed rels
  (`useRelationshipsQuery` in `useQueryBuilder` + `QueryCanvas`). For each query-owned rel with a non-null
  `originRelationshipId`, diff its snapshot (`left/rightColumn`, `cardinality`) against the current governed
  rel found by that id — **removed** (id absent) or **changed** (fields differ) → raise the warn; re-sync =
  an opt-in that re-copies the governed fields (decision 2). Mirrors R88's FE-side `columnMissing` staleness
  pattern; no contract/BE change.
- **React Flow is not yet a dependency** (confirmed: absent from `apps/builder/package.json` + root). R87's
  canvas is **hand-rolled SVG/DOM**, pick-only ([canvas.md R87 build-decision note](../../design/data-management/queries/canvas.md));
  React Flow (`@xyflow/react`) was **held in reserve** "if drag is ever judged worth the flagged deviation."
  Drawing now *creates* (the brainstorm §2 / R87-F1 verdict), so the deviation is **earned** — the human
  ratified adoption at the Plan gate. This is a **flagged peer-dep deviation** against canvas.md's
  surfaces-table `react, antd` (to record in canvas.md as the build lands, [[design-docs-are-source-code]]).
  A11y: React Flow does not replace the `Form` tab keyboard/SR-complete equivalent — the
  [[dont-mvp-rush-a-roadmap-home-surface]] keyboard path is retained (F1 plan).

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition | Fired? | Justification |
| --- | --- | --- |
| 1. >3 independent states/branches | yes | Beyond R87's pick states, the design adds: draw-to-define (no-governed-match → create), promote (success `201` / dedup `409` / conflict `422`), divergence-warn (origin removed vs. changed), and opt-in re-sync — >3 independent interactive branches. |
| 2. New interaction pattern | yes | Draw-to-*create* via React Flow drag-to-connect + pan/zoom is genuinely new — R85–R87 were explicitly hand-rolled, pick-only; no prior product surface uses a graph lib or literal column-drag. |
| 3. High user-error risk | yes | **Promote mutates the shared, persistent governed ER** (reversible only by delete), and a wrong free-form join silently produces wrong analytics — misstep cost is real. |
| 4. Contract depends on unresolved UI | yes | Whether promote needs a richer conflict payload (vs. the bare reused `409`/`422`) depends on the promote-conflict-resolution UX — not writable as YAML until the F1 gesture is felt. |
| 5. UX confidence below threshold | yes | This **is** the R87 F1 verdict — the human ran the pick-pair and judged it "almost the same as the Form builder"; the free-form builder is precisely the UX we must feel before committing. |

Result: **Flow: DFCFBI (triggers 1, 2, 3, 4, 5)** — F1 React Flow prototype + human review before Contract.

**Design gate CLOSED.** Next (DFCFBI): **F1** — a React Flow prototype of draw-to-define + the promote
affordance + the divergence-warn surface, **contract-safe** ([[dfcfbi-f1-precedes-contract]] — FE state +
request-only; no new wire fields until Contract) and **hard-stopping for human review**
([[dfcfbi-f1-needs-human-review]]) before the Contract gate. Design-doc amendments (canvas.md surfaces
table + React Flow deviation; relationships.md promote-target) land **as the code lands** per
[[design-docs-are-source-code]].

### F1-gate work (2026-06-19) — React Flow prototype (contract-safe; hard-stops for human review)

Started the F1 prototype on the human's go-ahead ("start now"). Cardinality at draw-time: **deferred for
F1** ("we can improve at end of F1") — F1 ships a lightweight default (a quick cardinality picker on the
draw); the infer-vs-prompt call is sharpened after the human feels it. Contract-safe per
[[dfcfbi-f1-precedes-contract]]: FE state + request-only against existing endpoints; **no new wire fields**.

**Engine decision (human's call, 2026-06-19) — React Flow now, full migration.** Surfaced a constraint
found at the F1 build read: the existing canvas has ~15 R85–R87 vitest tests driving the **hand-rolled**
SVG/DOM canvas by `data-component` hooks + a column-click gesture; React Flow renders its own DOM and uses
pointer-drag that happy-dom can't fire like a click (needs ResizeObserver + real element dimensions). So
adopting React Flow is a **full canvas rewrite that rewrites those ~15 tests**, not a drop-in. Given the
choice between "free-form on the current canvas first, React Flow after" and "React Flow now," the human
chose **React Flow now** — highest-fidelity "feels different from the Form builder" (the R87 ask). F1 thus
includes: `@xyflow/react` adoption (the flagged peer-dep deviation), drag-to-connect (governed match →
copy-on-pick; no match → define free-form), promote (`useCreateRelationshipMutation` → existing
`POST /relationships`), divergence warn + opt-in re-sync, and the happy-dom test-harness mocks
(ResizeObserver / `getBoundingClientRect`) to keep the suite meaningful.

_(Progress log below.)_

### F1 build landed (2026-06-19) — awaiting human review

**Scope built** (FE-only, contract-safe — no new wire fields; promote reuses the existing
`POST /relationships`):

- **`@xyflow/react@12.11.0`** added to `apps/builder` (the flagged peer-dep deviation — canvas.md
  surfaces-table currently declares `react, antd`; to record at F2/design-sync).
- **Model ops** — `chain.ts` `freeFormRel` (mint a query-owned rel, `originRelationshipId: null`);
  `joinGraph.ts` `resolveConnect` (pure draw-router: governed match → copy-on-pick · no match → define ·
  self/cyclic/disconnected → invalid) + `relDivergence` (copied-rel drift vs. origin); `useQueryBuilder`
  `defineJoin` / `promoteRel` (→ `useCreateRelationshipMutation`) / `resyncRel` + `promoteState`.
- **`QueryCanvas` rebuilt on React Flow** — custom column-handle nodes; **drag a column handle → another**
  routes through `resolveConnect`; **free-form define** opens a cardinality picker then `defineJoin`; the
  edge toolbar carries **Promote** (any rel), **Re-sync** (diverged copies), and the leaf `[×]` delete;
  **divergence + stale** render as warn alerts (warn-only — the query keeps running on its snapshot). The
  Form tab stays the keyboard/SR-complete equivalent (React Flow drag is mouse-first; a11y unchanged).
- **i18n** — 19 new `queries.builder.*` keys in `en` + `vi`.

**Verification**: **tsc clean**; **full vitest 181/181** (the R85/R87 canvas suite rewritten for React Flow —
12 new pure `resolveConnect`/`relDivergence`/`freeFormRel` tests + the canvas component tests now drive a
React Flow measurement harness: a firing `ResizeObserver` + `getBoundingClientRect` so edges render in
happy-dom); **production `vite build` succeeds** (React Flow CSS bundled; the pre-existing chunk-size
advisory is unchanged). The **draw-to-connect drag gesture itself is human-verified at this F1 review**
(happy-dom cannot fire a React Flow connect) — its *routing* is unit-tested via `resolveConnect`; this is
the gap the DFCFBI F1 hard-stop exists to close ([[dfcfbi-f1-needs-human-review]]).

**Deferred to post-F1 (not gaps — sequencing):** the **cardinality-at-draw** UX (infer vs. the current
quick-prompt) is refined after the human feels it (their "improve at end of F1" call); **design-doc
amendments** (canvas.md surfaces-table + React Flow deviation, relationships.md promote-target) land **as
the code settles** post-review per [[design-docs-are-source-code]] — held now because F1 may shift on
review. **Contract gate is next** (DFCFBI) — promote currently rides the existing endpoint with no wire
change; if the F1 review wants a richer promote-conflict payload (selector condition 4), that lands at C.

**F1 fix (2026-06-19) — canvas rendered nodes but was inert.** Human running the app reported nodes
showing but no pan/drag/connect. Cause: React Flow's pane needs (a) its base CSS and (b) a
definitely-sized parent — a side-effect CSS import inside the lazily-mounted canvas isn't reliably
injected by HMR, and the `height:100%`/flex chain could collapse the pane to 0px (nodes still show via the
overflowing viewport → "renders but inert"). Fix: moved `@xyflow/react/dist/style.css` to the app entry
(`main.tsx`) and pinned the pane to an explicit `height: clamp(420px, 60vh, 640px)`. tsc + 55 canvas tests
still green. **A hard refresh (Ctrl/Cmd+Shift+R) is needed to pick up the entry CSS.**

**F1 agent-verification (2026-06-19, Playwright headless on the running dev app).** Drove the real canvas
to confirm the fix + interactions (the human still owns the *feel* verdict): canvas renders (React Flow,
styled, CSS now from entry); **drag accounts.tier → owners.tier created a 2nd governed edge (copy-on-pick)**;
**drag owners.owner_name → regions.region opened the "Define a free-form relationship" cardinality modal**
(the gesture that *creates*). Two follow-on fixes made during verification: (a) the first drag failed
because a newly-**staged node landed off-viewport** — added `fitView` on node-set change so staged/joined
nodes stay visible; (b) added React Flow **`<Controls>` (zoom/fit) + `<Background>`** grid. tsc clean.
**Finding for the human's review:** edge labels (key pair · cardinality · Governed/Free-form · Promote ·
[×]) **overlap adjacent node cards** when nodes are close (the "Promote" link gets clipped) — a layout
polish item to batch with the cardinality-UX decision.

**F1 HARD-STOP — the human runs the app**: open a query builder → Canvas tab → drag a column to a column on
another source. Confirm: (a) a **no-governed-match** pair opens the cardinality picker and **creates** a
free-form join (the gesture finally *creates*); (b) a **matching** pair copies the governed rel; (c)
**Promote** pushes a rel to the workspace ER; (d) editing/removing a governed rel raises the **divergence
warn** and **Re-sync** adopts it — the query never breaks (R88 snapshot). Does the free-form builder now
feel **distinct from the Form builder** (the R87 verdict)?

### F1 review + Contract/Backend gates (2026-06-19)

**F1 human review — "feels right" (signed off, 2026-06-19).** The human ran the app (after the
render/interaction fixes + agent Playwright verification) and judged the free-form builder **distinct from
the Form builder** — the R87 verdict is answered. They flagged **usability gaps to improve later, not now**;
captured as a deferred batch per [[2026-06-18-r-ui-bug-fixing-round]] (don't fix UI usability piecemeal
mid-feature → a dedicated polish round). F1 hard-stop CLEARED.

**Contract gate — FE-only, no wire change (CLOSED).** Confirmed against the contract: `query.yaml`
`QueryRelationship.originRelationshipId` is already nullable and its description already anticipates "R89 —
defined free-form", so **free-form define adds no field** (it sets `originRelationshipId: null`, already
valid). **Promote** reuses the existing `POST /workspaces/{id}/relationships` (`relationship.yaml`
`CreateRelationship` body = exactly the fields promoted; dedup `409` + dtype `422` already specified).
**Divergence** is an FE diff. No new route, field, or error code → no `query.yaml` change. Conformance held
(MSW `additionalProperties:false` + `contract-validator` green in the 181; free-form/diverged definitions
loaded through MSW without contract drift). Selector condition 4 (richer promote-conflict payload) did
**not** fire at F1 — the bare `409/422` + the `CanvasPromoteError` alert sufficed.

**Backend gate — no change (CLOSED).** The promote target endpoint already exists (R70) and already does
the whole rulebook (dedup/dtype/self-join); the resolver is origin-agnostic (R88) so free-form rels join
with no engine change. Nothing to build server-side; backend pytest unaffected.

### Design-sync (2026-06-19) — docs reconciled to the React Flow build

Ran the **`design-sync`** skill on `data-management/queries` (code-truth). **`canvas.md` rewritten**
(676 → 470 lines): React Flow editor (draw-to-connect copy-on-pick + free-form define + cardinality picker,
promote, divergence warn + opt-in re-sync, fitView/Controls/Background); surfaces table flags
**`@xyflow/react` as the earned peer-dep deviation**; R80 verdict-record + Phase A/B/C ledger compacted out;
verified the standalone "New query" empty-canvas entry is **still not built** → kept deferred (not claimed).
**Ripples**: `queries.md` + `query-construction.md` retargeted "R89 free-form/promote deferred" → built;
`relationships.md` notes `POST …/relationships` is also the **promote target**. Drift report:
`.agents/tmp/design-sync/data-management-queries-R89.md`. Gates: **design:lint 0 · design:tokens 0 ·
markdownlint 0 · check_links clean · round-lint 0**.

## Check

_(Filled as the gates close — verification against the [Acceptance criteria](#acceptance-criteria-draft-sharpen-at-design).)_

- [x] **Plan gate** — scope (define + promote + warn) + React Flow + warn-only posture ratified by the
      human ("proceed", 2026-06-19).
- [x] **Design gate** — real code re-confirmed (resolver origin-agnostic → define is FE-only; promote
      reuses `POST /relationships` with 409 dedup + 422 dtype; divergence is an FE diff vs. the origin
      governed rel; React Flow not yet a dep — the earned, flagged deviation); `flow-selector` →
      **5/5 → DFCFBI (triggers 1,2,3,4,5)**.
- [x] **F1 gate** — React Flow canvas built (draw-to-connect → copy-on-pick / free-form define + cardinality
      picker; promote; divergence warn + re-sync); tsc clean, **vitest 181/181**, build green; agent
      Playwright-verified on the running app (governed connect creates an edge; no-match opens the define
      modal); **human review "feels right" — distinct from the Form builder (R87 answered)**.
- [x] **Design docs current (design-sync)** — reconciled `canvas.md` (React Flow + define/promote/divergence,
      ledger compacted, `@xyflow/react` deviation flagged) + retargeted `queries.md` / `query-construction.md`
      + the `relationships.md` promote-target note; design:lint/tokens/markdownlint/check_links all 0.
- [x] **Round split — this round = [D + F1 + design-sync]; "the rest" = R90** _(human's DFCFBI-as-2-rounds
      call, 2026-06-19)_. R89 ships Design + the F1 prototype (production-grade FE, feel-confirmed) +
      design-sync. **Contract (no wire change) and Backend (no change) were established as *Design findings*
      here** (see the Do log); their formal confirmation, **F2 hardening + the usability-polish batch**, and
      the **real-backend Integration** (MSW→DuckDB/CORS, [[seed-data-vs-msw-complementary]]) are **R90**.
- [ ] **Complete** — **human flip** for the D+F1+design-sync round (the feel-review is done). Only humans
      flip to `Complete` ([governance](../../context/governance.md)).

## Act

**Round at Review (2026-06-19)** — F1 human-signed-off ("feels right"); Contract + Backend = no change;
design docs synced. Awaiting the human's `Complete` flip + commit.

**Learnings**:

- **A "new interaction" round can still be contract-frozen.** DFCFBI fired 5/5 (genuinely new gesture), yet
  the round shipped with **zero** contract/backend change — R88's groundwork (nullable `originRelationshipId`,
  origin-agnostic resolver) + the pre-existing `POST /relationships` (R70) meant free-form define, promote,
  and divergence were all reachable FE-only. DFCFBI bought the **F1 prototype + human-feel review**, which is
  what the round actually needed; it did not imply wire churn. The flow chain and the contract blast-radius
  are independent axes.
- **React Flow is inert without entry-CSS + a sized pane — and that reads as "no code bug".** The canvas
  rendered nodes but nothing was interactive because (a) a side-effect CSS import inside a lazily-mounted
  component isn't reliably HMR-injected, and (b) a collapsing `height:100%`/flex chain leaves the pane 0px
  (the viewport overflows, so nodes still show). Both are environment/layout, not logic — green unit tests
  said nothing. Import the lib CSS at the app entry; give the pane an explicit height. _(Candidate principle
  once it gets a 2nd rep.)_
- **happy-dom can't fire a React Flow connect — so test the router, not the drag.** Extracting
  `resolveConnect` as a pure function made the routing unit-testable; the drag gesture itself is the F1
  human-review's job. Canvas component tests need a firing `ResizeObserver` + `getBoundingClientRect` mock or
  edges never render (React Flow only draws edges once nodes are measured).

**Promotions**: none land this round. The "draw-to-pick is a selection, not a creation" UX principle
([[query-owned-relationships]]) got its **second confirming rep** — drawing now *creates* and the human
confirmed it reads distinctly from the Form builder; it is a stronger `context/` promotion candidate now,
but hold for the human's review per the governance brake. The two F1 learnings above are candidates pending
a second rep.

**Follow-ups (not promotions, just notes):**

- **Canvas usability polish (deferred batch, [[2026-06-18-r-ui-bug-fixing-round]])** — the human's "feels
  right but some usability gaps, improve later." Don't fix piecemeal mid-feature → a dedicated polish round.
  Known items so far: (1) **edge-label/node overlap** (the key-pair + tags + Promote/[×] toolbar clips
  behind adjacent node cards when nodes are close); (2) **cardinality-at-draw UX** (the quick-prompt modal
  vs. inferring); (3) **handle discoverability** (are the column dots obviously drag targets?); (4) any
  further gaps the human enumerates. _Architecture (React Flow, define/promote/divergence) is settled — this
  is polish, not redesign._
- **Design-doc sync is R89's remaining closing step** — run `design-sync` on `data-management/queries`
  (+ `relationships.md` promote-target) to reflect the React Flow build; record the `@xyflow/react`
  surfaces-table peer-dep deviation.
- Dashboards / charts over the richer queries → **R90+**.
- Data-saver "save before staling" lifecycle → a future theme.
- The "draw-to-pick is a selection, not a creation" UX principle ([[query-owned-relationships]]) gets its
  second confirming rep here — a `context/` promotion candidate if it holds.

## Feeds into → Round_90 (free-form canvas — "the rest": C/B confirm + F2 + Integration)

Per the **DFCFBI-as-2-rounds split** (human, 2026-06-19): R89 shipped **[D + F1 + design-sync]**; R90
inherits **"the rest"** of the flow:

- **Contract** — confirm no wire change (R89 finding: free-form rides the nullable `originRelationshipId`;
  promote reuses `POST /relationships`; divergence is FE).
- **Backend** — confirm no change (promote endpoint R70 + resolver R88 already do the job).
- **F2** — harden the F1 build + the **deferred usability-polish batch** ([[2026-06-18-r-ui-bug-fixing-round]]):
  edge-label/node overlap, cardinality-at-draw UX (infer vs. prompt), handle discoverability.
- **Integration** — **real-backend end-to-end** (not MSW): promote actually persists to the DB; a free-form
  join actually runs in DuckDB; CORS/preflight clean ([[seed-data-vs-msw-complementary]],
  [[dfcfbi-f1-needs-human-review]]).

R90's Goal cites this via **Inherits from ← Round_89**.

## Feeds into → Round_91+ (dashboards) (TBD)

With free-form define + promote landed (and hardened in R90), queries carry rich, exploratory, query-owned
relationships — the substrate for **R91+ dashboards / charts** (the theme's payoff: free exploration → rich
queries → visualized).
