# `queries ⇒ workflows` — a concrete Workflow module — brainstorm

> **Status: brainstorm (working conclusions, NOT locked).** Came out of a whole-circle evaluation +
> cold-review (2026-07-01) and the `hg_code` prior-art reference. Anything acted on gets a proper
> Plan/Design gate (R131) — this doc is the reasoning behind it.
>
> _Track: 1 (product — the data-shaping trajectory). Pulled by: the human ("build a concrete
> workflows module, then link with existing"), the `hg_code` reference, and R124's wall. Consistent
> with [[2026-06-26-product-value-framing]] (Polars = tier-agnostic compute; workflow = its first
> pull) and [[workflows-extend-query-duckdb-first]] (extend-query held to its edge; the wall is here)._

## How we got here (the evaluation, in one breath)

A whole-circle evaluation asked *does what we built solve the real pain?* The reframe (human): the
weak joint is the **link between pieces**, not the pieces. Cold-review flipped two of my leans
(export ≈ *fallback to Excel* → dropped; "reframe the thesis" overreached). Then the human pointed at
`hg_code` — and it reframed everything.

## The prior art — `hg_code`

An insurance-provider **consolidation ETL**: many *heterogeneous* provider Excels (BaoViet, PVI,
MIC…) → a **YAML config** per provider (parser class + `pkeys` + `sql_methods` column-mapping +
named `normal_flows`) → **Polars** transforms + **fuzzy** address normalization (`thefuzz`,
`anyascii`) → **consolidated Excel out**. In one line: **config-driven, multi-source, non-SQL-capable
data _consolidation_, producing a deliverable.** It is exactly R124's "wall" made real (Polars, fuzzy,
multi-input, materialized output).

## The key insight — progressive structuring (`queries ⇒ workflows`)

`hg_code` goes `raw Excel → workflow`, so it crams *everything* (parsing, typing, mapping, joins,
transforms) into one heavy config. **We have a better structure**: `Excel → dataset → query →
workflow`. Each layer pays down structure — **dataset** (parse + type), **query** (join + filter +
governed rels + SQL-shape) — so a **workflow's inputs are already clean, typed, structured queries.**
Our workflow is a **focused last-mile transform layer over queries**, not a mega-ETL blob. Better
structure than the prior art.

## What the Workflow noun IS

```
Excel → dataset → query → WORKFLOW → dataset′ → query/dashboard
                          (consolidate · transform · materialize)
```

A **Workflow** (`wf_`) takes **≥1 query as input**, applies **steps** (reuse the R120–R130 engine),
and produces a **materialized output** (a produced dataset) that the existing `ws → dataset → query →
dashboard` chain consumes. **The link falls out of the existing seams**: input = a query (the
readable-table-source seam); output = a dataset (the chain already charts datasets). The circle grows
a **loop**.

## What's genuinely NEW (the real work — and the honest caveat)

Standing on queries, most "heavy" is reachable; the novelty is **materialization + the loop + multi-
input**, more than "a new compute engine":

- **Materialized output + captured schema** — the defining feature (and R124's wall): the output is a
  *produced* table (parquet + a frozen schema), not a live virtual view. Enables run-once-reuse, the
  Excel deliverable, and (later) pivot's data-dependent columns (frozen at run).
- **Multi-query input** (consolidation — union/join several queries) — mostly SQL.
- **Excel deliverable** — the *produced artifact*, exportable. NOT "fallback to Excel" (the human's
  rejection stands): you're shipping a result, not returning to spreadsheet-analysis.
- **DuckDB-first; Polars RESERVED.** Even fuzzy/dedupe may be SQL (DuckDB has `levenshtein` /
  `jaro_winkler_similarity`). Same discipline as the whole arc — probe the producer before pulling
  Polars. The honest finding may again be "not yet."

## Telos check + the one design fork (for R131)

`hg_code` is **power-analyst-shaped** (YAML + SQL + Python) = the parked **#3 heavy-DA surface**, NOT
the **#1 basic-Excel-leader, formula-free** product. The reconciliation keeps both: **Workflow is a
distinct module, but its UX stays #1-ease** — a formula-free builder (reuse `StepsEditor`), NOT YAML.
The **power/YAML (#3) authoring is deferred** (a later option if a real analyst pull arrives). So:

- **Locked lean (confirm at R131):** materialized output; DuckDB-first; reuse the steps engine +
  `StepsEditor`; ease-first UX; a real new noun (`wf_`, table, migration) — justified now (needs-
  driven: the wall + materialization + multi-input pull it; the first noun this arc adds).
- **Open for R131:** materialize storage shape + refresh semantics; how the output surfaces as a
  source (a `wf_`-kind readable source vs a produced `ds_`); multi-input consolidation (union vs join).

## The 5-round sketch (refined — each a 1-shot commit)

1. **R131 — Plan/Design gate.** The Workflow noun: model (`wf_`, inputs = queries, steps, materialized
   output + captured schema), the locked decisions above, acceptance criteria. Docs only.
2. **R132 — Backend noun + CRUD.** `wf_` id (values.yaml → constants) + a `workflows` table
   (migration) + models + create/list/get/delete + contract + tests. A single-query, no-step workflow
   = passthrough (proves the noun end-to-end, reusing `resolve_source` for the query input).
3. **R133 — Run → materialize.** A workflow *run* applies its steps over the resolved source →
   **writes parquet + captures the output schema**; a run/refresh action; rows read from the
   materialized output. (The wall-crossing.)
4. **R134 — Multi-query input + output-as-source.** Consolidate ≥1 query (union); the materialized
   output **surfaces as a readable source** the existing query/dashboard chain consumes (loop closes).
5. **R135 — FE.** A Workflows catalog + builder (reuse `StepsEditor`) + the **Excel deliverable**
   (export the materialized output — the artifact).

_(May flex to 6 if the migration + FE want isolation; each round stays thin + independently committed.)_

## Open questions (resolved at the R131 gate, not here)

- Materialize storage + refresh: re-run on demand? staleness flag? (mirror the query stale-flag model).
- Output identity: does a workflow output get a `ds_` (a real produced dataset) or a `wf_`-source the
  resolver reads? (affects how widgets/queries bind to it.)
- Multi-input: union (same-schema consolidation, the hg_code case) first; join later?
- Does materialization finally pull **Polars**, or does DuckDB (incl. its fuzzy fns) still suffice?
