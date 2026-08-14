# Round 171: the batched UI cluster — the papercuts that were never worth a round alone

**Status**: In Progress — opened 2026-08-14, **D gate active**
**Flow**: _(set at the Design exit via `flow-selector`)_
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

| # | Item | Where | Verified state |
| - | ---- | ----- | -------------- |
| **1** | **`[F-commit-error-opaque]`** — a non-coded `422` renders the raw Pydantic string with no field named ("Extra inputs are not permitted") | [`UploadConfirmStep.tsx:86`](../../../workspace/apps/builder/src/features/data-management/datasets/upload/UploadConfirmStep.tsx) — `return err.body.detail ?? err.body.error;` | **OPEN** — coded errors are handled well (`name_taken`, `coercion_failed` with column + samples + hint, `merge_duplicate_keys`); the fallback is the gap |
| **2** | **`[F-metadata-reset]`** — "Reset all to detected" wipes every dtype override with no click-time confirm and no undo | [`UploadMetadataStep.tsx:219`](../../../workspace/apps/builder/src/features/data-management/datasets/upload/UploadMetadataStep.tsx) + button `:327`, guarded only by `disabled={!hasAnyOverride}` | **OPEN** — no `Popconfirm` |
| **3** | **`[F-join-label-qualify]`** — join options read `account_id ↔ id`; the design declares `Deals.account_id ↔ Accounts.id` | [`JoinEditor.tsx:81`](../../../workspace/apps/builder/src/features/data-management/queries/JoinEditor.tsx) — `` `${r.leftColumn} ↔ ${r.rightColumn} · …` `` | **OPEN** — decided 2026-08-10, spec'd in `query-construction.md`, never built |
| **4** | **`[F-promote-gate]`** — `Promote` is offered on an edge copied from a governed rel, where it can only `409 relationship_exists` | [`QueryCanvas.tsx:562`](../../../workspace/apps/builder/src/features/data-management/queries/QueryCanvas.tsx) — rendered unconditionally; `Re-sync` beside it *is* gated on `divergence !== null` | **OPEN — and its description was stale.** See the note below. |
| **5** | **R165 W-1, second half** — the `derive` operand toggle still doesn't *read* as a toggle: a white `Segmented` thumb on a white card | [`StepsEditor.tsx:772`](../../../workspace/apps/builder/src/features/data-management/queries/StepsEditor.tsx) | **OPEN** — R165 shipped the `FieldLabel` half; the visual affordance was deferred here |
| **6** | **R165 W-2** — a dead backend is indistinguishable from a rejected step: no data, Save off, no message | [`QueryBuilderPanel.tsx`](../../../workspace/apps/builder/src/features/data-management/queries/QueryBuilderPanel.tsx) surfaces `stepInvalid` / `predStale` / `invalidCount` / `relStale` and **nothing for `previewQuery.isError`** | **OPEN** |
| **7** | **R166 header-action ordering** — `[Edit] [Duplicate] [Delete]` is specified for the query detail header only; generalising it (and the catalog row-actions question) is cross-surface | query / dataset / workflow detail headers | **OPEN — a decision, not a defect** |
| **8** | **R168 workflow row-order** — a workflow's rows come back in parquet file order; its source query applies R165 W-7's deterministic total order. Same rows, same values, different sequence | workflow rows path vs `_page_order_sql` | **OPEN, unjudged** — found by the agent, staged as R168's T1 candidate, never walked |

#### Already fixed — dropped from the cluster, recorded so they are not re-found

- **`[F-metadata-highlight]`** (every column showed the "overridden" highlight in refresh/append
  mode) — **fixed**. `UploadMetadataStep.tsx:356` now reads
  `override !== undefined && override.dtype !== row.dtype`, which is exactly the fix R157 proposed.
- **`[F-drift-layout]`** (the drift table right-aligned its type column) — **fixed**. `DriftGroup`'s
  `detail` column carries no `align` today.

#### Item 4's description was stale, and the correction matters

R162 recorded the cause as _"`promotable` tests only dataset-vs-`qr_`"_. **R167 deleted
`promotable` entirely**, with a comment stating that _"there is no longer a shape this could be
offered for and then rejected."_

**That comment addresses only half the shape.** It is true for the `qr_`-side edge it was written
about. It is **not** true for an edge **copy-on-picked from a governed rel and still in sync** —
promoting that re-creates a pair the governed ER already holds, which is `409
relationship_exists`. The button is rendered with no gate at all; `Re-sync` two lines below it
*is* gated. So the defect survives its own explanation, and the D gate should confirm the 409 by
hand before building against it.

### D — the design gate

- [ ] **Confirm item 4 empirically** — copy-on-pick a governed rel onto the canvas, click
      `Promote`, and observe the 409. The code reads that way; a shipped 409 is the proof.
- [ ] **Decide item 7** — it is a *cross-surface convention*, not a bug. Either settle the order
      for every detail header + the catalog row-actions question, or drop it from this round. It is
      the one item that could pull the round into a design conversation ([[requirements-table-before-building-ui]]
      applies: write the per-surface table **before** building).
- [ ] **Decide item 8's home** — the workflow row-order is arguably an **engine** fix (order the
      materialized read) rather than UI. If it is engine, it does not belong in a UI cluster.
- [ ] **Decide item 5's option** — R165 costed three; pick one, or drop it as polish.
- [ ] **Write the design into the corpus** where a decision is durable
      ([[d-gate-artifact-in-design-corpus]]): `upload.md` (items 1–2), `query-construction.md`
      (item 3, already spec'd), `canvas.md` (item 4).
- [ ] **Run [`flow-selector`](../../skills/flow-selector/SKILL.md)** at the Design exit. This
      round has real UX decisions (a destructive-action confirm, an affordance redesign), so
      **DFCFBI is live** — unlike R168, do not assume the no-UI branch.
- [ ] **Write the acceptance-walk questions at D**, applying the standing criterion: _if a test can
      answer it, it is a test_ ([[walk-record-always-spec-on-ask]]). **This round's walk is the
      fourth-instance test** for the category lesson R168 could not settle — see § Feeds into.

### Explicitly NOT in this round

- **R167's W-1 (canvas layout not persisting)** — R168 recorded that the human **ignored it rather
  than queuing it**, so it is *not* assumed into the cluster. **Raised for a yes/no**, not decided
  here.
- **R168's upstream staleness** (editing a source query does not invalidate a workflow's frozen
  output) — a **noun/mechanism gap**, not a papercut. It needs a design decision about what
  invalidation means, which is a different round.
- **The 8 remaining rotted links** (R170) — `unlink` across eight Complete rounds; an editorial
  call for the human.
- **Naming/legibility** (R163) — parked, and needs a design decision first.
- **The `Lifecycle` sections** R169 left in three design docs.

## Risks / unknowns

| Risk | Why it matters | Handling |
| ---- | -------------- | -------- |
| **A batched round has no single thesis**, so scope creeps item by item. | This is the failure mode of every "cleanup round". | The inventory is **closed at eight**, verified against code. Anything discovered mid-round is recorded, not absorbed. |
| **Item 7 is a design conversation wearing a bug's clothes.** | It could consume the round and leave the seven real fixes unshipped. | The D gate either settles it with a per-surface table or **drops it**. It does not get to be "decided while building". |
| **Two items were already fixed; more may be.** | Building work that no longer exists is worse than not building it. | Every item was re-verified against the code **before** this file was written. Re-verify at B for anything the D gate reshapes. |
| **Fixes are individually small and collectively invisible.** | A round that ships eight papercuts can still fail to *feel* like anything. | The walk asks whether the surfaces feel different, not whether eight diffs landed. |

## Do

_(filled during the round)_

## Check

_(filled at the gate)_

## Act

_(filled at close)_

## Feeds into → the fourth instance

**This round's acceptance walk is where the category lesson gets its evidence.** Three instances
across R165 / R166 / R167 cleared the Evolution Rule's bar: _a walk question works by putting a
human in front of a surface, and what they notice is not bounded by what you asked._ R168 was to
be the fourth, and its walk was skipped — leaving the pattern at three with **no fourth instance
and none refuted** ([[walk-record-always-spec-on-ask]]).

A cluster of eight papercuts, walked by a human, is an unusually good test of it. If this walk
returns something none of its questions asked about, the promotion fires — destination already
decided: `.agents/memory/`, **not** `skills/gate-walker/`, because a skill can check that a walk
was *recorded* but not that its *return* was read.
