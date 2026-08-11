# Data-management noun-model — concepts & boundaries (dataset · query · join · relationship · workflow)

**Concept**: the **one canonical place** that defines the five nouns of the data-management
domain and draws the load-bearing boundaries between them, so the **engine** and the
**surface** stop encoding conflicting implicit models. This is **Brick B — for the builders,
kept under the floor; the user never sees these words** (§ The two-brick lens). It states the
**target** model; where the shipped code diverges it records **named debt** (§ Named debt), not
a fix.

**Status**: **Accepted — concepts locked R161; the Query concept re-locked R162** (2026-08-07,
human). R161 left one boundary deliberately OPEN — *query⇄query composition* — and recorded
model A as the leading candidate. **That fork is now CLOSED, against A**: there is no
`query⋈query` at all (§ The composition fork — closed). Every remaining definition below is
unchanged from R161.
**Round introduced**: [`Round_161`](../../plan/cycles/Round_161.md) — pulled by
[`Round_160`](../../plan/cycles/Round_160.md)'s dogfood diagnosis (the query surface's real
defect is a missing/conflicting noun-model, not the join capability).
**Re-locked by**: [`Round_162`](../../plan/cycles/Round_162.md), under
[`programs/query-shaping-surface.plan.md`](../../plan/programs/query-shaping-surface.plan.md).
**Domain folder**: `data-management/` (domain-level; sits above every cluster).

> **Why this doc is `_`-prefixed and not a UI-surface concept doc.** This is a
> **definitional/meta** artifact — it has no surfaces, tokens, layout, or acceptance criteria to
> declare. The design-corpus format ([README.md](../README.md), `_TEMPLATE.md`) and its
> conformance lint (`scripts/lint/design-doc-lint.mjs`) govern **UI-surface concept docs**; a
> concepts doc is a different artifact type, so — like `_TEMPLATE.md` — it carries a leading-`_`
> so the lint skips it rather than forcing empty Surface/Token/Layout/Acceptance sections
> (theater a presence-lint can't make meaningful — cf. the [[adopt-artifact-defer-enforcement]]
> memory note).
> It is adopted by **hand-use**: the per-surface docs and the load order point here, and the next
> round reads it before touching queries.

**Sibling docs (the per-surface specs this doc unifies)**:
[queries/queries.md](queries/queries.md) (the Query noun · engine · joins · operations),
[workflows/workflows.md](workflows/workflows.md) (the Workflow noun · materialize/freeze),
[workspaces/relationships.md](workspaces/relationships.md) (the governed edge),
[datasets/datasets.md](datasets/datasets.md) (the leaf table-source),
[queries/canvas.md](queries/canvas.md) + [queries/query-construction.md](queries/query-construction.md)
(the query build surfaces).

---

## The two-brick lens (the frame under every boundary here)

The wall between a business user and an insight is two bricks cemented together
([Round_160](../../plan/cycles/Round_160.md) self-challenge finding):

- **Brick A — domain / relationship logic** (customer relates to orders on `customer_id`; rate =
  calls ÷ days; a lead with no call is a miss). **Irreducible** — no tool erases it; it *is* the
  meaning of the data. The user owns it, and wants to.
- **Brick B — engineering mechanics** (leaves, provenance flattening, composed-vs-materialized,
  the tree invariant, `cyclic_join`). **Accidental** — an artifact of how we built the engine. The
  user should never know it exists.

The product's #1 promise (ease, zero AI) is **not** "remove Brick A" (impossible) — it is **"never
charge the user for Brick B."** **Every noun and boundary in this doc is Brick B.** The test for
this doc is *fewer seams*, not a beautiful ontology (the round's own anti-rabbit-hole brake). A
definition earns its place only by killing a place where we currently charge for Brick B.

---

## The five nouns (target model)

Each entry states the **target** definition, the identity prefix, the code anchor, and the
**one boundary** that keeps it distinct from its neighbours.

### Dataset (`ds_…`) — the leaf table-source

A **Dataset** is a raw, uploaded table with **its own identity and its own row-source** (a
committed parquet). It is a **leaf**: it does not derive from anything, and it is what all reading
ultimately bottoms out in. Monthly exports **stack at this level** (upload + append), never
inside a Query.
([datasets/datasets.md](datasets/datasets.md);
resolves to `read_parquet(?)` —
[query_engine.py:114-129](../../../workspace/apps/backend/app/query_engine.py#L114).)

> **Boundary** — a Dataset **owns** its rows; every other noun *reads* rows it does not own.

### Query (`qr_…`) — the live table over datasets

A **Query** is a named, saved, **live** table built from **datasets only**, by an **ordered**
list of operations. Output is one flat table. It stores **only its definition**, never a result
(always fresh). From the user's point of view a Query **is a readable table, the same kind as a
Dataset** — the [[query-is-virtual-dataset]] unification — differing only in **archetype**
(derived vs leaf), not in what you can do with it. ([queries/queries.md](queries/queries.md).)

The operation vocabulary — the whole of it:

| Operation | What it does | Shipped? |
| --- | --- | --- |
| **join** a dataset | reads one more dataset alongside what is built so far; any type; a governed relationship pre-fills the key | yes |
| **filter** | keeps rows | yes (source filters + the `filter` operation) |
| **computed column** | appends a column from a formula-free binary op | yes (`derive`) |
| **aggregate** (collapsing) | `GROUP BY (dimensions) → measures`; the row count **shrinks** | yes |
| **within-group column** | appends a column whose value is an aggregate over the **group of other rows** it belongs to; the row count is **unchanged** | **no — R162 ships it** |

Two supporting operations exist for deliverable shaping and are not part of the conceptual
vocabulary above: `sort`/`top_n` (ordering + limit) and `select`/`date_bucket` (re-bind, bucket).

> **Boundary — settled (locked):** from the user's point of view a Query **is a readable
> table-source with its own identity**, the same kind as a Dataset ([[query-is-virtual-dataset]]).
> It stores a definition, not a result.
>
> **Boundary — settled (locked R162, closing R161's OPEN fork):** a Query is built from
> **datasets only**. It **never reads another Query** — not as a base, not as a join operand — it
> never stacks files, never freezes, and does not present (charts, formatting, and sort-for-display
> belong to the widget). See § The composition fork — closed.
>
> **Boundary — settled (locked R162):** **the same dataset may not appear twice in one Query.**
> A self-join is a deliberate scope boundary, not a gap ("Query only does BIZ, not everything" —
> human, 2026-08-07). The **Builder must not offer it**; it is unofferable at the gesture, not an
> error at run. The need this leaves unserved is an input to the Workflow round.

### Join — an operation *inside* a query, not a noun

A **Join** is **not a noun**. It is an **operation**: one `JoinStep` in a Query's `joins` list,
reading one more **dataset** alongside what has been built so far, through a query-owned edge.
There is no `join_` entity, no join catalog; a join lives and dies inside the Query that
expresses it.
([queries/queries.md § Joins](queries/queries.md);
`_resolve_chain` — [query_engine.py:164](../../../workspace/apps/backend/app/query_engine.py#L164).)

> **Boundary** — a join is **query-time composition of datasets**. Its right operand is always a
> **dataset** (never a Query — § Named debt D5). It never persists on its own and never becomes a
> reusable asset; what persists is the **relationship** it consumes (below) and the **query** that
> holds it.

### Relationship — a *governed* edge (`rel_`) vs a *query-owned* edge (`qrel_`)

One English word, **two distinct concepts** — the conflation is itself a Brick-B seam:

- **Governed Relationship (`rel_…`)** — a workspace-scoped, **validated, reusable** edge between
  two datasets' columns; persisted in the `relationships` table; status **computed** at read
  against current schemas. A shared, promotable **asset**.
  ([workspaces/relationships.md](workspaces/relationships.md).)
- **Query-owned relationship (`qrel_…`)** — an edge **embedded inside one Query's definition**,
  seeded by **copy-on-pick** from a governed `rel_` (`originRelationshipId` set) or **defined
  free-form** (`null`). The Query runs on this **private snapshot**, so editing/deleting the
  governed edge can never break a saved Query.
  ([queries/queries.md § Joins](queries/queries.md).)

> **Boundary** — **governed = the workspace's shared, validated vocabulary of edges;
> query-owned = one query's private, frozen-at-pick copy.** Copy-on-pick crosses the boundary one
> way (governed → query); **promote** crosses it back (a useful free-form `qrel_` → a governed
> `rel_`). A join **consumes** exactly one edge per hop.

### Workflow (`wf_…`) — a *frozen* materialization (definition re-opens once Query is settled)

Today a **Workflow** is a **separate noun**: it consolidates ≥1 query via `UNION ALL BY NAME`,
applies the same transform steps, and **materializes a FROZEN typed output** on run (a committed
parquet + captured schema). ([workflows/workflows.md](workflows/workflows.md).)

> **Boundary — settled (locked):** the **only crisp distinction** between a Query and a Workflow is
> **live vs frozen** — everything else (steps, DuckDB, sources) is shared. A Workflow's job is a
> **frozen, stable snapshot** to build on; a Query is always live.
>
> **Deferred, not open:** *what a Workflow should be* once Query is the single shaping surface is
> the last item of the [query-shaping-surface program](../../plan/programs/query-shaping-surface.plan.md)
> (item 4). Two inputs are already banked for it: the **self-join** need Query deliberately refuses,
> and whether frozen collapses to a materialization **mode** rather than a noun (§ Named debt D3).
> **This doc names them; it does not settle them.**

**The insight ladder (roles, stated cleanly):** **Dataset** (business as-is, stacked by append) →
**Query** (ask live questions — where almost all insight lives, zero-DE) → **chart/widget** (see
it) → **materialize** *only* when an answer must become a stable input to the next question →
**AI-loop (#2)** when even phrasing the question is hard. The Query is the **primary** insight
tool; materialization is **plumbing, not a peer surface**.

---

## The boundary table (what separates each pair)

| Boundary | Rule | Why it's load-bearing |
| --- | --- | --- |
| Dataset ⇄ Query | Dataset **owns** rows (a leaf parquet); Query **reads** rows (a live definition, no parquet). Stacking monthly files is the **dataset's** job (append), never the Query's. | Keeps "readable table" unified for the user while the engine knows which one is a row-source. |
| Query ⇄ Query | **None — a Query never reads a Query** (locked R162). Every operand is a dataset. | Removes the whole composed-source machinery, and with it `cyclic_join`, the step-drop, and the shared-leaf question. |
| Dataset ⇄ itself, inside one Query | The same dataset may **not** appear twice. A deliberate boundary, enforced by **not offering it** in the Builder. | Keeps the join graph a tree with unambiguous columns; the unserved self-join need is a Workflow input, not a Query gap. |
| Collapsing aggregate ⇄ within-group column | Collapsing **shrinks** the row count to one row per group; a within-group column **keeps** every row and appends the group's value beside it. | This is the missing primitive: comparing a row to its group needed two shaped results only because the second family was never shipped. |
| Join ⇄ Relationship | Join = a query-time **operation**; Relationship = the persisted **edge** it consumes. | A join never becomes a stored asset; only edges and queries persist. |
| Governed `rel_` ⇄ query-owned `qrel_` | Governed = shared/validated/promotable **asset**; query-owned = one query's **private snapshot**. | A saved query is immune to governed-edge edits; governance stays a reusable vocabulary. |
| Query ⇄ Workflow | **Live vs frozen** — the *only* real difference (settled). *What* frozen is for is deferred to program item 4. | Everything else (steps, engine, sources) is shared. |

---

## The composition fork — closed (2026-08-07, human), against the leading candidate

**R161 left this OPEN and recorded model A as leading.** A future round was expected to pick A
(query-as-subrelation-with-identity) or B (flatten to leaves, current). **The human closed it a
third way: neither. There is no `query⋈query`.**

Both A and B were answers to *"how should the engine behave when a query reads a query?"* The
close **rejects the question**. Composition existed to let a user compare two shaped results;
that need arose only because the product shipped **collapsing** aggregates and never shipped
**within-group** ones. Window functions are precisely the SQL feature that exists so you do not
self-join aggregates. Remove the missing primitive and the need for composition goes with it.

| | R161's record | R162's close |
| --- | --- | --- |
| the question | A or B? | neither — the need is removed upstream |
| `cyclic_join` | A makes it go away | **deleted** with composition (program item 3) |
| step-drop in composition | A fixes it | **dissolves** — there is no composition to drop steps in |
| Workflow noun | A lets it collapse to a mode | independent again; deferred to program item 4 |
| shared-leaf ⇄ promote-to-ER provenance | A trades it away | **kept** — leaves stay unambiguous |

**What A's analysis cost, honestly.** A's grounds were real (it *is* a small fix; aggregate
locality *does* pre-pay fan-out; it *does* restore the user's two-tables symmetry). The close does
not refute them — it removes their occasion. The one thing A offered that the closed model does
not is *reusing a saved shaping as an input*; the human's answer is that a shaping worth reusing
is either **one more operation in the same Query** or, eventually, a **Workflow**. Whether that
holds is what the program's acceptance walks test.

**Replace before you remove.** Composition is still shipped and still runs (§ Named debt D5). It
is retired at [program item 3](../../plan/programs/query-shaping-surface.plan.md), **after** the
within-group family lands — reversing that order would leave the human more blocked than today.

---

## Named debt (target model ⇄ current code)

Divergences between the target model and the shipped engine. **Recorded, not fixed here.**
Dispositions are now program items, not forks.

| # | Debt | Current code | Target | Disposition |
| --- | --- | --- | --- | --- |
| **D1** | **Steps dropped in composition** — a query used as a source loses its `aggregate/derive/filter/top_n/sort/select/date_bucket`; the join silently runs against un-shaped rows. | `resolve_source` bakes source+joins+own-filters only ([query_engine.py:87-100](../../../workspace/apps/backend/app/query_engine.py#L87)); `run_steps` runs only at top-level ([queries.py](../../../workspace/apps/backend/app/routers/queries.py)). | No composition ⇒ no step-drop. | **Dissolves with D5** (program item 3). It remains a live silent-wrong-rows bug in shipped code until then — **not fixed**, because the code path is scheduled for deletion, not repair. If item 3 slips, this reverts to a bug that must be fixed on its own. |
| **D2** | **Shared-leaf `cyclic_join`** — two queries derived from one dataset can't be joined. | Tree invariant rejects any leaf-overlap ([query_engine.py:212-218](../../../workspace/apps/backend/app/query_engine.py#L212)). | Not applicable — there are no query operands to overlap. | **Removed by decision, not fixed.** Joining two queries is out of scope; the capability is deliberately gone. A later reader must **not** read this as a bug that got solved. What replaces it is the within-group column (R162), not a relaxed invariant. |
| **D3** | **Workflow as a separate noun** — full table + routes + 3 FE surfaces for what may be a live/frozen toggle. | [workflows/workflows.md](workflows/workflows.md); `wf_` model, `/workflows` routes, catalog/builder/detail. | Undecided — settled at program item 4, now that it no longer depends on the composition fork. | **Deferred to program item 4**, with the refused self-join need as one of its inputs. Name it; don't build it. |
| **D4** | **Error surfaced at the wrong time, in engine vocabulary** — the FE lets you *draw* an edge that only fails later at preview/save with `cyclic_join`. | FE resolves left provenance to leaves but checks node-level ([joinGraph.ts](../../../workspace/apps/builder/src/features/data-management/queries/joinGraph.ts)); engine reasons surface at preview/save. | Unofferable at the gesture, in the user's words — never a run-time engine error. | **NOT mooted — corrected 2026-08-10.** The D gate wrote this off as "largely mooted by D5's removal"; hand-use then found a **third instance with nothing to do with composition**: the canvas offers **Promote** on an already-governed edge, which can only 409 (`[F-promote-gate]`). D4 is therefore a **recurring class, not one bug** — at least three live instances (draw-time `cyclic_join`, the self-join boundary, promote-on-governed). Treat it as a standing rule the Builder owes every gesture: **unofferable at the gesture, never an error at run.** Instances batch with the R157 UX cluster; the rule itself outlives item 3. |
| **D5** | **The shipped product exceeds the concept — composition is built, twice, and actively OFFERED.** A Query may drive from another Query (`sourceId: qr_`) **and** join one in on the right (`rightSourceId: qr_`, R91). The concept allows neither, yet **three surfaces still invite it** (§ D5's surface entry points). | Engine: `resolve_source` recurses on `qr_` ([query_engine.py:62-109](../../../workspace/apps/backend/app/query_engine.py#L62)); `QueryRelationship.rightSourceId` is `SourceId`, not `DsId` ([common.py:309](../../../workspace/apps/backend/app/models/common.py#L309)). Surfaces: see below. | Both operands dataset-only; `composition_cycle` / `cyclic_join` / the `visited` guard / `dataset_id_sets` deleted, **and every entry point withdrawn**. | **Program item 3** — after the within-group family ships (replace-before-remove). Includes migrating or refusing saved queries that use it. |
| **D6** | **The within-group column does not exist** — the collapsing aggregate family is complete, the windowed one is empty. | `_apply_step` has no window branch ([rows_reader.py:373](../../../workspace/apps/backend/app/ingest/rows_reader.py#L373)); the agg vocabulary is collapsing-only ([query_engine.py:376-398](../../../workspace/apps/backend/app/query_engine.py#L376)). | One appended column = an aggregate over the row's group. | **R162 — in flight.** The rest of the family (% of total · running total · rank within group · vs prior period) is program item 2. |

### D5's surface entry points (the part an engine-only reading misses)

Found by hand-use, 2026-08-10: the human asked whether *"Build on this query"* still creates a
query from a query. **It does.** Listing the surfaces here because D5 originally named only the
engine, which under-counts item 3's scope — the removal is not one resolver, it is a resolver
plus two prominent affordances plus the canvas's whole `qr_`-as-a-source treatment.

| # | Entry point | Mechanism | Anchor |
| --- | --- | --- | --- |
| 1 | **`[Build on this query]`** on the Query detail header → `/queries/new?base=<qr_>` | composition as the **driving base** | [QueryDetailPage.tsx:242](../../../workspace/apps/builder/src/features/data-management/queries/QueryDetailPage.tsx#L242) |
| 2 | The canvas **"Add a source"** picker's **"Saved queries"** option group | a `qr_` joined in on the **right of a hop** (R91/R92) — a *different* mechanism from #1 | [QueryCanvas.tsx:1122](../../../workspace/apps/builder/src/features/data-management/queries/QueryCanvas.tsx#L1122) |
| 3 | The `?base=` route itself, reachable by URL without #1 | same as #1 | [QueryCreatePage.tsx:34](../../../workspace/apps/builder/src/features/data-management/queries/QueryCreatePage.tsx#L34) |

Item 3 must also unwind what #2 pulled in: `qr_` node rendering, effective-column expansion for a
wide query source, the `qr_`-column→leaf provenance mapping, the non-promotable `qr_`-side edge
rule, and the unavailable-`qr_` state.

**Why they stay lit for now.** [Replace before you
remove](../../plan/programs/query-shaping-surface.plan.md): until the within-group column works
end-to-end (R163), composition is still the *only* way a user can attempt compare-to-group.
Withdrawing it first would leave the human **more** blocked than the dogfood that opened this
program. The cost of leaving it lit is real and named: **`[Build on this query]` is the first
thing a user reaches for when they want to compare two shaped results, and it leads to the
`cyclic_join` dead end that started R160** — so the product keeps inviting the failure until item
3. Whether to withdraw the affordances *earlier* than the engine (a cheap FE-only change, once
R163 makes the replacement real) is an **open call for the human**, not an agent's to make.

---

## Validation — the definitions hold against the real cases

Each dogfood finding maps to exactly one boundary or debt this doc draws — evidence the model
resolves the confusion rather than restating it (the falsification test):

- **"Join Query_A to Query_B, both from `ds_customer` → `cyclic_join`"** (R160) → the **Query ⇄
  Query** boundary. The question is removed, not answered: neither query exists as a separate
  artifact under the closed model; both shapings are operations in one Query.
- **"I cannot freely join and play with data"** (2026-08-07 dogfood) → the **collapsing ⇄
  within-group** boundary + **D6**. The wall was a missing primitive, not a missing join.
- **"A join source silently ignores its aggregate/filter steps"** (R160) → **D1**, dissolving with
  D5.
- **"Is this a builder or a workflow?"** (R160) → the **Query ⇄ Workflow** boundary. Live vs frozen
  is the only real difference; what frozen is *for* is program item 4.
- **"Editing a governed edge shouldn't break my saved query"** (R160) → the **governed `rel_` ⇄
  query-owned `qrel_`** boundary. Already honored by copy-on-pick; the boundary names *why*.
- **Compare an agent to their team** (2026-08-07) → the **collapsing ⇄ within-group** boundary.
  Under the closed model it is one Query: aggregate to the agent grain, append the team's value
  beside each row, subtract. No second artifact, no join.

---

## Scope boundary

### IN scope

- The five concept definitions + the settled boundaries, in one canonical home.
- The **Query concept as re-locked R162**: datasets only, ordered operations, never composed,
  never frozen, no self-join.
- The **named-debt** table (target ⇄ code divergence), with verified code anchors.

### OUT of scope (deferred with named triggers)

- **Any engine/code change** — the within-group column is [`Round_162`](../../plan/cycles/Round_162.md);
  retiring composition (D5, dissolving D1/D2) is program item 3; the Workflow definition (D3) is
  program item 4.
- **What a Workflow is** — deferred, with the refused self-join need banked as an input.
- **The promote-to-governed-ER build** — unbuilt; pulled only by a real governance need
  ([[relationships-future-parked]]). The closed model **preserves** its unambiguous leaf
  provenance, which model A would have traded away.
- **Composite/multi-column keys, cross-workspace joins, null-aware operators** — per
  [queries/queries.md § Scope boundary](queries/queries.md); unchanged by this doc.
- **Presentation** — charts, formatting, sort-for-display belong to the widget.

---

## Reference materials (read-only)

- [`programs/query-shaping-surface.plan.md`](../../plan/programs/query-shaping-surface.plan.md) —
  the four-round program this doc's re-lock opens, and the settled decisions behind it.
- [Round_160](../../plan/cycles/Round_160.md) — the dogfood + 6 code-grounded findings (the
  two-brick lens, the industry cross-check).
- [Round_161](../../plan/cycles/Round_161.md) — the round that authored this doc and left the
  fork open.
- [Round_162](../../plan/cycles/Round_162.md) — the round that closed the fork and ships the
  within-group column.
- [`brainstorms/2026-08-07-grain-alignment.md`](../../plan/brainstorms/2026-08-07-grain-alignment.md)
  — the paper experiment (four candidate designs, the pooled-vs-per-member trap), left untouched
  as a point-in-time record.
- Memory notes (auto-memory `[[wikilinks]]`): [[query-is-virtual-dataset]],
  [[query-is-a-connection-not-a-load]], [[workflows-extend-query-duckdb-first]],
  [[relationships-future-parked]].
