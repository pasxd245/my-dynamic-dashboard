# Round 135: Multi-query consolidation + output-as-source

**Status**: Review
**Date started**: 2026-07-01
**Date completed**:
**Flow**: **DCFBI** — Contract + Backend (no UI); closes the loop.

## Goal

**Inherits from ← [Round_134](Round_134.md)** — the workflow verb materialized ONE source. Now make
the noun what `hg_code` proves it should be: **consolidate ≥1 source into one output**, and let that
materialized output be **read back as a source**. Two moves in one coherent feature:

1. **Multi-query input** — a workflow's `sources` (≥1) are stacked with `UNION ALL BY NAME` (the
   same-schema consolidation the module exists for: many period/provider exports → one table).
2. **Output-as-source** — a `wf_` id resolves as a LEAF that reads the workflow's frozen
   `output.parquet`, so a workflow can source another workflow's output. The `queries ⇒ workflows ⇒
   (source again)` loop closes.

_Track: 1. Pulled by ← the brainstorm's `hg_code` reframing (consolidation module standing on
structured queries) and R124's "wall". Reuses the R133 engine — `resolve_source` gains a `wf_` leaf
branch; a new `build_consolidated_relation` unions per-source inner relations._

## Plan

- [x] `resolve_source` — `wf_` LEAF branch (reads materialized `output.parquet`; un-run = missing
      base). No recursion into the workflow's definition → no cycle possible (frozen output).
- [x] `_is_multi_source` — route a bare `wf_` through the resolver (like `qr_`).
- [x] `build_consolidated_relation` — resolve each source, stack with `UNION ALL BY NAME`; `columns`
      is the first source's space (declared consolidation schema).
- [x] `run_workflow` — consolidate ALL sources (not `sources[0]`); step-fold + materialize unchanged.
- [x] `_validate_sources` (create) — accept `qr_` OR `wf_` in-workspace.
- [x] Widen `WorkflowDefinition.sources` pattern (`^(qr_|wf_)…`) — model + `workflow.yaml`.
- [x] pytest (union stacks rows; wf-output-as-source; un-run source → 409; unknown wf source → 422).

## Risks / unknowns

- **`UNION ALL BY NAME`, not positional** — tolerates column-order differences between sources; a
  genuinely divergent schema is best-effort (missing columns read NULL). v1 assumes same-shape
  sources (the consolidation case); a heterogeneous-schema mapper is a later pull.
- **`wf_`-as-source is a LEAF, not composition** — it reads the FROZEN parquet, never the workflow's
  live definition. So there is no recursion and no cycle: a stale self/loop reference just reads prior
  output. An un-run source workflow has no output → `composition_base_missing` → 409 on run.
- **Source-id pattern spelled literally** (`^(qr_|wf_)[0-9a-f]{8}$`) in model + contract rather than a
  generated constant — a v1 alternation of two existing shapes; centralize if it spreads
  ([[config-value-home-heuristic]]).

## Do

**Built:** consolidation plus the closing loop. A workflow now unions ≥1 source (`qr_` and/or `wf_`)
into one relation before its steps run; a materialized `wf_` output resolves as a leaf source, so
workflows compose over each other's frozen outputs. `resolve_source` gained one leaf branch;
`build_consolidated_relation` does the `UNION ALL BY NAME` fold; create-validation and the source-id
pattern widened to admit `wf_`.

**Verification:** backend `pytest` **281 pass** (4 new: union doubles a self-consolidated count,
wf-output-as-source matches the upstream count, un-run source → 409 `query_stale`, unknown `wf_`
source → 422) · `ruff` clean · FE vitest **249 pass** (widened `sources` pattern dereferences; no
regression).

## Check

- [x] Backend 281 (4 new); ruff clean; no regression.
- [x] Union stacks rows; `wf_` output reads back as a source; loop closes.
- [x] Un-run / unknown sources fail correctly (409 / 422); contract dereferences.

## Act

**Learnings:**

- **The loop closes with ONE leaf branch.** Because a workflow output is MATERIALIZED (R134), reading
  it back is a `read_parquet` leaf — identical to a dataset — not a recursive resolve. Materialize-
  then-read is what makes composition-over-workflows trivial and cycle-free.
- **Consolidation is a `UNION ALL BY NAME` over the SAME engine** — no new execution path, just one
  more way to combine already-resolved relations. The engine's "resolve a source to a typed relation"
  seam absorbed both new capabilities.

**Promotions:** none — extends the R131 design on the R133/R134 seams.

**Prune check:** nothing pruned.

## Feeds into → Round_136

The backend module is whole (consolidate · transform · materialize · read-back). R136 is the FE: a
Workflows catalog plus builder (reuse `StepsEditor`) and the **Excel deliverable** (value-out) — the
first user-facing surface for the `queries ⇒ workflows` module.
