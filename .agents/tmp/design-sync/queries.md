# Detect — queries (CODE-TRUTH + drift)

**Date:** 2026-06-17
**Domain:** `data-management/queries/` (7 design docs, ~3,931 lines)
**Method:** code is the source of truth. Every fact below was read from the
router / models / engine / contracts / FE; docs were trusted for nothing.

---

## 1. CODE-TRUTH map

### 1.1 Routes (router: `workspace/apps/backend/app/routers/queries.py`)

| Method | Path | Request body fields | Success | Error statuses + exact `code` |
|---|---|---|---|---|
| POST | `/workspaces/{id}/queries` | `name`, `sourceId`, `definition` (`CreateQueryBody`) | `201` → `Query` (`model_dump(exclude_none=True)`) | `409 name_taken` (`ApiErrorNameTaken`); `409 composition_cycle` (`ApiErrorCompositionCycle`); `422` FastAPI validation envelope — unknown/cross-ws source, bad atom, or join reason (`unknown_relationship`/`cross_workspace_relationship`/`disconnected_join`/`cyclic_join`/`relationship_stale`/`relationship_dataset_missing`/`composition_base_missing` folded into the `detail[].msg`) |
| GET | `/workspaces/{id}/queries` | — | `200` → `Query[]`, `ORDER BY created_at DESC, id DESC` | (none — list never errors on per-row resolve; `resolvedColumns` simply omitted) |
| GET | `/queries/{id}` | — | `200` → `Query` | `404 not_found` (`ApiErrorNotFound`) |
| GET | `/queries/{id}/rows` | query params `page` (ge=1), `page_size` (default 50) | `200` → `RowsPage` `{rows, page, pageSize, total}` | `404 not_found`; `409 query_stale`; `409 relationship_stale`; `409 composition_cycle`; `422` for bad `page_size` (not in `PAGE_SIZES`) |
| POST | `/workspaces/{id}/queries/preview` | `sourceId`, `definition` (`PreviewQueryBody`); query params `page`,`page_size` | `200` → `{rows,page,pageSize,total}` **+ `resolvedColumns`** when multi-source | `409 query_stale`; `409 relationship_stale`; `409 composition_cycle`; `422` (structurally-bad source/edge, bad `page_size`) |
| PUT | `/queries/{id}` | `definition` only (`UpdateQueryBody`) | `200` → updated `Query` | `404 not_found`; `409 composition_cycle`; `422` (bad atom / join reason). **No `name_taken`** (definition-only). |
| DELETE | `/queries/{id}` | — | `204` no body | `404 not_found` |

**preview vs rows-get distinction (confirmed):** `rows-get` (`GET /queries/{id}/rows`) re-runs a **persisted** definition and returns a bare `RowsPage` (never `resolvedColumns`). `preview` (`POST .../queries/preview`) runs an **unsaved** body and **adds `resolvedColumns`** only on the multi-source branch (single-source preview omits it). Both share `_execute_chain` / `query_dataset_rows`.

**Error `code` strings actually emitted** (from `app/_generated/constants.py` ERROR_CODES, via Pydantic models in `models/common.py`): `not_found`, `name_taken`, `query_stale`, `relationship_stale`, `composition_cycle`. Note `disconnected_join` / `cyclic_join` / `unknown_relationship` / `cross_workspace_relationship` / `relationship_dataset_missing` / `composition_base_missing` are **internal reason strings**, NOT response codes — they are folded into a `422` FastAPI `detail[].msg` (create/update/preview structural branch), never returned as a top-level `{code}` envelope. At **run** time they collapse to `409 relationship_stale` (the catch-all for any non-cycle resolve failure).

### 1.2 Saved-query model + join/chain representation (persisted)

- **Table** `queries` (`db_models.py` SQLModel `Query`): `id` (PK, Text), `workspace_id` (Text, FK→workspaces ON DELETE CASCADE), **`source_id`** (Text, **NOT NULL, NO FK** — polymorphic `ds_|qr_`), `name` (Text), `definition_json` (Text), `created_at` (Text). Constraints: `CHECK(length(name) BETWEEN 1 AND 120)`, `idx_queries_workspace_id`, `idx_queries_name_unique (workspace_id, name) UNIQUE`.
- **`dataset_id` is GONE.** Migration `0002_query_source_id.py` (down_revision `0001_baseline`) backfills `source_id = dataset_id`, **drops** `dataset_id` (column + FK + `idx_queries_dataset_id`), and sets `source_id NOT NULL`. So `source_id` is the **single canonical** driving-source field; there is no `dataset_id` column, no `dataset_id` FK cascade. The dataset-delete→query cascade moved to the **app layer** (`routers/datasets.py`, R79).
- **Persisted definition** (`definition_json`, model `QueryDefinition`): `{ q?: str|null (≤200), filters: FilterAtom[], advanced: FilterAtom[][], joins: JoinStep[] = [] }`. `FilterAtom = {col≥0, dtype, op, val?, min?, max?}`. `JoinStep = {relationshipId, type: "inner"|"left"|"right"|"full" = "inner"}`. Legacy single `join` key is folded to a length-1 `joins` on read by a `model_validator` (`_fold_legacy_join`); new writes always use `joins`.
- **Join/chain representation actually stored:** an **ordered list `joins`** of `{relationshipId, type}`. There is no stored left/right dataset or tree-structure field — the **tree topology is implicit**: each hop's left/right comes from its `Relationship` row at resolve time (`_resolve_chain`). Hops are stored in topological order. A single join = length-1 list.
- **Persistence is raw `sqlite3` + Pydantic**, not SQLModel ORM at the router (router uses `get_conn()` raw SQL). The schema-of-record is SQLModel (`db_models.py`); Alembic migrates prod, `create_all_for_tests()` builds tests.

### 1.3 Join + composition semantics (engine: `app/ingest/rows_reader.py`, resolver: `queries.py`)

- **Join types supported:** `inner` / `left` / `right` / `full` — `_JOIN_KEYWORDS` maps to `INNER JOIN`/`LEFT JOIN`/`RIGHT JOIN`/`FULL OUTER JOIN`. Unknown kind defaults to INNER.
- **Topology: connected acyclic TREE (R74), not linear chain.** `_resolve_chain`: each hop's left dataset must be a member of **some source already in the graph** (`left_idx = next(... if rel.left in ids)`; else `disconnected_join`); its right must be new (else `cyclic_join`). `join_keys[k] = (left_idx, left_col, right_col, type)` — the ON-clause joins `T{k+1}` against `T{left_idx}` (`build_joined_select`). The linear chain is the degenerate path case.
- **Join-key drift check:** `_compatible(_dtype_of(left, rel.left_column), _dtype_of(right, rel.right_column))` — a missing/incompatible key → `relationship_stale`.
- **Composition (Query-on-Query) is REAL and built (R76).** `resolve_source` resolves a `qr_` driving source by recursively resolving its base query's own chain + baking its OWN filters into a parenthesized sub-relation (`(SELECT ...) AS T0`), exposing the base's EFFECTIVE columns. Recursion is cycle-guarded via `visited: frozenset` → `composition_cycle`. Joins onto a composed base extend from datasets *inside* the base (provenance via `dataset_id_sets`).
- **Effective columns:** `build_effective_columns` concatenates all sources' columns; names colliding across 2+ sources are qualified `Dataset.col` (e.g. `Deals.id`); unique names stay bare. `select_exprs` alias `T{i}."x" AS "effective_name"` so predicates reference effective names.
- **`_is_multi_source(source_id, chain)` = `source_id.startswith("qr_") or bool(chain)`** — a bare `ds_` with no hops takes the single-source `query_dataset_rows` path; anything else takes the joined/composed `query_joined_rows` path.

### 1.4 Frontend (all feature-local under `builder/src/features/data-management/queries/`)

| File | Role | Home |
|---|---|---|
| `QueriesPage.tsx` | catalog list at `/data-management/queries` | reuses `@mdd/ui` `PageHeader`/`PageCard` + AntD `<Table>`; "All" view fans out via `useQueries` |
| `QueryDetailPage.tsx` | detail at `/queries/:id` — read-only summary + run rows + inline Edit mode | reuses `@mdd/ui` shells + feature-local `<PagedRowsView>` |
| `QueryCreatePage.tsx` | "Build on this query" create mode at `/queries/new?base=qr_…` (R77) | reuses builder + `SaveQueryModal` |
| `QueryBuilderPanel.tsx` | presentational Build+Preview collapsible sections | reuses `ActiveFilterChips`/`FilterPopover`/`AdvancedQueryInput` from datasets |
| `JoinEditor.tsx` | base-source picker + join tree editor (single-edit ≤1 hop, hop-rows + add/remove for ≥2) | feature-local |
| `JoinWithRelatedModal.tsx` | minimal join-create (R71) opened from dataset detail | feature-local |
| `SaveQueryModal.tsx` | name capture for "Save filters as Query" + create mode | feature-local |
| `useQueryBuilder.ts` | builder state hook: draft, debounced preview, dirty/canSave, create vs edit | feature-local |
| `chain.ts` | `readChain`/`writeDef` — the ONLY working-chain↔wire bridge | feature-local |
| `hooks.ts` | TanStack hooks | feature-local |
| `types.ts` | TS types mirroring contracts | feature-local |

**Hooks / query keys / invalidations (`hooks.ts`):**
- `['queries', {workspaceId}]` — list. `['query', id]` — single. `['query-rows', id, {page,pageSize}]` — run. `['query-preview', workspaceId, sourceId, defKey, {page,pageSize}]` — preview (`retry:false`).
- `useCreateQueryMutation` → invalidates `['queries']`. `useUpdateQueryMutation` → invalidates `['queries']`, `['query', id]`, `['query-rows', id]`. `useDeleteQueryMutation` → invalidates `['queries']`, removes `['query', id]` + `['query-rows', id]`.

**TS types (`types.ts`):** `Query` carries `sourceId` (no `datasetId`), `resolvedColumns?`. `CreateQueryRequest = {name, sourceId, definition}`. `UpdateQueryRequest = {definition}`. `PreviewQueryRequest = {sourceId, definition}`. `QueryDefinition.joins?`, `JoinStep = {relationshipId, type}`, `JoinType = inner|left|right|full`. **`datasetId` does NOT appear anywhere in the FE.**

**Affordances actually built:** catalog (workspace filter + name search + sortable columns + source link resolving ds_/qr_); detail badges (Live/Stale/Join-unavailable/Composition-unavailable + Composed + Join tags); read-only composition summary + join summary (multi-hop); inline Edit (Build/Preview collapsible, per-column funnel filters, advanced query, q search, debounced preview + `[Preview]` flush, header `[Cancel][Save]`); "Build on this query" verb → create page; "Save filters as Query" + "Join with related dataset" (entry on dataset detail).

### 1.5 Canvas — BUILT? **NO.** Zero canvas code exists. No `Canvas`/`SourceGraph` component, no node-link editor, no `react-flow`-style dependency in the feature folder. `canvas.md` describes an **unbuilt, design-banked** surface (R80 design, build deferred R81+). The only join editor is the hop-list `JoinEditor.tsx`.

### 1.6 Field inventory (canonical, code-truth)

`Query`: `id, workspaceId, sourceId, name, definition{q,filters,advanced,joins}, resolvedColumns?, createdAt`. **No `datasetId`.**
Create body: `name, sourceId, definition`. Update body: `definition`. Preview body: `sourceId, definition`.

---

## 2. Drift report (per doc)

### 2.1 `saved-query.md` — DRIFTED (4 claims)
1. **`datasetId` in the TS model.** L353 `datasetId: string; // FK → Dataset.id (the single source, D-4)`. **Doc says X:** the Query model has a `datasetId` FK field / "the single source". **Code does Y:** `datasetId` retired R79; model has only `sourceId` (no FK). [model drift]
2. **Create-body field list.** L491, L556, L620: `POST … { name, datasetId, definition }` ("**+ optional `sourceId`**"). **Doc says X:** body carries `datasetId` (+ optional `sourceId`). **Code does Y:** body is `{name, sourceId, definition}` — `sourceId` is **required and canonical**, `datasetId` absent. [route/field drift]
3. **R77 create body.** L256: create `POST`s `{ name, datasetId: base.datasetId, sourceId: base.id, definition }`. **Code does Y:** `QueryCreatePage`/`useQueryBuilder.createWithName` send `{name, sourceId, definition}` only — no `datasetId`. [route/field drift]
4. **422 trigger phrasing** L626 "unknown `datasetId` → 422" — code rejects unknown **`sourceId`**. [minor field drift]
- *Header "As-built deltas" block (L20-40) is otherwise accurate (relabel, editing shipped, page sizes, Build-on-this-query). The drift is the body's stale `datasetId` field.*

### 2.2 `multi-join.md` — DRIFTED (5 claims)
1. **Canvas version.** L225 "free-form visual canvas is **R75**", L623/L637 "→ R75". **Code/anchor:** canvas is design-banked R80, build deferred R81+, and **not built**. [scope/version drift]
2. **Linear-chain invariant presented as current** in body sections — L266 "the linear-chain invariant (tail-extension) the builder enforces", L476-477 "satisfy the linear-chain invariant (each hop's left = the prior tail)", L512 "validate-on-save checks … the linear-chain invariant", L549/L574. **Code does Y:** the live rule is the **tree** invariant (`disconnected_join`/`cyclic_join`, left = ANY in-graph source). The doc's R74 as-built note (L44-54) corrects this, but the body still asserts the linear rule as current → internally contradictory. [semantics drift]
3. **`query.datasetId` in the resolve pseudocode.** L402 "sources = [D0 = query.datasetId]"; L216 "`datasetId` or any". **Code does Y:** driving source is `query.sourceId` (resolved by `resolve_source`). [field drift]
4. **Engine join_keys tuple.** L49 note says `(left_idx, left_col, right_col)` (3-tuple); **code** is a **4-tuple** `(left_idx, left_col, right_col, kind)` since R75 added per-hop type. [minor model drift]
5. **`removeLastJoin → removeJoin` / "[Remove] last for ≥2"** L48 — code removes **any leaf** (`onRemoveHop`, leaf-only), the doc's own R74 note also says "leaf removal", but L48's earlier framing says "Remove last". [minor — self-resolved later in doc]

### 2.3 `joins.md` — minor/borderline (1-2 claims)
1. The doc is largely an R71 historical seal (truth-test record). It correctly describes `{relationshipId, type}` and the two-dataset join, `relationship_stale`. **Borderline:** it predates outer-join types/tree/composition but is framed as "the second construction mode (R71)" so its scope is historically bounded; not factually wrong about R71. **One drift:** any forward reference framing the join as the only/terminal join shape is superseded. Treat as **low drift** — mostly accurate-for-its-round but redundant with the spine. [scope]

### 2.4 `query-builder.md` — NOT DRIFTED (0 claims)
Domain anchor. Correctly states canvas = "designed (banked) at R80, build deferred → R81+", joins shipped R71, construction R72, multi-join/tree R73/R74, composition trajectory. Reuse invariant holds. The cleanest doc; matches code.

### 2.5 `query-construction.md` — DRIFTED (6 claims) — HEAVIEST DRIFT
1. **Canvas version.** L12 "multi-join canvas is **R73**", L158 "multi-join canvas / source graph is **R73**". **Code/anchor:** banked R80, deferred R81+, not built. [scope/version drift]
2. **"Vestigial `datasetId`" section (L400-406) is FICTION vs code.** Doc: "the backend create handler still **requires a valid `datasetId`**", "`source_id = body.sourceId or body.datasetId`", "sends `datasetId = base.datasetId`". **Code does Y:** `create_query` reads `source_id = body.sourceId` only; `CreateQueryBody` has **no `datasetId`** and `datasetId` is dropped from the DB. The entire "vestigial datasetId grounding" is stale (it described the R76→R79-transition state; R79 finished the cleanup). [field/route drift — high severity]
3. **R77 create body.** L50, L567, L593 `POST { name, datasetId, sourceId, definition }`. **Code:** `{name, sourceId, definition}`. [field drift]
4. **Create-mode table** L393-397: `workspaceId / datasetId from base`, `datasetId = base.datasetId, the legacy NOT-NULL field`. **Code:** no `datasetId`; `createBase = {workspaceId, sourceId}`. [field drift]
5. **Preview body** L483 "body `{ datasetId, definition }`". **Code/contract:** `{sourceId, definition}`. [field drift]
6. **Seeded source** L393 "seeded `query.sourceId ?? query.datasetId`". **Code:** `setBaseSourceId(query.sourceId)` — no fallback. [minor field drift]
- *The "As-built deltas" header block (layout, header actions, debounce, stateless preview) is accurate.*

### 2.6 `composition.md` — DRIFTED (4 claims)
1. **`Query.datasetId` as the live source field.** L11, L75 "The driving source is `Query.datasetId`, typed `^ds_…`", L93 "`Query.datasetId` (`^ds_`) → `sourceId`". **Code does Y:** there is no `datasetId`; `sourceId` (`^(ds_|qr_)…`) is the single source field (R79 finished what R76 designed). The doc describes the R76 *transition* (rename+widen of `datasetId`) as if `datasetId` still exists. [field drift]
2. **POST body still gains `sourceId` "renamed+widened from datasetId"** L380 — additively framed; code has only `sourceId` (R79). [field drift]
3. **`composition_cycle` status code.** L93/L380 say the cycle guard returns **`422`** ("runs the composition_cycle guard (`422`)"). **Code does Y:** create/update/preview return **`409` composition_cycle** (`JSONResponse(status_code=409, ApiErrorCompositionCycle)`), and run returns `409`. Never 422. [error-status drift — high severity]
4. **"every stored `datasetId` reads as a `ds_` sourceId"** L385/L437 — migration **backfilled+dropped** `datasetId`; nothing "reads `datasetId`" anymore. [field drift]
- *Composition semantics (recursive resolver, sub-relation, provenance, cycle guard, endpoints stay dataset↔dataset) are otherwise accurately described and match code.*

### 2.7 `canvas.md` — DRIFTED-by-construction (DEFERRED, 1-2 claims) — describes UNBUILT surface
1. **Whole doc describes an unbuilt surface.** Honestly self-labeled "Accepted (design — banked); build DEFERRED to R81+ … ships no code." This is **correct** about its own status, so not "drift" in the lie sense — but for a code-truth sync it must be flagged: **0% of canvas.md is built.** [deferred]
2. **`datasetId` in the create flow.** L145, L345 `POST { name, datasetId, sourceId, definition }`. Even the deferred spec carries the stale `datasetId` field; when built it must send `{name, sourceId, definition}`. [field drift in a deferred spec]

---

## 3. De-fragmentation map

**Diagnosis:** the 7 docs are round-by-round fragments (R69→R80) of **TWO real built concepts + ONE unbuilt concept**, plus a domain anchor:

- **THE SPINE (the noun + model + run, what is actually built and persisted):**
  the **Saved Query** = `sourceId` (polymorphic `ds_|qr_`) + `definition{q,filters,advanced,joins}` + the run/preview routes + the tree-fold engine + composition resolver. Today this truth is **smeared across 5 docs** (saved-query, joins, multi-join, composition, query-construction). One model, one route family, one engine.
- **THE CANVAS (unbuilt):** a second editor over the same model — legitimately deferred.
- **THE ANCHOR:** `query-builder.md` (domain frame + reuse invariant + trajectory).

### Proposed spine-first merge

| Doc | Fate | Rationale |
|---|---|---|
| **`saved-query.md`** | **SPINE (canonical survivor)** — rename concept to the full Query noun: model (`sourceId`, definition, joins tree), all 7 routes, run/preview/composition. | It already owns the model + catalog + run path + create verbs; it is where the noun lives. Fold the verb/mode docs into its mode sections. |
| `joins.md` | **FOLD → spine** (a "Join (single-edge)" subsection). | Not a noun; the join is a `JoinStep` in the spine's `joins` list. R71 historical truth-test content → drop the ledger, keep the 1-paragraph semantics. |
| `multi-join.md` | **FOLD → spine** (the "Join tree" semantics: tree topology, fold engine, effective columns, outer types). | Same model as joins — it's `joins: JoinStep[]` + the tree invariant. The R73/R74 ledger + truth-test records compact away. |
| `composition.md` | **FOLD → spine** (the "Composed source (`qr_`)" subsection: polymorphic source, recursive resolver, cycle guard). | Same `sourceId` field + same engine entry. Pure mode of the spine. |
| `query-construction.md` | **SURVIVING SIBLING** (the *editable builder* surface: `useQueryBuilder`, `QueryBuilderPanel`, `JoinEditor`, preview UX, Build-on create mode). | Folding the full builder UX (layout, debounce, per-column funnels, create vs edit, save lifecycle) into the spine would bloat it badly. It is a distinct **surface** doc (UX), where the spine is the **model+API** doc. Earns its own home. **But** strip its stale "vestigial datasetId" section entirely. |
| `query-builder.md` | **SURVIVING SIBLING (the anchor)** — keep as the domain overview. | Anchors the folder + reuse invariant; the cleanest doc. Update its trajectory bullets only. |
| `canvas.md` | **DEFERRED — keep as-is** (do not fold, do not rewrite to code-truth). | Describes an unbuilt surface; sync should leave it labeled deferred. Only fix the `datasetId`→`sourceId` field bug in its spec so the future build inherits correct fields. |

**Net:** 7 docs → **3 living docs** (spine `saved-query.md` + sibling `query-construction.md` + anchor `query-builder.md`) + **1 deferred** (`canvas.md`). 3 docs fold away (joins, multi-join, composition).

### Locked round-file redirect-stubs needed (per merged/folded path)

Folding `joins.md`, `multi-join.md`, `composition.md` requires a **redirect stub** at each old path (a 2-line "merged into saved-query.md#section" pointer) because **locked** round files link them:

- **`joins.md`** linked by: Round_71, Round_72, Round_73, Round_75, Round_76, Round_81 → **6 locked files**
- **`multi-join.md`** linked by: Round_73, Round_74, Round_75, Round_76, Round_80, Round_81 → **6 locked files**
- **`composition.md`** linked by: Round_76, Round_77 → **2 locked files**
- (`saved-query.md` survives — linked by R69,R70,R71,R72,R77,R81; `query-construction.md` survives — R72,R73,R76,R77; `query-builder.md` survives — R70-R77,R79,R80; `canvas.md` survives deferred — R80. No stubs needed for survivors.)

**Total redirect stubs needed for the 3 folded paths: 3 stub files** (covering **14 locked-round-file link references** that must keep resolving). Stubs preserve the heading-anchors the round files deep-link.

---

## 4. Per-doc verdict table

| Doc | DRIFTED? | claimCount | fold-target | one-line summary |
|---|---|---|---|---|
| `saved-query.md` | YES | 4 | **SPINE (survivor)** | Owns the Query noun/model/routes; body still carries retired `datasetId` field — becomes the canonical spine. |
| `multi-join.md` | YES | 5 | FOLD → spine | Tree semantics correct in as-built notes but body still asserts linear-chain invariant + canvas=R75 + `query.datasetId`. |
| `joins.md` | minor | 1 | FOLD → spine | R71 historical seal; accurate-for-round, redundant with spine; low drift. |
| `query-builder.md` | NO | 0 | **SIBLING (anchor, survivor)** | Cleanest doc; canvas/trajectory framing matches code. |
| `query-construction.md` | YES | 6 | **SIBLING (survivor)** | Builder UX accurate, but "vestigial datasetId" section is fiction vs code + canvas=R73. |
| `composition.md` | YES | 4 | FOLD → spine | Resolver/cycle semantics correct, but `Query.datasetId` field + `composition_cycle`=422 (code: 409). |
| `canvas.md` | DEFERRED | 2 | **DEFERRED (keep)** | 0% built; honest about deferral; only field bug = `datasetId` in its create spec. |

**Total drifted claims across domain: ~22** (excluding canvas's "unbuilt" meta-flag).

---

## 5. Weight estimate & recommendation

**Recommendation: SPILL `queries` to its own round (R83). Do NOT bundle with workspaces+datasets.**

Reasoning:
- **Doc count:** 7 docs (the other domains are far smaller) — the heaviest single domain by a wide margin.
- **Drift volume:** ~22 drifted claims, including 2 **high-severity** correctness drifts (the `composition_cycle`=422-vs-409 error-status lie, and the entire "vestigial `datasetId`" fiction in query-construction.md), plus a pervasive `datasetId`→`sourceId` field drift threaded through 5 of 7 docs, and an internally-contradictory linear-vs-tree invariant in multi-join.md.
- **De-fragmentation complexity:** this is the ONLY domain requiring a 7→4 spine-first merge (3 folds + spine consolidation + a deferred doc). The fold itself is substantial editorial work (consolidate joins+multi-join+composition into spine sections without losing the tree/composition/outer-join semantics).
- **Locked-round stubs:** **3 redirect stubs** covering **14 locked-round-file link references** — the most stub work of any domain; each stub must preserve deep-link anchors so 14 references across R71-R81 keep resolving.

Bundling this with the lighter workspaces+datasets re-sync would either starve `queries` of the care its 7→4 merge needs or blow the round's scope. Give `queries` R83 to itself.
