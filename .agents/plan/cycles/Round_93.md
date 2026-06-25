# Round 93: column provenance on the wire + F2 fidelity — query×query joins resolve for real (C + B + F2 + Integration)

**Status**: **Complete** — human-signed-off 2026-06-25 ("okay to close"). All gates closed
(Plan · Contract · Backend · F2 · Integration); two I-phase defects fixed (query-node-draw
re-anchor + controls top-left). DFCFBI **back half** of the [Round_92](Round_92.md) split per
[[dfcfbi-two-round-split]] (front half shipped & Complete).
**Date started**: 2026-06-24
**Date completed**: 2026-06-25
**Flow**: **DFCFBI back half — [C + B + F2 + Integration]** (inherited from R92's Design-gate split;
the `flow-selector` ran at R92 → DFCFBI (1,2,5) — not re-run here, the split is the decision). F1
already happened (R92); F2 is the post-build feel-check on the real-resolving stack + the fidelity polish.

## Goal

**Inherits from ← [Round_92](Round_92.md)** — the query×query canvas UX is **F1-proven & human-accepted**:
a user can draw a join off any source (dataset or saved query), and the drawn join is **legal on R91's
wire** because the canvas translates a query-column drag into the owning leaf `(ds_, column)` via
**column provenance** that it currently **derives frontend-side** (the F1 mock, `provenance.ts`).

R93 makes that real on the **wire + engine**, then closes the round with the deferred **F2 visual
fidelity** and a real-stack **Integration**:

1. **Provenance on the wire (C + B)** — the resolver emits, per effective column, the leaf
   `ownerSourceId` (`ds_`) + `sourceColumn` it traces to; the FE **reads it off the wire** and
   **retires the FE mock** (`provenance.ts`'s re-derivation — throwaway per R92).
2. **F2 fidelity** — the deferred Attio-style polish the human flagged ("not nice yet, okay"):
   per-field **column-type glyphs** + **curved/rounded edges**.
3. **Integration** — a query×query join drawn on the canvas resolves for real on **persisted-definition
   + server-computed provenance** against the live DuckDB/CORS stack; then the human **Complete** flip.

_Track: 1 (product — completes the query×query relationships theme R88→R92 by making the F1-proven
interaction resolve on the real stack + the fidelity pass). Pulled by ← [Round_92](Round_92.md)
"Feeds into → Round_93" + the F1-prep pinned wire shape + the `ui-design` F1 watch-item. Per the
[Evolution Rule](../../AGENTS.md)._

## Plan-gate framing — the wire shape is already pinned (grounded at R92 F1-prep)

R92's cold-reviewer pre-mortem pinned the **Contract target** so the F1 mock wouldn't diverge from
what R93 can cheaply emit. Re-grounded against the real backend:

**Contract add.** Each *effective* `resolvedColumns` item gains the leaf it traces to:

```json
{ "name": "Deals.id", "dtype": "...", "ownerSourceId": "ds_abcd1234", "sourceColumn": "id" }
```

+ `ownerSourceId` is always a **leaf `ds_`** — it matches the resolver's left-matching, which tests
  `leftSourceId ∈ dataset_id_sets` (leaf ids) at
  [queries.py:205](../../../workspace/apps/backend/app/routers/queries.py#L205).
+ `sourceColumn` is the **pre-qualification** name on that leaf; the collision-qualified `name`
  (`Deals.id`) stays the display/header, the join key uses `sourceColumn`.

**Cheap to emit — no engine reshape, no migration:**

+ `build_effective_columns`
  ([rows_reader.py:137](../../../workspace/apps/backend/app/ingest/rows_reader.py#L137)) today takes
  `sources: [(dataset_name, columns)]` and concatenates with collision-qualification — it **does not
  carry the leaf `ds_` id**. The single change: thread the **leaf id** into `sources`
  (`[(dataset_name, dataset_id, columns)]`) so each effective entry can carry `{ownerSourceId,
  sourceColumn}` alongside `{name, dtype}`.
+ `resolve_source` ([queries.py:99](../../../workspace/apps/backend/app/routers/queries.py#L99)) — a
  `ds_` leaf attaches `ownerSourceId = <this ds_>`, `sourceColumn = c.name` (1:1, exact); a `qr_`
  **passes up** its sub-relation's provenance (its effective columns already carry it — clean
  recursion, arbitrary depth, the resolver already recurses).
+ `_resolved_columns` ([queries.py:257](../../../workspace/apps/backend/app/routers/queries.py#L257))
  emits the enriched items on the wire.
+ **No alembic migration** — `resolvedColumns` is **computed-on-read**, never persisted (only
  `definition_json` is stored, unchanged). Confirmed: it is built per-request by `_resolved_columns`.

**Boundary (unchanged from R92):** only a **1:1-owned** column gets provenance; a derived/aggregate
column has no single owner → no `ownerSourceId` → not a legal left key. No aggregation exists today,
so the new fields are present for every current effective column; the derived case is documented, not
built-for.

## Scope posture — make-it-real + the named F2 polish; no theme creep

R93 closes the query×query theme. It is **not** the dashboards / value-out pivot (that stays a later
theme, [[post-mvp-roadmap-migration-first]]). F2 is **bounded to the two named fidelity items**
(glyphs and curved edges) the R92 scope table deferred — not an open-ended reskin.

| Element | R93 | Notes |
| --- | --- | --- |
| Provenance on the wire (C + B) | ✅ | the enabler; retires the F1 FE mock |
| FE reads wire provenance (retire `provenance.ts` re-derivation) | ✅ | close the loop; `resolveConnect` consumes the wire field |
| Per-field column-type glyphs (F2) | ✅ | the Attio desirability item |
| Curved/rounded edge styling (F2) | ✅ | the Attio desirability item |
| Real-stack Integration (query×query resolves for real) | ✅ | seed + DuckDB/CORS; human Complete |
| Dashboards / charts; data-saver lifecycle | ❌ | their own future themes |
| Derived/aggregate left-keys; `qr_`-on-left | ❌ | named triggers; unneeded today |

## Plan (by gate — DFCFBI back half: C + B + F2 + Integration)

1. **Contract gate** — extend `resolvedColumns` items in
   [`_shared/query.yaml`](../../../workspace/packages/contracts/_shared/query.yaml#L256) with optional
   `ownerSourceId` + `sourceColumn` (keep `additionalProperties: false`; add the two props + decide
   required-when-present vs always-optional — derived columns would omit them). Ripple to the preview
   contract's `resolvedColumns` (same shape). Update **MSW** to emit the fields (the inverse of the F1
   constraint — `additionalProperties:false` now *expects* them). `gate-walker Contract` close.
2. **Backend gate** — thread the leaf id through `build_effective_columns`; `resolve_source` attaches
   (ds_) / passes up (qr_) provenance; `_resolved_columns` emits it. `uv run pytest` (new: a composed
   query's `resolvedColumns` carry correct `ownerSourceId`/`sourceColumn`, incl. a **nested `qr_`
   base** — provenance survives recursion; a collision-qualified name still names its true leaf).
   **No alembic migration** (computed-on-read). `gate-walker Backend` close.
3. **F2 gate** — _(a)_ **FE consumes wire provenance**: `QueryCanvas` reads
   `resolvedColumns[].ownerSourceId`/`sourceColumn` instead of re-deriving; **delete the
   `provenance.ts` mock** (the throwaway). _(b)_ **Fidelity polish**: per-field column-type glyphs +
   curved/rounded edges. **Human F2 feel-check** — the second DFCFBI feel-stop (now on the
   real-resolving stack; the `ui-design --fidelity` pass re-checks the "+ N more" keyboard/SR
   watch-item R92 flagged).
4. **Integration gate** — real-stack agent-verification (`pnpm dev` + seed): draw a query×query join,
   confirm it **resolves for real** (rows return; the left key is the server-provenanced leaf), the
   `composition_cycle` / unavailable states hold, then the **human Complete** flip
   ([[dfcfbi-f1-needs-human-review]] — Complete is human-signed-off).

## Acceptance criteria

+ [ ] **Provenance on the wire** — `GET /queries/{id}` and `…/preview` return `resolvedColumns` items
      carrying `ownerSourceId` (a leaf `ds_`) + `sourceColumn` for every 1:1-owned effective column;
      a nested `qr_` base's columns carry the correct leaf (recursion holds); contract + MSW green
      (`additionalProperties:false` satisfied).
+ [ ] **No migration / no persisted change** — only `_resolved_columns` output changes;
      `definition_json` and the stored schema are untouched; `uv run pytest` green.
+ [ ] **FE consumes the wire, mock retired** — `QueryCanvas`/`resolveConnect` read provenance off
      `resolvedColumns`; `provenance.ts` (the FE mock) is deleted; the builder test suite green.
+ [ ] **F2 fidelity** — per-field glyphs + curved edges land; **human F2 feel-checked**; the
      `ui-design --fidelity` "+ N more" keyboard/SR watch-item passes.
+ [ ] **Integration** — a query×query join drawn on the canvas resolves on the live stack; human
      flips **Complete**.

## Risks / unknowns

+ **Recursion correctness** — a `qr_` base whose own base is a `qr_`: provenance must pass up through
  every `resolve_source` level to the true leaf. The F1 mock only proved one level cheaply; the engine
  must hold at depth. _Mitigate: a nested-composition pytest case at the Backend gate._
+ **MSW inversion** — F1 required the mock *off* the response (`additionalProperties:false`); R93
  requires it *on*. Any MSW query fixture with `resolvedColumns` must add the fields or validation
  fails. _Mitigate: update fixtures in the Contract gate, not the Backend gate._
+ **`sourceColumn` vs qualified `name` drift** — the join key must use `sourceColumn` (pre-qualified),
  not the display `name`; a regression would send `Deals.id` as a leaf column and 422. _Mitigate: an
  explicit assertion in the resolver test + the Integration draw._
+ **F2 scope creep** — bounded to glyphs + curved edges; broader reskin is out (the brake).

## Do

### Plan-gate draft — opened from R92's feeds-into (2026-06-24)

Opened on the human's instruction ("plan R93") after flipping R92 Complete. R93 is the **committed
back half** of the R92 DFCFBI split (not a re-opened theme fork) — its scope is fixed by R92's
Feeds-into + the F1-prep pinned wire shape, re-grounded above against the real backend
(`resolve_source`, `build_effective_columns`, `_resolved_columns`; computed-on-read → no migration).

**Plan gate ratified (human, 2026-06-24):** "as drafted" — scope locked, no `cold-reviewer` pass
this round (the human's call; the wire shape was already cold-reviewed at R92's F1-prep). → **Plan
gate closed; next: Contract.**

### Contract gate — closed (2026-06-24)

Extended `resolvedColumns` items with **optional** `ownerSourceId` (a leaf `ds_`, pattern-bound) +
`sourceColumn`, keeping `additionalProperties: false`. Optional-not-required so a future
derived/aggregate column (no single owner) omits them — no aggregation today, so every current
effective column carries them.

+ **Contract schema** — both inline copies:
  [`_shared/query.yaml`](../../../workspace/packages/contracts/_shared/query.yaml#L256) (the
  canonical `Query.resolvedColumns`) + the
  [preview](../../../workspace/packages/contracts/queries/preview.contract.yaml#L130) response;
  examples enriched in [put](../../../workspace/packages/contracts/queries/put.contract.yaml#L92) +
  preview (R42 examples-as-fixtures).
+ **FE contract type** — `ResolvedColumn`
  ([types.ts](../../../workspace/apps/builder/src/features/data-management/queries/types.ts#L80))
  gains optional `ownerSourceId` / `sourceColumn`, mirroring the wire; the doc-comment names the
  R93 mock retirement.
+ **MSW conformance** — `withProvenance` fixture helper; `MOCK_JOINED_QUERY` + `MOCK_CHAIN_COLUMNS`
  now emit provenance (a collision-qualified `accounts.tier` keeps `sourceColumn: "tier"`), so MSW
  validates the **present** shape (the inverse of F1's mock-off-the-response constraint).
+ **Verified:** `@mdd/contracts` vitest **24/24** (OpenAPI valid + examples conform); builder
  `type-check` clean; builder vitest **191/191** (MSW responses-with-provenance pass contract
  validation). The wire add is **backward-compatible** — the real backend doesn't emit the fields
  until the Backend gate; optional ⇒ both presence and absence validate.

**Contract gate → CLOSED.** Next: **Backend** (emit provenance for real + pytest).

### Backend gate — closed (2026-06-24)

The resolver now emits column provenance for real — the engine reshape was exactly as scoped (no
migration, no SQL change):

+ **`build_effective_columns`**
  ([rows_reader.py:137](../../../workspace/apps/backend/app/ingest/rows_reader.py#L137)) — rides
  `ownerSourceId` / `sourceColumn` through the concatenation: it copies them onto each effective
  entry and **only collision-qualifies the display `name`**. The SQL alias still keys on the
  source-exposed `c["name"]`, so the join/select machinery is byte-for-byte unchanged.
+ **`resolve_source`**
  ([queries.py:99](../../../workspace/apps/backend/app/routers/queries.py#L99)) — a `ds_` leaf
  attaches `ownerSourceId = <this ds_>`, `sourceColumn = <bare name>` (1:1); a `qr_` **passes its
  sub-query's already-provenanced effective columns up** — so provenance traces to the true leaf at
  **any nesting depth** (the recursion the resolver already does).
+ **Emit** — new `ResolvedColumn` model (`Column` + optional `ownerSourceId` (a `DatasetId`) /
  `sourceColumn`, `extra="forbid"`); `_resolved_columns` + the preview handler emit it via
  `_to_resolved(...).model_dump(exclude_none=True)` (a derived column's `None` provenance is
  dropped — optional-contract-clean). `QueryModel.resolvedColumns` retyped; `Column` import removed.
+ **No alembic** — confirmed: `resolvedColumns` is computed-on-read in `_resolved_columns`; only
  `definition_json` is persisted, untouched. The stored schema does not change.
+ **Verified** — `uv run pytest` **200/200** (+1: two new provenance cases —
  `test_query_x_query_effective_columns_qualified` now asserts a `qr_`-right column's
  **display name is query-qualified (`Accounts base.id`) while its provenance owner is the LEAF
  `accounts` dataset**; `test_resolved_columns_provenance_traces_through_composed_base` proves the
  recursion through a composed driving base). `ruff` clean; schema-parity + conformance green (the
  backend output conforms to the extended contract via `validate_response`).

**Backend gate → CLOSED.** Next: **F2** (FE consumes the wire + retires the mock; fidelity polish;
the **human F2 feel-check** hard-stop).

### F2 build — done; awaiting the human feel-check (2026-06-25)

The provenance loop is closed FE-side and the deferred fidelity landed:

+ **FE consumes the wire; the mock is retired.** `QueryCanvas`'s `effectiveByQr` now reads a
  `qr_`'s effective columns + provenance straight off `q.resolvedColumns` (`ownerSourceId` /
  `sourceColumn`) — a single-source query (no `resolvedColumns`) falls back to its driving dataset's
  columns, owned 1:1. **`provenance.ts` (the F1 mock) is deleted**; `provenanceOf` / `columnsOf`
  read the wire-derived map. `resolveConnect` is unchanged (still provenance-aware); its unit tests
  stay (the `effectiveColumnsWithProvenance` tests went with the mock).
+ **Fidelity (the two named Attio items).** _(a)_ **Per-field column-type glyphs** — a muted line
  icon per dtype (`TextAa`/`Hash`/`CheckSquare`/`CalendarBlank`/`Clock`, supplementary to the text
  name + a `title`, so never glyph/colour-alone — accessibility holds). _(b)_ **Rounded edges** —
  `getSmoothStepPath` (orthogonal, `borderRadius: 12`) replaces the bezier S-curve.
+ **Draw-time dtype guard (human-requested in the feel-check).** `resolveConnect` now rejects an
  incompatible key pair (e.g. text ↔ number) **before minting** — `invalid: 'dtype_mismatch'` with a
  message — mirroring the backend's `_compatible` rule (equal dtype, or both numeric). **FE-lenient
  on unknown dtypes** (a not-yet-loaded column isn't blocked; the backend stays the authoritative
  gate). Previously an incompatible draw minted an edge that the next preview blocked as
  `relationship_stale` (feedback one beat late); now it's instant. Threaded via a `dtypeOf` resolver
  (the same per-source column space the nodes render).
+ **Distinct cursors (human-requested in the feel-check).** The node card and the pane read
  identically on hover, so panning vs. moving a node was indistinguishable. Now each action reads
  differently: **pane = `grab`** (pan), **node card = `move`** (reposition, *unchanging* while
  dragging — per the human, the icon shouldn't flip mid-move), **column row = `default`** (neutral),
  **handle dot = `crosshair`** (draw a join). The neutral-row → crosshair-dot contrast makes the
  draw-a-join affordance obvious as you reach the dot. CSS-only, scoped to the canvas.
+ **Verified (automated):** builder `type-check` clean; vitest **193/193** (the retired mock tests
  removed; +4 dtype-guard cases: incompatible rejected, numeric cross allowed, equal allowed, unknown
  lenient); prettier clean. The "+ N more" disclosure, picker, promote-suppression, unavailable node,
  and Form-tab parity are unchanged.

**HARD-STOP — human F2 feel-check** ([[dfcfbi-f1-needs-human-review]]): now on the **real-resolving
stack** (`pnpm dev` — the joins resolve on server provenance, not a FE mock). Exercise drawing off a
query-rooted node, the glyphs/rounded-edge feel, and confirm a query×query join returns rows; then
flip F2.

### F2 — human feel-checked & closed (2026-06-25)

The human ran it on the real-resolving stack and **accepted F2**, after a feel-check polish pass
(driven interactively; all committed as one squash per the human's "review then commit" preference):

+ **Draw-time dtype guard** — `resolveConnect` rejects an incompatible key pair (text ↔ number)
  before minting (`invalid: 'dtype_mismatch'`), mirroring the backend `_compatible` rule, FE-lenient
  on unknown dtypes. Closed the "validation felt one beat late" gap the human spotted.
+ **Cursor scheme** — pane `grab` (pan) · node card `move` (steady while dragging) · column row
  `default` · handle `crosshair`; so pan vs. move-node vs. draw-join each read distinctly.
+ **Enlarged handle hit-area** — a transparent `::before` grows the connect-dot grab/hover zone
  without enlarging the visible dot.
+ **One-line toolbar** — `[+ Add a source] [👁 N rows ↗] [? Help]`, top-right, uniform text+icon;
  the verbose drag-tip folded into the Help popover; the preview chip passed into the canvas toolbar.
+ **Maximize** — a tab-size in-page overlay (NOT the OS Fullscreen API, which left the pane
  unmeasured → blank) fills the viewport to draw with room; `Esc` exits; the fit re-runs on toggle.

**Verified (automated):** builder `type-check` clean; vitest **193/193**; prettier + i18n parity
clean. **F2 gate → CLOSED** (human-accepted). Next: **canvas.md re-sync**, then **Integration**.

### canvas.md re-sync — done (2026-06-25, the F2-close pre-step to Integration)

Ran `design-sync` (sync mode) on
[`canvas.md`](../../design/data-management/queries/canvas.md) — the F2 build moved the code past
the doc. Drift report: [`.agents/tmp/design-sync/queries-canvas.md`](../../tmp/design-sync/queries-canvas.md)
(9 drift items). Reconciled to code truth:

+ **Provenance: FE-derived → wire-read.** The doc claimed provenance is computed frontend-side
  (`provenance.ts`) with the on-the-wire add "deferred". Code: the resolver emits
  `resolvedColumns[].ownerSourceId/sourceColumn`; `QueryCanvas.effectiveByQr` reads it off the
  wire; **`provenance.ts` is deleted**. Rewrote the Editing/Query-node/Data-contract/Scope
  sections; **deleted the phantom `provenance.ts` surface row**; renamed the Data-contract
  heading to "consumes the resolver's column provenance".
+ **Deferred items that shipped, moved OUT-of-scope → built:** "column provenance on the wire"
  and "visual fidelity polish (glyphs + curved edges)" — both removed from the deferred list.
+ **Added current behaviour:** the `dtype_mismatch` invalid draw (guard before minting,
  FE-lenient on unknowns); per-field type glyphs (`@phosphor-icons/react`, supplementary + a11y);
  rounded orthogonal edges (`getSmoothStepPath`); the cursor scheme + enlarged handle hit-area;
  the one-line top toolbar (status chip folded in); the in-page maximize overlay. Updated the
  Surfaces table, peer-dep deviation note, token map (glyph colour), ASCII intent, and
  acceptance criteria 5 + 11. De-attributed two round-stamp ledger phrases (F1 overlap, R90 batch).
+ **Gate green:** `design:lint` 0 · `design:tokens` 0 · `markdownlint` 0 · `check:links` all
  resolved (the new intra-doc fragment resolves). Doc-only change; no code touched.

→ **canvas.md in sync. Next: Integration gate** (real-stack query×query resolves + human Complete).

### Integration gate — agent-verified on the real stack (2026-06-25); awaiting human Complete

Brought up the real backend (`uv run uvicorn` on `:8000`, DuckDB **v1.1.3**) + `seed.py --reset`
(workspace `ws_18c510d0`: regions·products·customers·orders, 3 governed rels, 6 base queries) —
the live DuckDB/CORS path, [[seed-data-vs-msw-complementary]]. Verified the R93 wire + engine for
real (not fixtures):

+ **Provenance on the wire (GET + preview).** `GET /queries/qr_2e742bbf` (seed's composed
  customers ⋈ orders) returns `resolvedColumns` carrying `ownerSourceId`/`sourceColumn` per
  column. The collision-qualified display names trace to the **true leaf**: `customers.customer_id`
  → owner `ds_50617934`/src `customer_id`; `orders.customer_id` → owner `ds_2bee41e2`/src
  `customer_id`.
+ **A query×query join resolves for real.** Built a `qr_`-right join (drive `customers`, free-form
  join in the saved query `qr_e3a8c38b` "Big or pending orders" on `customer_id` — exactly the
  canvas draw) → `POST …/queries/preview` returned **10 rows** of real seed data (first row: Acme
  Corp ⋈ a $1200 pending order). The **recursion proof on the live stack**: the right query's
  columns trace through the `qr_` to the **orders leaf** `ds_2bee41e2` (e.g.
  `Big or pending orders.customer_id` → owner `ds_2bee41e2`), never the `qr_` id; the left key is
  the server-provenanced leaf `ds_50617934`.
+ **`composition_cycle` holds.** Forcing a cycle (PUT the right query to join back to the probe)
  is **rejected at write time — `422 cyclic_join`** — the right query stays untouched
  (`relationships: [] · joins: []`). The throwaway probe query was deleted (`204` → `404`); the
  seed workspace is back to its 6 queries (clean).
+ Backend stopped cleanly (`dev:local:down`), `:8000` freed; the seed persists for the human's
  in-browser pass.

**HARD-STOP — human Complete** ([[dfcfbi-f1-needs-human-review]]): the API-level resolution +
provenance + cycle-guard are agent-verified on the real stack; the in-browser **canvas draw** of a
query×query join and the **Complete flip** are the human's. Run `pnpm dev` (seed already loaded),
open a query, draw off a `qr_` node, confirm rows + the glyph/rounded-edge feel, then flip Complete.

### I-phase defect fix — canvas re-anchors a query-node draw, no orphaned leaf (2026-06-25)

Human-reported during the I-phase in-browser pass: **"Build on this query" → draw a rel → the canvas
shows the query, the dataset the query was built from, AND the added source** (three nodes), instead
of just a rel from the driving query to the added source.

**Root cause (verified, render-only).** Drawing off a `qr_` node, `resolveConnect` correctly rewrites
the left endpoint to the qr_'s **owning leaf** dataset (the resolver requires a leaf `leftSourceId` —
[queries.py:209](../../../workspace/apps/backend/app/routers/queries.py#L209) matches against the
base's inner leaf ids, never a `qr_`). The canvas node-builder then did `push(qrel.leftSourceId)`,
spawning that leaf as a **separate node** (≠ the qr_ root) → the qr_ root rendered **orphaned** + the
inner leaf showed as an extra card. Confirmed it's render-only: built the exact model on the live
stack — it previews **21 rows, all `tier=gold` ⋈ orders**; the stored leaf-left is required and
semantically correct.

**Fix (render-only; model untouched).** Extracted the node/edge construction into a pure
`buildSourceGraph` ([joinGraph.ts](../../../workspace/apps/builder/src/features/data-management/queries/joinGraph.ts) —
the established home for shared canvas selectors). Node set = **root + each hop's RIGHT** only; a hop's
LEFT is never its own node — `displayLeft` re-anchors a stored leaf-left onto the in-graph `qr_` whose
effective column owns it (via wire provenance), with the effective column as the edge handle. A
dataset×dataset left (already an in-graph node) is unchanged; a degenerate ownerless leaf falls back to
rendering as its own node (keeps the edge attached). `QueryCanvas` now consumes `buildSourceGraph` and
anchors each edge on `leftNode`/`leftHandle`.

**Verified:** builder `type-check` clean; vitest **197/197** (+4 `buildSourceGraph` cases:
dataset×dataset unchanged · build-on-query root re-anchor (no orphaned leaf) · query×query joined-in
re-anchor · unresolved hop); prettier clean on the touched files. The in-browser confirmation of the
draw stays the human's (part of the Complete pass).

### I-phase UX fix — canvas controls pinned top-left (2026-06-25)

Human-reported: the zoom/fit/maximize **`<Controls>` sat bottom-left** (React Flow's default), so on a
short viewport they fell **below the fold** and needed a scroll to reach. Set `position="top-left"` on
[`<Controls>`](../../../workspace/apps/builder/src/features/data-management/queries/QueryCanvas.tsx#L1080) —
top-left is clear (the toolbar is top-right). One-line change; `type-check` clean, prettier clean,
`queries.test` **43/43** (canvas still mounts). canvas.md layout synced (ASCII + prose).

## Check

+ [x] **Plan gate** — **ratified** (human, 2026-06-24, "as drafted"); scope locked, no cold-reviewer
      pass this round (wire shape cold-reviewed at R92 F1-prep).
+ [x] **Contract gate** — **closed** (2026-06-24): `resolvedColumns` items gain optional
      `ownerSourceId`/`sourceColumn` (both inline copies + examples + FE type + MSW fixtures);
      contracts 24/24 · builder type-check 0 · builder 191/191. Backward-compatible (optional).
+ [x] **Backend gate** — **closed** (2026-06-24): `build_effective_columns` rides provenance through;
      `resolve_source` attaches (ds_) / passes up (qr_) to any depth; `_resolved_columns` + preview
      emit `ResolvedColumn` (exclude_none). No alembic (computed-on-read). pytest 200/200 (+2
      provenance cases) · ruff clean · schema-parity + conformance green.
+ [x] **F2 gate** — **closed** (human feel-checked & accepted 2026-06-25): FE consumes wire
      provenance + mock retired; fidelity (glyphs, rounded edges) + feel-check polish (dtype guard,
      cursor scheme, enlarged handle area, one-line toolbar, tab-size maximize). type-check 0 ·
      vitest 193/193 · prettier + i18n parity clean.
+ [x] **Integration gate** — **closed; human-signed-off Complete 2026-06-25** ("okay to close").
      Real-stack agent-verification: query×query join previews **10 real rows**; `resolvedColumns`
      provenance traces through the `qr_` to the orders leaf `ds_2bee41e2`; `composition_cycle`
      rejected at write (`422 cyclic_join`); probe cleaned up + canvas.md re-synced. Two I-phase
      defects fixed: canvas **re-anchors a query-node draw** (`buildSourceGraph`, no orphaned leaf)
      + **controls pinned top-left** (reachable on a short viewport). vitest 197/197.

## Act

R93 **closes the query×query relationships theme** (R88→R93) — a user can draw a join off any
source on the canvas and it resolves for real on server-emitted column provenance. Carried lessons:

+ **Provenance computed-on-read scales cleanly** — emitting `ownerSourceId`/`sourceColumn` on
  `resolvedColumns` needed no migration and recursed to the true leaf at any depth; the F1 FE mock
  was a faithful stand-in that retired without churn (the R92 cold-review pin paid off).
+ **A leaf-left that lives inside a `qr_` is a rendering concern, not a model one** — the resolver
  rightly requires a leaf `leftSourceId`; the canvas must re-anchor it onto the owning in-graph
  query node (`buildSourceGraph`). Worth remembering for any future source-graph view.
+ **Two I-phase defects surfaced only in the human's real-app pass** (orphaned-leaf render,
  bottom-left controls below the fold) — reaffirms [[dfcfbi-f1-needs-human-review]]: green gates +
  agent API-verification still can't see layout/feel; the human run is the gate.

Further canvas polish (any additional defects beyond the two fixed) batches to a dedicated UI-bug
round per [[batch-ui-bugs-into-one-round]], not piecemeal. Next theme is the human's call at the
fork (see Feeds-into).

## Feeds into → Round_94+ (the next theme — human's call at the R93 fork)

R93 **closes the query×query relationships theme** (R88 model → R89 free-form canvas → R90 polish →
R91 query×query model → R92 canvas UX → R93 wire + fidelity + real-stack). The next theme is the
human's call at the R93 completion fork; the standing roadmap candidate is the deferred
**dashboards / value-out** theme ([[post-mvp-roadmap-migration-first]]) — visualize a saved Query —
which R91→R92 deferred in favour of finishing relationships. Named non-theme follow-ups stay parked:
derived/aggregate-column left-keys (only if aggregation arrives) and `qr_`-on-left (unneeded while
every effective column traces 1:1 to a single leaf).

**Plan candidate (human-flagged at the R93 I-phase, 2026-06-25):** the **standalone "New query"
create action**. A query today offers `Edit` + `Build on this query`, but there is **no plain
"New query"** entry — `QueryCreatePage` requires a preset `?base=` (the R77 build-on path) and the
catalog has no `[+ New query]`. This is the empty-canvas create entry already deferred in
[canvas.md Scope OUT](../../design/data-management/queries/canvas.md) ([[dont-mvp-rush-a-roadmap-home-surface]]);
now promoted to a **tracked candidate** for a future round (place the first node on an empty graph,
no preset base). Not in R93 scope.
