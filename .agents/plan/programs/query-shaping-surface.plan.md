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
- **Deferred** — Workflow's definition (R166+, and only once Query is settled); the
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
| 1 | **Within-group column** (aggregate within a group, as a column) + the Query concept rewritten into the design corpus | **in flight** — split by the DFCFBI selector | `Round_162` (D + F1) → `Round_163` (C + B + F2 + I) |
| 2 | The rest of the within-group family — % of total · running total · rank within group · vs prior period | queued | `Round_164` |
| 3 | **Retire `query⋈query`, replace it with Duplicate** — remove composition (**both** forms — see D5) and the surfaces that offer it, ship `Duplicate` in its place, clean saved queries, delete the `cyclic_join` / `composition_cycle` / shared-leaf machinery (§ Item 3 scope) | queued | `Round_165` |
| 4 | **Workflow** — settle what it is, now that Query is the single shaping surface | queued | `Round_166` |

> **Renumbered 2026-08-10.** Item 1's round ran the `flow-selector` at its Design exit and landed
> **DFCFBI (triggers 1, 3, 5)**, so the standing [[dfcfbi-two-round-split]] applies: R162 stops at
> the F1 feel-review, R163 finishes the capability, and every later item shifts by one. The
> firewall holds — R162's F1 half ships FE code, not only documents.

**Already complete — verified in code 2026-08-07, schedule no work for it**: the *collapsing*
aggregate family. `count` · `count_distinct` · `sum` · `avg` · `min` · `max` all ship, with
per-agg dtype rules ([query_engine.py:376-398](../../../workspace/apps/backend/app/query_engine.py#L376)).

> **Correction (R162 D gate, 2026-08-10).** This paragraph originally closed with *"Conditional
> aggregate is redundant — a computed 0/1 column plus `avg` gives a rate."* **That does not hold
> on shipped code**: `derive` takes **numeric operands only**, so there is no way to turn
> `outcome = 'connected'` into a 0/1 column — meaning *connect rate by agent*, the dogfood's own
> example, is **not expressible today at all**. The route that does work arrives with item 1:
> aggregate at a finer grain (`[agent, team, outcome] → count`), then roll it up with a
> within-group column (`SUM(count) OVER (agent)`), filter, divide. So the within-group column
> unblocks **T2 as well as T3** — one more tile than this plan claimed. Conditional aggregate
> stays unscheduled, but for a different reason than the one written here.

Round 1 also **calibrates this doc**: it is the first round to rewrite a design-corpus
concept doc as its D gate, so its review pass hardens the repeatable unit before item 2.

### Item 3 scope — retire composition, replace it with **Duplicate** (human, 2026-08-10)

Settled in discussion after the F1 hand-use found composition still offered. Item 3 is **not**
"delete the resolver" — it is a **replacement**, and the replacement is *smaller* than the thing
it replaces.

**Why Duplicate rather than nothing.** "Build on this query" today creates a query whose
`sourceId` is the base (`qr_`). Under the closed concept that cannot exist. But the *need* it
serves — make a variant of a query without rebuilding 8 operations by hand — is real, and is the
report-maintenance treadmill the product exists to kill. **Duplicate** serves it by copying the
**definition** into a new query over the same datasets: no link, no composition, concept-clean.

**Duplicate is strictly MORE correct than what it replaces.** Composition bakes in the base's
`q` + filters + advanced but **never runs its steps**
([query_engine.py:87-100](../../../workspace/apps/backend/app/query_engine.py#L87) — no
`run_steps` call), so today "Build on this query" over a *shaped* base silently builds on the
base's **un-shaped** rows (that is D1). A duplicate copies the definition entire, steps included,
so its rows are identical to the base's by construction. The bug leaves with the feature — and
note it bites hardest on exactly the queries this program creates.

**The one capability lost, and why it is acceptable.** Composition is a *live link* (fix the
base, dependents follow); Duplicate is a *snapshot* (they drift). The product already made this
exact trade and locked it: **copy-on-pick** gives a query a private `qrel_` snapshot so editing a
governed edge can never break a saved query. Same question, same answer, already a boundary.
Live composition was the outlier. (The grain-alignment brainstorm's fourth finding also warns
that linked intermediates which desync are a silent-wrong-number risk; today's composition
manages to look linked *and* return wrong rows.)

**It deletes a page.** Composition needs a preset-base create mode — `QueryCreatePage`, the
`?base=` route, a builder that previews against a base before the query exists — because the new
query has no definition yet. A duplicate has a complete, runnable definition already, so it is:
`[Duplicate]` → name modal → `POST {name, sourceId: <the base's OWN sourceId>, definition: <deep
copy>}` → open it → Edit. That reuses `SaveQueryModal` + `useCreateQueryMutation` (the standing
one-create-rhythm) and lets `QueryCreatePage` **and** the `?base=` route be deleted. Item 3 is
net-negative code.

**Labels** (per [[labels-context-and-locale-aware]]; corpus-checked, not just convention):

| | EN | VN |
| --- | --- | --- |
| The verb (detail header · catalog ⋯) | **Duplicate** | **Tạo bản sao** |
| Default name of the copy | `{{name}} (copy)` | `{{name}} (bản sao)` |

- **`bản sao` is already this corpus's word for this concept** — the canvas divergence copy says
  *"Truy vấn vẫn dùng bản sao riêng"* (the query's own copy of a relationship). Same concept,
  different object → consistent, not colliding. **`nhân bản` is rejected**: it would be a *second*
  VN word for a concept that already has one.
- **`sao chép` is taken** by clipboard-copy (`dashboard.builder.jsonCopy`), so the family splits
  cleanly: `sao chép` = the Ctrl+C verb, `bản sao` = a duplicated artifact.
- **No numeral** — "Tạo bản sao", not "Tạo 1 bản sao"; the digit reads as chat register, is
  redundant, and is longer beside `[Sửa] [Xóa]`.
- **EN rejects** `Copy` (taken — clipboard), `Save as` (collides with *"Save filters as Query"*, a
  genuinely different create), `Clone` (developer register). `Duplicate` also carries the semantic
  freight: it says *independent*, where *Build on* said *dependent*.
- **Still open**: the name-capture **modal title** is a third display context and needs its own
  call — the header button and catalog item can both be the bare verb, the modal title should not
  be. Settle at build time.

**Entry points**: Duplicate replaces D5 **#1** (`[Build on this query]`) and **#3** (the `?base=`
route). It does **not** replace **#2** (the canvas "Saved queries" group — a `qr_` on the right of
a hop): that intent is *join my query to another query*, which the closed concept refuses
outright, and whose replacement is the within-group column, later Workflow. **#2 is removed with
no replacement, deliberately.**

**Build detail to not guess**: `qrel_` ids are query-local, so the deep copy may reuse them
verbatim (no collision) or mint fresh ones — pick one. The default name goes through the existing
`409 name_taken` path.

**Honest caveat**: the case for Duplicate rests on inference, not observation. R160's dogfood used
composition to *join* two queries, not to clone one; no recorded instance of a clone need exists.
The bar is *retaining a modified form of something already built*, not adding something new, so
"default = don't add" does not bite — but this is reasoning, not evidence.

## Rolling log

| Entry | Axis/Kind | Seen in | Disposition |
| ----- | --------- | ------- | ----------- |
| Grain alignment needed by 3 of 5 dashboard tiles — load-bearing, not an edge case | evidence | R162 | open |
| "Average within team" is ambiguous: pooled rows (71.4%) vs average of member rates (70.8%) | UX trap | R162 | **settled at the R162 D gate** — it is an **ordering**, not a parameter. No `basis` field; a **grain line** on each card names what one row means at that position and rewrites itself when the card moves past an aggregate |
| "Vs prior period" lies silently on gaps (Jan, Feb, **Apr** → Feb reads as April's previous) | correctness trap | — | open |
| Order × within-group interact — a group column computed before vs after a filter averages over different groups | UX trap | — | open |
| Join after aggregate requires the key to survive the group-by; impossible joins must be grey, not error | UX | — | open |
| **Self-join is a BOUNDARY, not a gap** — the same dataset twice in one query is rejected ([query_engine.py:212](../../../workspace/apps/backend/app/query_engine.py#L212)) and stays rejected, **including in the Builder** (offer-nothing, not error-at-run). "Query only does BIZ, not everything" | boundary (human, 2026-08-07) | R162 | **settled** — state it in `_noun-model.md`; the need it leaves unserved is an input to item 4 (Workflow) |
| Brainstorm's D-A row says pooled 71.4% is "not expressible". **Superseded** — once order carries meaning, placing the within-group column *before* the collapsing aggregate yields pooled, *after* yields 70.8% | superseded finding | R162 | **confirmed + settled** at the R162 D gate — the affordance built is the ordering, not a parameter |
| **Derivable but undiscoverable** — top-N = rank + filter; anti-join = left join + `is_null` filter. Both work; both need a SQL trick to assemble. For a *player*, that means they don't exist | UX / persona | — | open — decide per item whether to name it as a first-class operation |
| Join types shipped = `inner`/`left`/`right`/`full` ([common.py:330](../../../workspace/apps/backend/app/models/common.py#L330)). No anti-join or cross join as a **named** type, though anti-join is derivable | concept↔code gap | — | open |
| `build_stepped_select` is cited by `_noun-model.md` but does not exist | doc↔code drift | R161 | **fixed** — R162 D gate |
| D1 step-drop, D2 shared-leaf, D3 workflow-as-noun, D4 error-at-wrong-time | inherited debt | R161 | D1/D2 dissolved by item 3; D3 → item 4; D4 deferred |

| **Composition is shipped TWICE** — a `qr_` driving base **and** R91's `qr_` on the right of a hop ([common.py:309](../../../workspace/apps/backend/app/models/common.py#L309)). Both design docs listed the latter as *out of scope* | concept↔code gap | R162 D gate | **raised to noun-model D5** — item 3 must retire both, not just the base |
| `_MAX_STEPS = 8` ([query_engine.py:461](../../../workspace/apps/backend/app/query_engine.py#L461)). The **pooled** T3 path costs **exactly 8** steps; per-member costs 6 | ceiling | R162 D gate | open — **not pre-raised**; if the acceptance walk hits it, that is the evidence |
| `StepsEditor` (R120–R144, 538 lines) had **no design-doc home at all** | doc↔code drift | R162 D gate | **backfilled** into `query-construction.md § Shape` |
| R162 flow = **DFCFBI (triggers 1, 3, 5)** → F1 precedes Contract, and the standing split makes it [D+F1] then [C+B+F2+I] | process | R162 D gate | **settled (human, 2026-08-10)** — split; the program renumbers by one (item 2 → R164) rather than using an `R162a/b` form |

| **Join dropdowns drop the dataset qualifier** — `optionLabel` renders `account_id ↔ id`, but the design declares `account_id ↔ Accounts.id` ([JoinEditor.tsx:99](../../../workspace/apps/builder/src/features/data-management/queries/JoinEditor.tsx#L99)). Worst at the **add-a-join** picker: the left-source select only renders at 2+ sources, so in the common case **neither side is named** and "join to what?" is invisible | **fidelity drift** (design declared it, build dropped it) | R162 hand-use | **settled (human, 2026-08-10) — qualify BOTH sides**, `Deals.account_id ↔ Accounts.id`; spec'd in `query-construction.md`, tracked as **[F-join-label-qualify]**, built with the **R157 UX cluster** per [[r-ui-bug-fixing-round]] |
| **Duplicate replaces composition** — semantics, EN/VN labels, default name, entry points #1/#3 (not #2), and the deletion of `QueryCreatePage` + `?base=` | decision (human, 2026-08-10) | R162 discussion | **settled** — folded into item 3 (§ Item 3 scope) |

## Lifecycle

Active until Query is the single shaping surface — composition retired, the within-group
family shipped, and Workflow's boundary settled against it. At close, the rolling log's
recurring entries promote to their own rounds or a decision artifact, and this file folds
into a closing note.
