# Round 93: column provenance on the wire + F2 fidelity — query×query joins resolve for real (C + B + F2 + Integration)

**Status**: **In Progress** — Plan ratified + **Contract + Backend closed**; **F2 build done**
(FE-consumes-wire + mock retired + fidelity), **awaiting the human F2 feel-check** (2026-06-25).
DFCFBI **back half** of the [Round_92](Round_92.md) split per [[dfcfbi-two-round-split]] (front half
shipped & Complete).
**Date started**: 2026-06-24
**Date completed**: —
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
+ **Verified (automated):** builder `type-check` clean; vitest **189/189** (191 − the 2 retired
  mock tests); prettier clean. The "+ N more" disclosure, picker, promote-suppression, unavailable
  node, and Form-tab parity are unchanged.

**HARD-STOP — human F2 feel-check** ([[dfcfbi-f1-needs-human-review]]): now on the **real-resolving
stack** (`pnpm dev` — the joins resolve on server provenance, not a FE mock). Exercise drawing off a
query-rooted node, the glyphs/rounded-edge feel, and confirm a query×query join returns rows; then
flip F2. **Not flipped here.**

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
+ [ ] **F2 gate** — **next** (FE-consumes-wire + retire mock + fidelity + human F2 feel-check).
+ [ ] **Integration gate** — pending (real-stack + human Complete).

## Act

_Pending — round not yet ratified/started._

## Feeds into → Round_94+ (the next theme — human's call at the R93 fork)

R93 **closes the query×query relationships theme** (R88 model → R89 free-form canvas → R90 polish →
R91 query×query model → R92 canvas UX → R93 wire + fidelity + real-stack). The next theme is the
human's call at the R93 completion fork; the standing roadmap candidate is the deferred
**dashboards / value-out** theme ([[post-mvp-roadmap-migration-first]]) — visualize a saved Query —
which R91→R92 deferred in favour of finishing relationships. Named non-theme follow-ups stay parked:
derived/aggregate-column left-keys (only if aggregation arrives) and `qr_`-on-left (unneeded while
every effective column traces 1:1 to a single leaf).
