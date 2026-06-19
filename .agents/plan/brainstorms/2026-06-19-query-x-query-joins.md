# Brainstorm — Query×query joins (a saved Query as a joined-in source)

**Date**: 2026-06-19
**Status**: Opened at R91's Plan gate. The **theme** is chosen by the human (R91 = continue the
free-form/relationships theme, _not_ dashboards); the substantive model calls below are
**proposals for the human + the R91/R92 Design gate**, not yet sealed.
**Pulled by**: R90's human-flagged follow-up — _"Query↔query joins — a query as a non-driving
(joined-in) source → R91+"_ ([Round_90 line 216](../cycles/Round_90.md)) — and the
[queries.md](../../design/data-management/queries/queries.md) OUT-of-scope boundary it names.
_Track: 1 (product feature — model evolution + new capability). Per the
[Evolution Rule](../../AGENTS.md)._

Feeds the queries domain ([queries.md](../../design/data-management/queries/queries.md)) and the
canvas ([canvas.md](../../design/data-management/queries/canvas.md)). Continues the
[[query-owned-relationships]] theme (R88→R90); realizes the
[[query-is-virtual-dataset]] "unify `ds_` ∪ `qr_` as one readable table-source" direction.

---

## 1. The capability — what's missing today

A saved Query (`qr_…`) is **already** a polymorphic source — but only as the **driving base**
(composition, R76/R77): you can make Query B the base and join datasets onto it. What you
**cannot** do today is join a saved query **in** as a peer — a `qr_` on the **right** of a join
hop. Every hop's right side is resolved as a dataset.

| Role of a `qr_` | Today | This theme |
| --- | --- | --- |
| **Driving base** (root of the tree) | ✅ built (composition; recursive `resolve_source`) | unchanged |
| **Joined-in** (right side of a hop) | ❌ resolver reads right as a dataset only | ✅ this is the new capability |

This is a **named, deliberate** scope boundary, not a bug —
[queries.md OUT-of-scope](../../design/data-management/queries/queries.md): _"A `qr_` on the
right of a join hop … the `qr_` source is the **base** only."_ The R90 free-form canvas surfaced
the pull: the `[+ Add a source]` picker lists datasets-only (faithful to the model), and a
composed (`qr_`-driven) query renders **no connect handles** on its base node — both are the same
missing capability: _treat a query's effective columns as a joinable node._

---

## 2. The architectural insight — the engine is ~80% there

`resolve_source(con, source_id, …, visited)` **already** resolves any source polymorphically
([queries.py](../../../workspace/apps/backend/app/routers/queries.py)):

- `ds_` → `read_parquet(?)` over the dataset's parquet (the leaf);
- `qr_` → recurse via `_resolve_chain`, bake the result as a SQL subquery `(<sub.sql>) AS Ti`,
  expose its **effective** (already collision-qualified) columns; **cycle-guarded** via the
  `visited` frozenset (`composition_cycle`).

The **only** place that bypasses this is the hop's right side: `_resolve_chain` hardcodes
`right_ds = con.execute(_SELECT_DATASET, (qrel["rightDatasetId"],))`
([queries.py ~210–225](../../../workspace/apps/backend/app/routers/queries.py#L210)) and reads
`read_parquet` over a dataset.

> **The backend change is mostly: stop special-casing the right side as a dataset; route it
> through the polymorphic `resolve_source` you already have**, threading `visited` so a query
> that joins itself in (directly/transitively) is cycle-rejected. The fold in `query_joined_rows`
> (`(<subquery>) AS Ti`) is already what composition emits — no engine reshape.

The genuinely-new work is **(a)** the rel-model asymmetry (§3, the crux), **(b)** effective-column
naming across a nested query (§4), and **(c)** the canvas rendering a query as a column-bearing,
handle-bearing node (§5 — which also closes the R90 composed-base gap).

---

## 3. The crux — a query×query edge has no governed counterpart (human's call)

Today a `QueryRelationship` is one of two things, **both dataset↔dataset**:

- **copy-on-pick** — a query-owned copy of a governed `rel_` (`originRelationshipId` set), or
- **free-form** — a hand-drawn `ds_↔ds_` edge with no governed origin (`originRelationshipId:
  null`), **promotable** up into the governed ER.

Governed relationships are **hard-wired dataset↔dataset**: the `Relationship` SQLModel carries
`ForeignKey("datasets.id")` on both sides ([db_models.py ~123–138]), and
`relationships.py` resolves both sides against the `datasets` table. **The governed ER can never
express a `qr_` side.**

→ Therefore a **query×query edge is a distinct species**: it is **free-form-only**, **never
copy-on-pick**, and **cannot be promoted** (there is no dataset-only governed home for it). This is
clean and worth stating up front:

> **Proposed decision A.** A join edge whose right (or left) side is a `qr_` is a free-form,
> non-promotable, query-local edge. The canvas offers **no Promote** on it; divergence-warn does
> not apply (it has no origin). Governance stays dataset-centric; the governed ER is **not**
> re-opened. _(This keeps the R88 copy-on-pick/promote symmetry intact — query×query simply lives
> outside it.)_

---

## 4. Proposed model + naming (to seal at the Design gate — not final)

```ts
// QueryRelationship sides become polymorphic source refs (ds_ | qr_), not dataset-only.
type SourceRef = `ds_${string}` | `qr_${string}`;

type QueryRelationship = {
  id: string;                    // qrel_…
  leftSourceId: SourceRef;       // WAS leftDatasetId (ds_ only) — now ds_ | qr_
  leftColumn: string;            // an EFFECTIVE column name of the left source
  rightSourceId: SourceRef;      // WAS rightDatasetId (ds_ only) — now ds_ | qr_
  rightColumn: string;           // an EFFECTIVE column name of the right source
  cardinality: Cardinality;      // advisory (R90 finding: never read by the resolver)
  originRelationshipId?: string | null; // null whenever either side is qr_ (no governed origin)
};
```

**Design-gate question — rename vs. widen-in-place.** `leftDatasetId`/`rightDatasetId` become a
lie if they can hold `qr_`. Two options:

1. **Rename** → `leftSourceId`/`rightSourceId` (truthful; matches the existing `sourceId`
   polymorphic convention). Churn: contract `query.yaml`, `common.py`, `types.ts`, resolver,
   `chain.ts`, canvas, tests. **Clean-slate is cheap** — we're on `dev`, no back-compat
   ([[query-owned-relationships]] decision 5; alembic is a single fresh `0001` and the model lives
   in the opaque `definition_json` blob, so **no DDL**). _Lean: rename — do it right while the
   theme is open._
2. **Widen the pattern in place** (keep the `…DatasetId` names, allow `^(ds_|qr_)…`). Cheapest
   diff, but bakes a misleading name into the wire forever.

**Effective-column naming (the real new sub-problem).** A joined-in query contributes its
**effective** columns, which are themselves already collision-qualified internally (e.g.
`Deals.id`, `Accounts.id`). Folded into the outer query alongside datasets, names can collide
across nested boundaries. `build_effective_columns` qualifies by **source name** today; for a
`qr_` source the "name" is the **query's name**. Open question: do we qualify
`QueryName.Deals.id` (two-level) on collision, or flatten? _Proposal: qualify by the source node's
display name (dataset name **or** query name); on a residual collision, the existing bare→qualified
rule applies one more level. Seal the exact rule at Design with a test._

**Cycle + freshness (reuse what exists).**

- **Cycle**: thread the `visited` frozenset through right-side resolution; a query that joins
  itself in (directly/transitively) → reuse **`composition_cycle`** (same guard, same `409`).
- **Freshness**: re-resolve the inner query on every run; an exposed column that drifted away →
  the existing **`relationship_stale`** (`_compatible(_dtype_of(...))`) fires unchanged.
- **Cascade**: deleting a joined-in query must stale/invalidate dependents — **app-level**, like
  the polymorphic `source_id` cascade (`routers/datasets.py` precedent; no FK on a polymorphic
  column). A delete surfaces as `relationship_stale`/missing on the next run.

---

## 5. Canvas UX — one capability closes two gaps

The new FE capability is **render a query source as a column-bearing, handle-bearing node**:

1. **`[+ Add a source]` offers queries too.** `stageable` is `datasets.map(...)` today
   ([QueryCanvas.tsx ~527]); add the workspace's saved queries (excluding self + cycle-creating
   picks). Label with the `qr_` name (the canvas already loads `queriesQuery` for naming).
2. **A query node renders its effective columns + connect dots.** Today `dsColumnsById` is built
   from datasets only, so a `qr_` node renders **no handles** — this is exactly the R90-flagged
   composed-base gap. Build a `qrColumnsById` from each query's `resolvedColumns` (already on the
   `Query` wire shape) and feed the same node-render path. **Fixing this once serves both joining a
   query in *and* the composed-base handle gap.**
3. **No Promote on a query×query edge** (§3, decision A) — the context pad suppresses/disables
   Promote when either side is `qr_`, with a one-line "why" (free-form, no governed home).
4. **`joinGraph.ts` is already polymorphic-ready** — its `resolveConnect`/`addEligibleRels`/leaf
   logic uses a generic `Edge` and does **not** introspect the id format. Minimal FE-logic change;
   the work is data (offer `qr_`, load its columns) + the Promote suppression.

---

## 6. Sequencing — the scope fork for R91 (human ratifies)

This is a **model + resolver + contract + canvas** change. Two shapes (the round file's fork,
re-themed):

| Shape | R91 | R92+ |
| --- | --- | --- |
| **Brainstorm + thin slice** _(lean)_ | This brainstorm → Design seal + `flow-selector` → **build the vertical slice**: resolver routes right through `resolve_source`; rel model/contract widened (rename); canvas offers `qr_` sources + renders query-node handles (closes the R90 gap); Promote suppressed on `qr_` edges. Likely **DFCFBI** (new canvas UX needs an F1 feel-review) → maybe a [[dfcfbi-two-round-split]]. | Polish, more nested depth, dashboards (value-out) next. |
| **Brainstorm only** | This brainstorm → Design seal of the model; **no build**. | Build lands R92 (DFCFBI). |

**Why "thin slice" is defensible here (vs. the more cautious brainstorm-only):** unlike the
query-owned-relationships theme (which invented a whole new model), the engine is **already
polymorphic** (§2) — the model space is narrower and lower-risk. The one genuinely model-uncertain
piece is the effective-column naming (§4), which a Design-gate decision + a test pins down. But
the canvas query-node rendering is **new UX with low prior-art** → an **F1 feel-review** is
warranted, so expect **DFCFBI** and possibly a two-round split.

---

## 7. Open Design-gate questions

- **Rename vs. widen-in-place** for the rel-edge source fields (§4) — _lean: rename to
  `leftSourceId`/`rightSourceId`; clean-slate makes it cheap._
- **Effective-column naming** across a nested query (§4) — two-level qualify vs. flatten; seal with
  a test.
- **`qr_` on the LEFT of a hop** — symmetric to the right; the engine treats left via provenance
  (`dataset_id_sets`). Does the slice support both sides `qr_`, or right-side-first? _Lean:
  right-side-first (the flagged ask); left follows if cheap._
- **Contract** — widen `query.yaml#/QueryRelationship` side patterns to `^(ds_|qr_)…`; confirm MSW
  `additionalProperties:false` + `contract-validator` stay green. `relationships/*.yaml` stays
  **dataset-only** (governed ER unchanged — §3).
- **Flow** — `flow-selector` at the Design gate (expect DFCFBI: new canvas UX, low prior-art).
- **Composed-base gap** — fold the R90 composed-base-no-handles fix into the query-node render (§5),
  or split it out? _Lean: fold — it's the same code path._

---

## 8. Risks + mitigations

| Risk | Mitigation |
| --- | --- |
| **Governance dilution** — query×query edges erode the dataset-centric ER | §3 decision A: `qr_`-side edges are free-form-only, **non-promotable**; the governed ER is never re-opened. |
| **Effective-column ambiguity** across nested queries | §4 naming rule sealed at Design **with a test**; reuse `build_effective_columns`. |
| **Infinite recursion** (a query composing/joining itself) | Reuse the existing `visited` cycle guard + `composition_cycle`; thread it through right-side resolution. |
| **Canvas blast radius** (new node species) | `joinGraph.ts` is polymorphic-ready (§5.4); the change is data + Promote-suppression, not a graph-engine reshape. |
| **Scope creep toward dashboards** | Dashboards is explicitly the **next** theme (value-out), deferred until this completes — chosen by the human at R91's Plan gate. |
| **Over-building the model** ([[query-is-a-connection-not-a-load]]) | Cardinality stays **advisory** (R90 finding); no row-explosion guard; runtime cost is a consumer concern. |
