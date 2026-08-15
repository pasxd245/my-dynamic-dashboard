# Round 171: the batched UI cluster — the papercuts that were never worth a round alone

**Status**: Review — opened 2026-08-14; eight items built and the acceptance walk returned
**6 of 6** with three findings, all fixed in-round (2026-08-15). Act drafted; **awaiting human
sign-off to flip Complete** ([[dfcfbi-f1-needs-human-review]] — "Complete" means signed-off, not
gates-green).
**Flow**: **DFCFBI (triggers 3, 5)** — set at the Design gate via `flow-selector`; recorded in the
Do log.
**Date started**: 2026-08-14
**Date completed**:

<!-- ⟢ At a glance is authored at the Review→Complete flip (R159 doctrine), not during Do. -->

## Goal

**Inherits from ← [Round_170](Round_170.md)** and the close of
[`query-shaping-surface`](../programs/query-shaping-surface.plan.md). The program shipped four
items in seven rounds and each one deliberately refused to fix the UI papercuts it walked past —
per [[batch-ui-bugs-into-one-round]], _don't fix UI bugs piecemeal mid-feature; batch them into a
dedicated round._ **This is that round.** Every item below was found by a human at a surface,
recorded, and explicitly deferred here.

**Ranked first by the human 2026-08-14** out of the standing backlog, for a reason worth writing
down: R169 and R170 both shipped **zero product code**. The program's own firewall — _no round
ships only documents_ — was written against exactly that drift, and two consecutive rounds outside
the program is where it stops being a coincidence.

_Track: 1 (product). Pulled by: the standing UI cluster, accumulated across R157 → R168 and
designated for a batched round by [[batch-ui-bugs-into-one-round]]._

## Plan

**Expected outcome**: the eight verified items below are fixed or consciously dropped, each with a
human-perceivable difference at a surface.

**Falsified if**: the cluster turns out to be less coherent than "UI papercuts" suggests — i.e. the
items need three different design conversations rather than one build pass. Then it splits by
surface (upload wizard / query builder / canvas) rather than shipping as one round.

### The inventory — **verified against the code today**, not copied from the round files

This matters: **two of the ten items on the standing list are already fixed**, and one has had its
mechanism removed underneath its description. A cluster assembled from memory would have built
work that no longer exists.

| #     | Item                                                                                                                                                                                       | Where                                                                                                                                                                                                                               | Verified state                                                                                                                                           |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **`[F-commit-error-opaque]`** — a non-coded `422` renders the raw Pydantic string with no field named ("Extra inputs are not permitted")                                                   | [`UploadConfirmStep.tsx:86`](../../../workspace/apps/builder/src/features/data-management/datasets/upload/UploadConfirmStep.tsx) — `return err.body.detail ?? err.body.error;`                                                      | **OPEN** — coded errors are handled well (`name_taken`, `coercion_failed` with column + samples + hint, `merge_duplicate_keys`); the fallback is the gap |
| **2** | **`[F-metadata-reset]`** — "Reset all to detected" wipes every dtype override with no click-time confirm and no undo                                                                       | [`UploadMetadataStep.tsx:219`](../../../workspace/apps/builder/src/features/data-management/datasets/upload/UploadMetadataStep.tsx) + button `:327`, guarded only by `disabled={!hasAnyOverride}`                                   | **OPEN** — no `Popconfirm`                                                                                                                               |
| **3** | **`[F-join-label-qualify]`** — join options read `account_id ↔ id`; the design declares `Deals.account_id ↔ Accounts.id`                                                                   | [`JoinEditor.tsx:81`](../../../workspace/apps/builder/src/features/data-management/queries/JoinEditor.tsx) — `` `${r.leftColumn} ↔ ${r.rightColumn} · …` ``                                                                         | **OPEN** — decided 2026-08-10, spec'd in `query-construction.md`, never built                                                                            |
| **4** | **`[F-promote-gate]`** — `Promote` is offered on an edge copied from a governed rel, where it can only `409 relationship_exists`                                                           | [`QueryCanvas.tsx:562`](../../../workspace/apps/builder/src/features/data-management/queries/QueryCanvas.tsx) — rendered unconditionally; `Re-sync` beside it _is_ gated on `divergence !== null`                                   | **OPEN — and its description was stale.** See the note below.                                                                                            |
| **5** | **R165 W-1, second half** — the `derive` operand toggle still doesn't _read_ as a toggle: a white `Segmented` thumb on a white card                                                        | [`StepsEditor.tsx:772`](../../../workspace/apps/builder/src/features/data-management/queries/StepsEditor.tsx)                                                                                                                       | **OPEN** — R165 shipped the `FieldLabel` half; the visual affordance was deferred here                                                                   |
| **6** | **R165 W-2** — a dead backend is indistinguishable from a rejected step: no data, Save off, no message                                                                                     | [`QueryBuilderPanel.tsx`](../../../workspace/apps/builder/src/features/data-management/queries/QueryBuilderPanel.tsx) surfaces `stepInvalid` / `predStale` / `invalidCount` / `relStale` and **nothing for `previewQuery.isError`** | **OPEN**                                                                                                                                                 |
| **7** | **R166 header-action ordering** — `[Edit] [Duplicate] [Delete]` is specified for the query detail header only; generalising it (and the catalog row-actions question) is cross-surface     | query / dataset / workflow detail headers                                                                                                                                                                                           | **OPEN — a decision, not a defect**                                                                                                                      |
| **8** | **R168 workflow row-order** — a workflow's rows come back in parquet file order; its source query applies R165 W-7's deterministic total order. Same rows, same values, different sequence | workflow rows path vs `_page_order_sql`                                                                                                                                                                                             | **OPEN, unjudged** — found by the agent, staged as R168's T1 candidate, never walked                                                                     |

#### Already fixed — dropped from the cluster, recorded so they are not re-found

- **`[F-metadata-highlight]`** (every column showed the "overridden" highlight in refresh/append
  mode) — **fixed**. `UploadMetadataStep.tsx:356` now reads
  `override !== undefined && override.dtype !== row.dtype`, which is exactly the fix R157 proposed.
- **`[F-drift-layout]`** (the drift table right-aligned its type column) — **fixed**. `DriftGroup`'s
  `detail` column carries no `align` today.

#### Item 4's description was stale, and the correction matters

R162 recorded the cause as _"`promotable` tests only dataset-vs-`qr_`"_. **R167 deleted
`promotable` entirely\*\*, with a comment stating that _"there is no longer a shape this could be
offered for and then rejected."_

**That comment addresses only half the shape.** It is true for the `qr_`-side edge it was written
about. It is **not** true for an edge **copy-on-picked from a governed rel and still in sync** —
promoting that re-creates a pair the governed ER already holds, which is `409
relationship_exists`. The button is rendered with no gate at all; `Re-sync` two lines below it
_is_ gated. So the defect survives its own explanation, and the D gate should confirm the 409 by
hand before building against it.

### D — the design gate

- [x] **Confirm item 4** — confirmed by tracing the whole chain, not by a hand-run; see the D-gate
      ruling in the Do log. The gate the ruling specifies is correct **by construction** (it is the
      unique index's own predicate), so the hand-run is confirmation, not a dependency.
- [x] **Decide item 7** — settled as a **written convention, no code**. Human's call 2026-08-15.
- [x] **Decide item 8's home** — **engine, fixed minimally, kept in this round**. Human's call.
- [x] **Decide item 5's option** — **`Radio.Group optionType="button"`**. Human's call.
- [x] **Write the design into the corpus** — **deferred to the code commits, deliberately.**
      [[fix-code-first-then-sync-doc]] (the human's R168 call) overrides the default here: a ruling
      written into the corpus ahead of the code needs a current-state marker, and a marker narrates
      the risk instead of removing it. The rulings live in this file's Do log; each corpus doc is
      synced in the same commit as the code that makes it true. **Exception**: item 3 is already in
      `query-construction.md` carrying an explicit `not yet built` marker — that one is a
      marker-clear, not a new write.
- [x] **Run [`flow-selector`](../../skills/flow-selector/SKILL.md)** — **DFCFBI (triggers 3, 5)**.
- [x] **Write the acceptance-walk questions at D** — five questions, in § Check.

### Explicitly NOT in this round

- **R167's W-1 (canvas layout not persisting)** — R168 recorded that the human **ignored it rather
  than queuing it**, so it is _not_ assumed into the cluster. Raised for a yes/no at the D gate and
  **answered NO, 2026-08-15** — it stays out.
- **R168's upstream staleness** (editing a source query does not invalidate a workflow's frozen
  output) — a **noun/mechanism gap**, not a papercut. It needs a design decision about what
  invalidation means, which is a different round.
- **The 8 remaining rotted links** (R170) — `unlink` across eight Complete rounds; an editorial
  call for the human.
- **Naming/legibility** (R163) — parked, and needs a design decision first.
- **The `Lifecycle` sections** R169 left in three design docs.

## Risks / unknowns

| Risk                                                                    | Why it matters                                                             | Handling                                                                                                                       |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **A batched round has no single thesis**, so scope creeps item by item. | This is the failure mode of every "cleanup round".                         | The inventory is **closed at eight**, verified against code. Anything discovered mid-round is recorded, not absorbed.          |
| **Item 7 is a design conversation wearing a bug's clothes.**            | It could consume the round and leave the seven real fixes unshipped.       | The D gate either settles it with a per-surface table or **drops it**. It does not get to be "decided while building".         |
| **Two items were already fixed; more may be.**                          | Building work that no longer exists is worse than not building it.         | Every item was re-verified against the code **before** this file was written. Re-verify at B for anything the D gate reshapes. |
| **Fixes are individually small and collectively invisible.**            | A round that ships eight papercuts can still fail to _feel_ like anything. | The walk asks whether the surfaces feel different, not whether eight diffs landed.                                             |

## Do

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)), 2026-08-15:

| Condition                            | Fired?  | Justification                                                                                                                                                                                                                                                            |
| ------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. >3 independent states/branches    | no      | The items are independent single-state additions, not one state model. The largest, item 6, adds a **fifth** branch to a set of four that already exists (`stepInvalid` / `predStale` / `invalidCount` / `relStale`) — an addition to a shipped model, not a new one.    |
| 2. New interaction pattern           | no      | `Popconfirm` is absent from the product today, but confirm-before-destructive is not — `DeleteConfirmModal` ships it. A lighter chrome for an existing pattern is "same pattern, new screen" by the skill's own bar. `Radio.Group` already ships in `UploadConfirmStep`. |
| 3. High user-error risk              | **yes** | Item 2 is a genuinely destructive, un-undoable action (one click wipes every dtype override on the tab) reachable with no confirm, and item 4 offers an action that can only fail. Both are exactly this condition.                                                      |
| 4. Contract depends on unresolved UI | no      | **Zero wire change in the round.** Item 1 renders a 422 that already ships; item 8 changes the order rows are written in, not the `RowsPage` shape. No `*.contract.yaml` is touched.                                                                                     |
| 5. UX confidence below threshold     | **yes** | Item 5's affordance was **already fixed once and re-walked as still-unclear** — _"vẫn chưa thật 'rõ' lắm để biết nó là 1 toggle"_ (R165 W-1). A fix that failed the human's eye once is the definition of below-threshold confidence.                                    |

Result: **Flow: DFCFBI (triggers 3, 5)**

**Chain shape.** With condition 4 firing `no` and no contract touched, **C is empty this round** —
`F1` is not a slice of the FE build, it _is_ the FE build (items 1–6 are FE-only), and `B` is item 8
alone. So the chain runs **D → F1 (six FE items) → C (none) → B (item 8, engine) → F2 (none) → I**.
Recorded rather than silently collapsed: an empty phase that is _reasoned_ empty is a different
artifact from one that was skipped. The [[dfcfbi-two-round-split]] split is **not** invoked — its
purpose is isolating F1 feel-risk from a large C+B, and there is no C and a ~10-line B.

**Model check** (Design gate):

- **Noun-vs-mode**: _neither_ — **no new noun and no new mode.** Every one of the eight items is a
  correction to a surface that already ships in the mode it already has; the round adds no route, no
  wizard step, no panel, and no wire field. That is an unusual answer, so it is worth stating rather
  than leaving blank: this cluster's whole risk is the _opposite_ of R69's, and the check that
  matters here is the scope brake (the inventory is closed at eight), not the model.
- **Discovered-vs-imposed**: **discovered**, and unusually strongly — every item was found by a
  **human standing in front of a running surface** (R157/R162/R165/R166/R168 walks), recorded at the
  time, and deferred here on purpose. Nothing in the inventory was reasoned into existence. Two
  entries were then found **already fixed** and dropped, and one (item 4) had its stated cause
  **falsified** by re-reading the code — evidence that the inventory was re-derived from the build
  rather than copied forward. Item 7's convention is likewise discovered: it was _read off_ the
  three shipped headers, not invented for them.

### D-gate rulings — what the build implements against

Per [[fix-code-first-then-sync-doc]] these live here, not yet in the corpus; the named doc is
synced in the same commit as the code.

**Item 1 · `[F-commit-error-opaque]`** → the uncoded fallback names the field. Today
`UploadConfirmStep.tsx:86` returns `err.body.detail ?? err.body.error` raw, which for a Pydantic
`extra='forbid'` rejection reads _"Extra inputs are not permitted"_ with no field named — the one
piece of information the user needs. The fallback renders the **`loc` path** the router's
`_validation_error` family already sends (`{"loc": ["body", "rightDatasetId"], "msg": …}`), and
when `detail` is a bare string it is shown **with a "this is unexpected" frame** rather than posing
as guidance. → syncs `upload.md` § Failure semantics.

**Item 2 · `[F-metadata-reset]`** → a `Popconfirm` on `[Reset all to detected]`, naming **the count
and the tab**: _"Reset 4 overrides on `Worksheet2` to detected?"_ Two reasons for `Popconfirm` over
the shipped `DeleteConfirmModal`: the action is scoped to one tab and needs its _scope_ stated more
than its consequence, and `DeleteConfirmModal` encodes resource-deletion copy. **Also fix the
enablement**: `hasAnyOverride` is `Object.keys(columnOverrides).length > 0`, which counts an
override entry **equal to the detected dtype** — the same not-really-an-override that R157's
highlight fix already learned to exclude (`override.dtype !== row.dtype`, `:356`). The button and
the count must use that same predicate, or the confirm will offer to reset zero things. →
syncs `upload.md` § Metadata step.

**Item 3 · `[F-join-label-qualify]`** → build to the spec already written in
[`query-construction.md` § Join option labels](../../design/data-management/queries/query-construction.md);
that section's `Current state` / fidelity-drift note is cleared in the same commit. Its **build
note is binding**: both qualifiers plus the cardinality suffix overflow a narrow `<Select>`, so the
ellipsis/`title` behaviour is decided, not hoped.

**Item 4 · `[F-promote-gate]`** → **confirmed, and the gate is the unique index's own predicate.**
The chain: copy-on-pick snapshots the governed rel's exact fields
([`chain.ts:82`](../../../workspace/apps/builder/src/features/data-management/queries/chain.ts)) →
`promoteRel` POSTs those same fields
([`useQueryBuilder.ts:268`](../../../workspace/apps/builder/src/features/data-management/queries/useQueryBuilder.ts)) →
the index `idx_relationships_pair_unique` is
`(workspace_id, left_dataset_id, left_column, right_dataset_id, right_column)`
([`db_models.py:164`](../../../workspace/apps/backend/app/db_models.py)) →
`IntegrityError` → `409 relationship_exists`
([`relationships.py:147`](../../../workspace/apps/backend/app/routers/relationships.py)).

Two things this trace settles that the item's own description did not:

1. **`cardinality` is not in the key.** So a `divergence: 'changed'` edge whose _only_ change is
   cardinality **also** 409s. The gate is therefore **not** "has an `originRelationshipId`" — that
   predicate is both too narrow (it misses a free-form edge drawn over a pair the governed ER
   already holds) and too wide (it catches a `removed`-divergence edge, which promotes fine).
2. **The correct gate is: _some governed rel already holds this ordered pair_** — evaluated on the
   FE against the `governedById` map the canvas already has. That is the 409 condition exactly,
   which is why this ruling does not depend on the hand-run.

This is [[error-code-is-not-the-guard]] read in the mirror: R167 was right that the `qr_`-side
shape is gone, and wrong to conclude the button could no longer be rejected — _"unreachable" was
relative to the layer it was reasoning about._ → syncs `canvas.md` § Editing, whose Promote
paragraph currently asserts R167's claim as current-state and is **false today**.

**Item 5 · R165 W-1** → `Radio.Group optionType="button"` at
[`StepsEditor.tsx:772`](../../../workspace/apps/builder/src/features/data-management/queries/StepsEditor.tsx),
keeping the `FieldLabel` R165 shipped. Both halves carry a border, so the control reads as pressable
regardless of which half is selected — which is the precise failure of `Segmented` here (a white
raised thumb on a white card leaves only the **un**selected half shaded).

**Item 6 · R165 W-2** → `QueryBuilderPanel` gains a branch for `previewQuery.isError`, distinct in
copy from a rejected step: a dead backend is _"couldn't reach the server"_ with a retry, not
_"this step is invalid"_. The panel surfaces four conditions today and this one nowhere.

**Item 7 · R166 header-action ordering** → **a written convention, no code.** The per-surface table
[[requirements-table-before-building-ui]] asks for, read off the build:

| Surface         | Header actions today                                                         | Form     |
| --------------- | ---------------------------------------------------------------------------- | -------- |
| Query detail    | `[Edit] [Duplicate] [Delete]` — primary Edit, danger Delete                  | inline   |
| Workflow detail | `[Run] [Edit] [Delete]` — primary Run, danger Delete                         | inline   |
| Dataset detail  | `Actions ▾` → Join with related · ─ · Properties · Refresh · Rename · Delete | dropdown |

All three already obey one rule, so the round **writes it down rather than rebuilding anything**:
_verbs ordered most-reached-for first, the destructive verb last; inline at ≤3 actions, collapsed
into a single `Actions ▾` above that._ The **catalog row-actions** question is recorded as still
open, not answered — a list row is not a detail header and no evidence in this cluster speaks to it.
→ syncs `_shared/crud-hygiene.md`, which is where cross-surface CRUD affordances already live
(and whose criterion 10 describes the dataset detail header as inline rename+delete — true when
written, superseded by the dropdown; the sync corrects it).

**Item 8 · R168 workflow row-order** → **minimal engine fix, and the trace found more than the item
claimed.** `materialize_steps` writes the parquet from `build_steps_relation` with **no `ORDER BY`**
([`rows_reader.py:633`](../../../workspace/apps/backend/app/ingest/rows_reader.py)), while the source
query's paged read applies `_page_order_sql` (R165 W-7). The fix: **order the materialized write by
the same `_page_order_sql` keys**, so the parquet's file order _is_ the query's order and the
existing read agrees. Scoped to the workflow run path — the shared `query_dataset_rows` is not
touched.

**Recorded, not absorbed** (per the round's own scope-creep handling): `query_dataset_rows` itself
has no `ORDER BY` either ([`rows_reader.py:105`](../../../workspace/apps/backend/app/ingest/rows_reader.py)),
so the **dataset** rows path has no total order at all — the same class R165 W-7 measured at 33 rows
twice and 33 never. Ordering the write makes the workflow read _agree with its query_; it does not
make either read _contractually_ ordered. That is an engine round, and this round does not open it.

**R167 W-1 (canvas layout not persisting)** → **stays out**, human's call 2026-08-15. R168 recorded
it as ignored rather than queued, and it needs a storage decision (where does a per-query node
position live?), which is not a papercut.

### Build record — what shipped, and what the building falsified

| Item  | Commit                                                | Doc synced                                |
| ----- | ----------------------------------------------------- | ----------------------------------------- |
| 1 · 2 | `d18d451` — the upload wizard's two papercuts         | `upload.md`                               |
| 3–6   | `00ccb07` — the query builder's four                  | `canvas.md`, `query-construction.md`      |
| 7 · 8 | `dd3fe9d` — the ordered write + the header convention | `workflows.md`, `_shared/crud-hygiene.md` |

**Gates**: builder 375 passed (25 files, +9), backend 440 passed (+3), `tsc --noEmit` clean,
`design-doc-lint` 0 errors across 14 docs, i18n parity green (en + vi for every new key).

**Three things the building falsified, each recorded because the round file said the opposite:**

1. **The D-gate ruling on item 1 was backwards.** It said a bare-string `detail` should carry the
   "unexpected" frame. That arm is exactly R144's `format_unsupported` family — guidance the
   **router wrote for the user**. The pydantic **list** arm is the app-bug one, and it was also
   the unreadable one, because `datasetsApi` kept `msg` and dropped `loc`. Framing both as
   unexpected would have destroyed R144's work; a regression test now pins the distinction.
2. **The shipped promote test was asserting the defect.** It promoted a copy-on-picked, in-sync
   edge — the exact POST that returns `409 relationship_exists` — and passed, because the MSW
   handler never modelled `idx_relationships_pair_unique` and returned `201` to anything. **The
   FE suite could not have caught item 4 at any point.** A mock that answers more permissively
   than the database turns a test into a description of the bug.
3. **My first test for item 8 proved nothing.** It used an explicit `sort` step — but
   `build_steps_relation` already emits that `ORDER BY` inside the relation, so it passed with
   the fix disabled. The two orders diverge only where `_page_order_sql` adds keys the steps
   relation lacks: **no ordering step at all**, and ties. Re-probed with the fix off, the
   aggregate returned `Alice, Carol, Bob` from the workflow and `Alice, Bob, Carol` from the
   query; the test is built on that case and **verified to fail without the fix**.

**Two things found while building, recorded and NOT absorbed** (the inventory stayed closed):

- **`query_dataset_rows` has no `ORDER BY` at all**, so the **dataset** rows path has no total
  order either — the same class R165 W-7 measured. Ordering the materialized write makes a
  workflow agree with its query; it does not make either read contractually partitioned. Named
  in `workflows.md`, left for an engine round.
- **Item 2's enablement bug had a sibling**: R157's highlight predicate misses a **format-only**
  override (a `date` column whose dtype matches detected but whose format the user edited).
  Folding both onto one `isRealOverride` fixed it as a side effect of not writing the predicate
  twice.

## Check

_(verdicts filled at the I gate — the five questions below are unwalked; the build is ready for
them)_

### Acceptance-walk questions (written at D, per [[walk-record-always-spec-on-ask]])

Six questions, `coverage: 6 of 8` — item 7 ships no build to walk, and item 8 is a test, not a
gesture. The standing criterion applied throughout: **if a test can answer it, it is a test.** Each
question names the card or control it acts on; grade the gesture, not the outcome.

> **On the count — five was an anchor, and the human caught it (2026-08-15).** R165, R166, R167,
> R168 and this round's first draft all wrote exactly **five** questions, and nothing prescribes
> five: [[walk-record-always-spec-on-ask]] mandates questions + ⬜ + `coverage: N of M`, never a
> number. R165 set the shape and four rounds copied it. **It cost a question here.** Item 3 was
> dropped as _"a string a test asserts exactly"_ — true of the text, false of the thing that was
> actually uncertain: `query-construction.md`'s binding build note says the qualified label
> **overflows a narrow `<Select>`** and demands an explicit ellipsis/`title` decision. That
> decision was made; whether it **reads** is perception, and JSDOM has no layout, so no test in
> this repo can answer it. T6 below is that question. A batched cluster spans more surfaces than a
> single-feature round, so this was the round where the count should have moved most — which is
> exactly where the anchor held.

| #      | Question                                                                                                                                                                                                                                                                                                                                                              | Item(s) | Verdict     |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------- |
| **T1** | On the upload wizard's **Metadata** step, override two columns' dtypes, then click `[Reset all to detected]`. Does the confirm tell you **what you are about to lose** clearly enough that you'd be comfortable clicking through it — and on an Excel file with two sheets, is it obvious the reset is **this tab only**?                                             | 2       | ✅ **PASS** |
| **T2** | Commit an upload that the server rejects with something the FE has no code for (e.g. a body it refuses). Reading only the red box on **Confirm**, can you tell **which field** the server objected to, and do you know it is a bug rather than something you did?                                                                                                     | 1       | ✅ **PASS** |
| **T3** | On a query's **Canvas**, draw a join that matches an existing governed relationship, then click the edge. Does the actions row read as **honest** — is it clear why `Promote` is or isn't available on _this_ edge, without clicking it to find out?                                                                                                                  | 4       | ❌ **W-1**  |
| **T4** | On the query builder's **Computed column** card, without touching anything: can you tell at a glance that the by-column / by-number control is a **switch you can press**, and which side is currently on?                                                                                                                                                            | 5       | ✅ **PASS** |
| **T5** | Stop the backend, then edit a step on a saved query. From the builder panel alone, can you tell **the server is unreachable** rather than that your step was rejected — and does the surface tell you what to do next?                                                                                                                                                | 6       | ❌ **W-2**  |
| **T6** | Open a query with 2+ hops and look at the **add-a-join** picker and the hop rows, where the labels are longest. Now that both sides are qualified (`accounts.account_id ↔ tiers.acct · many:one`), can you still **read** them — or does the `<Select>` cut them off somewhere that costs you the part you needed? Hover a truncated one: does the full label arrive? | 3       | ⚠️ **W-3**  |

Item 8 is not walked because it is a **test, not a gesture**: run a workflow whose source query
carries a `sort` step, page its rows, and assert the sequence matches the query's own paged read.
It goes to the B gate's suite.

### Walk result — run by the human 2026-08-15. **`coverage: 6 of 6 returned`**, three findings

Their words, hedges intact:

- **T1 — PASS.** _"ok"_
- **T2 — PASS, with an observation.** _"ok, it will tell the first column giving the issue (resolve
  one by one, expected behavior)"_ — the typed `coercion_failed` names one column at a time and the
  human read that as correct, not as a gap. Recorded rather than actioned.
- **T3 — FAIL → W-1.** _"not good. I think better we just 'hide' the promote button. Why? base on
  rel type is governed ore free form, we got to know."_
- **T4 — PASS.** _"ok, it'is highlighted as a normal toggle, easy to 'regconize'"_ — the second
  attempt at this affordance (R165 shipped the label, R171 the boxed radio) is the one that landed.
- **T5 — FAIL → W-2.** _"not good, if I stop server, then click on 'Save' button on FE, nothing will
  be show. The error only when something be fetched."_
- **T6 — PARTIAL → W-3.** _"partial ok. The 'rel' dropdown is ok, but the `<Select>` of join type,
  'Inner (matches o...' => this is now fully show, full is 'Inner (matches only)', not too long and
  we can show full?"_ — the qualified labels the question was **about** read fine; the defect is in
  the neighbouring control.

#### W-1 — `Promote` is hidden, not disabled (T3, fixed in-round)

The build offered it **disabled with a tooltip**, reasoning that a vanishing button raises the
question the tooltip answers. The walk overturned that on better grounds: **the info-box already
prints `Relationship type: Governed` two rows above**, so the absence is explained before the user
looks for the button — a disabled button re-explains what the box just said. It also brings
`Promote` into line with `Re-sync` directly below it, which is absent rather than disabled when it
does not apply. The gate predicate is unchanged (`promoteWouldCollide` — still the unique index's
own); only the presentation moved. One case is now unnarrated and is recorded in `canvas.md`: a
_free-form_ edge over an already-governed pair hides the button while the box reads "Free-form".

#### W-2 — a failed **Save** was completely silent (T5, fixed in-round) — the round's most serious find

The human's diagnosis was exact: _"the error only when something be fetched."_ The builder surfaced
**fetch** failures and not **mutation** failures. `save()` carried an `onSuccess` and **no
`onError`**, so a `PUT` that never landed was indistinguishable from one that did — and since
`onSuccess` closes edit mode, the _successful_ case is the one that visibly changes. **The user's
next move is to navigate away believing the work is stored.** That is the only failure on this
surface that loses data, and no gate caught it: `tsc`, 375 builder tests and five linters were all
green.

Note this is **not** the same defect as item 6 (R165 W-2), fixed earlier in this round: that one is
the preview, a fetch, on the read path. The two share a name and nothing else. Fixed: an error toast
that says nothing was written, and edit mode **stays open with the draft**, so retrying is one click.

**Recorded, not swept**: query delete and Duplicate's create have no `onError` either. Both are
recoverable by observation — the list refresh contradicts them — where a silent Save is not. Named
in `query-construction.md`.

#### W-3 — the join-type `<Select>` truncated a label that fits (T6, fixed in-round)

`width: 160` clipped `Inner (matches only)` to `Inner (matches o…`. The objection is the right one:
the string is short, so the truncation buys nothing and costs the parenthetical that explains what
the join type _does_. Widened to 200 (the longest option in either locale, ~184px with padding and
arrow); the hop's label column is the `flex: 1, minWidth: 0` neighbour and absorbs it.

**What T6 says about T6**: the question asked whether the labels **this round qualified** still fit,
and they do — the human confirmed the `rel` dropdown reads fine. The defect is in a control R171
never touched, noticed because the question put someone in front of the row.

## Act

**Learnings**:

- **A batched cluster held together.** The round's `Falsified if` was _"the items need three
  different design conversations rather than one build pass"_ — it did not fire. Eight items across
  three surfaces shipped as one round, and the only item that threatened to become a design
  conversation (item 7) was settled by **reading the rule off the build** instead of imposing one.
  The brake that made it work was verifying the inventory against the code **before** writing the
  round file: two items were already fixed and one had its stated cause falsified.
- **The most valuable finding came from the gesture nobody specified.** W-2 — a silent failed Save,
  the round's only data-losing defect — was found by a human doing something adjacent to what the
  question asked, after `tsc`, 375 builder tests, 440 backend tests and five linters were green.
  Fourth instance of the category lesson, and the sharpest.
- **"Unreachable" is relative to a layer, and so is "already handled".** Item 4's guard had been
  removed on reasoning true for one shape only. Item 6 fixed dead-backend legibility for **fetches**
  while the identical gap sat open on **mutations** one file away. Both are the same error: a fix
  scoped to the layer that was being looked at, described as if it were general.
- **A test can assert the right string and still prove nothing.** Three times this round: the
  promote test asserted a 201 the real backend answers 409 (MSW never modelled the unique index);
  the first item-8 test passed with the fix disabled; and item 3's label test would have "covered"
  a label the user cannot read. **Ask what the test would still pass on.**
- **A recurring format becomes an anchor.** Five rounds wrote five walk questions with nobody
  choosing five. The artifact has no repo home and no lint, so it travels by imitation — which
  transmits accidents as faithfully as intent. Queued for graduation (§ Feeds into).

**Kept**: the inventory-closed-at-eight discipline. Three findings arrived mid-round
(`query_dataset_rows` has no total order; R157's highlight missed format-only overrides; query
delete/create have no `onError`) and each was **recorded rather than absorbed**. Only the one that
was a two-line consequence of not writing a predicate twice was folded in.

**Changed**: nothing in the process. This round used the shipped flow as-is; the one process change
it produced is deliberately deferred to its own Track-2 successor.

## Feeds into → the fourth instance

**This round's acceptance walk is where the category lesson gets its evidence.** Three instances
across R165 / R166 / R167 cleared the Evolution Rule's bar: _a walk question works by putting a
human in front of a surface, and what they notice is not bounded by what you asked._ R168 was to
be the fourth, and its walk was skipped — leaving the pattern at three with **no fourth instance
and none refuted** ([[walk-record-always-spec-on-ask]]).

A cluster of eight papercuts, walked by a human, is an unusually good test of it. If this walk
returns something none of its questions asked about, the promotion fires — destination already
decided: `.agents/memory/`, **not** `skills/gate-walker/`, because a skill can check that a walk
was _recorded_ but not that its _return_ was read.

**It fired — twice, 2026-08-15, and neither was refuted.**

- **T5 → W-2.** The question asked whether the **builder panel** names an unreachable server after
  you _edit a step_. The human stopped the server and pressed **Save** instead — a different
  gesture on a different code path (mutation, not fetch) — and found that a failed save was
  **completely silent**. The fix T5 was nominally testing (the preview's dead-backend message) does
  not touch it. This is the round's most serious defect and the only one that loses data.
- **T6 → W-3.** The question asked whether the join labels **this round qualified** still fit. They
  do — that half passed. The defect was in the **join-type `<Select>` beside them**, a control R171
  never touched.

**Four instances, four rounds, four domains, none refuted** — R165 (asked about numbers → six
defects incl. a latent pager bug), R166 (asked about rows → button order), R167 (asked about `qr_`
traces → canvas layout), R171 (asked about a preview panel → a silent Save; asked about labels → a
neighbouring control). The pattern is now over the Evolution Rule's bar with the fourth instance
R168's skip left missing.

**What that means for the queued graduation below**: the `.agents/memory/` file it creates now has
its fourth instance to carry, and W-2 is the sharpest evidence yet for _why_ the artifact earns its
keep — **every automated gate was green** (`tsc`, 375 builder tests, 440 backend tests, five
linters) and none of them could see a mutation with no error branch. This is also the round that
supplies the counter-example the memory needs: the human's T5 gesture was **not the one the
question specified**, which is exactly the property no test and no lint can reproduce.

### Also feeds into → the walk artifact graduates (Track 2, queued for AFTER this round closes)

**Decided with the human 2026-08-15, execution deliberately deferred.** Two findings, one cause.

- **The count was an anchor.** R165–R168 and this round's first draft all wrote exactly **five**
  questions; nothing prescribes five. It cost item 3 a walk question — recovered as T6. See
  § Check.
- **The artifact has no repo home.** Its entire spec lives in an agent-private memory file, while
  **four round files (R166 · R167 · R168 · R171) cite `[[walk-record-always-spec-on-ask]]`, a slug
  the repo cannot resolve.** No linter validates `[[…]]`, so `check:links` — which R170 just made
  honest — is structurally blind to the class. That is
  [[a-wrong-validator-hides-breaks-both-ways]] one layer out: R170 fixed the checker's slug bug;
  wikilinks were never in its scope at all.

The cause is the same for both: **with no repo definition and no lint, the artifact travels round
to round by imitation**, which transmits its accidents as faithfully as its intent and is
detectable only when a human happens to ask.

**The agreed shape** — the memory file's own pre-authorized graduation, whose trigger has now
fired (5 rounds of hand-use; and the human corrected the artifact's _method_ in R167 and its
_count_ here, which is stronger evidence of "read" than the criterion asked for):

| What                                                                                                                                                                         | Where                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **The rule** — `## Check` carries questions + ⬜ + `coverage: N of M`; relocate from acceptance criteria + Risks; drop what a test can close; **count follows the surfaces** | `.agents/plan/PDCA.md` § Round Template (minimal, ~4 lines)        |
| **The why + dogfood ledger** — R165–R171 evidence, the six-defects-none-about-their-question pattern, the skip semantics                                                     | repo `.agents/memory/` (also resolves the four dangling citations) |

Logged in [`promotions.md`](../promotions.md) for human sign-off when it lands.

**Why after, not now**: R171 is Track 1 and this is Track 2 — _"if a task blurs tracks, pause and
split it"_ (AGENTS.md). And the walk is still unrun, so the evidence is incomplete: it may supply
the **fourth instance** the section above is waiting for, which belongs in the very
`.agents/memory/` file this graduation creates. The two converge — one artifact, written once the
walk has said what it has to say.

_Track: 2 (agent-method). Pulled by: R171's count anchor + four round files citing an unresolvable
slug._
