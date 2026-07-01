# Round 130: workflows — design-sync the queries doc + prune

**Status**: Complete
**Date started**: 2026-06-30
**Date completed**: 2026-07-01
**Flow**: DCFBI — docs + prune; no product code.

## Goal

**Inherits from ← [Round_129](Round_129.md)** — close the query-steps workflow arc (R120–R129) by
syncing the `data-management/queries` design doc to the shipped steps engine + builder (design docs
are current-state, [[design-docs-are-source-code]]) and pruning the leftover unused i18n key.

_Track: 1. Pulled by ← the usability arc's close._

## Plan

- [x] Prune the unused `queries.builder.steps.joinedNote` i18n key (en + vi; superseded by R129).
- [x] `queries.md`: add a "Transform steps (workflows)" section (the `steps` model · the typed
      `run_steps` engine · post-step `resolvedColumns` + preview `baseColumns` · per-step drift
      semantics · the `/aggregate` route · the pre-shaped widget consumer · the deferred wall);
      add the `/queries/{id}/aggregate` route + steps notes to the Routes table; bump Status; add
      the Workflow-noun wall to Scope § OUT.

## Risks / unknowns

- **Doc drift if the engine changes** — kept the section to the shipped shape (4 kinds, DuckDB,
  base/result columns); future step kinds extend the union + this list.

## Do

**Built:** removed `joinedNote` (both locales; 23 keys each, validated). Synced `queries.md` —
Transform-steps section, `/aggregate` route row, `/rows` + `/preview` steps notes, Status
"(extended R120–R129)", Scope-OUT Workflow-noun wall.

**Verification:** `design:lint` 0 · `design:tokens` 0 · `markdownlint` 0 · both locale JSONs parse
(steps = 23 keys, no `joinedNote`) · no code references the pruned key.

## Check

- [x] `design:lint` / `design:tokens` / `markdownlint` all 0.
- [x] Locale JSONs valid; no dangling reference to the pruned key.
- [x] `queries.md` reflects the shipped steps engine + the deferred Workflow-noun wall.

## Act

**Learnings:**

- **The arc closes coherently** — R120–R129 took "workflows" from a deferred YAML+Polars subsystem to
  a shipped, DuckDB-only, query-steps shaping engine (aggregate · derive · filter · top_n, chained)
  with an authoring builder usable across all query shapes, a pre-shaped widget consumer, a seeded
  demo, and a located wall (pivot → a future materialized `Workflow` noun). Zero Polars; extend-query
  vindicated to its edge.

**Promotions:** none — the durable lesson is captured in [[workflows-extend-query-duckdb-first]].

**Prune check:** pruned the `joinedNote` i18n key (R129 superseded it).

## Feeds into → Round_131 (TBD)

The query-steps workflow theme is complete + documented. Next, per the human's earlier framing:
iterate the **weakest joint** in the now-closed product circle (candidates: the data-profile
"understand your data" step; the BYO-AI / spec substrate; or — when a concrete pivot/multi-output
pull arrives — the materialized `Workflow` noun at R124's wall).
