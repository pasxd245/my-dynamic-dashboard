# Program plan: Query as the single shaping surface

**Status**: Active (current round — `cycles/Round_162.md`)
**Opened**: 2026-08-07
**Closed**:

Make **Query** the one place where data is shaped, then shrink everything that
duplicates it. The program runs four rounds: land the missing primitive that made
composition necessary (**within-group columns**), complete that family, retire
`query⋈query`, and only then settle what Workflow is. Cadence: one slice per round,
each independently useful — stop after any round and the product is coherent. The
goal is a data **player** unblocked: import → shape → look, without a modeling
language and without artifacts piling up per question.

_Track: 1 (product — the #1 ease story fails at its core; the human's 2026-08-07
full-loop dogfood could not build an ordinary dashboard). Pulled by: that dogfood
plus the Query concept-lock conversation of the same day. Decisions settled in
[`brainstorms/2026-08-07-grain-alignment.md`](../brainstorms/2026-08-07-grain-alignment.md)._

## Settled decisions (human, 2026-08-07)

1. **Persona = "data player", not data diver.** Serve the fastest path from *"I
   wonder…"* to *"oh, look at that"*, for a manager who knows Excel and owns the
   business question. Not a warehouse. Not competing with Power BI on breadth — the
   bar is *escaping the CRM/Excel complexity without first learning Power Query or DAX*.
2. **Query is closed** (supersedes the R161 definition — see § The Query concept).
3. **No `query⋈query`.** Every join operand is a dataset: `ds ⋈ ds ⋈ ds …`.
4. **Aggregate belongs to Query**, in two families — collapsing (group-by) and
   within-group (windowed).
5. **Order carries meaning.** The operation list is genuinely ordered; filter-then-join
   and join-then-filter are different questions.
6. **Join may appear anywhere in the order** (option ii), not only as a prelude — the
   thing joined *in* is always a dataset, the left side is whatever has been built.
7. **Query stays live.** Never materialized; drift surfaces as a warning, never as
   silently wrong rows.
8. **Stacking is not Query's job** — monthly exports combine at the dataset level via
   upload + append. A workflow *can* do it, but that is a consequence, not its purpose.

### The Query concept

> A named, saved, **live** table built from **datasets only**, by an **ordered** list of
> operations: **join** a dataset (any type; a relationship pre-fills the key) · **filter** ·
> **computed column** · **aggregate** (group-by) · **within-group column**. Output is one
> flat table. It never reads another Query, never stacks files, never freezes, and does not
> present — charts, formatting, and sort-for-display belong to the widget.

**Why this program exists, in one line**: the product shipped collapsing aggregates and
never shipped within-group ones, so the only way to express *"compare this to its group"*
was to join two results — which is `query⋈query`, which hits `cyclic_join`. Window
functions are precisely the SQL feature that exists so you don't self-join aggregates.

## The repeatable unit (what each round does)

Each round is a **DCFBI slice** over one coherent capability:

1. **D** — update the design corpus *first*, in-round. The D-gate artifact is the
   design-corpus spec ([[d-gate-artifact-in-design-corpus]]), so
   [`_noun-model.md`](../../design/data-management/_noun-model.md) and the affected
   per-surface docs are rewritten as part of the round, never as a round of their own.
2. **C → B → F → I** — contract, backend, front-end, integration, per the standing gates.
   Run `flow-selector` at the Design exit to record the chain.
3. **Acceptance is a rebuild, not a test count.** Every round ends with the human
   producing something real on real data. Gates green is necessary, never sufficient
   ([[dfcfbi-f1-needs-human-review]]).
4. **Ship something usable.** No round in this program may deliver only analysis.

## Scope + firewall

- **In** — the Query surface: within-group operations, the collapsing set, the ordered
  operation list, retiring composition.
- **Deferred** — Workflow's definition (R165+, and only once Query is settled); the
  draw-time join-error UX (D4, largely mooted once composition is gone); the R157 UX
  cluster; `[F-prov-reimport-choice]`.
- **Out** — materialization/scheduling semantics; presentation (charts, formatting,
  sort-for-display); promote-to-governed-ER; anything that re-opens the persona question.

**Firewall (anti-creep)** — two rules:

- **Replace before you remove.** Composition is not retired until within-group columns
  make it unnecessary. Reversing this order leaves the human *more* blocked than today.
- **No round ships only documents.** The four-week stall of R159→R161 (three consecutive
  code-free rounds on the same untouched seam) is the named failure mode this program is
  built to avoid. If a round's scope collapses to analysis, it merges into its neighbour
  rather than standing alone.

## Work items + order (suggestive, not binding)

| # | Item | Status | Round |
| - | ---- | ------ | ----- |
| 1 | **Within-group column** (aggregate within a group, as a column) + the Query concept rewritten into the design corpus | **in flight** | `Round_162` |
| 2 | The rest of the within-group family — % of total · running total · rank within group · vs prior period | queued | — |
| 3 | **Retire `query⋈query`** — remove composition, clean saved queries, delete the `cyclic_join` / `composition_cycle` / shared-leaf machinery | queued | — |
| 4 | **Workflow** — settle what it is, now that Query is the single shaping surface | queued | — |

**Already complete — verified in code 2026-08-07, schedule no work for it**: the *collapsing*
aggregate family. `count` · `count_distinct` · `sum` · `avg` · `min` · `max` all ship, with
per-agg dtype rules ([query_engine.py:376-398](../../../workspace/apps/backend/app/query_engine.py#L376)).
Conditional aggregate is redundant — a computed 0/1 column plus `avg` gives a rate.

Round 1 also **calibrates this doc**: it is the first round to rewrite a design-corpus
concept doc as its D gate, so its review pass hardens the repeatable unit before item 2.

## Rolling log

| Entry | Axis/Kind | Seen in | Disposition |
| ----- | --------- | ------- | ----------- |
| Grain alignment needed by 3 of 5 dashboard tiles — load-bearing, not an edge case | evidence | R162 | open |
| "Average within team" is ambiguous: pooled rows (71.4%) vs average of member rates (70.8%) — must be a user choice in plain words | UX trap | R162 | open |
| "Vs prior period" lies silently on gaps (Jan, Feb, **Apr** → Feb reads as April's previous) | correctness trap | — | open |
| Order × within-group interact — a group column computed before vs after a filter averages over different groups | UX trap | — | open |
| Join after aggregate requires the key to survive the group-by; impossible joins must be grey, not error | UX | — | open |
| **Self-join is a BOUNDARY, not a gap** — the same dataset twice in one query is rejected ([query_engine.py:212](../../../workspace/apps/backend/app/query_engine.py#L212)) and stays rejected, **including in the Builder** (offer-nothing, not error-at-run). "Query only does BIZ, not everything" | boundary (human, 2026-08-07) | R162 | **settled** — state it in `_noun-model.md`; the need it leaves unserved is an input to item 4 (Workflow) |
| Brainstorm's D-A row says pooled 71.4% is "not expressible". **Superseded** — once order carries meaning, placing the within-group column *before* the collapsing aggregate yields pooled, *after* yields 70.8%. So the pooled/per-member choice may be an **ordering**, not a parameter — the R162 design gate must settle which affordance it builds | superseded finding | R162 | open — decide at the R162 D gate |
| **Derivable but undiscoverable** — top-N = rank + filter; anti-join = left join + `is_null` filter. Both work; both need a SQL trick to assemble. For a *player*, that means they don't exist | UX / persona | — | open — decide per item whether to name it as a first-class operation |
| Join types shipped = `inner`/`left`/`right`/`full` ([common.py:330](../../../workspace/apps/backend/app/models/common.py#L330)). No anti-join or cross join as a **named** type, though anti-join is derivable | concept↔code gap | — | open |
| `build_stepped_select` is cited by `_noun-model.md` but does not exist | doc↔code drift | R161 | fix in R162 |
| D1 step-drop, D2 shared-leaf, D3 workflow-as-noun, D4 error-at-wrong-time | inherited debt | R161 | D1/D2 dissolved by item 3; D3 → item 4; D4 deferred |

## Lifecycle

Active until Query is the single shaping surface — composition retired, the within-group
family shipped, and Workflow's boundary settled against it. At close, the rolling log's
recurring entries promote to their own rounds or a decision artifact, and this file folds
into a closing note.
