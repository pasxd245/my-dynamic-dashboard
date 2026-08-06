# Data-management noun-model — concepts & boundaries (dataset · query · join · relationship · workflow)

**Concept**: the **one canonical place** that defines the five nouns of the data-management
domain and draws the load-bearing boundaries between them, so the **engine** and the
**surface** stop encoding conflicting implicit models. This is **Brick B — for the builders,
kept under the floor; the user never sees these words** (§ The two-brick lens). It **locks the
concept definitions + settled boundaries** (what each noun *is*); where the current code diverges
it records **named debt** (§ Named debt), not a fix. **One boundary is left OPEN** on purpose —
query⇄query composition (§ The query-identity fork) — so the vocabulary is settled without forcing
the one-way-door composition call before the evidence is in.

**Status**: **Concepts Accepted — locked R161** (the five definitions + the settled boundaries
below). **One boundary is deliberately OPEN**: the *query⇄query composition* model (§ The
query-identity fork) — model A leads on current evidence but is **not locked**; it reopens when a
build round or more dogfood pulls it. Locked concepts stay reopenable "when needed" (the human's
R161 call: define/lock the vocabulary first, decide composition later). Build deferred to R162+.
**Round introduced**: [`Round_161`](../../plan/cycles/Round_161.md) — pulled by
[`Round_160`](../../plan/cycles/Round_160.md)'s dogfood diagnosis (the query surface's real
defect is a missing/conflicting noun-model, not the join capability).
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
[queries/queries.md](queries/queries.md) (the Query noun · engine · joins · composed source ·
steps), [workflows/workflows.md](workflows/workflows.md) (the Workflow noun · materialize/freeze),
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
ultimately bottoms out in.
([datasets/datasets.md](datasets/datasets.md);
resolves to `read_parquet(?)` —
[query_engine.py:114-129](../../../workspace/apps/backend/app/query_engine.py#L114).)

> **Boundary** — a Dataset **owns** its rows; every other noun *reads* rows it does not own.

### Query (`qr_…`) — the live readable view

A **Query** is a named, saved **definition** that produces a **readable table** by re-running —
against current data, every read — a driving source + optional joins + filters + ordered transform
**steps**. It stores **only its definition**, never a result (always fresh). From the user's point
of view a Query **is a readable table, the same kind as a Dataset** — the
[[query-is-virtual-dataset]] unification — differing only in **archetype** (derived vs leaf), not
in what you can do with it. ([queries/queries.md](queries/queries.md).)

> **Boundary — settled (locked):** from the user's point of view a Query **is a readable
> table-source with its own identity**, the same kind as a Dataset ([[query-is-virtual-dataset]],
> locked long before R161). It stores a definition, not a result.
>
> **Boundary — OPEN (the one undecided seam):** *how the engine composes a query read by another
> query* — as that query's **full output with its own identity** (model A) or **flattened to its
> leaf datasets** (model B, current). See § The query-identity fork; it stays open until pulled.
> Note the current flatten also **silently drops the inner query's steps**, which is a correctness
> bug **either way** (§ Named debt D1) — separate from the A/B choice.

### Join — an operation *inside* a query, not a noun

A **Join** is **not a noun**. It is an **operation**: one `JoinStep` in a Query's `joins` list,
reading two or more sources as one table through a query-owned edge. There is no `join_` entity,
no join catalog; a join lives and dies inside the Query that expresses it.
([queries/queries.md § Joins](queries/queries.md);
`_resolve_chain` — [query_engine.py:164](../../../workspace/apps/backend/app/query_engine.py#L164).)

> **Boundary** — a join is **query-time composition**. It never persists on its own and never
> becomes a reusable asset; what persists is the **relationship** it consumes (below) and the
> **query** that holds it.

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

### Workflow (`wf_…`) — a *frozen* materialization (collapse-to-mode is fork-contingent)

Today a **Workflow** is a **separate noun**: it consolidates ≥1 query via `UNION ALL BY NAME`,
applies the same transform steps, and **materializes a FROZEN typed output** on run (a committed
parquet + captured schema). ([workflows/workflows.md](workflows/workflows.md).)

> **Boundary — settled (locked):** the **only crisp distinction** between a Query and a Workflow is
> **live vs frozen** — everything else (steps, DuckDB, sources) is shared. A Workflow's job is a
> **frozen, stable snapshot** to build on; a Query is always live.
>
> **Boundary — OPEN (fork-contingent):** *whether the noun collapses to a materialization **mode**
> of a query* (dbt's `table` vs `view` — a "snapshot this" toggle, no separate surface to learn).
> R160 finding #6 showed steps **compose live**, so the noun is not required *for composition* — but
> collapsing it is only coherent **if the composition fork resolves toward model A**. Until then the
> separate noun stands; the collapse is § Named debt D3 (its own heavier round, gated on the fork).
> **This round names the possibility; it does not collapse the noun.**

**The insight ladder (roles, stated cleanly):** **Dataset** (business as-is) → **Query** (ask live
questions — where almost all insight lives, zero-DE) → **chart/widget** (see it) → **materialize**
*only* when an answer must become a stable input to the next question → **AI-loop (#2)** when even
phrasing the question is hard. The Query is the **primary** insight tool; materialization is
**plumbing, not a peer surface**.

---

## The boundary table (what separates each pair)

| Boundary | Rule | Why it's load-bearing |
| --- | --- | --- |
| Dataset ⇄ Query | Dataset **owns** rows (a leaf parquet); Query **reads** rows (a live definition, no parquet). | Keeps "readable table" unified for the user while the engine knows which one is a row-source. |
| Query ⇄ Query (composition) | **OPEN** — a query read as a source is either its **full output with its own identity** (model A) or **flattened to leaves** (model B, current). *Not locked* — § The query-identity fork. | The one undecided seam; resolving it (toward A) would fix the shared-leaf `cyclic_join` + the step-drop together. |
| Join ⇄ Relationship | Join = a query-time **operation**; Relationship = the persisted **edge** it consumes. | A join never becomes a stored asset; only edges and queries persist. |
| Governed `rel_` ⇄ query-owned `qrel_` | Governed = shared/validated/promotable **asset**; query-owned = one query's **private snapshot**. | A saved query is immune to governed-edge edits; governance stays a reusable vocabulary. |
| Query ⇄ Workflow | **Live vs frozen** — the *only* real difference (settled). *Whether* frozen collapses to a **mode** of a query is fork-contingent (OPEN). | Everything else (steps, engine, sources) is shared; the collapse only coheres if the composition fork resolves toward A. |

---

## The query-identity fork (model A vs B) — OPEN, not locked

**Status: OPEN.** R161 locked the vocabulary and left this one seam undecided on purpose (the
human's call — lock concepts first, decide composition when a build round or more dogfood pulls
it). Model A **leads** on current evidence but is **not** committed; this section records the fork
and the leading candidate so a future round reopens it with the analysis already done, not from
scratch. The axis: **how does a derived query behave when another query reads it?**

| | **A — query behaves like a dataset** | **B — flatten to leaves (current)** |
| --- | --- | --- |
| composition | query-source = its full stepped run output, a live subquery/CTE with its own alias | window, flattened to its `ds_` leaves |
| `cyclic_join` (two views of one dataset) | **gone** — distinct subqueries, no cycle | **fires** ([query_engine.py:212-218](../../../workspace/apps/backend/app/query_engine.py#L212)) — must be taught |
| step-dropping in composition | **gone** — steps run (it's the query's real output) | **stays** ([query_engine.py:87-100](../../../workspace/apps/backend/app/query_engine.py#L87) bakes source+joins+filters only) |
| Workflow noun | collapses → live/frozen is a materialization **mode** | stays a separate noun |
| cost | re-runs the nested pipeline per read (**consumer pays** — [[query-is-a-connection-not-a-load]]-consistent) | one flat SQL, cheaper |
| loses | automatic leaf-dedup + **promote-to-governed-ER leaf provenance** | — |
| new debt it takes on | **join fan-out / measure double-count** (flatten sidestepped this) | — |

**Leading candidate: model A** (recorded, not locked). Grounds (R160 findings #5–#6, code-verified
this round):

1. **A is a bug-fix, not a rewrite.** Query-as-subrelation-with-identity **already exists**
   (`resolve_source` wraps a `qr_` as `( … )` with effective columns —
   [query_engine.py:62-109](../../../workspace/apps/backend/app/query_engine.py#L62)); the step
   engine is **already nested SQL** (`_apply_step` wraps `SELECT … FROM (prev)` —
   [rows_reader.py:373](../../../workspace/apps/backend/app/ingest/rows_reader.py#L373)). The
   step-drop is fixable by calling that existing fold inside `resolve_source`.
2. **Fan-out is largely pre-paid** by the same fix: a source query that aggregates to its own grain
   becomes a pre-aggregated subrelation (one row per key) *before* the join — Malloy's aggregate
   locality — so the fan-out never happens. The user expresses grain by *where* they place the
   aggregate step (Brick A, legible), not via a symmetric-aggregate engine.
3. **A restores the user's symmetry** ("two tables, join them"), which every tool their mental model
   is trained on gives (Metabase Models, Looker, Malloy — R160 industry cross-check).

**The precise, honest cost.** Relaxing the shared-leaf `cyclic_join` is safe for the *run*
(`build_effective_columns` already collision-qualifies). What shared-leaf genuinely breaks is
**unambiguous leaf provenance for promote-to-governed-ER** — which `ds_` owns a key when it appears
twice. That governance future is **not built**, so the cost is deferral, not regression. **Keep
`composition_cycle`** (genuine self-reference — a real cycle —
[query_engine.py:74-76](../../../workspace/apps/backend/app/query_engine.py#L74)) always; relax only
the shared-leaf `cyclic_join`. Do **not** over-correct: a genuine self-join on one identity
([[relationships-future-parked]]) is real Brick A — express it as "join `ds` to itself with two
aliases," don't let the common two-views case inherit that rare case's rejection.

**Why OPEN, not locked:** this is a one-way-door product-model lock (it only truly commits once
users build queries that depend on shared-leaf joins), and it rests on n=1 dogfood + industry
triangulation with 3 R160 probes still unrun. `cold-reviewer [mix]` (R161, all six anchors
grounded) confirmed the code-grounded core but surfaced two concerns to resolve **before** any
lock: (1) A trades a *loud* `cyclic_join` for a *potentially silent* double-count in the residual
raw-join-then-top-aggregate case (backstop deferred, needs a per-source PK we don't have) — decide
whether the eventual A build must be *paired* with a loud guard; (2) "relax shared-leaf only" needs
an engine mechanism to distinguish the common two-views case from a genuine self-join. Reopen this
fork when R162 (or more dogfood) pulls it; the build (D1/D2 below) is then a separate bounded round.

---

## Named debt (target model ⇄ current code)

Divergences between the target model and the shipped engine. **Recorded, not fixed here.** D1 is a
correctness bug **independent of the fork**; D2/D3 are **fork-contingent** — they only resolve once
the query-identity fork closes (toward A). All builds are separate bounded rounds (mostly R162).

| # | Debt | Current code | Target | Disposition |
| --- | --- | --- | --- | --- |
| **D1** | **Steps dropped in composition** — a query used as a source loses its `aggregate/derive/filter/top_n/sort/select/date_bucket`; the join silently runs against un-shaped rows. | `resolve_source` bakes source+joins+own-filters only ([query_engine.py:87-100](../../../workspace/apps/backend/app/query_engine.py#L87)); `run_steps` runs only at top-level ([queries.py](../../../workspace/apps/backend/app/routers/queries.py)). | Inner query's steps take effect in composition (whether via live nesting under A, or an explicit error/materialize under B). | **Fix regardless of the fork** — it's a silent-wrong-rows **correctness bug** now. Cleanest fix (live nesting via `build_stepped_select`) presumes A; a B-world fix would error instead. |
| **D2** | **Shared-leaf `cyclic_join`** — two queries derived from one dataset can't be joined; the most natural move is unexpressible. | Tree invariant rejects any leaf-overlap ([query_engine.py:212-218](../../../workspace/apps/backend/app/query_engine.py#L212)). | Relax **shared-leaf** only (distinct subqueries under A); **keep** `composition_cycle`. | **Fork-contingent (A).** Cost = defer promote-to-ER leaf provenance (unbuilt); needs the two-views-vs-self-join discriminator (cold-review anchor 3). |
| **D3** | **Workflow as a separate noun** — full table + routes + 3 FE surfaces for what is a live/frozen toggle. | [workflows/workflows.md](workflows/workflows.md); `wf_` model, `/workflows` routes, catalog/builder/detail. | Materialization **mode** of a query (`view` vs `table`) — *only if the fork closes toward A*. | **Fork-contingent, own heavy round.** Do not collapse casually. Name it; don't build it. |
| **D4** | **Error surfaced at the wrong time, in engine vocabulary** — FE cyclic check is node-level so it *lets you draw* the edge; the leaf collision only fails later at preview/save with `cyclic_join`. | FE resolves left provenance to leaves but checks node-level ([joinGraph.ts](../../../workspace/apps/builder/src/features/data-management/queries/joinGraph.ts)); engine reasons surface at preview/save. | Detect at **draw time**; if a constraint must be taught, teach it in the user's language at the gesture (Brick A words, not `cyclic_join`). | **R162+ UX**, partly mooted by D2 (fewer collisions to surface). |

---

## Validation — the definitions hold against R160's real cases

Each R160 dogfood finding maps to exactly one boundary or debt this doc draws — evidence the
model resolves the confusion rather than restating it (the round's falsification test):

- **"Join Query_A to Query_B, both from `ds_customer` → `cyclic_join`"** → the **Query ⇄ Query**
  boundary + **D2**. Under model A these are two distinct subqueries; the collision is accidental,
  not semantic.
- **"A join source silently ignores its aggregate/filter steps"** → **D1**. The step-drop is a
  correctness bug the Query definition ("full output, steps included") forbids.
- **"Is this a builder or a workflow?"** → the **Query ⇄ Workflow** boundary. Live vs frozen is the
  only real difference; workflow is a mode (D3), not a peer surface.
- **"Editing a governed edge shouldn't break my saved query"** → the **governed `rel_` ⇄
  query-owned `qrel_`** boundary. Already honored by copy-on-pick; the boundary names *why*.
- **The deferred live probes** (anti-join, messy/composite key, render-to-widget) stay deferred to
  the **R162** build round as its acceptance checks — they validate the *fix*, not these
  definitions.

---

## Scope boundary

### IN scope (R161)

- **Locked:** the five concept definitions + the settled boundaries, in one canonical home.
- The **named-debt** table (target ⇄ code divergence), with verified code anchors.
- The **query-identity fork** recorded with its leading candidate (A) + cold-review concerns —
  **left OPEN**, not locked (the human's lock-concepts-first call).

### OUT of scope (deferred with named triggers)

- **The query⇄query composition lock (A vs B)** — recorded, deliberately undecided; reopened when
  a build round or more dogfood pulls it. Nothing downstream should assume A is settled.
- **Any engine/code change** — the D1 correctness-bug fix + the D2 relaxation are **R162**;
  D3 (collapse the Workflow noun) is its own heavier round — all gated on the fork closing.
- **The promote-to-governed-ER build** — the governance future whose leaf-provenance the A
  direction would trade against; unbuilt, pulled only by a real governance need
  ([[relationships-future-parked]]).
- **Composite/multi-column keys, cross-workspace joins, null-aware operators** — per
  [queries/queries.md § Scope boundary](queries/queries.md); unchanged by this doc.

---

## Reference materials (read-only)

- [Round_160](../../plan/cycles/Round_160.md) — the dogfood + 6 code-grounded findings this doc
  distills (the two-brick lens, the A/B fork, the industry cross-check, the solve-it-smart trace).
- [Round_161](../../plan/cycles/Round_161.md) — the round that authored this doc.
- Memory notes (auto-memory `[[wikilinks]]`): [[query-is-virtual-dataset]],
  [[query-is-a-connection-not-a-load]], [[workflows-extend-query-duckdb-first]],
  [[relationships-future-parked]].
