# Round 168: what a Workflow is — and the bug that has been waiting for the answer

**Status**: Complete — human sign-off 2026-08-14 (**walk skipped at the human's call — 0 of 5, unrun**)
**Flow**: DCFBI (no-UI round — `flow-selector` at the Design exit, **0 of 5** conditions fired)
**Date started**: 2026-08-14
**Date completed**: 2026-08-14

## ⟢ At a glance

**Shipped** — **the Workflow noun is settled, and the bug that was waiting for it is fixed.**
Consolidating a query means consolidating **what that query returns** — its own steps included —
so a Workflow over a shaped query no longer freezes un-shaped rows to `output.parquet`
(noun-model **D1**, closed). A workflow source is **frozen, permanently**, which is the noun's
distinction from a Query and which retired the `composition_cycle` **error code** across six
layers. And the noun is exactly two things a Query cannot express: **consolidate** (`UNION ALL BY
NAME`) and **materialize** (**D3**, closed). Its `steps` are borrowed, not a third thing.

**Studied** — **the fork the round was built around did not exist.** § Plan warned that Q1 "is not
rhetorical, and the answer is not obvious", and named a defensible counter-reading: one shaping
layer, not two stacked. Reading the code dissolved it — **that reading was not self-consistent as
shipped.** A `wf_` source already resolved POST-steps while a `qr_` source resolved PRE-steps, so
one union could stack a shaped source on a raw one; and the builder already offered a query's
post-step `resolvedColumns` to build workflow steps the run then refused with `step_invalid`. The
noun question and the bug question were the same question. **Two further distinctions came out of
doing the work**: the repair belongs in `resolve_source`'s `qr_` branch, not the consolidation path
— repairing the resolver's contract rather than patching one caller into agreement with it; and
**an error code is not a guard**. Retiring `composition_cycle` from the wire is right because no
request can provoke it; deleting the `visited` check would not make a cycle impossible, it would
make one **fatal**, because the DB does not enforce what the type system does.

**Watch**

- **The acceptance walk was SKIPPED (human's call) — coverage 0 of 5, unrun.** This round is signed
  off on green gates plus a quick human check, **not** on a walk. The three rounds before it each
  ran one and each returned something no gate saw (R165: six defects; R166: header order; R167:
  canvas layout). A legitimate call on an engine-side round with no new surface — with a known cost.
- **The walk-question promotion did NOT fire, and that is absence of evidence, not evidence of
  absence.** The bar stands at three instances. The D gate settled the destination on reasoning
  rather than a count — **`.agents/memory/` is the ceiling, not `skills/gate-walker/`**, because a
  skill can check that a walk was recorded but not that its **return** was read. The next round
  that runs a walk is where a fourth instance can arrive.
- **A row-ORDER difference is open and unjudged.** The workflow reads its parquet in file order;
  the query rows path applies R165 W-7's total order. Same rows, same values, different sequence.
  Staged as T1's candidate answer and never walked.
- **Upstream staleness is named, unfixed, unwalked.** Editing a source query does not invalidate a
  workflow's frozen output — only a `PUT` on the workflow does. It predates the round; the round
  found it and left it.
- **The nine-doc `design-sync` backlog is scoped, not ranked** ([`Round_169`](Round_169.md)), and
  **`--check` has still never run** on those docs, so doc↔code drift stays unmeasured.

## Goal

**Inherits from ← [Round_167](Round_167.md)** — composition is retired in the engine, **D5 is
closed**, and `resolve_source`'s `qr_` branch is now narrowed to **one call site**: Workflow's.
That is the inheritance that matters. Workflow's boundary is finally visible in the code instead
of tangled with a capability the product no longer has, so the noun can be defined against what it
actually does rather than against what it shared.

**Seeded from ← [Query as the single shaping surface](../programs/query-shaping-surface.plan.md)**
— **item 4**, the last of the program.

**This round is not open-ended noun design.** Three concrete questions arrive already sharpened by
R167, and each has a shipped consequence waiting on it. Answering them **is** defining the noun;
starting from a blank "what should a Workflow be" would re-derive what four rounds already learned.

_Track: 1 (product). Pulled by: program item 4 — and by R167's deferral of D1, which the human
routed here so the repair lands with the decision that governs it._

## Plan

**Expected outcome**: the Workflow noun is defined in the design corpus, **D1 is repaired** (or
consciously re-deferred with a reason that is not "later"), and the frozen-or-live question is
settled — which also settles whether `composition_cycle` goes live again or is finally retired.

**Falsified if**: the three questions turn out to be separable from "what a Workflow is" — i.e.
D1 can be fixed without deciding what consolidation *means*, in which case the deferral was wrong
and the repair should simply have shipped at R167.

### The three questions R167 hands over

| #     | Question                                                                                                                          | The shipped thing waiting on it                                                                                                                                                           |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1** | **Does consolidating a query mean consolidating what that query RETURNS?** If yes, D1 is a bug; if no, it is the definition.      | `build_consolidated_relation` never calls `run_steps`, so a Workflow over a _shaped_ query reads **un-shaped** rows — and **freezes them to `output.parquet`**. Seeded and demonstrable. |
| **2** | **Is a workflow source resolved FROZEN or LIVE?**                                                                                 | Today `wf_` is a frozen leaf, which is the _only_ reason `composition_cycle` is unreachable. Live resolution reactivates it; frozen retires it for good.                                 |
| **3** | **What is the noun for, that a Query with `steps` is not?**                                                                       | The whole program tested "query gains steps" against the wall. Consolidation (`UNION ALL BY NAME`) is the one thing a Query cannot express — is that the noun, or is there more?          |

**Question 1 is not rhetorical, and the answer is not obvious.** `GET /queries/{id}/rows` runs a
query's steps, so "the same query answers differently depending on who asks" reads as an
inconsistency. But a Workflow **materializes**, and a defensible reading is that it consolidates
the query's **source rows** and then applies **its own** steps — one shaping layer, not two
stacked. The D gate must pick a reading and say why; the FE says nothing about which is intended.

### D — the design gate

> **Closed 2026-08-14** — every box below is ticked; the reasoning is § Do → _D gate_.

- [x] **Answer questions 1–3** and write the noun into
      [`workflows.md`](../../design/data-management/workflows/workflows.md)
      ([[d-gate-artifact-in-design-corpus]]) — which already carries R167's § Known defect and the
      resolver-ownership section as the current-state starting point.
- [x] **Decide D1's repair or its principled deferral.** If it is a bug, the fix is small
      (`run_steps` in the consolidation path); the risk is that a run **materializes**, so a wrong
      answer persists. If it is the definition, the FE must **say so** — a workflow whose output
      does not match its source query is otherwise indistinguishable from a bug (R167's walk
      confirmed a human reads it as one).
      → **A bug. Repaired at B**, and the FE needs no new copy: the builder's promise was already
      the correct one.
- [x] **Settle `composition_cycle`** — live sources reactivate it, frozen retires it. Either way
      it stops being dormant, which is the state R167 deliberately left it in
      ([api-error.yaml](../../../workspace/packages/contracts/_shared/api-error.yaml)).
      → **Retired.** Frozen is ruled permanent, so the reactivating condition can never fire.
      Deletion is cross-cutting and gets **its own C slice**.
- [x] **Re-confirm the seeded workflow still demonstrates the trap** before designing against it
      (the seed is disposable; `--reset` regenerates it).
      → **It does** — a 4-row shaped source query materializing 120 un-shaped rows, read from the
      dev DB rather than the running app.
- [x] **Run [`flow-selector`](../../skills/flow-selector/SKILL.md)** at the Design exit.
      → **DCFBI**, 0 of 5 (no-UI branch).
- [x] **Write the acceptance-walk questions at D**, with how each outcome is read — **and apply
      R167's new criterion**: _if a test can answer it, it is a test_ ([[walk-record-always-spec-on-ask]]).
      Every question must name a gesture on a surface a human can perceive.
      → **T1–T5**, none of which asks "do the rows match?" — that one is a test.
- [x] **Decide the walk-question promotion** carried from R167 (§ Two open calls carried in) — at
      the same moment this round's own walk questions are written, because that is when a fourth
      instance either arrives or does not. **Not** a Track-1 deliverable; the D gate only decides
      whether it promotes, where to, and on what evidence.
      → **Destination decided** (`.agents/memory/` — a skill cannot enforce what a walk *returns*);
      **promotion itself fires at this round's I gate**, because writing questions is not what
      produces an instance — running the walk is.

### Explicitly NOT in this round

- **The `design-sync` backlog** — **no longer unscoped**: it is [`Round_169`](Round_169.md) as of
  the human's call 2026-08-14, and **nine** docs / **325** stamped lines on re-measurement, not the
  8 / ~286 R167 recorded. It stays **out of this round** for the reason that put it there: this is
  the program's last round, so there is no successor to absorb a doc-only tail. R169 is scoped, not
  ranked.
- **The latent pager risk** — recorded at R167, measured as non-reproducing, fix deferred by the
  human.
- **The batched UI cluster** — R165's W-1/W-2, R157's cluster, R166's header-ordering
  generalisation ([[batch-ui-bugs-into-one-round]]). R167's W-1 (canvas layout) is **not** in it:
  the human ignored it rather than queuing it.
- **The naming/legibility cluster** parked at R163.

## Risks / unknowns

| Risk                                                                                                                                | Why it matters                                                                                                                    | Handling                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Defining a noun is open-ended work** and this program has shipped four rounds of narrow, checkable slices.                        | An unbounded design round is where scope goes to die — and item 4 is the last one, so there is no successor to absorb the overflow. | The three questions bound it. If the D gate cannot answer them without a fifth, that is the signal to split, not to widen.                     |
| **D1's repair changes what is FROZEN to disk.**                                                                                     | A materialized wrong answer is not fixed by later fixing the code; nothing re-reads it.                                            | The `workflows` table now holds the seeded demo (R167 closed the empty-table window deliberately). Re-check before relying on it being cheap. |
| **The FE may need to say what a Workflow means**, not just run it.                                                                  | R167's walk showed a human reads a mismatch as a bug. If question 1 answers "by design", silence is not an option.                | Whether that is copy, a badge, or a summary line is the D gate's, and it decides the flow.                                                     |

## Do

### Opened 2026-08-14 — two open calls carried in from R167, both dispositioned by the human

R167's Act left exactly two calls with the human rather than absorbing them. Neither is folded into
this round's build; both are recorded here so the round opens with them decided rather than
carrying them as ambient debt.

#### 1. The walk-question promotion — **PROPOSED, not promoted** (human, 2026-08-14)

**The candidate**, three instances across three domains:

| Round | The question asked about | What the human actually returned |
| ----- | ------------------------ | -------------------------------- |
| R165  | five questions on the ordered-window family | **six defects**, none about what any question asked (incl. a pre-existing pager bug) |
| R166  | T1 — do the **rows** match? | **button order** in the detail header |
| R167  | T3 — any trace of a `qr_` source on the canvas? | **canvas layout** not persisting (W-1) |

The shape: _a walk question works by putting a human in front of a surface, and what they notice is
not bounded by what you asked._ Three instances clears the Evolution Rule's third-instance bar,
which is why R167 raised it as a proposal rather than a note.

**The human's call: decide it at this round's D gate, not now.** The reasoning is that the D gate
is where this round writes its own walk questions — so it is the moment a **fourth instance either
arrives or does not**, and the decision gets evidence instead of a count. Promoting at the open
would spend the bar's credibility on a round that has not yet run its own walk.

**Which also keeps this round Track 1.** A promotion is a Track-2 artifact
([[gates-dont-survive-self-modification]] territory); item 4 is product work. Deciding it at D, as
a by-product of writing walk questions, is the narrowest way to touch it without blurring tracks.

**Where it would go, when it goes** — noted so the D gate is not re-deriving this:

- The doctrine has **no shared repo home today**. `skills/gate-walker/` verifies that a gate's exit
  criterion is documented; it says nothing about how a walk's **return** is read. `context/` has no
  walk artifact either. What exists is a personal-memory entry
  ([[walk-record-always-spec-on-ask]]) plus the round files themselves.
- So a promotion is genuinely **additive**, and the Evolution Rule's default is don't. The
  candidate destinations are `.agents/memory/` (shared, version-controlled, cheap) or
  `skills/gate-walker/SKILL.md` (operational, enforced). **They are not the same claim**: the first
  says agents should know this, the second says the skill should check it.
- **The open question the D gate must answer, and it is the real one**: this pattern is about
  what a walk **returns**, and it is not clear a skill can enforce anything about it. It may be a
  fact to know, not a rule to run — in which case `memory/` is the ceiling, not a waypoint.

#### 2. The `design-sync` backlog — **scoped out, into [`Round_169`](Round_169.md)** (human, 2026-08-14)

**Call**: it is its own work and gets its own round. Explicitly **not** folded in here — R168 is the
last round of the program, so a doc-only tail has no successor to absorb it, which is the same
reasoning R167 used to leave it out in the first place.

**Scoped now rather than parked**, so it is ranked when the program closes instead of rediscovered.
[`Round_169`](Round_169.md) holds the inventory, the two-axis measurement and the timebox; it is
`Planning`, **scoped but not ranked** — the human ranks the successor set at the program's close.

**Two corrections it makes to R167's figure**, both from re-measurement on 2026-08-14:

- **Nine docs, not eight.** The domain holds 14; R167 synced 4; `_TEMPLATE.md` is not a surface
  doc. `workspaces/workspaces.md` (2 stamped lines) was the one missing from the count.
- **325 stamped lines, not ~286.** R167's per-doc figure is reproducible (`upload.md` = 166 lines
  via `rg -c '\bR[0-9]{2,3}\b'`); its total is not. Appended to R167 rather than edited in — that
  round is `Complete` and append-only.
- **And one thing nobody has measured**: `--check` has never been run on those nine docs, so
  **doc↔code drift is unknown**. "~286 round-stamps" measures **ledger accretion**, a different
  axis. R169 runs `--check` first, because that is what decides the round's size.

### D gate — 2026-08-14: the three questions, answered from the code

Written into
[`workflows.md` § The noun, settled](../../design/data-management/workflows/workflows.md)
([[d-gate-artifact-in-design-corpus]]). What follows is the reasoning; the doc carries the
ruling.

#### The seed still demonstrates the trap — re-confirmed before designing against it

Read straight out of the dev DB rather than by booting the stack, so the evidence is the
committed artifact and not a screenshot:

| | Rows | Columns |
| --- | ---: | --- |
| `qr_8c0d6e90` "Revenue by order status" — `ds_71b9d46a` + one `aggregate` step (`dimensions: [status]`, `measures: [sum(amount)]`) | **4** | `status` + the summed measure |
| `wf_11af3fad` "Consolidated revenue by status" — sources `["qr_8c0d6e90"]`, no steps of its own | **120** | the **9 raw order columns** |

`output_columns_json` on the workflow row lists `order_id, customer_id, product_id, amount,
quantity, status, is_priority, ordered_at, Source.Name`, and the materialized
`data/workflows/ws_19b9c71b/wf_11af3fad/output.parquet` holds 120 rows. The trap is live.

#### Q1 — does consolidating a query mean consolidating what it RETURNS? **Yes. D1 is a bug.**

The round opened saying this "is not rhetorical, and the answer is not obvious", and that the
defensible counter-reading is _one shaping layer, not two stacked_. Reading the code closed it:
**the counter-reading is not self-consistent as shipped.** Three findings, none of them a matter
of taste.

1. **A `wf_` source already resolves to what it RETURNS.**
   [`_resolve_workflow_leaf`](../../../workspace/apps/backend/app/query_engine.py) reads
   `output.parquet`, whose schema is `output_columns_json` — captured at
   [`routers/workflows.py`](../../../workspace/apps/backend/app/routers/workflows.py) from
   **`final_cols`**, the **post-step** columns. A `qr_` source resolves **pre-step**. So one
   `UNION ALL BY NAME` can stack a shaped workflow on top of a raw query. **Two source kinds,
   two contradictory readings, in the same union** — the "one shaping layer" rule is already
   broken by the code that would have to defend it.
2. **The builder already promises post-step columns.** `useSourceColumns`
   ([hooks.ts](../../../workspace/apps/builder/src/features/data-management/workflows/hooks.ts))
   hands the `StepsEditor` a `qr_` source's `resolvedColumns`, and `_resolved_columns` is
   explicit that "a query with `steps` exposes its POST-step output columns here" (R120).
   `build_consolidated_relation` then validates the workflow's steps against `plan["columns"]` —
   **pre-step**. A user who builds a workflow step on the aggregate measure the builder listed
   gets `step_invalid` at run, on a column the UI offered. That is not an ambiguity to be
   resolved by choosing a reading; it is a contradiction that has to be repaired either way.
3. **The program's thesis forbids it.** "Query is the single shaping surface." A path that reads
   a query's un-shaped rows routes **around** the shaping surface — and this is the program's
   last round, so it would close having built the exception it set out to remove.

**Which means § Plan's _Falsified if_ did not fire, but its premise did not survive either.** The
round predicted a genuine fork the D gate would have to *pick*. There was no fork: the noun
question and the bug question are the same question, and the code answered it. The deferral from
R167 still paid — the answer is written into the noun, not patched into a path.

#### Q2 — frozen or live? **Frozen. And `composition_cycle` is retired, not dormant.**

Frozen is not a default kept for want of a reason; it **is** the noun's distinction — Query is a
live re-run that stores a definition, Workflow freezes a typed artifact
([workflows.md § Concept](../../design/data-management/workflows/workflows.md), noun-model
**D3**). Live resolution would collapse the two into one live noun and delete the reason this one
exists, and it would pull an upstream-re-run/DAG concept the product does not have — Evolution
Rule default = don't add.

**So the guard's reactivating condition can never fire.** R167 kept `composition_cycle` dormant
precisely against this decision. With a Query's driving source and every join operand `ds_`
(R167) and a `wf_` source a frozen leaf, `resolve_source`'s `visited` set **cannot see a repeat
by construction**. Verified at the type, not the branch: `sourceId` and `rightSourceId` are both
`DsId` in [common.py](../../../workspace/apps/backend/app/models/common.py). Q1's repair does not
change that: folding a source query's steps in adds no recursion — a query still resolves over
dataset leaves.

**And the DB path is closed too**, which is the half a type cannot prove. R167's stance is
reject-at-write with **no migration**, resting on finding E — **zero composed rows in either
form**, re-confirmed against the DB at that round's build. So no legacy `qr_`-sourced query can
resolve recursively either. If that ever stops being true the retirement is wrong, which is why
it is written down here rather than assumed.

**Its retirement is cross-cutting and is therefore its own slice** ([[split-fragile-subphase]],
[[round-bundling-revert-seams]]). It spans six layers — `values.yaml` → generated constants in
**both** languages → `_shared/api-error.yaml` + two contract files → backend models/routers/engine
→ FE `types.ts`, `WorkflowDetailPage`, two api clients → `tests/test_composition.py`, whose
DB-crafted tests are explicitly documented as "not vestigial" because the guard was dormant. A
bad sweep there must not be able to take the D1 repair with it.

#### Q3 — what is the noun for, that a Query with `steps` is not? **Consolidate + materialize.**

Two things, and only two, both genuinely inexpressible as a Query: `UNION ALL BY NAME` over ≥1
saved query (there is no `query ∪ query` — a Query has one driving source plus join hops), and a
**frozen** typed parquet with a captured schema that reads back as a stable source (a Query is
live-only).

Its `steps` are **not** a third thing — same step union, borrowed. Q1 narrows their
justification to exactly one job: **post-union shaping** (consolidate twelve monthly queries,
*then* total them). Anything expressible on a single source belongs upstream in the Query, and
after the repair it *arrives* from upstream. That is the two-altitude rule now written into
§ Concept.

#### The flow — `flow-selector` at the Design exit

Run against the D-gate artifact. This is a **feature round that changes the engine and the
contract but adds no new UI surface**, so it takes the skill's explicit no-UI branch — the five
conditions are UX-framed and read vacuously no. Recorded anyway; the audit trail is the point.

| # | Condition | Verdict | Why |
| - | --------- | ------- | --- |
| 1 | >3 independent interactive states/branches | **no** | The `stateDiagram` (Draft ⇄ Materialized) is untouched — the repair changes what a run *produces*, not the states it moves through. |
| 2 | New interaction pattern not previously used | **no** | No new surface, no new gesture. |
| 3 | High user-error risk if the flow is unclear | **no** | Run already materializes irreversibly; the repair *reduces* error risk by making the output match what the builder promised. |
| 4 | Contract shape depends on unresolved UI behaviour | **no** | The only contract move is *deleting* `composition_cycle`; no UI question governs it. |
| 5 | UX confidence below threshold | **no** | The UX is unchanged, and Q1 removes the mismatch R167's walk showed a human reads as a bug. |

**0 of 5 → `Flow: DCFBI`** (no-UI round → DCFBI by construction). The round's own § Risks flagged
"the FE may need to say what a Workflow means" — **it does not**, and that is a consequence of
Q1 rather than an oversight: the builder's promise was already right, so the repair makes the FE
truthful without changing a pixel.

#### The acceptance-walk questions, written at D

R167's criterion applied: **if a test can answer it, it is a test**
([[walk-record-always-spec-on-ask]]). "Do the rows match?" is a test — it is `test_workflows_run.py`,
not a walk question — so none of these ask it.

| # | The gesture, and the surface | How each outcome is read |
| - | ---------------------------- | ------------------------ |
| **T1** | Open the query `Revenue by order status`, then the workflow `Consolidated revenue by status`, and **read the two pages one after the other**. | **Pass** = they read as the same table seen twice. **Fail** = anything makes you check which page you are on — headers, row counts, ordering, a stale badge. |
| **T2** | In the workflow builder, **add a step over the source query's aggregate measure** (the column the builder lists), Save, Run. | **Pass** = the step the builder offered is the step the run accepts. **Fail** = `step_invalid`, or the column is not offered. This is finding 2 from Q1, walked. |
| **T3** | **Before** re-running, open the workflow that was materialized under the OLD engine. | **Pass** = it is evident the output predates the fix. **Fail** = a stale 120-row output looks current — nothing invalidates it, because the *definition* did not change, the *engine* did. |
| **T4** | Edit the **source query's** steps, then return to the workflow **without touching it**. | **Pass** = the workflow makes its staleness legible. **Fail** = it presents a frozen output as current. `PUT` on the workflow invalidates; a change upstream does not. A genuine gap, deliberately walked rather than pre-fixed. |
| **T5** | With the round's changes in, **say what a Workflow is for** while looking at the catalog. | **Pass** = "consolidate + freeze" is what the surface says. **Fail** = it still reads as "a Query, but saved differently" — which would mean Q3 is written in a doc and nowhere a user can see. |

T3 and T4 are the two the D gate is least sure of, and both are **states the repair creates or
exposes rather than fixes**. They are on the walk for that reason, not despite it.

#### The walk-question promotion — destination decided, promotion deferred to this round's I gate

The human routed this to the D gate "because that is when a fourth instance either arrives or
does not". **One correction to that timing, and it changes the answer.** Writing walk questions
does not produce an instance — the pattern is about what a walk **returns**, so the fourth
instance can only arrive when the walk is **run**. Deciding it here would still be deciding it on
a count of three.

So the D gate decides the half that *is* decidable now, and it is the half the round called
"the real one":

- **Destination: `.agents/memory/`, not `skills/gate-walker/`.** `gate-walker` verifies that a
  gate's **exit criterion is documented as met**. What a human notices at a surface is not a
  criterion — it cannot be enumerated in advance, which is the entire content of the pattern. A
  skill can check that a walk was **recorded**; it cannot check that its **return** was read
  properly. **This is a fact to know, not a rule to run — so `memory/` is the ceiling, not a
  waypoint.**
- **Promotion fires at this round's I gate**, on whether T1–T5 return a fourth instance. If they
  do, it is written as a shared `.agents/memory/` entry. If the walk returns only what it asked,
  the third instance stands and the pattern stays personal — a bar met three times and then not
  met is evidence too.

**Track stays 1.** Nothing above is built; a destination is named and a trigger is set.

### The build — 2026-08-14, and the human re-ordered it

**The human's call at the D gate: fix the bug FIRST, then sync the docs to it, then run the
chain uninterrupted.** That inverts DCFBI's doc-then-code habit, and it is the better order here
for a reason worth recording: the D-gate ruling had been written into `workflows.md` ahead of the
code, carrying an explicit *current-state marker* saying so. A design doc describing behaviour the
code does not have is the exact failure [[design-docs-are-source-code]] names, and a marker only
narrates the risk rather than removing it. Fixing first makes the sync a **description** instead
of a promise. The Q1 ruling was confirmed by that instruction rather than answered separately;
the `composition_cycle` and stale-output calls both followed from it, with the human adding
**"only seed data, just remove them all"**.

**C ran after B1, not before it.** The D1 repair touches no contract, and the only C work — the
`composition_cycle` retirement — is independent of it. Recorded as a deliberate deviation rather
than an oversight.

#### B1 — the repair, and where it belongs

The fix went into `resolve_source`'s `qr_` branch, **not** `build_consolidated_relation`. The
round's plan named the latter, and the code argued for the former: that branch is Workflow's
reader and nothing else's (R167), so repairing it there makes the resolver's own contract — *what
the query returns* — true for every consumer, rather than patching one caller into agreement with
it. Split out as `_resolve_query_source`, mirroring `_resolve_workflow_leaf`; the branch had grown
past what a polymorphic dispatcher should hold.

`build_steps_relation` is the SQL→SQL fold `run_steps` and `materialize_steps` each carried
inline. A third repetition is what made extracting it right, not the extraction being tidy.

A source query whose steps no longer validate is `query_stale` — drift, mapped by the consumer to
409, not a 422 from a path with no request to blame.

**Three tests, each asserting the RULING rather than the call site**, and all three verified
failing against the pre-fix engine before being kept:

| Test | What it pins |
| ---- | ------------ |
| `test_workflow_over_a_shaped_query_materializes_the_SHAPED_rows` | The workflow's rows **equal** the source query's own `/rows` — same total, same rows. |
| `test_a_workflow_step_can_use_a_column_the_source_query_derived` | Finding 2, walked as a test: a workflow step over a column the source query DERIVED. The builder already offered it; the run used to refuse it with `step_invalid`. |
| `test_consolidating_two_shaped_queries_unions_their_ANSWERS` | Self-consolidation doubles the **shaped** count, and the union carries the shaped column space. |

#### C — the retirement, and a distinction the sweep produced

The sweep found that **the error code and the guard are not the same thing**, which the round file
had been treating as one decision. The code is retired across all six layers. The `visited` check
is **kept**.

Deleting the guard would not make a cycle impossible — it would make one **fatal**. The API cannot
express a self-referencing query since R167, but the DB does not enforce that, and a hand-crafted
row would recurse until the stack gives out. One set membership buys a refusal instead of a
`RecursionError`. The guard now returns an internal `source_cycle` reason with no code of its own,
which each consumer maps through its generic "this source can't resolve" fallback.

**One correction to what the D gate wrote**: that fallback is *not* uniformly `query_stale`. It is
`relationship_stale` on the queries rows path and `query_stale` on the workflow run path — the
tests caught the over-claim. What the DB-crafted tests in `test_composition.py` now assert is
**409 rather than 500**, which is the property actually worth holding.

#### B2 — four docs, and only four

`workflows.md` (marker removed; the ruling shipped), `queries.md` (its "dormant" claim was false
in both halves), `_noun-model.md` (**D1 and D3 both CLOSED**), and `query-construction.md` — which
carried a *"this base query loops back on itself"* builder warning that was **already doubly dead**
before this round: R166 deleted create mode and R167 made a `qr_` base unwritable. The nine-doc
`design-sync` backlog stays out, in [`Round_169`](Round_169.md).

#### The seed — reset, per the human's call

`pnpm dev:seed --light --reset`. Verified through the **running app**, not the test client:

| | Before R168 | After |
| --- | --- | --- |
| `Revenue by order status` (the source query) | 4 rows × 2 cols | 4 rows × 2 cols |
| `Consolidated revenue by status` (the workflow) | **120 rows × 9 raw cols** | **4 rows × 2 cols, values identical** |

**Gates**: 437 backend · 363 builder · 40 contract · `type-check` clean · `md:lint` 0/313 ·
`design:lint` 0/14 · `design:tokens` 0/11 · `check:links` at parity (24, all pre-existing in
rounds 76–152).

**One thing found while verifying, not fixed** — the workflow's rows come back in a **different
order** than the source query's (`completed, refunded, cancelled, pending` vs alphabetical). The
query rows path applies R165 W-7's deterministic total order; the workflow rows path reads the
materialized parquet in file order. It is left for **T1** to judge rather than pre-fixed, because
T1 asks whether anything makes you check which page you are on — and this is a candidate answer
that should come from a human reading both pages, not from the agent that found it.

### Next: the I gate — the walk is staged

The stack is running (`:8000` / `:3000`) and freshly seeded. § Check carries T1–T5.

## Check

### Acceptance walk — staged 2026-08-14, **coverage: 0 of 5**

Written at the D gate before the build, and unchanged by it. R167's criterion holds throughout:
**if a test can answer it, it is a test** ([[walk-record-always-spec-on-ask]]) — so none of these
asks "do the rows match?", which is `test_workflows_run.py`.

The app is running and seeded. The two nouns the walk turns on:

- Query **`Revenue by order status`** — one `aggregate` step, 4 rows.
- Workflow **`Consolidated revenue by status`** — consolidates exactly that query, no steps of
  its own.

| # | Verdict | The gesture, and the surface | How each outcome is read |
| - | ------- | ---------------------------- | ------------------------ |
| **T1** | ⬜ | Open the query, then the workflow, and **read the two pages one after the other**. | **Pass** = they read as the same table seen twice. **Fail** = anything makes you check which page you are on. _Known candidate: the row ORDER differs — the workflow reads its parquet in file order, the query applies R165 W-7's total order. Deliberately not pre-fixed._ |
| **T2** | ⬜ | In the workflow builder, **add a step over a column the source query produced** (one the builder lists but the dataset does not have), Save, Run. | **Pass** = the step the builder offered is the step the run accepts. **Fail** = `step_invalid`, or the column is not offered. |
| **T3** | ⬜ | Judge whether a workflow materialized under the **old** engine would have announced itself as stale. | **Pass** = it would be evident the output predates the fix. **Fail** = a stale output looks current. _The seed was reset per the human's call, so this is a judgement about the mechanism, not a state the walk can now reach._ |
| **T4** | ⬜ | Edit the **source query's** steps, then return to the workflow **without touching it**. | **Pass** = the workflow makes its staleness legible. **Fail** = it presents a frozen output as current. `PUT` on the workflow invalidates; a change upstream does not. |
| **T5** | ⬜ | With the round's changes in, **say what a Workflow is for** while looking at the catalog. | **Pass** = "consolidate + freeze" is what the surface says. **Fail** = it still reads as "a Query, but saved differently" — Q3 written in a doc and nowhere a user can see. |

**T3 and T4 are the two the D gate was least sure of, and both are states the repair creates or
exposes rather than fixes.** They are on the walk for that reason, not despite it.

**T3 changed shape when the seed was reset.** The human's "just remove them all" was the right
call for dev data and it costs T3 its live state — a stale-output workflow no longer exists to
open. It stays on the walk as a judgement about whether the mechanism *would* announce itself,
which is weaker evidence than a surface, and is recorded as weaker rather than quietly dropped.

### The walk was SKIPPED — human's call, 2026-08-14. **coverage: 0 of 5, unrun.**

> _"I have do a quick check. Please skip the walk-through for this r168."_

**All five stay ⬜ and the count stays 0 of 5.** Unrun is not the same as passed, and this round
does not get to report 5 of 5 or quietly drop the section. What R168 is signed off on is **green
gates plus the human's own quick check** — not a walk.

**What that costs, stated rather than implied.** The last three rounds each ran this walk and each
time it returned something no gate saw: R165 found **six** defects after every gate was green
(including a pre-existing pager bug), R166 found a header ordering, R167 found the canvas layout
not persisting. The mechanism's whole track record is that green gates do not predict what a human
notices ([[dfcfbi-f1-needs-human-review]]). Skipping it is a legitimate call on a round whose
change is engine-side with no new surface — which is exactly what `flow-selector` said at 0 of 5 —
but it is a call with a known cost, and the cost is that **three specific questions go unanswered**
rather than answered negatively:

| Left open | Why it matters that nobody looked |
| --------- | --------------------------------- |
| **T1's row-order candidate** | Found by the agent while verifying, deliberately not pre-fixed so a human could judge it. Nobody judged it — so it is carried below as an observation, not a defect and not a non-issue. |
| **T4 — upstream staleness** | A change to a source query does not mark a workflow's frozen output stale; only a `PUT` on the workflow itself invalidates. This is a real gap in the noun, discovered at the D gate, and it remains unwalked. |
| **T5 — does the surface say what the noun is for?** | Q3 is settled in the design corpus. Whether a user can see it anywhere is now untested. |

**And it settles the promotion by not settling it** — see § Act.

## Act

### The round — Complete, on gates and a human check rather than a walk (2026-08-14)

Item 4 landed: the noun is defined in the corpus, **D1 is repaired**, frozen is ruled
**permanent**, and the `composition_cycle` error code is retired. § Plan's _Falsified if_ did not
fire — but its premise did not survive either. It predicted a genuine fork the D gate would have
to *pick*; there was no fork. The noun question and the bug question were the same question, and
reading the code answered it. The deferral from R167 still paid: the answer is written into the
noun rather than patched into a path.

### The walk-question promotion — **NOT promoted**; the bar stands at three

The D gate set the trigger precisely: the promotion fires at the I gate **if this round's walk
returns a fourth instance**. No walk ran, so no fourth instance arrived — and, importantly, **none
was refuted either**. This is absence of evidence, not evidence of absence, and the two must not be
recorded as the same thing.

So the pattern stays where it was: a personal-memory entry ([[walk-record-always-spec-on-ask]]),
three instances, no shared repo home. **The Evolution Rule's default holds — don't add.** What the
D gate *did* settle stands and is worth carrying forward, because it was decided on evidence
available now rather than on a count:

> **The destination, if it ever promotes, is `.agents/memory/` — not `skills/gate-walker/`.**
> `gate-walker` verifies that a gate's **exit criterion is documented as met**. What a human
> notices at a surface is not a criterion; it cannot be enumerated in advance, which is the entire
> content of the pattern. A skill can check that a walk was **recorded**. It cannot check that its
> **return** was read properly. This is a fact to know, not a rule to run — so `memory/` is the
> **ceiling**, not a waypoint.

**The next round that runs a walk is where the fourth instance can arrive.** Recorded here so it is
not re-derived.

### Carried out of this round

| Item | Status |
| ---- | ------ |
| **Workflow row ORDER differs from its source query's** — the workflow reads its materialized parquet in file order; the query rows path applies R165 W-7's deterministic total order. | **Open observation, unjudged.** Found by the agent, staged as T1's candidate answer, never walked. Cheap to fix (order the read) but it is a **presentation** call, not a correctness one — the rows and values are identical. Belongs with the batched UI cluster if the human ranks it a defect. |
| **Upstream staleness (T4's question)** — editing a source query does not invalidate a workflow's frozen output. | **Named, unfixed, unwalked.** A real gap in the noun, discovered at the D gate. Not a regression: it predates the round. |
| **The latent pager risk** | Unchanged — recorded at R167, non-reproducing, fix deferred by the human. The workflow rows path is the same `query_dataset_rows` shape. |
| **The nine-doc `design-sync` backlog** | [`Round_169`](Round_169.md) — scoped, **not ranked**. |
| **The standing product backlog** | R157 UX cluster · naming/legibility · Export ④ · `[F-prov-reimport-choice]` · AI-propose-key #2 · R145 1b · the batched UI cluster. Ranked by the human now that the program closes. |

### The program closes

[`query-shaping-surface`](../programs/query-shaping-surface.plan.md) is **Complete** — four items,
seven rounds, 2026-08-07 → 2026-08-14. Its thesis held end to end: **a Query gains operations until
it cannot express the shaping, and the wall that pulls a Workflow noun is consolidation.** The
successor is not pre-decided.

## Feeds into → the program closes

Item 4 is the last of [`query-shaping-surface`](../programs/query-shaping-surface.plan.md). When
it lands the program's thesis has been tested end to end: **a Query gains operations until it
cannot express the shaping, and the wall that pulls a Workflow noun is consolidation.** What
succeeds it is not pre-decided — the standing backlog (R157 UX cluster, naming/legibility, the
`design-sync` backlog, Export ④, `[F-prov-reimport-choice]`, AI-propose-key #2, R145 1b) is ranked
by the human when the program closes, not before.

**One backlog item is now scoped, and that is not the same as ranked.** The `design-sync` backlog
has a drafted round — [`Round_169`](Round_169.md), nine docs, timeboxed — written at this round's
open so it could be kept **out** of R168 without being lost. It carries the next number because
that is where it sits today; if the human ranks another item first, it renumbers. Scoping an item
does not promote it above the six that are still one line each.
