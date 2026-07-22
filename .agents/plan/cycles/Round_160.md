# Round 160: queries dogfood — can query-owned join/relationship solve a real problem?

**Status**: **COMPLETE** — 2026-07-22 (dogfood complete; noun-model diagnosis; human-approved close)
**Date started**: 2026-07-12
**Date completed**: 2026-07-22
**Flow**: probe / dogfood-collect round — no feature code planned; findings are the deliverable (cf. R142, R157). No DCFBI gates; the human walk IS the method.

## ⟢ At a glance

<!-- reader-layer authored at close (R159 doctrine). Shipped = what's now true ·
     Studied = predicted→saw→now-believe · Watch = open threads / next bearing. -->

**Shipped** — Dogfooded the query surface on real FM call data (28k+ rows). One code fix landed:
the Canvas source-node truncated long real-world names with no way to recover them → added an
AntD hover tooltip (`QueryCanvas.tsx` `SourceNode`; `tsc --noEmit` 0). The round's real
deliverable is a **diagnosis**, not a feature — this was a probe round (cf. R142, R157).

**Studied** _(predicted → saw → now believe)_ — Predicted the join challenge would be where
friction concentrates (messy key / anti-join / self-join). Saw: the most natural move — join two
queries derived from one dataset — is rejected `cyclic_join`, traced end-to-end to a
**surface↔engine model split** (canvas: query = first-class joinable node; engine: query =
transparent window flattened to leaf datasets). Now believe, **high confidence (code-traced): the
join capability is not the problem — the missing/conflicting definitions of
dataset · query · join · relationship · workflow are.** Every finding is a boundary collision.
Not "prune the join"; the fix is a **noun-model** (R161) + a scoped composition-model change
(model A — mostly a bug-fix, not a rewrite: step-dropping fix + scoped `cyclic_join` relaxation).

**Watch**

- **R161 = the concepts/boundaries definition round** — canonical design-corpus doc; the
  query-identity decision (model A vs B) falls out of defining "query."
- **Unrun probes** — baseline Q1–Q3, real anti-join, messy-key, render-to-widget were NOT run
  (round pivoted to the model diagnosis). Fold them into R161 as validation the definitions hold.
- **Named debt if model A** — join fan-out / measure double-count (Looker symmetric-aggregate
  territory); largely pre-paid by aggregate-locality, but flag the raw-join-then-top-aggregate case.
- **`cyclic_join` relaxation trades against promote-to-governed-ER leaf provenance** — decide in R161.

## Goal

**Pulled by ← this session** (queries-dogfood decision, 2026-07-12) and **← [R159](Round_159.md)**
(this is the first round to write an "At a glance" block at close). Substrate: the real FM1–12
call logs (+ a CRM leads table) already ingested through the datasets loop.

Dogfood the **query** feature end-to-end on real data, with the sharpened thesis the human raised:
**challenge the query-owned join/relationship capability — can it actually solve a real problem,
or is it complexity we built without a real pull?** Per [[relationships-future-parked]] the
relationship-value question was parked behind "value-out"; this dogfood is that value-out event.

**Two-sided bet — both outcomes are findings:**

- Join cleanly answers real questions group-by can't (anti-join, cross-entity) → the relationship
  investment is vindicated.
- Join can't express the real need / chokes on a messy key / a self-join / the real questions were
  single-table all along → hard evidence to prune or de-prioritize the relationship complexity.

_Track: 1 (product — validate + rank the query surface on real data). Pulled by: the human's
"can join-relationship really solve a real problem?" challenge + the value-out gate on
[[relationships-future-parked]]._

## Plan

Expected outcome (prediction): the single-source baseline (Q1–Q3) answers cleanly without a
formula; the join challenge is where friction concentrates — a messy/no-clean-key join (per the
append evidence), the anti-join ("never matched"), or a self-join. That friction — or its absence —
resolves the parked relationship-value question. Falsified if the baseline itself breaks (queries
can't do basic group-by on real data) or if the join is both frictionless AND obviously high-value.

- [ ] **Baseline walk (Calls only)** — what's answerable WITHOUT a join:
  - Q1 calls per month (`date_bucket` / provenance month + count → line/bar)
  - Q2 top-5 by volume (`aggregate` + `top_n` + `sort` → bar)
  - Q3 a per-agent-per-month rate/ratio (2-D `aggregate` + `derive`) — the formula-creep probe
- [ ] **Join challenge (the human's real join)** — the questions a join unlocks that group-by can't:
  - anti-join ("entities never matched")
  - messy / composite key behavior (no clean single-column key)
  - self-join / identity, if a real question needs it
- [ ] **Render** at least one query to a widget/chart (the producer→presentation arc).
- [ ] Capture findings live; at close, re-rank the queries roadmap + fold in any datasets-side
      items the walk exposes.

## Risks / unknowns

- **Realism** — the probe is only as good as the human's real question; a synthetic join proves
  nothing. The human brings their own.
- **Formula-creep** — the product's hard test: if answering a question makes the user write/read a
  formula, we've become Excel-with-extra-steps. Watch every `derive`/`filter`.
- **Confounds** — a break may be a datasets-side gap (ingest / join-key) surfacing through queries,
  not a query bug. Attribute carefully.

## Do

### Setup (2026-07-12)

- App live: builder `:3000` · backend `:8000` (duckdb v1.1.3). Real call data loaded (e.g.
  `Weekly - Report Call Full FM5.25_Worksheet`, 28,172 rows).
- Dogfood is human-driven: the human walks their real question at `localhost:3000`; findings +
  live backend diagnosis logged here.

_(findings accrue below as the walk proceeds)_

### Finding — Canvas source names truncated with no tooltip (2026-07-12)

Surfaced while walking the join challenge: the **real** data carries long source names (e.g.
`Weekly - Report Call Full FM5.25_Worksheet`), which the Canvas source node truncates to `…` at the
fixed node width (`NODE_W = 188`) — with **no** hover tooltip, so the full name was unrecoverable.
A findability gap the small/synthetic names in prior rounds never exposed; the long-name real data
is what triggered it.

- **Fix** — `QueryCanvas.tsx` `SourceNode`: source name `ellipsis` → `ellipsis={{ tooltip: data.label }}`
  (AntD-native ellipsis tooltip); column names inside the node gained `title={c.name}`. Still
  truncates at 188px, but hover now reveals the full name. `tsc --noEmit` → 0.
- **Attribution** — a query-surface (Canvas) UX gap, not a datasets/ingest confound.

### Finding — the canvas presents a query-join model the engine doesn't honor (2026-07-12)

The sharpest finding of the dogfood so far, and it lands directly on the round thesis
(query-owned join: real pull or hidden complexity?). Traced end-to-end at the human's prompt.

**The dogfood case (the human's own):** one dataset `ds_customer`; two queries `Query_A`,
`Query_B` derived from it; join A→B on `customer_id`. Expectation (user's mental model): "two
tables, join them." Actual: **rejected as `cyclic_join`** (422 at save, 409 at run/preview).

**Why — there are two models, and the user only sees the top one:**

- **What the canvas shows:** nodes are *queries*; drawing a line between two is a join. First-class,
  WYSIWYG, "clean and simple."
- **What the engine runs:** a query is a *transparent window* onto its leaf datasets. Every node is
  flattened to its `ds_` leaves and a tree is enforced over *those* — each leaf may appear **once**
  ([query_engine.py:213-218](../../../workspace/apps/backend/app/query_engine.py#L213)). A and B
  both resolve to `{ds_customer}` → overlap → `cyclic_join`. To the engine this is a **self-join on
  one dataset**; to the user it's obviously two different queries.

**Three ways the hidden model bites (all invisible on the surface):**

1. **Shared-leaf collision** — the dogfood case above. Any two nodes sharing *any* leaf dataset →
   `cyclic_join`. The most natural thing to try (two derived views of one entity) is unexpressible.
2. **Steps dropped in composition** — a query used as a join *source* is baked by
   [resolve_source (query_engine.py:74-109)](../../../workspace/apps/backend/app/query_engine.py#L74)
   as source+joins+**own filters only**; its transform `steps` (aggregate/top_n/derive/date_bucket)
   are NOT applied (`_run_steps` runs only at the top-level run/preview,
   [queries.py:255](../../../workspace/apps/backend/app/routers/queries.py#L255)). A row-reducing
   step's passthrough key column still exists pre-step with matching dtype → the join silently runs
   against **un-aggregated / un-filtered** rows. The sanctioned "materialized stepped result as a
   source" path is a **workflow** (`wf_`, a fresh leaf —
   [query_engine.py:132-154](../../../workspace/apps/backend/app/query_engine.py#L132)).
3. **Left key must trace to a leaf** — the left endpoint is rewritten via provenance to its owning
   `ds_` ([joinGraph.ts:254-261](../../../workspace/apps/builder/src/features/data-management/queries/joinGraph.ts#L254));
   a derived/aggregate column (no single owner) is rejected `derived`. Protective, but again only
   legible in engine terms.

**The defect is the invisibility, not the flattening.** The provenance-flattening is *smart* — it's
what makes composition safe and promotion-to-governed-ER possible. But the clean surface **promises a
model the engine won't deliver**, and when they diverge the app speaks the engine's vocabulary
(`cyclic_join`, `relationship_stale`, `derived`) at the wrong time (preview/save, not draw). Note the
FE cyclic check is **node-level** (is `qr_B` already connected?), so it *lets you draw* the edge; the
leaf-level collision only surfaces later in the backend — the worst-case timing.

**Bearing on the thesis:** this is *not* "prune the join capability." The single-dataset self-join
the user reached for is the parked [[relationships-future-parked]] "self-join ↔ identity" case — a
known gap, not a regression. The join is real and valuable for **disjoint** entities (anti-join,
cross-entity). What the dogfood indicts is the **surface↔engine mismatch**, which is a UX/legibility
problem, not a capability one.

**Candidate directions (no code yet — human picks):**

- **Forward:** detect the leaf collision at *draw time* (the FE already resolves left provenance to
  leaves — it has enough to know A and B share `ds_customer` on drop), instead of failing at preview.
- **Up (user vocabulary):** replace `cyclic_join` with _"Query_A and Query_B both come from
  **customer** — you can't join a dataset to itself. Combine them as steps in one query, or
  materialize one as a workflow."_
- **Out of scope to keep:** do NOT expose the internals wholesale — that kills the simplicity the
  surface is prized for. The goal is to teach the constraint in the user's language at the gesture,
  not to surface the join-tree machinery.

- **Attribution** — query-surface (Canvas + engine) legibility gap; the shared-leaf self-join is
  the parked identity model, surfaced (not caused) by this dogfood.

### Finding — the self-challenge: a nice builder that doesn't *help* is useless (2026-07-12)

Emerged from the human pressing "what are the ROLES — builder vs workflow?" and landing the
sharpest line of the round: **a clean builder that doesn't help the user get an insight is
useless.** Cleanliness is necessary, not sufficient. The test isn't "is the surface tidy?" — it's
"did a business user get an insight *without paying for engineering they shouldn't have to see?*"

**The two-brick lens (the frame under all findings above).** The wall between a business user and
an insight is two bricks cemented together:

- **Brick A — domain / relationship logic** (customer relates to orders on `customer_id`; rate =
  calls ÷ days; a lead with no call is a miss). **Irreducible** — no tool erases it, it *is* the
  meaning of the data. The user must own it — and already does; it's their business.
- **Brick B — engineering mechanics** (leaves, provenance flattening, composed-vs-materialized, the
  tree invariant, `cyclic_join`). **Accidental** — an artifact of how we built the engine. The user
  should never know it exists.

The product's #1 promise (ease, zero AI) is **not** "remove Brick A" (impossible, and the user
*wants* to own their domain) — it is **"never charge the user for Brick B."** Every finding above is
a place we currently charge for Brick B: `cyclic_join` in engine vocabulary, hidden flattening,
silent step-dropping, and now the noun-level choice "builder or workflow?".

**Roles, stated cleanly (the human's question).** The only crisp distinction between the two
surfaces is **live vs frozen** — everything else (steps, DuckDB, charting) is shared, which is
*why* they blur:

| | **Query (builder)** | **Workflow** |
|---|---|---|
| is | a **live lens** on data | a **frozen snapshot** of a computed result |
| runs | every read | once at run; frozen until re-run |
| use when | **ask a question, see the answer** | **build on top of a computed result** (reshape-then-join, self-join, stable snapshot) |

The insight ladder: **Dataset** (business as-is) → **Query** (ask live questions — where almost all
insight lives, zero-DE) → **chart/widget** (see it) → **Workflow** only when an answer must become
the *input* to the next question → **AI-loop (#2)** when even phrasing the question is hard (agent
operates, human verifies *meaning*). The builder is the **primary** insight tool; the workflow is
**plumbing, not a co-equal analysis surface**. The dogfood confused this precisely because rescuing
a broken join pushed the workflow *forward* — making it look peer to the builder.

**Candidate (OPEN — not a decision).** The role confusion is itself a Brick-B leak at the level of
*nouns*. Our own history says transform-steps were deliberately folded **into the Query**; the
"Workflow noun" was to appear only when a query genuinely *couldn't* express the shaping — and that
wall [[workflows-extend-query-duckdb-first]] **had not fired**. Yet a workflow surface exists. So a
live candidate is: **workflow = an invisible *materialization mode* of a query** (a "snapshot this /
reuse this" toggle), not a separate thing the user must learn. That would collapse both roles back
into one surface with a live/frozen switch underneath — Brick B stays under the floor. Held open on
purpose; more dogfood should pressure-test it before we write it as direction.

**Bearing on the round thesis.** This does not prune the join capability — it reframes the whole
round: the query surface's problem is **legibility, not capability**. The self-challenge is the
keeper: *build the engine as smart as it needs to be, but judge the surface only by whether a
domain expert gets an insight in their own language.* A nice builder that fails that test is
useless. :)

- **Attribution** — cross-cutting product-legibility finding (query + workflow surfaces + the
  noun model); pulled by the human's builder-vs-workflow role question. Keeps room to evolve — no
  lock-in.

### Finding — query≈dataset: the join constraint is *accidental*, not semantic (2026-07-12)

The human's syllogism, which sharpens the mismatch above into a **model** question, not a copy one:

1. From the **end-user** POV a query *is* a readable table — same as a dataset ([[query-is-virtual-dataset]]).
2. If so, "draw a link between two queries" **must** behave the same as "draw a link between two datasets."
3. Current implementation can't — so we must consider the composition model carefully, not just relabel.

**Diagnosis — an identity asymmetry.** A **dataset** is a *leaf* (its own identity, a distinct
row-source); a **query** is a *transparent window* flattened to its leaves
([query_engine.py:213-218](../../../workspace/apps/backend/app/query_engine.py#L213)). Two datasets →
two distinct leaves → join fine. Two queries off one dataset → *one* leaf seen twice → `cyclic_join`.
The user's symmetry is broken by an identity model they never see.

**The key point — the constraint is mostly accidental.** `Query_A` (region X) JOIN `Query_B` (region Y)
on `customer_id` is, in SQL, just `(A) JOIN (B) ON …` — two derived relations, **no cycle**; DuckDB
runs it trivially. The engine rejects it only because flattening **erased each query's identity
first**, then the tree-invariant can't tell "two views of customer" from "customer self-joined." So
R160's earlier "teach the constraint in nicer words" (the "Up" candidate) risks **teaching Brick B a
constraint that shouldn't exist**. Consistency check: R75 [[query-is-a-connection-not-a-load]] already
killed a Query-side guard (row-explosion) on "runtime cost is the consumer's problem." `cyclic_join`
is another Query-side guard; the same doctrine leans toward *let it run*.

**The fork (feeds R161 — a DECISION, not closed here):**

| | **A — query behaves like a dataset** | **B — keep flatten-to-leaves** |
|---|---|---|
| composition | query-source = its full run output, a live subquery/CTE with its own alias | window, flattened to leaves |
| `cyclic_join` (same-leaf) | gone — distinct subqueries | stays, must be taught |
| step-dropping (finding #2) | gone — steps run (it's the query's real output) | stays |
| Workflow noun | collapses → live/frozen is a materialization toggle | stays a separate noun |
| cost | re-runs nested pipeline per read (consumer pays — R75-consistent) | cheaper, one flat SQL |
| loses | automatic leaf-dedup + safe-composition / promote-to-governed-ER | — |
| **must re-solve** | **join fan-out / measure double-count** (flatten partly sidestepped this) | — |

**A** restores the symmetry and fixes three findings + the noun in one move; it's the coherent form
of the [[workflows-extend-query-duckdb-first]] "materialization mode" candidate. What it costs
(leaf-dedup, promote-to-ER) served a *governance* future, not the **#1 ease** promise — so that cost
is the thing on trial. **A's own new debt is fan-out safety**, which the flatten model bought us for
free. Do NOT over-correct: a genuine self-join on one entity/identity ([[relationships-future-parked]])
is real Brick A — express it as "join `ds` to itself with two aliases," don't let the common
two-views case inherit that rare case's rejection.

**Bearing on thesis:** still not "prune the join." It reframes the fix from *legibility* (R160 so far)
to *composition-model* — bigger than this dogfood's scope, so it's staged as the **R161 decision**.
Industry cross-check for that decision lives in the next finding.

- **Attribution** — query-surface composition-model finding; pulled by the human's query≈dataset
  syllogism. Held open — R161 decides.

### Finding — industry cross-check: where our composition model sits (2026-07-13)

Researched how comparable tools solve query-as-source composition, to inform the R161 fork. The axis
is **how a derived query behaves when used as a source**: *inline/flatten* (ours) vs *opaque relation
with identity* (most others).

- **dbt materializations** — the decisive frame. `ephemeral` = SQL **inlined as a CTE** into
  dependents (*exactly our flatten*); `view`/`table` = materialized **with identity**; it's a
  per-model **config toggle**, not separate nouns. → validates "materialization is a MODE, not a
  Workflow noun" ([[workflows-extend-query-duckdb-first]]). ([dbt docs](https://docs.getdbt.com/docs/build/materializations))
- **Metabase Models** — "a query that **behaves like a table**," used as a data source, joinable —
  the query≈dataset intuition made **first-class**. BUT known issue *"Multiple Models of same
  underlying Table conflict"* ([#24515](https://github.com/metabase/metabase/issues/24515)) — even
  the tool that best embodies query≈dataset **hits our exact same-leaf case**. Humbling: the collision
  is intrinsic, not just our bug. ([Models docs](https://www.metabase.com/docs/latest/data-modeling/models))
- **Looker symmetric aggregates** — the fan-out tax model **A** must pay. Joining coarse→fine
  double-counts a summed measure; Looker's default fix is `SUM DISTINCT` on a declared PK, else
  "aggregate in a derived table to force 1:1." Our flatten model **sidesteps** this by construction;
  A reintroduces it. ([Looker docs](https://cloud.google.com/looker/docs/best-practices/understanding-symmetric-aggregates))
- **Malloy** — modern query≈source done right: composable sources with identity, joins declared on
  sources, **compiles to optimized SQL on DuckDB** (our engine). Proof the A direction is viable on
  our stack. ([Sources](https://docs.malloydata.dev/documentation/language/source.html))

**Verdict — good bones, off-axis default.** Our engine is a legitimate, even elegant *inline/flatten*
implementation (dbt's `ephemeral`, chosen well). But we made the **minority pole the only mode**, and
it's off-axis from (a) the **#1 ease** promise and (b) every tool the user's mental model is trained
on (Metabase/Looker/Malloy all give a derived query **identity**). Two nuances keep us honest: the
same-leaf collision is **intrinsic** (Metabase #24515), and **A imports fan-out debt** (Looker's
symmetric aggregates) that flatten gave us free. So R161 is not "A is obviously right" — it's "pick
the pole deliberately, and if A, budget the fan-out answer."

- **Attribution** — external evidence for the R161 composition-model decision; no code.

### Finding — solve-it-smart: model A is a *bug-fix*, not a rewrite; fan-out is pre-paid (2026-07-14)

Read the actual engine to test whether A can be done *elegantly* on our DuckDB stack. It can — and
most of A already exists. Three code facts change the decision:

1. **Query-as-subrelation-with-identity already exists.** `resolve_source` for a `qr_` source already
   wraps a query as `( … )` and exposes its EFFECTIVE (collision-qualified) columns
   ([query_engine.py:74-109](../../../workspace/apps/backend/app/query_engine.py#L74)); the right side
   of a join is the SAME unified resolver ([query_engine.py:203-211](../../../workspace/apps/backend/app/query_engine.py#L203)).
   We are ALREADY closer to model A (identity) than to a pure flatten — the flatten only survives in the
   `dataset_ids` provenance set + the tree guard.

2. **The step engine is SQL-composable — steps are already nested SQL.** `_apply_step` wraps each step
   as `SELECT … FROM (prev) AS _x` ([rows_reader.py:373-407](../../../workspace/apps/backend/app/ingest/rows_reader.py#L373));
   `run_steps` and `materialize_steps` are the SAME fold, one executing, one writing parquet
   ([rows_reader.py:430-461](../../../workspace/apps/backend/app/ingest/rows_reader.py#L430)). So the
   step-dropping bug (finding #2) is fixable by calling that existing fold inside `resolve_source`
   (extract `build_stepped_select(inner, …, steps)`), exposing post-step columns. **A stepped query can
   compose LIVE as one nested query** — no materialization required.
   → **This directly answers the Workflow-noun question:** since steps compose live, the Workflow noun is
   NOT required for composition. `materialize_steps` (frozen parquet) becomes a pure *performance/stability
   mode* (snapshot a heavy result) — dbt's `table` vs `view`, a **toggle, not a noun**. Confirms the R160
   candidate with code evidence.

3. **The fan-out tax is largely PRE-PAID — by the same bug-fix.** Fix #2 and a source query that
   aggregates to its own grain becomes a pre-aggregated subrelation (one row per key) *before* it's
   joined → **the fan-out never happens.** That is exactly Malloy's "aggregating subquery" / aggregate
   locality — and here it falls out of fixing a correctness bug, not building Looker's symmetric-aggregate
   engine. The user expresses grain by WHERE they put the aggregate step (source query vs top query) —
   which is Brick A (domain), legible, already how they build.

**The precise trade (sharper than "A vs B").** Relaxing the shared-leaf `cyclic_join`
([query_engine.py:212-218](../../../workspace/apps/backend/app/query_engine.py#L212)) is safe for the RUN
because `build_effective_columns` already collision-qualifies columns; what shared-leaf genuinely breaks
is **unambiguous leaf-provenance for promote-to-governed-ER** (which `ds_customer` owns this key when it
appears twice?). So the real decision is: **`cyclic_join` (promote-to-ER provenance) ⇄ query≈dataset
symmetry.** Keep `composition_cycle` (genuine self-reference — a real cycle) always.

**The residual fan-out case (raw-join-then-top-level-aggregate)** — user joins raw A→raw B and sums a
coarse column at the top. Tiered smart answer, our-fit order:

- **Primary:** aggregate locality (free, above) — steer/default to aggregate-in-source.
- **Backstop (defer until pulled):** Looker `SUM(DISTINCT …)` on a declared PK, or a warn. Needs a
  per-source key we don't have — don't pre-build ([[relationships-future-parked]]).

**Bearing on thesis / R161.** "Can we solve it smart?" → **yes, and cheaply**: the elegant path is a
targeted **step-dropping fix** (kills a correctness bug + delivers aggregate locality + makes live
composition real) plus a **scoped `cyclic_join` relaxation** (the only real cost is deferring
promote-to-ER provenance, which isn't built). Not a rewrite. R161 decides whether to take it.

- **Attribution** — code-grounded design view for the R161 decision; no code written this round.

## Check

- [x] **The join-relationship challenge answered with evidence** — join is *not* pruned; the real
      defect is the surface↔engine model split and the missing noun-model. Code-traced.
- [ ] ~~Every query step kind + a join + a render exercised breadth-first~~ — **deferred**: the
      round pivoted from breadth-dogfood to the composition-model diagnosis. Baseline Q1–Q3 /
      anti-join / messy-key / render move to R161 validation (see Watch).
- [x] Findings captured (6, code-grounded); roadmap re-rank folded into R161's remit below.

## Act

**Learnings**:

- The dogfood's value was **diagnostic, not the planned breadth walk** — a probe round earns its
  keep by what it *finds*, and honest R159-style Studied records that it answered a *deeper*
  question (the noun-model) than it asked (breadth). It did not manufacture closure on the unrun
  probes; it named them.
- **Root cause is definitional, not a bug**: dataset · query · join · relationship · workflow were
  never given explicit boundaries, so the engine and the surface each invented their own and they
  disagree. Fixing individual seams (`cyclic_join`, step-dropping) treats symptoms.
- **Ease (#1) constraint**: these definitions are Brick B — they serve the builders, must stay
  under the floor; the user should never see them (the round's own two-brick lens).

**Promotions**: none. The noun-model is R161's deliverable (a design-corpus artifact), not a
`memory/` note yet.

**Prune check**: nothing pruned. (The composition model is under review, not cut — R161 decides.)

## Feeds into → Round_161 (concepts & boundaries)

- **Define the noun-model** — dataset · query · join · relationship · workflow, with explicit
  boundaries, as a canonical design-corpus doc (target model; current code divergence = named debt).
- **Query-identity decision (model A vs B)** falls out of defining "query"; `cold-reviewer` before
  locking; the trade is `cyclic_join`/promote-to-ER provenance ⇄ query≈dataset symmetry.
- **Validation** — the unrun real-data probes (anti-join, messy-key, render) confirm the
  definitions hold on real data.
