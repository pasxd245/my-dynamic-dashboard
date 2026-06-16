# Detect — workspaces (CODE-TRUTH + drift)

Date: 2026-06-17
Pass: Detect (detection only — no design doc edited)
Domain: `data-management/workspaces` (two distinct nouns: **Workspace** + **Relationship**)

---

## CODE-TRUTH map

### Routes

#### Workspaces (`app/routers/workspaces.py`, prefix `/workspaces`)

| Method / Path | Request body (exact fields) | Success | Errors (status + `code`) |
| --- | --- | --- | --- |
| `GET /workspaces` | — | `200` → `list[Workspace]`, ordered `created_at DESC, id DESC` | — |
| `POST /workspaces` | `CreateWorkspace { name }` (`extra="forbid"`, `1..NAME_LENGTHS["workspace_max"]`=80) | `201` → `Workspace` (JSONResponse) | `409 {code:"name_taken"}` (on `workspaces.name` UNIQUE violation); `422` FastAPI/pydantic `detail[]` |
| `PATCH /workspaces/{id}` | `RenameWorkspaceBody { name }` (`extra="forbid"`, 1..80) | `200` → `Workspace` | `404 {code:"not_found"}` (pre-check); `409 {code:"name_taken"}` (UPDATE UNIQUE violation); `422` `detail[]` |
| `DELETE /workspaces/{id}` | — | `204` (empty `Response`) | `404 {code:"not_found"}`; `409 {code:"non_empty", datasetCount:int>=1}` (pre-count of `datasets WHERE workspace_id=?`) |

- `{id}` path param pattern `ID_PATTERNS["workspace"]` (`^ws_[0-9a-f]{8}$`).
- Delete is **block-not-cascade**: handler pre-counts datasets, returns 409 if any. DB-level `ON DELETE CASCADE` FKs exist as backstop only.
- All error bodies are the bare code-first envelope `{"code": …}` (+ `datasetCount` for non_empty). Emitted as `JSONResponse(...).model_dump()`.

#### Relationships (`app/routers/relationships.py`, NO router prefix; paths absolute)

| Method / Path | Request body | Success | Errors (status + ACTUAL emitted shape) |
| --- | --- | --- | --- |
| `POST /workspaces/{id}/relationships` | `CreateRelationshipBody { leftDatasetId, leftColumn, rightDatasetId, rightColumn, cardinality }` (`extra="forbid"`) | `201` → `Relationship` (status hardcoded `"valid"` at create) | `409 {code:"relationship_exists"}` (only on SQLite UNIQUE-pair violation); **`422` = plain FastAPI `detail:[{loc,msg,type:"value_error"}]`, NO `code` field** — for self-pair, unknown_dataset, cross-workspace, unknown_column, incompatible_join_keys |
| `GET /workspaces/{id}/relationships` | — | `200` → `list[Relationship]` (computed status), `created_at DESC, id DESC` | — |
| `GET /relationships/{id}` | — | `200` → `Relationship` (computed status) | `404 {code:"not_found"}` |
| `DELETE /relationships/{id}` | — | `204` (empty `Response`) | `404 {code:"not_found"}` |

- `{id}` workspace pattern `^ws_[0-9a-f]{8}$`; relationship pattern `ID_PATTERNS["relationship"]` (`^rel_[0-9a-f]{8}$`).
- **CRITICAL — 422 has no machine code.** `_validation_error()` raises `HTTPException(status_code=422, detail=[{loc, msg, type:"value_error"}])`. The human reason string carries a token prefix (`self_join:`, `unknown_dataset:`, `unknown_column:`, `incompatible_join_keys:`) inside `msg`, but it is NOT a structured `code`. Codes like `incompatible_join_keys` exist only as text prefixes, not envelope fields.
- **409 `relationship_exists` IS emitted** with that code (`ApiErrorRelationshipExists().model_dump()`), only on `sqlite3.IntegrityError` matching `"UNIQUE constraint failed" + "relationships."`.
- **No `409 relationship_stale`** is emitted anywhere in R70 code (reserved for R71; the model `ApiErrorRelationshipStale` exists in `models/common.py` but is unused by these handlers).
- **`status` is computed, never stored** — `_compute_status()` reads both datasets' `columns_json`, returns `"stale"` if either dataset missing OR either column missing OR dtypes not `_compatible`; else `"valid"`. `_compatible`: equal dtypes OR both in `{integer, float}`.
- Self-join guard: `body.leftDatasetId == body.rightDatasetId` → 422 (covers degenerate self-pair AND any same-dataset pair; self-joins deferred).

### Models / DB

**Schema of record is SQLModel** (`app/db_models.py`), evolved via **Alembic** (`alembic/versions/0001_baseline.py`, `0002_query_source_id.py`). `db.py` no longer hand-bootstraps `_SCHEMA` — that retired into `0001_baseline`. Tests build from `SQLModel.metadata` via `create_all_for_tests()` (stamped at head); production runs `alembic upgrade head` via `run_startup_migrations()`.

**`workspaces` table** (SQLModel `Workspace`):
- `id` TEXT PK; `name` TEXT NOT NULL; `created_at` TEXT NOT NULL.
- `CheckConstraint("length(name) BETWEEN 1 AND 80")`.
- `Index("idx_workspaces_name_unique", "name", unique=True)` — **global** uniqueness.

**`relationships` table** (SQLModel `Relationship`):
- `id` TEXT PK; `workspace_id` TEXT NOT NULL FK→workspaces.id ON DELETE CASCADE; `left_dataset_id` TEXT NOT NULL FK→datasets.id ON DELETE CASCADE; `left_column` TEXT NOT NULL; `right_dataset_id` TEXT NOT NULL FK→datasets.id ON DELETE CASCADE; `right_column` TEXT NOT NULL; `cardinality` TEXT NOT NULL; `created_at` TEXT NOT NULL.
- **No `status` column** (computed on read).
- `CheckConstraint("cardinality IN ('one_to_one','one_to_many','many_to_many')")`.
- `Index("idx_relationships_workspace_id", "workspace_id")`.
- `Index("idx_relationships_pair_unique", workspace_id, left_dataset_id, left_column, right_dataset_id, right_column, unique=True)`.

**ORM reality**: DDL/migration = SQLModel + Alembic; **request handlers use raw `sqlite3`** via `db.get_conn()` (hand-written SQL). PRAGMA `foreign_keys = ON` set per connection.

**Wire (camelCase) vs DB (snake_case)**: handlers map by hand. Workspace: `created_at`→`createdAt`. Relationship: `workspace_id`→`workspaceId`, `left_dataset_id`→`leftDatasetId`, `left_column`→`leftColumn`, `right_dataset_id`→`rightDatasetId`, `right_column`→`rightColumn`, `created_at`→`createdAt`.

**Pydantic wire models** (`app/models/common.py`, all `extra="forbid"`):
- `Workspace { id (WsId ^ws_), name (1..80), createdAt (IsoUtc) }`.
- `Relationship { id (RelationshipId ^rel_), workspaceId (WsId), leftDatasetId (DsId), leftColumn, rightDatasetId (DsId), rightColumn, cardinality (Cardinality), status (RelationshipStatus valid|stale), createdAt }`.
- `CreateRelationshipBody { leftDatasetId, leftColumn, rightDatasetId, rightColumn, cardinality }`.
- Error models: `ApiErrorNotFound`, `ApiErrorNameTaken`, `ApiErrorNonEmpty{datasetCount>=1}`, `ApiErrorRelationshipExists`, `ApiErrorRelationshipStale` (unused by R70 handlers).
- `Cardinality = Literal["one_to_one","one_to_many","many_to_many"]`; `RelationshipStatus = Literal["valid","stale"]`.

### Frontend — components + homes

| Component / file | Home | Notes |
| --- | --- | --- |
| `WorkspacesPage`, `WorkspaceCard`, `CreateWorkspaceModal` (all in one file) | `features/data-management/workspaces/WorkspacesPage.tsx` | feature-local; NOT @mdd/ui |
| `WorkspaceRelationshipsPage` | `features/data-management/relationships/WorkspaceRelationshipsPage.tsx` | reuses PageHeader + PageCard + AntD `<Table>` |
| `DeclareRelationshipModal` (+ exported `dtypeCompatible`) | `features/data-management/relationships/DeclareRelationshipModal.tsx` | live compat line `aria-live="polite"`, Declare disabled until compatible |
| `RenameModal`, `DeleteConfirmModal`, `BlockedDeleteModal` | `features/data-management/_shared/` | shared; reused, not owned |
| `PageHeader`, `PageCard` | `@mdd/ui` | imported as `from '@mdd/ui'` |
| `ApiErrorThrown`, `isApiError`, `ApiError` union | `features/data-management/_shared/types.ts` | code-first branching |

- `BlockedDeleteModal` is **workspace-only** (props `workspaceName`, `datasetCount`).
- `WorkspaceCard` overflow `<Dropdown>` has **THREE** items: `Relationships` (ShareAltOutlined → `/data-management/workspaces/<id>/relationships`), `Rename`, `Delete` (danger). Card click → `/data-management/datasets?workspace=<id>`.
- Relationships table columns: Left (dataset name), Right (dataset name), Keys (`left ↔ right`), Cardinality (`<Tag>`), Status (icon+text valid/stale `<Tag>`), actions (delete). Status uses `WarningFilled` + `Tooltip` for stale, success `<Tag>` for valid.
- DeclareRelationshipModal cardinality default = `'one_to_many'`. Duplicate detected client-side by `error.body.code === 'relationship_exists'`.

### TanStack hooks / query keys

Workspaces (`workspaces/hooks.ts`):
- `useWorkspacesQuery` — key `['workspaces']` (`WORKSPACES_QUERY_KEY`).
- `useCreateWorkspaceMutation` — invalidates `['workspaces']`.
- `useRenameWorkspaceMutation` — invalidates `['workspaces']` AND `['datasets']`.
- `useDeleteWorkspaceMutation` — invalidates `['workspaces']` AND `['datasets']`.

Relationships (`relationships/hooks.ts`):
- `useRelationshipsQuery(workspaceId)` — key `['relationships', { workspaceId }]`.
- `useRelationshipQuery(id)` — key `['relationship', id]`.
- `useCreateRelationshipMutation` — invalidates `['relationships']` (base key).
- `useDeleteRelationshipMutation` — invalidates `['relationships']`, removes `['relationship', id]`.

### Cross-links (FKs / cascades / routes)

- `relationships.workspace_id` → `workspaces.id` ON DELETE CASCADE.
- `relationships.left_dataset_id` / `right_dataset_id` → `datasets.id` ON DELETE CASCADE.
- `datasets.workspace_id` → `workspaces.id` ON DELETE CASCADE (workspace delete is block-not-cascade in handler; FK cascade is backstop).
- Workspace card → relationships sub-route `/data-management/workspaces/<id>/relationships`.

### Flat field inventory

- Workspace wire: `id`, `name`, `createdAt`. DB: `id`, `name`, `created_at`.
- Relationship wire: `id`, `workspaceId`, `leftDatasetId`, `leftColumn`, `rightDatasetId`, `rightColumn`, `cardinality`, `status` (computed), `createdAt`. DB: `id`, `workspace_id`, `left_dataset_id`, `left_column`, `right_dataset_id`, `right_column`, `cardinality`, `created_at` (no `status`).
- CreateWorkspace body: `name`. CreateRelationship body: `leftDatasetId`, `leftColumn`, `rightDatasetId`, `rightColumn`, `cardinality`.
- Error codes emitted: `not_found`, `name_taken`, `non_empty` (+`datasetCount`), `relationship_exists`. NOT emitted by these handlers: `relationship_stale`, `query_stale`, `composition_cycle`.

---

## Drift report

### Doc 1 — `workspaces/workspaces.md`

Re-synced in R81; re-confirmation against code.

| Claim | doc says / code does | Category |
| --- | --- | --- |
| Persistence SQLModel + Alembic, handlers raw sqlite3 | doc says / code matches | (in sync) |
| Global unique `idx_workspaces_name_unique` | doc says / code matches | (in sync) |
| Data-contract table (4 routes, bodies, statuses, codes) | doc rows match handlers exactly incl. `409 name_taken`, `409 non_empty + datasetCount`, `404 not_found`, `422` | (in sync) |
| Block-not-cascade delete + FK backstop | doc says / code matches (pre-count then CASCADE backstop) | (in sync) |
| Query keys + invalidations (rename/delete invalidate both `['workspaces']`+`['datasets']`) | doc says / hooks match | (in sync) |
| WorkspaceCard overflow Relationships/Rename/Delete; card→datasets filter; Relationships→sub-route | doc says / code matches | (in sync) |

**No drift found.** Doc remains in sync after R81 re-sync. **Claims audited: ~8 load-bearing, 0 drifted.**

### Doc 2 — `workspaces/relationships.md`

Carries an OUT-OF-SYNC marker (R81, claims=3). Full diff:

| # | Claim | doc says / code does | Category |
| --- | --- | --- | --- |
| 1 | Persistence mechanism | doc § Data model (l.194-197, l.217) says **"established raw-SQLite + Pydantic standard (J-3 … SQLModel was the refuted guess)"** + shows a hand `CREATE TABLE IF NOT EXISTS relationships` DDL block / **code: schema of record is the SQLModel `Relationship` table in `db_models.py` under Alembic `0001_baseline`** (handlers do use raw sqlite3, but the "SQLModel refuted" framing + hand-DDL are stale post-R78). | behaviour frozen at old round (pre-R78) |
| 2 | Declare `422` machine code — "open question" | doc § Data contract (l.341-346) leaves **"Open contract question … whether the declare 422 carries a specific machine code (e.g. `incompatible_join_keys`) or a generic envelope"** UNRESOLVED / **code resolves it: 422 is a generic FastAPI `detail:[{loc,msg,type:"value_error"}]` with NO machine code; reason is a text prefix in `msg`.** | resolved open-question |
| 3 | `Relationship` Pydantic model home | Surfaces table (l.73) says model lives in **`apps/backend/app/routers/relationships.py` (or `models`)** / **code: it lives in `app/models/common.py`** (imported by the router; router defines none). | surface moved / stale home |
| 4 | Declare-flow mermaid `Invalid: 422 → inline reason` branch | doc mermaid (l.266) labels the 422 branch **"inline reason (unknown col / cross-workspace / self-pair)"** / **code: 422 is a generic pydantic `detail[]`; `DeclareRelationshipModal` does NOT parse per-reason — only `relationship_exists` is special-cased; everything else is a generic `<Alert>` `error.message`.** Directionally right (422 happens) but the "inline reason" granularity is not built. | mermaid branch wrong (partial) |
| 5 | `relationship_stale` 409 reserved for R71 | doc (l.334-340) says reserved / **code matches** — `ApiErrorRelationshipStale` exists but unused by R70 handlers. | (in sync — correctly deferred) |
| 6 | Status computed-not-stored; valid|stale; compat rule (int↔float) | doc says / code matches (`_compute_status`, `_compatible`) | (in sync) |
| 7 | Four routes + paths + 201/409/404/204; `relationship_exists` on duplicate pair | doc contract table matches handlers | (in sync) |
| 8 | FE: Page-List reuse; aria-live compat line; keys `['relationships',{workspaceId}]`/`['relationship',id]` | doc says / code matches | (in sync) |

**DRIFTED — confirmed.** R81 `--check` count of **3** is accurate for the primary body claims (persistence framing, resolved 422 open-question, model home). Drift #4 is a secondary mermaid-granularity nuance worth correcting at sync. **Claims audited: ~11; 3 primary (matches marker) + 1 mermaid nuance.**

### Doc 3 — `_shared/crud-hygiene.md` (workspace/relationship claims only)

| Claim | doc says / code does | Category |
| --- | --- | --- |
| `WorkspaceCard (extended)` Layer = **`@mdd/ui`**, "shared cross-domain" (l.66) | doc says WorkspaceCard is a `@mdd/ui` primitive / **code: `WorkspaceCard` is feature-local inside `WorkspacesPage.tsx` under `features/data-management/workspaces/`; NOT in `@mdd/ui`** (contradicts workspaces.md, which calls it feature-local). | surface moved / wrong home |
| WorkspaceCard overflow menu has **two** items: `Rename` + `Delete` (l.121-127, l.331) | doc says two / **code: THREE — `Relationships` (R70) + `Rename` + `Delete`.** Frozen pre-R70. | behaviour frozen at old round |
| Wire shape `PATCH/DELETE /workspaces/{id}` + 200/204/404/409 codes (l.406-414) | doc says / code matches (`name_taken`, `non_empty`+`datasetCount`, `not_found`) | (in sync) |
| Workspace name unique **globally** (l.354-356, l.388-393) | doc says / code matches | (in sync) |
| `RenameWorkspaceBody` max=80 from `NAME_LENGTHS["workspace_max"]` | doc says / code matches | (in sync) |
| Workspace delete/rename mutations invalidate `['workspaces']`+`['datasets']` | doc says / hooks match | (in sync) |
| BlockedDeleteModal informational, single button, two reach-paths | doc says / code matches | (in sync) |
| BE handler sketch `rename_workspace(workspace_id, body)` / `@router.patch("/workspaces/{workspace_id}")` (l.499-509) | doc shows param `workspace_id` + shared `RenameBody` / **code: handlers use path param `id` (`@router.patch("/{id}")`, prefix `/workspaces`) and a dedicated `RenameWorkspaceBody`.** Illustrative, but param + body-class differ. | stale field name / illustrative drift (minor) |

**DRIFTED (workspace claims).** Two material: WorkspaceCard `@mdd/ui` home (wrong) and two-item-menu (frozen pre-R70, now three). One minor signature mismatch. Wire-shape / uniqueness / hooks all in sync. **Claims audited (workspace/relationship-scoped only): ~9; 2 primary + 1 minor.**

---

## Per-doc verdict

| Doc | DRIFTED? | Claim count (audited) | One-line summary |
| --- | --- | --- | --- |
| `workspaces/workspaces.md` | **No** | ~8, 0 drifted | Still in sync after R81 re-sync — routes, persistence, hooks, nav all match code. |
| `workspaces/relationships.md` | **Yes** | ~11, 3 primary (+1 mermaid nuance) | R81 marker (claims=3) confirmed: stale "raw-SQLite/SQLModel-refuted" framing (pre-R78), resolved 422-machine-code open-question (code emits generic `detail[]`, no code), wrong `Relationship` model home (it's `models/common.py`). |
| `_shared/crud-hygiene.md` | **Yes** (workspace claims) | ~9, 2 primary (+1 minor) | WorkspaceCard listed as `@mdd/ui` (feature-local in reality); overflow menu claimed two items (now three incl. Relationships); wire-shape/uniqueness/hooks in sync. |

### De-fragmentation note

**No de-fragmentation needed for the `workspaces/` folder.** `workspaces.md` and `relationships.md` are **two genuinely distinct nouns** (a container vs. a governed edge), correctly kept as two sibling docs — NOT a split single concept. Confirmed by relationships.md's own noun-vs-mode rationale and the code's separate router/table/feature-folder. `crud-hygiene.md` is a deliberate cross-cutting `_shared/` doc (one verb-set across workspaces+datasets) and should stay shared, not be folded into workspaces.md.
