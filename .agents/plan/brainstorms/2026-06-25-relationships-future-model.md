# Brainstorm (PARKED) — the future relationships / composition model

**Status**: **Parked — no decision.** Captured during R94 (UI bug batch) from a design discussion
that branched off D5 (promote boundary). Three entangled strategic questions, all rooted in the same
place: **how query identity & composition are modelled.** Deferred behind the value-out roadmap
([[post-mvp-roadmap-migration-first]]); pick up only on a real pull. Decide them **together** — they
share a root — not piecemeal.

_Track: 1 (product-model exploration). Pulled by ← the R94 D5 discussion (self-join → pipeline →
governed-rel value). Per the [Evolution Rule](../../AGENTS.md) — parked, not built._

## The shared root

All three questions reduce to: **what is a query's identity, and how do queries compose?** Today
identity is **dataset-id-based** — a leaf `ds_` is the unit of provenance and of the tree invariant.
That single choice is what blocks self-joins and what the pipeline/governed-rel ideas are circling.

## Q1 — Self-joins / diamonds / DAGs ↔ the provenance-identity shift

- **Today:** a dataset may appear **once** per query. `dataset_id` membership does double duty — the
  acyclic invariant **and** hop-left matching ([queries.py:209](../../../workspace/apps/backend/app/routers/queries.py#L209),
  overlap → `cyclic_join` [:221-227](../../../workspace/apps/backend/app/routers/queries.py#L221)).
  A `customers ↔ customers` self-rel (direct **or** via a query built on customers) is rejected —
  the `qr_` right expands to its leaves, so the wrapper trick doesn't escape it. Correctly out of
  scope (canvas.md Scope boundary).
- **What real support needs:** move identity from **dataset-id → per-source alias** (each node a
  distinct relation `customers AS c1`/`c2`, provenance keyed on the source-instance, not the leaf).
- **Readiness (honest):** scaffolding exists, core identity unbuilt. 🟡 SQL aliasing (`qr_` rights
  already bake as aliased subqueries; raw `read_parquet` datasets have no per-instance alias) · 🟢
  column collision-qualification · 🟡 provenance-on-wire (R93 shape exists but keys `ownerSourceId`
  on a leaf `ds_`) · 🔴 resolver (`dataset_id_sets` double duty) · 🔴 FE (`buildSourceGraph` /
  `resolveConnect` assume one node per source) · 🔴 contract (no alias/instance concept). **Design-
  ready to scope; not a small build.** A multi-gate round starting with a design gate on the
  identity model.
- **Trigger:** a concrete report needs a self-referential / parent-child join (org hierarchy, account
  parent→child, manager chain). Build on demand, not speculatively.

## Q2 — "Model queries as a pipeline (stage → stage)" — cold-reviewed, verdict: doesn't solve the stated problem

- **Cold-review (mix, 2026-06-25) verdict:** the reframe targets **topology** when the blocker is
  **identity**. A pipeline hits the *same* `cyclic_join` wall (stage-A(customers) ⋈ stage-B(customers)
  still expands to overlapping leaves) unless it **also** re-keys provenance off the leaf — which is
  the Q1 alias-identity shift, achievable **without** a pipeline. So pipeline is **neither necessary
  nor sufficient** for self-joins. Also: composition **already is** a pipeline (`qr_` resolves
  recursively, baked as an aliased subrelation — [queries.py:99-110](../../../workspace/apps/backend/app/routers/queries.py#L99)),
  so an explicit pipeline layer risks a **second** chaining abstraction + a saved-query migration.
- **Where a pipeline framing *could* earn its place — a different rationale:** reuse, **materialization
  / perf** (cache a stage's output), and **staged debugging** of long compositions. Judge it on
  *those* merits (value + DX), not as a self-join enabler. Still behind value-out.

## Q3 — Do governed relationships earn their keep? Could a pipeline/workflow supersede governed-vs-free-form?

- **What governed rels give today:** a curated, reusable, **divergence-tracked** dataset↔dataset join
  catalog — copy-on-pick (reuse a vetted key+cardinality), warn-on-drift, discoverability, and
  promote (free-form → governed). **Value scales with reuse across many queries** — low now (few
  queries), by design grows.
- **The human's hypothesis (R94 discussion):** governed rels "don't have much benefit" yet; maybe when
  a workflow/pipeline model stabilizes we leverage *that* instead of detecting governed-vs-free-form.
- **The brake:** this challenges a **stated foundation** — [purpose.md](../../context/purpose.md) key
  decision #4 ("Relationships are central and not fixed; relationship governance is a product
  requirement, not a technical extra"). So it's a strategic re-examination, **not** a bug-round tweak.
  Re-open the decision deliberately (with the reuse/scale evidence + the pipeline question), don't
  erode it incrementally.
- **Entanglement:** "supersede governed-vs-free-form with pipelines" depends on Q2 (whose self-join
  rationale the cold review rejected) — so this can't be settled before the pipeline framing has a
  real, non-self-join rationale and a worked design.

## How to pick this up (when a pull arrives)

1. Start from **Q1's identity model** (dataset-id → alias) — it's the root all three share.
2. Treat Q2 (pipeline) as a **separate value/DX proposal** with its own worked design + demand, not a
   self-join enabler.
3. Re-open Q3 (governed-rel role) **only** deliberately, against purpose.md #4 + real reuse data.
4. Sequence: **behind value-out** (consumer-save/Excel → dashboards). No build without a named trigger.
