# Round 124: workflows exploration — finding the wall (pivot breaks the query model)

**Status**: Review
**Date started**: 2026-06-30
**Date completed**:
**Flow**: Exploration / decision (no code) — the stated mission: *push step kinds until a query
can't express the shaping; that wall pulls a Workflow noun.*

## Goal

**Inherits from ← [Round_123](Round_123.md)** — R120–R123 absorbed four step kinds into the
query-steps model with **zero** Polars and **no** new noun. The human's mission: keep going **to
hit the wall**. This round reports the wall — and it is **pivot / crosstab**.

_Track: 1. Pulled by ← the human's "try to hit the wall" directive (2026-06-30). The wall is the
deliverable, per [[query-is-virtual-dataset]] ("once a query can't adapt → a Workflow noun")._

## What still FITS (no wall) — the query-steps model is broad

Every transform whose output is a **single table with a schema knowable from the definition +
input schema alone** absorbs cleanly as a step (SQL, typed-chained, static columns):

| Transform | SQL | Output columns knowable statically? | Verdict |
| --- | --- | --- | --- |
| aggregate (R120) | `GROUP BY` | yes (dims + measures) | ✅ shipped |
| top_n (R121) | `ORDER BY … LIMIT` | yes (unchanged) | ✅ shipped |
| derive (R122) | arithmetic | yes (+1 named col) | ✅ shipped |
| filter (R123) | `WHERE` | yes (unchanged) | ✅ shipped |
| sort | `ORDER BY` | yes (unchanged) | would fit |
| dedupe / distinct | `DISTINCT` / `QUALIFY` | yes (unchanged) | would fit |
| window (running total, rank) | `… OVER (…)` | yes (+1 named col) | would fit |
| unpivot / melt | `UNPIVOT` | yes (fixed names) | would fit |
| fill-nulls / impute | `COALESCE` / window | yes (unchanged) | would fit |

So the model is **not** near its limit on breadth — these are all the same shape (one table, static
schema). Grinding them out wouldn't find a wall.

## THE WALL — pivot / crosstab (data-dependent output schema)

**Pivot** (`PIVOT t ON region USING SUM(amount)`) is SQL-expressible in DuckDB — but its **output
columns are the DISTINCT VALUES of the pivot column** (one column per region: `EMEA`, `APAC`, …).
That is **data**, not schema. This breaks the query model on **three** contracts at once:

1. **Static column resolution.** `_step_plan` / `_resolved_columns` compute a query's effective
   columns from *definition + input schema, with NO data scan*. A pivot's columns can't be known
   without scanning the data — the validator/column-resolver structurally cannot produce them.
2. **Stable columns.** A saved query's `resolvedColumns` is a stable contract: widgets bind to
   column NAMES, a downstream join references effective names. A pivot's columns **change when the
   data changes** (a new region appears → a new column) → silent downstream breakage.
3. **Cheap metadata.** `get`/`list` compute `resolvedColumns` without touching parquet. Pivot would
   force a data scan into every metadata read.

A pivot is therefore **not a virtual-query transform** — it only makes sense as a **materialized
output whose schema is CAPTURED at run time** (compute once → freeze the columns into a produced
dataset). That is exactly the construct a Query is *not*. **This is the Workflow-noun trigger
firing.**

Two adjacent walls confirm the boundary:

- **Multi-output** — a Query is ONE virtual table; a transform that emits several tables (split,
  branch) can't be a query. (No demand yet — contrived to add.)
- **Non-SQL compute** — fuzzy match / dedupe-by-similarity / regression / rolling-apply aren't SQL.
  That's the **Polars** pull (compute engine), orthogonal to the noun wall.

## The decision the wall pulls (for the human)

The query-steps model covers all **static-schema, single-table, SQL** shaping — a large, valuable
space (R120–R123 + the "would fit" list). The wall is **data-dependent / multi-output / non-SQL**
output. That pulls a **`Workflow` noun**, distinct from a Query:

- **Materialized + schema-captured** — runs the pipeline, writes a result (parquet), records the
  resulting columns; downstream binds to the *captured* schema (stable), not a live re-derivation.
- This is where **pivot** lives, where **multi-output** could live, and the natural home for a
  **Polars** step (non-SQL compute) when one is pulled.

So the boundary is clean: **Query = live, static-schema, SQL shaping (steps); Workflow = materialized,
schema-captured, may host non-SQL.** R119–R123 deliberately built the Query side to its edge; the
edge is here.

## Plan

- [x] Push step kinds conceptually to the limit; identify which break the model.
- [x] Name the wall (pivot — data-dependent output schema) with the precise contract it breaks.
- [ ] **Human decision:** introduce a `Workflow` noun (materialized, schema-captured) for
      pivot / multi-output / non-SQL? Or defer until a concrete pivot/multi-output product pull?

## Risks / unknowns

- **Don't build the noun speculatively.** Per the default-don't-add + needs-driven-rungs doctrine,
  the Workflow noun should land when a real pivot / multi-output pull arrives — the wall says WHERE
  it goes, not that it must be built now.

## Do

Analysis only (no code). The four shipped step kinds + the "would fit" set establish that the
query-steps model's limit is **not breadth of SQL ops** but **the static-schema, single-table,
live-virtual contract**. Pivot is the minimal transform that violates it (§THE WALL).

## Check

- [x] The wall is named and grounded in the actual column-resolution architecture (`_step_plan` /
      `_resolved_columns` are data-free) — not a hand-wave.
- [x] The fitting set vs the wall is a crisp, decidable boundary (static-schema SQL vs
      data-dependent / multi-output / non-SQL).

## Act

**Learnings:**

- **The wall is architectural, not SQL-capability.** DuckDB *can* pivot; the QUERY MODEL can't carry
  a data-dependent output schema (stable, scan-free `resolvedColumns`). The limit is the contract,
  which is the right place for it.
- **Extend-query was the correct default** — it absorbed every static-schema SQL transform with no
  new noun, no Polars, no migration. The noun earns its place only at the wall.

**Promotions:** none — extends the [[workflows-extend-query-duckdb-first]] memory (the wall is now
located, not just predicted).

**Prune check:** nothing pruned.

## Feeds into → Round_125 (TBD)

Awaiting the human's call on the `Workflow` noun (materialized / schema-captured). If green-lit, R125
designs it (Plan gate) for pivot as the first materialized transform; else the theme pauses at a
complete, shipped Query-steps shaping engine and the FE step-builder (the flagged feel-surface) is
the next product round.
