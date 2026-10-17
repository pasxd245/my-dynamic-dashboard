# design-sync — queries (full sync)

**Date:** 2026-10-17 · **Branch:** `release/v0.0.1-rc.3` · **Mode:** sync (default)
**Domain:** `.agents/design/data-management/queries/` — `queries.md`, `query-construction.md`, `canvas.md`
**Method:** code is the source of truth. Claims checked against
`routers/queries.py`, `query_engine.py`, `ingest/rows_reader.py`, `ingest/export.py`,
`models/common.py`, `db_models.py`, `alembic/versions/*`, contracts `_shared/query.yaml` +
`queries/*.contract.yaml`, builder `features/data-management/queries/*`, `api/queriesApi.ts`,
`i18n/locales/{en,vi}.json`. Docs were last synced at R176 (commit `5334c81`); code drift comes
from R175 (partly), R180, R181, R182, R183, R184 — plus pre-existing drift found on the way.

(Supersedes the 2026-06-17 detect report that previously lived at this path.)

---

## 1. Drift — doc says X / code does Y

### queries.md

| # | Category | Doc said | Code does |
|---|---|---|---|
| Q1 | added route | 8 routes; no totals / export | `POST /queries/{id}/totals` (Σ numeric columns over the **post-step** relation under dashboard filters → `{sums, rowCount}`; 422 unknown/non-numeric column) and `POST /queries/{id}/export` (CSV/XLSX of every row of the post-step filtered relation, typed cells, totals row, XLSX `Filters` sheet, `percent` formatting; cap `EXPORT_MAX_ROWS` = 100 000 → `422 export_too_large {rows, max}`) — `_final_relation`, `ingest/export.py` |
| Q2 | added param | rows-get has only `page`/`page_size` | `unpaged=true` — one response capped at `DASHBOARD_MAX_ROWS` (10 000), `total` = full count |
| Q3 | added error code | top-level codes: not_found, name_taken, query_stale, step_invalid, relationship_stale | + `export_too_large` |
| Q4 | behaviour | totals/export not described; aggregate "over a raw query" | aggregate reads the **pre-step** relation; totals/export read the **post-step** relation; on totals/export a step drift maps to `409 query_stale` (not `step_invalid`) |
| Q5 | added step kind | 9 kinds (aggregate … window_column) | 13 kinds: + `compute` (R184, `fn: trim`, U+00A0-aware, all-space → NULL, `wrong_dtype` / `unknown_function` / `unknown_column` / `column_exists`), + `case`, `date_part`, `date_diff` (R175, never documented in the spine) |
| Q6 | behaviour frozen | `group_column.by: []` not allowed; planner guard `group_by_required` | empty `by` = whole table (`OVER ()`), builder shows "Across everything"; `group_by_required` no longer exists in the planner |
| Q7 | stale limit | `_MAX_STEPS` referenced, no value | 24 (`too_many_steps`) |
| Q8 | stale error code | `prior_period_order_desc` | `window_order_desc` (+ full window vocabulary: `window_col_forbidden/required`, `window_order_forbidden/required/single/not_date`, `window_unit_forbidden`, `unknown_granularity`, `unknown_window_op`) |
| Q9 | stale field | `FilterAtom = {col, dtype, op, val?, min?, max?}` | + `vals` (in / not_in, ≤500) and `refCol` (column operand) — R176 |
| Q10 | stale enum | cardinality `one_to_one / one_to_many / many_to_many` | + `many_to_one` (migration `0004`) |
| Q11 | stale type | FE `type DsId`, `sourceId: DsId` | FE `sourceId: string` (contract pattern `^ds_…`) |
| Q12 | stale claim | `resolvedColumns` present "when multi-source" | present when joined **and/or stepped** (post-step, no provenance); carries `ownerSourceId`/`sourceColumn` on joined columns |
| Q13 | stale claim | "Alembic carries one revision — `0001_baseline`" | `0001`–`0007`; `queries` created by `0001`, untouched by later revisions |
| Q14 | stale claim | engine uses `duckdb.connect(":memory:")` | `duck.connect()` (pins `preserve_insertion_order`); paged order per `_paging-and-order.md` |
| Q15 | added error status | PUT: 404 only when the query is absent | PUT and rows also 404 when the driving dataset is gone (`source_missing`) |
| Q16 | added surface | — | `MetadataPanel` (R180) on the detail view; `queriesApi` totals/export/unpaged clients |
| Q17 | behaviour | detail state diagram has no step state | `409 step_invalid` renders its own stale page with the step hint |
| Q18 | ledger | Status line + D5/R166–R168 blockquotes, dated human decisions, acceptance-walk narration, "verified against data/app.sqlite 2026-08-13", "relocated step-drop bug … deferred to the Workflow round" (repaired R168) | removed; living rationale kept de-attributed |
| Q19 | stale scope | "Excel export of a Query result; dashboards → downstream" OUT of scope | built (export route; dashboards consume aggregate/totals/export/unpaged) |
| Q20 | heading | `Composed source (qr_) — RETIRED at R167` | renamed `Composed source (qr_)` — also repairs 3 pre-existing broken links in Round_76/77 (`#composed-source-qr_`) |

### query-construction.md

| # | Category | Doc said | Code does |
|---|---|---|---|
| C1 | behaviour | base `<Select>` "picks the driving sourceId (a Dataset or a Query)"; ASCII "base: ds_ or qr_" | base `<Select>` is **disabled** (fixed at create; PUT is definition-only), flat datasets list |
| C2 | stale surface | canvas "design banked, build deferred" | built (Canvas tab) |
| C3 | layout | two collapsible sections Build + Preview | `[Form] [Canvas]` tabs; Form = Build · Transform · Preview sections |
| C4 | stale menu | `[Add step ▾]` "12 entries"; Add-a-column group of 7 | 16 entries; Add-a-column = Group value · 4 window ops · Computed column · Conditional column (IF) · **Clean text** (R184) · Date bucket · Part of a date · Time between dates |
| C5 | added card | — | "Clean text" card (`compute`): New column name · Function (Trim spaces) · of (string columns only), hint line, default `<col>_clean` |
| C6 | added cards | — | `case`, `date_part`, `date_diff` cards (R175) |
| C7 | behaviour frozen | "`within each` takes ≥1 column — not optional" | empty → "Across everything" |
| C8 | stale code | "preview path maps every bad step to `409 query_stale`" | `409 step_invalid`, own page-level message (`queries.builder.stepInvalid`) |
| C9 | added behaviour | — | `JoinWithRelatedModal` shows a multiplication warning from the relationship self-check (R183) |
| C10 | stale scope | "rest of the within-group family → program item 2" OUT of scope | built |
| C11 | contradiction | "Join option labels — not yet built" heading, then "Built (R171)" | built; folded into the layout |
| C12 | ledger | R-stamps, Round_162/163 links, "Create mode: deleted" history section | removed; "no create mode" stated in present tense |

### canvas.md

| # | Category | Doc said | Code does |
|---|---|---|---|
| K1 | stale enum | cardinality without `many_to_one`; inference "exactly one key-like → one_to_many" | `inferCardinality`: left-only key → `one_to_many`, right-only key → `many_to_one` |
| K2 | stale label | edge badge `1:1 / 1:n / n:n` | `relationships.cardinality.*` = `1:1 / 1:many / many:1 / many:many` |
| K3 | stale claim | node `<Tag>` `Dataset` / `Query` + filter icon for a query | `Dataset` only, table icon |
| K4 | stale claim | `[+ Add a source]` "(grouped Datasets / Saved queries)" (a11y) | flat datasets list |
| K5 | contradiction | "Data contract: consumes the resolver's column provenance… to orient a query-column draw" | canvas reads no provenance (stated elsewhere in the same doc) |
| K6 | stale claim | canvas mounts on `useQueriesQuery` | `useRelationshipsQuery` + `useDatasetsQuery` only |
| K7 | stale criteria | acceptance #1 "(dataset or saved query)", #5 "derived", #12 retired-criteria record | dataset only; `derived` route gone; #12 removed |
| K8 | ledger | R97/R166/R167/R171 stamps, "what the symmetric canvas cost to keep" section, Track/Pulled-by block | removed; one-line rationale kept |

---

## 2. Code / contract findings (not doc errors — reported, not fixed)

1. **FE copy still offers saved queries.** `queries.builder.baseSourcePlaceholder` = "A dataset or a saved query" (VN "Một tập dữ liệu hoặc một truy vấn đã lưu") and `queries.builder.canvasHelpAddSource` = "…another dataset or saved query…" — both pickers offer datasets only.
2. **`ComputeStep.fn` is `Literal["trim"]` in the request model**, so `unknown_function` is reachable only by re-planning a stored definition (planner backstop), never from a request (which gets a plain FastAPI 422).
3. **Stale backend docstrings**: `models/common.py` `WindowColumnStep` docstring still says `group_by_required` guards `group_column`; `routers/queries.py` module docstring lists "Five endpoints"; preview docstring says sourceId "ds_ or qr_"; `db_models.Query.source_id` comment still says "a `qr_` for a composed one".
4. **`totals` / `export` map a step drift to `409 query_stale`**, while rows/preview use `409 step_invalid` — consistent with their contracts, but the dashboard cannot tell a drifted step from a drifted predicate on those two routes.
5. Delete and Duplicate on the query detail still have no `onError` (documented as current behaviour).

---

## 3. Anchors preserved for inbound links

`#joins-reading-related-datasets-as-one`, `#the-trajectory-what-queries-grows-into`,
`#the-reuse-invariant-the-one-rule-this-domain-holds`, `#join-tree-topology`, `#join-types`,
`#execution-model-live-re-run-no-materialization`, `#data-model`, `#scope-boundary`,
`query-construction.md#the-within-group-column`. **`#transform-steps-workflows--r120r141` keeps its
legacy heading text** ("Transform steps (workflows) — R120–R141") because locked `Round_144.md` and
the live `datasets/upload.md` link it and the link checker has no HTML-anchor support.
`#duplicate-r166-make-a-variant-without-rebuilding-it` (only self-linked) became
`#duplicate-make-a-variant-without-rebuilding-it`.

## 4. Gates

`prettier --write` (4 files) · `pnpm design:lint` 0 errors · `pnpm design:tokens` 0 parity errors ·
`markdownlint-cli2` 0 errors · `pnpm check:links` 18 → 15 broken (no new; 3 Round_76/77 links
repaired). No OUT-OF-SYNC marker on any synced doc.
