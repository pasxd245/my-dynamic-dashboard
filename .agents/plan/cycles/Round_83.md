# Round 83: design-sync — fold the `queries` domain (7→4 spine-first) + sync to code

**Status**: Planning — Plan gate (this step). Inherits R82's Detect (drift report + 6 markers
already stamped); R83 runs the **Fix gate** (sync + de-fragment) then Check.
**Date started**: 2026-06-17
**Date completed**:
**Flow**: **Track-2 agent-method** — applies the [`design-sync`](../../skills/design-sync/SKILL.md)
skill's `sync` mode (+ its §5 de-fragment step) to the `queries` domain. `flow-selector` (DCFBI vs
DFCFBI) is **N/A** (no product contract/BE/FE code; sync-only). Gates: **Plan → Fix → Check**
(Detect inherited from R82).

## Goal

**Inherits from ← [Round_82](Round_82.md)** — R82 ran `design-sync --check` across all three
data-management domains, spilled `queries` (J-1: heaviest by far) to this round, and left **6
standing `OUT OF SYNC` markers** under `queries/` as R83's signal. The CODE-TRUTH map + per-doc
drift + de-fragmentation map are already written to
[`.agents/tmp/design-sync/queries.md`](../../tmp/design-sync/queries.md) (read from the code,
trusting no doc).

Run `design-sync` `sync` on the `queries` domain so its design corpus matches the **actual
implementation** (code is the source of truth) and is ledger-free — including the skill's **§5
de-fragment** step, because here one concept (the Saved Query) is smeared across 5 docs.

Two jobs, in dependency order:

1. **Sync to code** — fix the drift the Detect pass found (see § Drift to fix below), notably the **2
   high-severity correctness lies**: `composition_cycle` is **`409`** not `422`, and the entire
   "vestigial `datasetId`" section in `query-construction.md` is **fiction** (the code reads
   `sourceId`; `datasetId` was backfilled + dropped by migration `0002`, R79).
2. **De-fragment spine-first** — fold the 7-doc cluster to **3 living docs + 1 deferred**
   (drift report §3), establishing the **noun/model spine first**, then folding the verb/mode docs
   onto it; leave **redirect stubs** where locked round files link the merged paths.

_Track: 2 (agent-method). Pulled by ← the 6 `queries/` `OUT OF SYNC` markers (the relationships.md→R82
pattern, repeated) and [Round_82 § Feeds into](Round_82.md) — per [Evolution Rule](../../AGENTS.md)
and the [dynamic-equilibrium brake](../../context/purpose.md#dynamic-equilibrium)._

## The fold map (from R82 Detect, drift report §3 — confirmed from CODE-TRUTH)

| Doc | Fate | Rationale |
| --- | --- | --- |
| **`saved-query.md`** | **SPINE (canonical survivor)** — the full Query noun: model (`sourceId` polymorphic `ds_\|qr_`, `definition{q,filters,advanced,joins}` tree), all 7 routes, run/preview/composition engine. | Already owns the model + catalog + run path + create verbs; the noun lives here. The mode docs fold into its sections. |
| `joins.md` | **FOLD → spine** ("Join (single-edge)" subsection) + redirect stub. | Not a noun — a `JoinStep` in the spine's `joins` list. Drop the R71 truth-test ledger; keep the 1-paragraph semantics. |
| `multi-join.md` | **FOLD → spine** ("Join tree" semantics: tree topology, fold engine, effective columns, outer types) + redirect stub. | Same model — `joins: JoinStep[]` + the **tree** invariant. R73/R74 ledger compacts away. |
| `composition.md` | **FOLD → spine** ("Composed source (`qr_`)" subsection: polymorphic source, recursive resolver, cycle guard) + redirect stub. | Same `sourceId` field + same engine entry. Pure mode of the spine. |
| `query-construction.md` | **SURVIVING SIBLING** (the editable *builder* surface UX). | Folding the full builder UX into the spine would bloat it; it's a distinct **surface** doc. **Strip its fictional "vestigial datasetId" section entirely.** |
| `query-builder.md` | **SURVIVING SIBLING (the anchor)** — domain overview + reuse invariant. | Cleanest doc (0 drift); update trajectory bullets only. |
| `canvas.md` | **DEFERRED — keep labeled deferred** (do NOT fold or rewrite to code). | Describes an unbuilt surface (0% built). Only fix the `datasetId`→`sourceId` field bug in its create spec so the future build inherits correct fields. |

**Net: 7 → 3 living (`saved-query` spine + `query-construction` sibling + `query-builder` anchor) + 1
deferred (`canvas`).** 3 docs fold away behind redirect stubs.

## Drift to fix (from drift report §2 — ~22 claims)

+ **`datasetId` → `sourceId`** threaded through 5 of 7 docs (model field, create/update/preview
  bodies, R77 create-on-query body, resolve pseudocode) — `datasetId` is GONE (mig `0002`, R79);
  `sourceId` is the single canonical source field, no FK.
+ **`composition_cycle` = `409`, not `422`** (`composition.md` L93/L380) — high severity.
+ **"Vestigial `datasetId`" fiction** (`query-construction.md` L400-406) — delete; the create handler
  reads `sourceId` only.
+ **Linear-chain → tree invariant** (`multi-join.md` body) — the live rule is the connected-acyclic
  **tree** (`disconnected_join`/`cyclic_join`, left = ANY in-graph source); the linear chain is the
  degenerate path case.
+ **Canvas version stamps** (`R73`/`R75`) → canvas is design-banked **R80**, build deferred, **not
  built**.
+ Minor: `join_keys` 4-tuple (adds per-hop `kind`), `removeLastJoin`→leaf-removal phrasing.

## Judgment calls (held open)

| #   | Question | Why it's the crux |
| --- | -------- | ----------------- |
| J-1 | **Spine/mode split — confirm from CODE-TRUTH, not the R81-reverted draft.** | The R81 query-fold draft was **doc-sourced** and reverted. The split here must be code-true: the drift report §3 derived it from the router/engine/contracts (spine = `saved-query`; fold joins+multi-join+composition; siblings construction+builder; canvas deferred). **Ratify the §3 map; re-confirm at the fold from code, not the draft.** |
| J-2 | **How much builder UX stays in `query-construction.md` vs folds into the spine.** | The spine is the **model+API+engine** doc; `query-construction` is the **surface (UX)** doc. The risk is double-homing the preview/edit lifecycle. Rule: model/route/engine facts → spine; layout/debounce/per-column-funnel/create-vs-edit/save-lifecycle → sibling. Resolved at the Fix seam. |
| J-3 | **Redirect-stub anchor preservation.** | The 3 folded paths are deep-linked (with `#anchors`) by **14 references across locked round files** (R71-R81). Each stub must preserve the specific heading-anchors the round files target, not just the file path. Verify with `markdown-check-link` against the locked round files. |

## Plan (by gate)

1. **Plan gate** — ratify the fold map + spine-first order + the drift-fix list; record J-1…J-3 open.
   Commit the Plan seam. _(This step.)_
2. **Fix gate** — `design-sync` `sync` on `queries`, in dependency order, one round (the fold is one
   coherent edit; sub-seams optional if it gets large):
   + **(a) spine** — build/confirm `saved-query.md` to CODE-TRUTH: model (`sourceId`, definition,
     `joins` tree), all 7 routes + exact error codes, the tree-fold engine, the composition resolver
     + `409 composition_cycle`. Strip its stale `datasetId` field.
   + **(b) fold** — fold `joins.md` → `multi-join.md` → `composition.md` into spine sections
     (spine-first; do **not** start from the newest leaf). Replace each with a 2-line **redirect
     stub** preserving the deep-link anchors the 14 locked references target.
   + **(c) siblings** — sync `query-construction.md` (delete the "vestigial datasetId" fiction; fix
     canvas-version stamps; `datasetId`→`sourceId`) and `query-builder.md` (trajectory bullets only).
   + **(d) deferred** — `canvas.md`: keep the deferred banner; fix only the `datasetId`→`sourceId`
     field bug in its create spec.
   + Repoint live inbound links (`markdown-check-link --fix`); clear all 6 markers.
3. **Check** — gates green; **no `OUT OF SYNC` marker remains anywhere in `design/`** (R82 + R83 =
   whole corpus clean); the **14 locked-round links still resolve** via the stubs (+ their anchors);
   flip to Review → human sign-off.

## Acceptance criteria

+ [ ] `queries` **synced to the code**; the **2 high-severity correctness drifts fixed**
      (`composition_cycle` = `409`; the `datasetId` fiction deleted), `datasetId`→`sourceId`
      everywhere, the linear→**tree** invariant corrected.
+ [ ] **7→4 fold done spine-first** (`saved-query` spine + `query-construction` + `query-builder`
      siblings + `canvas` deferred); **3 redirect stubs** preserve the **14 locked-round-file link
      references** *and their deep-link anchors*.
+ [ ] **No `OUT OF SYNC` marker remains anywhere in `design/`** — the whole data-management corpus
      now matches the implementation and is ledger-free.
+ [ ] Gates green: `design:lint` 0, `design:tokens` 0, `markdownlint` 0, `markdown-check-link` 0
      broken (in scope), `plan:lint` 0.
+ [ ] **Complete = human-signed-off** (the synced + folded `queries` corpus).

## What is OUT of scope

+ **The canvas BUILD** — still deferred (R80 J-2); R83 keeps `canvas.md` labeled deferred and only
  corrects its field bug. With the corpus synced, the canvas-build gate re-opens against code-true
  docs — but ships no canvas code here.
+ **New features / new design** — sync + fold only; code is the source of truth, nothing is invented.
+ **Pre-existing broken links in locked round files** (`*.env.hbs` / `*.yaml.hbs` in Round_30/32/45,
  the `decisions/README.md` AGENTS anchor) — untouched, out of scope; not introduced by the sweep.

## Risks / unknowns

+ **Lossy fold** — consolidating joins+multi-join+composition into spine sections without dropping the
  tree / composition / outer-join semantics. _Mitigation: code-as-truth + the drift report's §3 map +
  the skill's redirect-stub rule (merge ≠ delete)._
+ **Re-deriving the spine from code, not the R81-reverted draft** (J-1) — that draft was doc-sourced.
  _Mitigation: build the spine from the CODE-TRUTH map (router/engine/contracts), confirm at the seam._
+ **Stub anchors must preserve deep-links** (J-3) — 14 references across R71-R81 target specific
  headings. _Mitigation: `markdown-check-link` against the locked round files before declaring done._

## Do

### Plan-gate ratification (2026-06-17)

_Pending — filled when the Plan seam is ratified ("proceed r83")._

## Check

+ [ ] _(Pending.)_

## Act

_Pending — filled at round close._

## Feeds into → the canvas-build gate / consumer-save + dashboard themes

With `queries` synced + folded, the **entire** data-management design corpus matches the
implementation and is ledger-free (no `OUT OF SYNC` markers anywhere). The **canvas build** gate (R80
J-2 + R81/R82's synced-corpus gate) re-opens against a code-true source model, and the downstream
**consumer-save / dashboard** themes read a clean, single-spine Query model (`saved-query.md`).
