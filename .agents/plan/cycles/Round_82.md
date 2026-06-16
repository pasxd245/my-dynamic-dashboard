# Round 82: design-sync sweep — re-sync the design corpus to code (workspaces → datasets → queries)

**Status**: In Progress — Detect done (J-1 → `queries`→R83); Fix gate underway (workspaces + datasets).
**Date started**: 2026-06-17
**Date completed**:
**Flow**: **Track-2 agent-method** — applies the [`design-sync`](../../skills/design-sync/SKILL.md)
skill across the data-management corpus. `flow-selector` (DCFBI vs DFCFBI) is **N/A** (no product
contract/BE/FE code). Gates: **Plan → Detect → Fix** (per-domain seams) **→ Check**.

## Goal

**Inherits from ← [Round_81](Round_81.md)** — R81 authored the `design-sync` skill and synced the
first domain (`workspaces.md`); it left a standing **`OUT OF SYNC` marker** on
[relationships.md](../../design/data-management/workspaces/relationships.md) as the R82 signal.

Run `design-sync` across **all three data-management domains** so the whole design corpus matches
the **actual implementation** (code is the source of truth) and is ledger-free. Approach (user):

1. **Detect first** — one `--check` pass over **workspaces → datasets → queries**: build each
   domain's CODE-TRUTH map, emit a per-domain drift report, and stamp `OUT OF SYNC` markers on the
   drifted docs. This gives the **whole drift picture before any rewrite** (and surfaces
   cross-domain drift — e.g. a rename or a persistence-foundation that hit multiple domains).
2. **Then fix one by one** — run `sync` per domain in **dependency order** (workspaces → datasets →
   queries: container → source → composer), each domain its own **commit seam**, each clearing its
   markers as it lands.

_Track: 2 (agent-method). Pulled by ← [Round_81 § Feeds into](Round_81.md) (the full-corpus sweep)
and the standing `OUT OF SYNC` marker on relationships.md — per [Evolution Rule](../../AGENTS.md)
and the [dynamic-equilibrium brake](../../context/purpose.md#dynamic-equilibrium)._

## Judgment calls (held open)

| #   | Question | Why it's the crux |
| --- | -------- | ----------------- |
| J-1 | **One round or spill `queries` to R83?** | **RESOLVED at Detect → SPILL to R83.** `queries` proved heaviest (7 docs / ~22 drifts / 2 correctness lies / the only 7→4 spine merge / 3 stubs over ~14 locked links); R82 ships workspaces+datasets, queries markers stand as R83's signal ([[round-bundling-revert-seams]]). |
| J-2 | **`queries` de-fragmentation shape.** | The 7-doc `queries/` cluster needs the skill's **de-fragment** step (§5): spine-first merge + redirect-stubs for the ~8 **locked** round files that link the merged paths. Confirm the spine/mode split **from the code**, not from the R81-reverted draft (that draft was doc-sourced; this must be code-true). Resolved at the `queries` Fix seam. |
| J-3 | **Per-domain CODE-TRUTH depth.** | `datasets` is a large surface (upload, filters, advanced-query, detail, table). Delegate a CODE-TRUTH map per domain (subagent), as in R81. `_shared/crud-hygiene.md` (workspace+dataset CRUD) and `_platform/` are cross-cutting — sync `crud-hygiene` with whichever domain pass touches it; `_platform/` is a follow-up if it drifts. |

## Plan (by gate)

1. **Plan gate** — ratify the sweep + the order + detect-first; record J-1…J-3 open. Commit the
   Plan seam. _(This step.)_
2. **Detect gate** — `design-sync --check` on each domain (`workspaces`, `datasets`, `queries`):
   CODE-TRUTH map → drift report (`.agents/tmp/design-sync/<domain>.md`) → stamp `OUT OF SYNC`
   markers on drifted docs. Tally drift volume; **resolve J-1** (one round vs spill `queries`).
   Verify `--check` stays gate-green with markers in place. Commit the Detect seam (the markers).
3. **Fix gate** — `sync` per domain, dependency order, one commit seam each:
   + **(a) workspaces** — sync [relationships.md](../../design/data-management/workspaces/relationships.md)
     to code (clear its marker; correct the persistence + declare-`422`/`409` + the mermaid branch
     labels); re-confirm `workspaces.md` still in sync.
   + **(b) datasets** — CODE-TRUTH → sync each `datasets/` doc; clear markers.
   + **(c) queries** — **SPILLED to R83** (J-1 resolved at Detect). The de-fragment spine-first (J-2)
     + sync + redirect-stubs work is R83's; the 6 `queries/` markers stand as its signal.
4. **Check** — per-domain gates green; **no `OUT OF SYNC` marker remains** in `design/` (the
   absence-of-markers *is* the in-sync signal); flip to Review.

## Acceptance criteria

+ [x] **Detect pass** run on all three domains; per-domain drift reports + markers produced; **J-1
      decided** → **`queries` spills to R83**; R82 scope = workspaces + datasets (+ `_shared`).
+ [ ] Each in-scope domain **synced to the code** (markers cleared); `queries` **de-fragmented
      spine-first** with redirect-stubs where locked round files link merged paths.
+ [ ] **No `OUT OF SYNC` marker remains** in the synced scope — the corpus matches the
      implementation and is ledger-free.
+ [ ] Gates green: `design:lint` 0, `design:tokens` 0, `markdownlint` 0, `markdown-check-link` 0,
      `plan:lint` 0.
+ [ ] **Complete = human-signed-off** (the synced corpus).

## What is OUT of scope

+ **The canvas BUILD** — still deferred (R80 J-2); this round **re-opens its gate** (a synced
  corpus) but ships no canvas code.
+ **New features / new design** — sync only; code is the source of truth, nothing is invented.
+ **`_platform/` chrome docs** — a follow-up if Detect shows they drift; not a data-management
  domain. (`_shared/crud-hygiene.md` rides along with the workspaces/datasets passes that touch it.)

## Risks / unknowns

+ **`queries` de-fragmentation is the hard part** — a lossy spine-first merge + redirect-stubs for
  ~8 locked round files. _Mitigation: code-as-truth + the J-1 spill-to-R83 option + the skill's
  documented merge rule (redirect-stub, not deletion)._
+ **Re-deriving `queries` from code, not the reverted R81 draft** — that draft was doc-sourced.
  _Mitigation: J-2 confirms the spine/mode split from the CODE-TRUTH map._
+ **Detect stamps many markers at once** — must stay gate-safe. _Mitigation: proven in R81; the
  marker is a comment, body untouched._

## Do

### Plan-gate ratification (2026-06-17)

+ **Sweep ratified** (user: "proceed r82"): run [`design-sync`](../../skills/design-sync/SKILL.md)
  across all three data-management domains so the corpus matches the **actual implementation**
  (code is the source of truth) and is ledger-free.
+ **Order ratified**: **detect-first** (one `--check` pass over workspaces → datasets → queries for
  the whole drift picture before any rewrite), **then fix one-by-one** in dependency order
  (container → source → composer), each domain its own commit seam.
+ **J-1…J-3 held open** — J-1 (one round vs spill `queries`→R83) resolved from the Detect drift
  volume; J-2 (`queries` spine/mode split) resolved at the `queries` Fix seam from CODE-TRUTH;
  J-3 (per-domain CODE-TRUTH depth) — delegate a code-read subagent per domain.
+ **`flow-selector` N/A recorded** — Track-2 agent-method (no product contract/BE/FE to gate).

### Detect-gate resolution (2026-06-17)

**CODE-TRUTH + drift** built by **three parallel subagents** (J-3: one code-read per domain) reading
the real backend / contracts / frontend, trusting no doc. Per-domain reports written to
`.agents/tmp/design-sync/{workspaces,datasets,queries}.md`. Drift tally:

| Domain | Doc | Drifted? | Claims | Headline divergence |
| --- | --- | --- | --- | --- |
| workspaces | `workspaces.md` | No | 0 | still in sync after R81 |
| workspaces | `relationships.md` | **Yes** | 4 | persistence framing pre-R78; resolved `422`; model home; mermaid `409`/`422` branches |
| _shared | `crud-hygiene.md` | **Yes** | 4 | `WorkspaceCard` home/menu frozen pre-R70; dataset delete now cascades to queries |
| datasets | `datasets.md` | **Yes** | 4 | page size 20; row-click resolved; inline surfaces; R78/R79 persistence unreferenced |
| datasets | `upload.md` | **Yes** | 9 | vanished helpers; FS layout; `200` not `201`; commit re-parses; name 1–120 |
| datasets | `dataset-detail.md` | **Yes** | 3 | DuckDB not pyarrow; inline `MetadataStrip`; stale 2-button ASCII |
| datasets | `dataset-filters.md` | No | 0 | in sync (nit only) |
| datasets | `advanced-query.md` | No | 0 | fully in sync |
| queries | `saved-query.md` | **Yes** | 4 | `datasetId`→`sourceId` (mig 0002); **spine** |
| queries | `multi-join.md` | **Yes** | 5 | linear-chain invariant vs R74 **tree** |
| queries | `joins.md` | **Yes** | 1 | `datasetId`→`sourceId` |
| queries | `query-construction.md` | **Yes** | 6 | "vestigial `datasetId`" is fiction (code reads `sourceId`) |
| queries | `composition.md` | **Yes** | 4 | `composition_cycle` is **`409`** not `422` |
| queries | `canvas.md` | **Yes** | 2 | `datasetId`→`sourceId`; surface **0% built** (deferred) |
| queries | `query-builder.md` | No | 0 | in sync |

**11 `OUT OF SYNC` markers stamped** (relationships updated 3→4; 10 new). Gates stay green with
markers in place: `design:lint` 0, `design:tokens` 0, `markdownlint` 0, `markdown-check-link` 0
broken. Detect seam committed.

+ **J-1 → SPILL `queries` to R83.** Evidence: `queries` is the heaviest by far — 7 docs / ~22
  drifted claims / 2 correctness lies (`composition` `409`-not-`422`; the `datasetId` fiction) / the
  **only** de-fragmentation (7→4 spine-first merge: fold joins+multi-join+composition into
  `saved-query.md`, keep `query-construction`+`query-builder` siblings, `canvas` deferred) / **3
  redirect-stubs across ~14 locked round-file links**. Bundling it with workspaces+datasets would
  starve the fold ([[round-bundling-revert-seams]]). R82 ships **workspaces + datasets** (+ the
  cross-cutting `_shared/crud-hygiene.md`); the queries markers stand as **R83's** signal (the R82
  relationships.md → R82 pattern, repeated). J-1's pre-ratified lean ("spill if Detect shows
  `queries` too heavy") fires.
+ **J-3 → confirmed.** No de-fragmentation needed in workspaces (two distinct nouns) or datasets
  (the rows-GET predicate stack reads as legitimate sibling modes, not one split concept).
  `_shared/crud-hygiene.md` rides with the R82 passes (both domains touch it).

## Check

+ [ ] _(Pending.)_

## Act

_Pending — filled at round close._

## Feeds into → R83 (if `queries` spills) / the canvas-build gate

A design corpus synced to the implementation and ledger-free. If `queries` spills, **R83** finishes
it. When the sweep completes, the **canvas build** gate (R80 J-2 + R81's synced-corpus gate)
re-opens against a corpus that matches the code — and the downstream consumer-save / dashboard
themes read a clean, code-true source model.
