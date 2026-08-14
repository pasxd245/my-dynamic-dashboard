# Program plan: Query as the single shaping surface

**Status**: **COMPLETE — closed 2026-08-14.** All four items shipped in seven rounds. `cycles/Round_162.md` + `cycles/Round_163.md` (item 1, signed off 2026-08-11), `cycles/Round_164.md` + `cycles/Round_165.md` (item 2, signed off **2026-08-13** — walk 5 of 5, six defects found after green gates and all fixed), [`Round_166`](../cycles/Round_166.md) (**item 3a**, signed off **2026-08-14** — walk 5 of 5, **T5 = yes**), [`Round_167`](../cycles/Round_167.md) (**item 3b**, the engine half — walk 5 of 5, **D5 CLOSED**), and [`Round_168`](../cycles/Round_168.md) (**item 4**, what a Workflow is — signed off **2026-08-14** on green gates and a human check; **the walk was skipped at the human's call, 0 of 5 unrun**, the only round of the seven without one). **D1 and D3 both CLOSED.**
**Opened**: 2026-08-07
**Closed**: 2026-08-14

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

1. **Persona = "data player", not data diver.** Serve the fastest path from _"I
   wonder…"_ to _"oh, look at that"_, for a manager who knows Excel and owns the
   business question. Not a warehouse. Not competing with Power BI on breadth — the
   bar is _escaping the CRM/Excel complexity without first learning Power Query or DAX_.
2. **Query is closed** (supersedes the R161 definition — see § The Query concept).
3. **No `query⋈query`.** Every join operand is a dataset: `ds ⋈ ds ⋈ ds …`.
4. **Aggregate belongs to Query**, in two families — collapsing (group-by) and
   within-group (windowed).
5. **Order carries meaning.** The operation list is genuinely ordered; filter-then-join
   and join-then-filter are different questions.
6. **Join may appear anywhere in the order** (option ii), not only as a prelude — the
   thing joined _in_ is always a dataset, the left side is whatever has been built.
7. **Query stays live.** Never materialized; drift surfaces as a warning, never as
   silently wrong rows.
8. **Stacking is not Query's job** — monthly exports combine at the dataset level via
   upload + append. A workflow _can_ do it, but that is a consequence, not its purpose.

### The Query concept

> A named, saved, **live** table built from **datasets only**, by an **ordered** list of
> operations: **join** a dataset (any type; a relationship pre-fills the key) · **filter** ·
> **computed column** · **aggregate** (group-by) · **within-group column**. Output is one
> flat table. It never reads another Query, never stacks files, never freezes, and does not
> present — charts, formatting, and sort-for-display belong to the widget.

**Why this program exists, in one line**: the product shipped collapsing aggregates and
never shipped within-group ones, so the only way to express _"compare this to its group"_
was to join two results — which is `query⋈query`, which hits `cyclic_join`. Window
functions are precisely the SQL feature that exists so you don't self-join aggregates.

## The repeatable unit (what each round does)

Each round is a **DCFBI slice** over one coherent capability:

1. **D** — update the design corpus _first_, in-round. The D-gate artifact is the
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
- **Deferred** — Workflow's definition (R168 after the 2026-08-13 layer split, and only once Query is settled); the
  draw-time join-error UX (D4, largely mooted once composition is gone); the R157 UX
  cluster; `[F-prov-reimport-choice]`.
- **Out** — materialization/scheduling semantics; presentation (charts, formatting,
  sort-for-display); promote-to-governed-ER; anything that re-opens the persona question.

**Firewall (anti-creep)** — two rules:

- **Replace before you remove.** Composition is not retired until within-group columns
  make it unnecessary. Reversing this order leaves the human _more_ blocked than today.
- **No round ships only documents.** The four-week stall of R159→R161 (three consecutive
  code-free rounds on the same untouched seam) is the named failure mode this program is
  built to avoid. If a round's scope collapses to analysis, it merges into its neighbour
  rather than standing alone.

## Work items + order (suggestive, not binding)

| #   | Item                                                                                                                                                                                                                                                                            | Status                                                                                                                                                                                                                        | Round                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1   | **Within-group column** (aggregate within a group, as a column) + the Query concept rewritten into the design corpus                                                                                                                                                            | **DONE 2026-08-11** — both rounds **Complete**; acceptance walk confirmed on the human's real 90 581-row call log                                                                                                             | `Round_162` (D + F1) → `Round_163` (C + B + F2 + I) |
| 2   | The rest of the within-group family — % of total · running total · rank within group · vs prior period                                                                                                                                                                          | **COMPLETE 2026-08-13** — end-to-end, gap-blank proven on the real 90 581-row log; the acceptance walk returned **5 of 5** and produced six fixes (incl. a pre-existing pager defect, and `step_invalid` as a new error code) | `Round_164` (D + F1) → `Round_165` (C + B + F2 + I) |
| 3a  | **Ship Duplicate + withdraw every entry point** — the FE half. `[Build on this query]`, the canvas "Saved queries" group and its whole `qr_`-as-a-source treatment, the `?base=` route and `QueryCreatePage`. **No engine, no contract.**                                       | **Planning 2026-08-13**                                                                                                                                                                                                       | [`Round_166`](../cycles/Round_166.md)               |
| 3b  | **Retire composition in the engine** — `rightSourceId: SourceId → DsId`, narrow the `qr_` branch to Workflow's reader, retire `composition_cycle`, collapse D2's set-overlap check, **fix D1 in the workflow consolidation path**, migration stance, + the 14-doc `design-sync` | queued                                                                                                                                                                                                                        | `Round_167`                                         |
| 4   | **Workflow** — settle what it is, now that Query is the single shaping surface                                                                                                                                                                                                  | **COMPLETE 2026-08-14** — the noun is **consolidate + materialize**; consolidation reads what a source **returns** (**D1** repaired); a workflow source is **frozen permanently** (**D3** closed), which retired the `composition_cycle` error code. Walk **skipped** by the human, 0 of 5 unrun | `Round_168`                                         |

> **Renumbered 2026-08-10.** Item 1's round ran the `flow-selector` at its Design exit and landed
> **DFCFBI (triggers 1, 3, 5)**, so the standing [[dfcfbi-two-round-split]] applies: R162 stops at
> the F1 feel-review, R163 finishes the capability, and every later item shifts by one. The
> firewall holds — R162's F1 half ships FE code, not only documents.

**Already complete — verified in code 2026-08-07, schedule no work for it**: the _collapsing_
aggregate family. `count` · `count_distinct` · `sum` · `avg` · `min` · `max` all ship, with
per-agg dtype rules ([query_engine.py:376-398](../../../workspace/apps/backend/app/query_engine.py#L376)).

> **Correction (R162 D gate, 2026-08-10).** This paragraph originally closed with _"Conditional
> aggregate is redundant — a computed 0/1 column plus `avg` gives a rate."_ **That does not hold
> on shipped code**: `derive` takes **numeric operands only**, so there is no way to turn
> `outcome = 'connected'` into a 0/1 column — meaning _connect rate by agent_, the dogfood's own
> example, is **not expressible today at all**. The route that does work arrives with item 1:
> aggregate at a finer grain (`[agent, team, outcome] → count`), then roll it up with a
> within-group column (`SUM(count) OVER (agent)`), filter, divide. So the within-group column
> unblocks **T2 as well as T3** — one more tile than this plan claimed. Conditional aggregate
> stays unscheduled, but for a different reason than the one written here.

Round 1 also **calibrates this doc**: it is the first round to rewrite a design-corpus
concept doc as its D gate, so its review pass hardens the repeatable unit before item 2.

### Item 3 scope — retire composition, replace it with **Duplicate** (human, 2026-08-10)

Settled in discussion after the F1 hand-use found composition still offered. Item 3 is **not**
"delete the resolver" — it is a **replacement**, and the replacement is _smaller_ than the thing
it replaces.

**Why Duplicate rather than nothing.** "Build on this query" today creates a query whose
`sourceId` is the base (`qr_`). Under the closed concept that cannot exist. But the _need_ it
serves — make a variant of a query without rebuilding 8 operations by hand — is real, and is the
report-maintenance treadmill the product exists to kill. **Duplicate** serves it by copying the
**definition** into a new query over the same datasets: no link, no composition, concept-clean.

**Duplicate is strictly MORE correct than what it replaces.** Composition bakes in the base's
`q` + filters + advanced but **never runs its steps**
([query_engine.py:87-100](../../../workspace/apps/backend/app/query_engine.py#L87) — no
`run_steps` call), so today "Build on this query" over a _shaped_ base silently builds on the
base's **un-shaped** rows (that is D1). A duplicate copies the definition entire, steps included,
so its rows are identical to the base's by construction. The bug leaves with the feature — and
note it bites hardest on exactly the queries this program creates.

**The one capability lost, and why it is acceptable.** Composition is a _live link_ (fix the
base, dependents follow); Duplicate is a _snapshot_ (they drift). The product already made this
exact trade and locked it: **copy-on-pick** gives a query a private `qrel_` snapshot so editing a
governed edge can never break a saved query. Same question, same answer, already a boundary.
Live composition was the outlier. (The grain-alignment brainstorm's fourth finding also warns
that linked intermediates which desync are a silent-wrong-number risk; today's composition
manages to look linked _and_ return wrong rows.)

**It deletes a page.** Composition needs a preset-base create mode — `QueryCreatePage`, the
`?base=` route, a builder that previews against a base before the query exists — because the new
query has no definition yet. A duplicate has a complete, runnable definition already, so it is:
`[Duplicate]` → name modal → `POST {name, sourceId: <the base's OWN sourceId>, definition: <deep
copy>}` → open it → Edit. That reuses `SaveQueryModal` + `useCreateQueryMutation` (the standing
one-create-rhythm) and lets `QueryCreatePage` **and** the `?base=` route be deleted. Item 3 is
net-negative code.

**Labels** (per [[labels-context-and-locale-aware]]; corpus-checked, not just convention):

|                                      | EN                | VN                   |
| ------------------------------------ | ----------------- | -------------------- |
| The verb (detail header · catalog ⋯) | **Duplicate**     | **Tạo bản sao**      |
| Default name of the copy             | `{{name}} (copy)` | `{{name}} (bản sao)` |

- **`bản sao` is already this corpus's word for this concept** — the canvas divergence copy says
  _"Truy vấn vẫn dùng bản sao riêng"_ (the query's own copy of a relationship). Same concept,
  different object → consistent, not colliding. **`nhân bản` is rejected**: it would be a _second_
  VN word for a concept that already has one.
- **`sao chép` is taken** by clipboard-copy (`dashboard.builder.jsonCopy`), so the family splits
  cleanly: `sao chép` = the Ctrl+C verb, `bản sao` = a duplicated artifact.
- **No numeral** — "Tạo bản sao", not "Tạo 1 bản sao"; the digit reads as chat register, is
  redundant, and is longer beside `[Sửa] [Xóa]`.
- **EN rejects** `Copy` (taken — clipboard), `Save as` (collides with _"Save filters as Query"_, a
  genuinely different create), `Clone` (developer register). `Duplicate` also carries the semantic
  freight: it says _independent_, where _Build on_ said _dependent_.
- **Still open**: the name-capture **modal title** is a third display context and needs its own
  call — the header button and catalog item can both be the bare verb, the modal title should not
  be. Settle at build time.

**Entry points**: Duplicate replaces D5 **#1** (`[Build on this query]`) and **#3** (the `?base=`
route). It does **not** replace **#2** (the canvas "Saved queries" group — a `qr_` on the right of
a hop): that intent is _join my query to another query_, which the closed concept refuses
outright, and whose replacement is the within-group column, later Workflow. **#2 is removed with
no replacement, deliberately.**

**Build detail to not guess**: `qrel_` ids are query-local, so the deep copy may reuse them
verbatim (no collision) or mint fresh ones — pick one. The default name goes through the existing
`409 name_taken` path.

**Honest caveat**: the case for Duplicate rests on inference, not observation. R160's dogfood used
composition to _join_ two queries, not to clone one; no recorded instance of a clone need exists.
The bar is _retaining a modified form of something already built_, not adding something new, so
"default = don't add" does not bite — but this is reasoning, not evidence.

> **Answered 2026-08-13 (human).** _"I want that feature, don't need to wait till pulled."_ The
> caveat is not withdrawn — it is **overruled deliberately**, which is a different thing and should
> read as one later. R166's acceptance walk is still the probe: it asks whether the built thing
> lands, not whether to build it.

### Item 3's layer split — and the five findings that forced it (2026-08-13)

A D-gate code walk before `Round_166` was written found that **item 3's scope above is wrong in
four places**. The scope text is left standing as authored (it is the human's settled scope); the
corrections are recorded here rather than by editing it, so both readings survive.

| #     | Finding                                                                                                                                                                                                                                                                                                                                                               | What it corrects above                                                                                                                                                                                |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | **The `qr_` resolver is load-bearing for Workflow.** A Workflow's sources are `qr_`/`wf_` and **never** `ds_` ([common.py:905](../../../workspace/apps/backend/app/models/common.py#L905)); `build_consolidated_relation` resolves them through the same branch composition uses ([workflows.py:216](../../../workspace/apps/backend/app/routers/workflows.py#L216)). | "delete the machinery" — deleting it breaks Workflow outright. It is **narrowed to Workflow's reader**, and what a Workflow is stays item 4's question.                                               |
| **B** | **`cyclic_join` is the self-join boundary**, not composition machinery — it rejects a `ds_` right already in the graph ([query_engine.py:213-218](../../../workspace/apps/backend/app/query_engine.py#L213)), which `_noun-model.md` says stays rejected.                                                                                                             | "delete the `cyclic_join` … machinery". Only the **set-overlap** form (D2) dies; it degenerates to a single-id membership test.                                                                       |
| **C** | **`composition_cycle` becomes unreachable but `composition_base_missing` stays** — the same reason string is also the un-run-workflow case ([query_engine.py:142](../../../workspace/apps/backend/app/query_engine.py#L142)).                                                                                                                                         | "delete the `composition_cycle` … machinery". Removing the published enum member is a contract change with a hand-written FE allowlist on the other side (R165's `isApiError` lesson).                |
| **D** | **D1 does not dissolve — it relocates.** `build_consolidated_relation` never calls `run_steps`, so a Workflow consolidating a _shaped_ query reads its **un-shaped** rows and **materializes them to parquet** ([query_engine.py:446](../../../workspace/apps/backend/app/query_engine.py#L446)).                                                                     | The rolling log's _"D1/D2 dissolved by item 3"_. `_noun-model.md` declines to fix D1 because the path is _"scheduled for deletion, not repair"_ — true of the query path, false of the workflow path. |
| **E** | **The data cleanup costs nothing on this DB** — 10 saved queries, **zero** composed; the `workflows` table is empty (direct read of `data/app.sqlite`).                                                                                                                                                                                                               | "clean saved queries" is a **policy** call, not a data job.                                                                                                                                           |

**The split, and why this order.** Findings A–D mean the engine half is neither a deletion nor
net-negative; finding E means the FE half is safe to run alone. So item 3 cuts at the FE/engine
seam, **replacement first**:

- **3a (`Round_166`, FE-only, contract-safe)** — ship Duplicate, withdraw all three D5 entry
  points, delete `QueryCreatePage` + the `?base=` route, and flatten both source pickers to
  datasets-only. **Shipped 2026-08-14 (`bd42c6f`, `384c2ae`), −405/+150 LOC.** One correction to
  this line: the canvas's `qr_` **rendering** did **not** come out here. The Plan and `canvas.md`
  contradicted each other on it and the human ruled for the design doc (2026-08-14) — the rendering
  retires **with** the engine in 3b, so the deletion happens once, in one place.
- **3b (`Round_167`, engine + contract)** — **Complete 2026-08-14.** Findings A–C landed as
  **narrow / collapse / keep-dormant** rather than delete; **finding D (D1) was deferred to item 4
  by the human**, so the repair lands with the decision that governs it. The migration stance is
  reject-at-write (zero composed rows). **The `design-sync` is 4 of 14** — the docs whose code
  changed; the other eight are a real backlog (~286 round-stamps) left unscoped rather than
  absorbed.

Three reasons for that order. **(i)** `_noun-model.md` pre-registered it: _"whether to withdraw the
affordances **earlier** than the engine … is an open call for the human, not an agent's to make"_ —
the human made it. **(ii)** It answers the honest caveat by hand, one round before anything is
irreversible ([[probe-desirability-before-additive-depth]]). **(iii)** It keeps the program's own
firewall honest at the affordance level, not just the capability level: the replacement ships, gets
hand-used, and only then does the thing it replaces come out.

**The cost, named rather than discovered**: for one round the engine still **accepts** `qr_`
operands over the API that no UI offers. That is today's state exactly, so it is not a regression —
but it is a documented gap, not a bug for a later reader to rediscover. And the program grows to
five rounds; Workflow shifts to `Round_168`.

## Rolling log

| Entry                                                                                                                                                                                                                                                                                                | Axis/Kind                               | Seen in     | Disposition                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **The gap trap is CLOSED on real data** — January 2026 filtered out of the real 90 581-row log; February's previous-month reads **blank**, not December's 1816                                                                                                                                       | correctness, proven                     | R165 I gate | **done.** A positional `LAG` would have printed 1816 and looked entirely reasonable on a dashboard                                                                                                                                                                                               |
| **A shared helper's ambiguity is a latent bug in every caller** — `_measure_expr(over="")` conflated _no window_ with _empty window_, so "across everything" silently emitted a collapsing aggregate                                                                                                 | SQL correctness                         | R165 B gate | **fixed by a TYPE (`str \| None`), not a branch.** R163 learned extraction _finds_ bugs; this is the other half — extraction concentrates risk into one contract, which must then be exact                                                                                                       |
| **`prior_period` needs a period-ALIGNED axis** — the `RANGE … PRECEDING AND … PRECEDING` frame is a POINT; on raw dates every cell reads blank (correct, useless). `date_bucket` is the producer, and the coupling is load-bearing, not conventional                                                 | UX / correctness trap                   | R165 B gate | documented + pinned as a test; **no affordance built** — the card cannot tell two `date` columns apart. Candidate for the parked naming/legibility cluster                                                                                                                                       |
| **`prior_period` at the wrong grain** (several rows per period) returns the FIRST of them, arbitrary among ties                                                                                                                                                                                      | boundary                                | R165 B gate | documented, not guarded — cannot be known statically. Well-defined downstream of an `aggregate`                                                                                                                                                                                                  |
| **A MIRROR note left by the round that paid for the lesson turned a re-derivation into a 2-line edit** — R163 wrote it in `workflow.yaml`; R165's C gate simply followed it                                                                                                                          | method evidence                         | R165 C gate | **evidence for _least mechanism that works_** — the note did a lint's job at none of the cost                                                                                                                                                                                                    |
| **`_MAX_STEPS` — verdict returned: NOT raised**                                                                                                                                                                                                                                                      | ceiling                                 | R165 I gate | the real month-over-month tile costs **4** of 8; the trigger did not fire. An answer, not an omission                                                                                                                                                                                            |
| **`ux-design` at the D gate found two ABSENCES a build review could not** — a menu growing to a flat twelve, and an op handing back half an answer with nothing saying so                                                                                                                            | method evidence                         | R164 D gate | **the skill's preventive claim, earned.** A fidelity pass compares build to spec; it cannot flag what the spec never declared                                                                                                                                                                    |
| **Verifying the engine BEFORE the design gate changed the DESIGN, not just the confidence** — checking `LAG` vs the interval frame at B would have found `LAG` already specced and built                                                                                                             | method evidence                         | R164 D gate | note; the trap is invisible unless the fixture has a gap in it                                                                                                                                                                                                                                   |
| **A mock can encode a decision or quietly contradict it** — MSW's `prior_period` looks up by calendar value, not row position, so F1 cannot feel right while teaching the opposite of what R165 must build                                                                                           | method evidence                         | R164 F1     | note                                                                                                                                                                                                                                                                                             |
| **`prior_period` must walk the CALENDAR, not the rows** — `RANGE BETWEEN INTERVAL 1 <unit> PRECEDING AND …` instead of `LAG`, so a missing period reads NULL rather than the wrong period's value                                                                                                    | correctness decision                    | R164 D gate | **settled** — both readings run on the pinned DuckDB 1.1.3; the wrong answer was reproduced, not theorised                                                                                                                                                                                       |
| **Four ops, ONE step kind, and the MENU does the naming** — `window_column` + an `op` discriminator; `[Add step ▾]` gains four business-phrase entries and three `<OptGroup>`s, so no abstract kind label exists for the user to decode                                                              | design decision (human chose the scope) | R164 D gate | **settled** — a flat 12-option menu was the `ux-design` Findability gap that forced the grouping                                                                                                                                                                                                 |
| **`prior_period` emits the VALUE, so a month-over-month tile is TWO steps** — and the card says so, in an advisory line naming the next step in the menu's own words                                                                                                                                 | UX mitigation, invented at the gate     | R164 D gate | open — **never seen by a human**; it is one of the two reasons condition 5 fired                                                                                                                                                                                                                 |
| **Blank means two things** — "no previous period" vs "the previous value was empty" render identically; the card counts the gapped rows rather than marking cells (which would put presentation into a compute step)                                                                                 | `ux-design` Credibility gap             | R164 D gate | **settled at the gate**; a per-cell rendering is refused as a `<PagedRowsView>`-level concern                                                                                                                                                                                                    |
| **`RANK` only — `ROW_NUMBER` refused on correctness grounds** — it invents an order between equal rows, so a tie can reshuffle between runs                                                                                                                                                          | boundary                                | R164 D gate | **settled**; named trigger to revisit = a real need for gapless numbering                                                                                                                                                                                                                        |
| Grain alignment needed by 3 of 5 dashboard tiles — load-bearing, not an edge case                                                                                                                                                                                                                    | evidence                                | R162        | **confirmed R163 acceptance walk** — the human rebuilt the blocked dashboard on their real 90 581-row call log; the 2026-08-07 blocking question really was compare-to-group                                                                                                                     |
| "Average within team" is ambiguous: pooled rows (71.4%) vs average of member rates (70.8%)                                                                                                                                                                                                           | UX trap                                 | R162        | **settled at the R162 D gate** — it is an **ordering**, not a parameter. No `basis` field; a **grain line** on each card names what one row means at that position and rewrites itself when the card moves past an aggregate                                                                     |
| "Vs prior period" lies silently on gaps (Jan, Feb, **Apr** → Feb reads as April's previous)                                                                                                                                                                                                          | correctness trap                        | —           | **reproduced AND fixable — verified on the pinned DuckDB 1.1.3 before R164 opened.** Positional `LAG` makes April read **20** (February's value); `RANGE BETWEEN INTERVAL 1 MONTH PRECEDING AND INTERVAL 1 MONTH PRECEDING` returns **NULL**. R164's D gate adopts the interval frame, not `LAG` |
| Order × within-group interact — a group column computed before vs after a filter averages over different groups                                                                                                                                                                                      | UX trap                                 | —           | open                                                                                                                                                                                                                                                                                             |
| Join after aggregate requires the key to survive the group-by; impossible joins must be grey, not error                                                                                                                                                                                              | UX                                      | —           | open                                                                                                                                                                                                                                                                                             |
| **Self-join is a BOUNDARY, not a gap** — the same dataset twice in one query is rejected ([query_engine.py:212](../../../workspace/apps/backend/app/query_engine.py#L212)) and stays rejected, **including in the Builder** (offer-nothing, not error-at-run). "Query only does BIZ, not everything" | boundary (human, 2026-08-07)            | R162        | **settled** — state it in `_noun-model.md`; the need it leaves unserved is an input to item 4 (Workflow)                                                                                                                                                                                         |
| Brainstorm's D-A row says pooled 71.4% is "not expressible". **Superseded** — once order carries meaning, placing the within-group column _before_ the collapsing aggregate yields pooled, _after_ yields 70.8%                                                                                      | superseded finding                      | R162        | **confirmed + settled** at the R162 D gate — the affordance built is the ordering, not a parameter                                                                                                                                                                                               |
| **Derivable but undiscoverable** — top-N = rank + filter; anti-join = left join + `is_null` filter. Both work; both need a SQL trick to assemble. For a _player_, that means they don't exist                                                                                                        | UX / persona                            | —           | open — decide per item whether to name it as a first-class operation                                                                                                                                                                                                                             |
| Join types shipped = `inner`/`left`/`right`/`full` ([common.py:330](../../../workspace/apps/backend/app/models/common.py#L330)). No anti-join or cross join as a **named** type, though anti-join is derivable                                                                                       | concept↔code gap                        | —           | open                                                                                                                                                                                                                                                                                             |
| `build_stepped_select` is cited by `_noun-model.md` but does not exist                                                                                                                                                                                                                               | doc↔code drift                          | R161        | **fixed** — R162 D gate                                                                                                                                                                                                                                                                          |
| D1 step-drop, D2 shared-leaf, D3 workflow-as-noun, D4 error-at-wrong-time                                                                                                                                                                                                                            | inherited debt                          | R161        | D1/D2 dissolved by item 3; D3 → item 4; D4 deferred                                                                                                                                                                                                                                              |

| **Composition is shipped TWICE** — a `qr_` driving base **and** R91's `qr_` on the right of a hop ([common.py:309](../../../workspace/apps/backend/app/models/common.py#L309)). Both design docs listed the latter as _out of scope_ | concept↔code gap | R162 D gate | **raised to noun-model D5** — item 3 must retire both, not just the base |
| `_MAX_STEPS = 8` ([query_engine.py:461](../../../workspace/apps/backend/app/query_engine.py#L461)). The **pooled** T3 path costs **exactly 8** steps; per-member costs 6 | ceiling | R162 D gate | **arithmetic confirmed by execution** (R163 I gate: the pooled chain runs at exactly 8 on real seeded data). **Reached, never exceeded → not raised.** Still the trigger if the acceptance walk needs a 9th step |
| `StepsEditor` (R120–R144, 538 lines) had **no design-doc home at all** | doc↔code drift | R162 D gate | **backfilled** into `query-construction.md § Shape` |
| R162 flow = **DFCFBI (triggers 1, 3, 5)** → F1 precedes Contract, and the standing split makes it [D+F1] then [C+B+F2+I] | process | R162 D gate | **settled (human, 2026-08-10)** — split; the program renumbers by one (item 2 → R164) rather than using an `R162a/b` form |

| **Join dropdowns drop the dataset qualifier** — `optionLabel` renders `account_id ↔ id`, but the design declares `account_id ↔ Accounts.id` ([JoinEditor.tsx:99](../../../workspace/apps/builder/src/features/data-management/queries/JoinEditor.tsx#L99)). Worst at the **add-a-join** picker: the left-source select only renders at 2+ sources, so in the common case **neither side is named** and "join to what?" is invisible | **fidelity drift** (design declared it, build dropped it) | R162 hand-use | **settled (human, 2026-08-10) — qualify BOTH sides**, `Deals.account_id ↔ Accounts.id`; spec'd in `query-construction.md`, tracked as **[F-join-label-qualify]**, built with the **R157 UX cluster** per [[r-ui-bug-fixing-round]] |
| **Duplicate replaces composition** — semantics, EN/VN labels, default name, entry points #1/#3 (not #2), and the deletion of `QueryCreatePage` + `?base=` | decision (human, 2026-08-10) | R162 discussion | **settled** — folded into item 3 (§ Item 3 scope) |

| **Canvas offers `Promote` on an already-governed edge** — `promotable` tests only dataset-vs-`qr_` ([joinGraph.ts:144](../../../workspace/apps/builder/src/features/data-management/queries/joinGraph.ts#L144)); the `free` flag that should gate it drives styling only. Clicking can only 409 | D4-class (offer-nothing violated) | R162 hand-use | open — **[F-promote-gate]**, batched with the R157 UX cluster; `'changed'`-divergence behaviour is an open call |
| **D4 is a recurring CLASS, not one bug** — the D gate called it "largely mooted by D5's removal"; a third instance unrelated to composition then surfaced. Standing rule: **unofferable at the gesture, never an error at run** | correction to a D-gate judgment | R162 hand-use | **corrected in `_noun-model.md` D4**; the rule outlives item 3 |
| **The grain line WORKS** — moving a Group value card above/below a collapsing aggregate makes the pooled-vs-average reading legible | UX verdict (the question R162 carried unanswered) | R163 acceptance walk | **settled — yes** (human, 2026-08-11, _"seem all good"_). The round's primary risk did not materialise |
| **Naming is the real legibility gap, not expressibility** — first hand-use produced `rate` holding a call count (1315) and `delta` holding an average (1344.33); the product agreed to a dashboard-ready table. The dtype tell (`rate` renders `int`) is already on screen and inert | UX trap (new axis) | R163 hand-use | **parked by the human** — _"post back, enhance later"_. Evidence banked, **no affordance proposed** (design-by-building brake). Needs ranking |
| **Filter placement silently collapses the denominator** — a `filter` moved above a Group value card makes every rate read **100.0%**, and the grain line does NOT change (it tracks position vs `aggregate` only) | correctness trap | R163 (demonstrated on real data) | **pulled into R164** (human, 2026-08-11) — the grain line gains a clause naming the row-narrowing steps (`filter`, `top_n`) that precede the card. Lands on **both** card families, so it repairs the shipped R163 card too |
| The two new F2 card states (orphaned-by-a-move, name collision) shipped but **were never walked by a human** | unconfirmed build | R163 | open — carried to R164's walk |

| **The shared `Step` union widened Workflow** — one Python union + one `_apply_step` serve both nouns, but `workflow.yaml` duplicates its `oneOf` | contract/impl split | R163 C gate | **settled — widen both.** `workflow.yaml` now carries a MIRROR note; the widening is tested end-to-end (workflow create → run → materialized within-group column) |
| **`COALESCE(agg(x), 0)` cannot simply take `OVER (…)`** — `OVER` binds to the aggregate call, so the collapsing NULL policy had to be re-composed as `COALESCE(agg(x) OVER (…), 0)` | SQL correctness | R163 B gate | **caught by EXTRACTING the measure expression into one shared helper instead of copying it.** A copied expression map would have shipped this silently at the first `sum` |
| **Preview reports every bad step as `409 query_stale`** — uniform across `derive`/`date_bucket`/`group_column`; only the SAVE path returns the precise 422 | error-surface finding | R163 I gate | **this is why the card-level orphaned/collision states earn their place** — without them a reorder into an invalid position says only "stale", never _which_ column. Recorded in `query-construction.md` |
| Brainstorm T3 ground truth lists **−4.1pt** for A2 (average-of-agents); full precision is **−4.2** (the table subtracted already-rounded rates) | rounding artifact | R163 B gate | **engine is right, hand table had the artifact** — noted in the test, brainstorm left untouched as a point-in-time record |

## Lifecycle

Active until Query is the single shaping surface — composition retired, the within-group
family shipped, and Workflow's boundary settled against it. At close, the rolling log's
recurring entries promote to their own rounds or a decision artifact, and this file folds
into a closing note.

---

## Closing note (2026-08-14)

**The thesis held end to end.** _A Query gains operations until it cannot express the shaping, and
the wall that pulls a Workflow noun is consolidation._ Items 1 and 2 shipped the operations
(within-group columns, then the ordered-window family); item 3 retired `query⋈query` once those
operations made it unnecessary; item 4 found the wall exactly where the thesis predicted —
`UNION ALL BY NAME` is the one shaping a Query cannot express, and **materializing** is the one
thing it cannot be. The Workflow noun survives on those two grounds and no others.

**What the program actually cost, and what unblocked it.** It opened against a four-week stall
(R159→R161: three consecutive code-free rounds on the same untouched seam), and the firewall it was
built with — _no round ships only documents_ — held for all seven. The stall's root cause turned
out to be a missing primitive, not a missing decision.

**Three findings the program produced that outlive it:**

1. **A plan can be wrong about its own deletions.** Item 3 was written as "delete the machinery";
   R167's code walk found three of the four named things must **stay**, and executing the plan
   faithfully would have broken Workflow outright. The round's value was in refusing its plan.
2. **Green gates do not predict what a human notices.** Five of the six walks returned defects
   none of the questions asked about — six of them in R165 alone, including a pre-existing pager
   bug. The one round that skipped its walk (R168) is the one whose surface-level questions stay
   unanswered.
3. **Naming, not expressibility, is the live legibility gap** (R163) — a column called `rate`
   holding a count reached a dashboard-ready table unchallenged. Parked by the human, still unranked.

**Carried out, unranked:** the row-order and upstream-staleness observations from R168, the latent
pager risk (R167), the nine-doc `design-sync` backlog ([`Round_169`](../cycles/Round_169.md),
scoped not ranked), the naming/legibility cluster (R163), and the batched UI cluster
(`[F-join-label-qualify]`, `[F-promote-gate]`, R157's cluster, R166's header ordering). **The
successor is not pre-decided** — the human ranks the standing backlog now that this closes.
