# Implementation Plan: Saved Queries (MVP 2)

**Branch**: `004-saved-queries` | **Date**: 2026-05-08 | **Spec**: `/specs/004-saved-queries/spec.md`
**Input**: Feature specification from `/specs/004-saved-queries/spec.md`
**Dependency**: Spec 003 (Query Builder & Execution) — saved queries depend on builder configuration snapshots

## Summary

Implement saved-query persistence so analysts can preserve, version, search, and reuse recurring business questions built in the spec 003 query builder. The technical approach adds four immutable-snapshot tables to the metadata store (saved_queries, saved_query_versions, saved_query_executions, saved_query_events), extends backend services to orchestrate create/list/load/delete/restore workflows, implements library search and soft-delete recovery, and connects the React builder UI to save/load/duplicate/restore flows with full traceability. The outcome enables MVP 2 transition from exploratory to repeatable analysis while preserving version lineage, execution history, and revalidation warnings for schema drift.

## Technical Context

**Language/Version**: Python 3.12 (backend), JavaScript ES2022 (React 18 + Vite builder)
**Primary Dependencies**: FastAPI, Pydantic, SQLite (`sqlite3`), Polars, DuckDB, React 18, TanStack Query
**Storage**: SQLite metadata DB for saved-query library, versions, executions, and audit events; inherited parquet-backed data frames from spec 003
**Testing**: `pytest` backend contract + integration suites for save/list/load/delete/restore; builder smoke via Vite build and manual library/detail flows
**Target Platform**: Linux local/dev container with browser-based builder UI
**Project Type**: Web application (backend API + frontend builder)
**Performance Goals**: SC-001 library list/search under 2 seconds; SC-002 save new query under 1 second; SC-003 load and revalidate under 2 seconds; SC-004 soft-delete / restore under 500ms
**Constraints**: Single-user workspace scope (no cross-user sharing in MVP 2); soft-delete recovery window is 24 hours; query name uniqueness per workspace per user; only valid builder snapshots can be saved; all versions are immutable after creation
**Scale/Scope**: Single-workspace, single-user saved-query management; up to 1,000s of saved queries per user; version history unbounded (retention policy deferred to MVP 3); execution history retained until manual cleanup

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Pre-Phase 0 gate review:

- **Principle I (Business-Question-First)**: PASS. Spec defines business question: preserve recurring analysis. Decision: move from MVP 1 exploratory to MVP 2 repeatable workflows. Primary roles: analyst (saves/reuses), business owner (reviews provenance).
- **Principle II (Metric Contract Before Visualization)**: PASS. Feature is query persistence layer, not metric definition. Metric contracts (spec 005+) consume saved queries; this spec provides only library/versioning infrastructure.
- **Principle III (Relationship Rule Before Cross-Table Query)**: PASS WITH DESIGN REQUIREMENT. Saved versions capture which approved relationships were referenced at save time. Loading must revalidate those relationships before reuse. Broken or downgraded relationships surface as warnings.
- **Principle IV (Reconciliation Before Recommendation)**: PASS. Feature is governance/version surface, not recommendation. Recommendations remain downstream (spec 005+).
- **Principle V (Challenge & Sensitivity Before Decision-Ready)**: PASS. Saved queries are exploration/analysis-workbench surface role. Challenge/sensitivity gating remains downstream.
- **Principle VI (Traceability For Every Claim)**: PASS WITH DESIGN REQUIREMENT. Plan must persist: author, timestamps, SQL snapshot, builder snapshot, relationship context, version lineage, execution history. Every query is inspectable for provenance and reproducibility.
- **Principle VII (Reproducibility From Raw Inputs)**: PASS WITH DESIGN REQUIREMENT. Saved version is an immutable snapshot of builder configuration reproducible from raw builder state. Version can be reloaded and compared over time.

Post-Phase 1 re-check: (to be validated after design)

- All entities preserve traceability and versioning; no silent overwrites permitted.
- Soft-delete with recovery window enforces reversibility without permanent loss.
- Execution history remains immutable for audit compliance.

## Project Structure

### Documentation (this feature)

```text
specs/004-saved-queries/
├── plan.md              # This file (/speckit.plan output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── saved-queries.openapi.yaml
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (planned touch points)

```text
apps/backend/
├── app/
│   ├── main.py
│   ├── schemas.py
│   ├── core/
│   │   └── metadata_db.py           # Add 4 new tables
│   └── services/
│       ├── query_service.py          # New — orchestrate save/list/load/delete
│       ├── manifest_service.py       # Existing — may be extended for query export
│       └── upload_service.py         # Existing — reference for versioning patterns
└── tests/
    ├── contract/
    │   └── test_saved_queries_contract.py # New
    └── integration/
        ├── test_saved_query_lifecycle.py   # New
        ├── test_saved_query_search.py      # New
        └── test_saved_query_recovery.py    # New

apps/builder/
└── src/
    ├── App.jsx
    ├── pages/
    │   └── SavedQueryLibrary/       # New
    │       ├── SavedQueryLibraryPage.jsx
    │       ├── SavedQuerySearch.jsx
    │       ├── SavedQueryList.jsx
    │       └── SavedQueryDetail.jsx
    ├── components/
    │   └── SavedQuery/              # New
    │       ├── SaveQueryDialog.jsx
    │       ├── UpdateQueryDialog.jsx
    │       ├── VersionTimeline.jsx
    │       └── ExecutionHistoryTable.jsx
    └── api/
        └── queryApi.js              # New
```

## Implementation Phases

### Phase 0: Research Plan

1. **Query snapshot versioning strategy**: Decide on builder_snapshot_json structure, immutability guarantees, and parent-version linking for variant lineage.
2. **Soft-delete recovery mechanics**: Define recovery-window clock (24-hour start, whether refreshable, hard cutoff behavior, and cleanup job cadence).
3. **Search and tagging normalized behavior**: Decide tag casing/whitespace normalization and basic keyword search implementation (exact substring vs token match).
4. **Revalidation strategy for schema drift**: When a saved query is loaded, which relationships/columns must be re-validated, and what warnings surface?
5. **Execution history scope**: What metadata is recorded per execution (row count, duration, status enum values, user context)?
6. **API error semantics**: Define 400 (validation), 404 (not found), 409 (conflict—duplicate name, expired recovery), 422 (unprocessable—broken snapshot).

Phase 0 output: `research.md` with all decisions, rationale, and rejected alternatives.

### Phase 1: Design And Contracts

**Prerequisites:** `research.md` complete

1. **Data Model** → `data-model.md`:
   - Entity definitions for saved_queries, saved_query_versions, saved_query_executions, saved_query_events
   - Relationships, constraints, indexes
   - State machine for saved query lifecycle (active → deleted → expired)
   - Version lineage rules (immutability, parent-version linking)

2. **API Contracts** → `contracts/saved-queries.openapi.yaml`:
   - Endpoint definitions: create, list, search, get, load, update, duplicate, restore, delete
   - Request/response schemas with exact field types and validations
   - Error responses (400, 404, 409, 422) with structured error payloads
   - Authentication/authorization scope (workspace-scoped, user-scoped)

3. **UI Component Architecture**:
   - SavedQueryLibraryPage (list, search, filter, pagination)
   - SavedQueryDetailPanel (metadata, versions, executions, actions)
   - SaveQueryDialog (save-as-new)
   - UpdateSavedQueryDialog (save-as-new-version or update-metadata)
   - LoadSavedQueryFlow (revalidate, warn, hydrate builder)
   - DeleteRestoreControls (soft-delete UI, recovery countdown)

4. **Agent Context Update**:
   - Update `.github/copilot-instructions.md` plan reference from spec 003 to spec 004 path.

Phase 1 output: data-model.md, contracts/saved-queries.openapi.yaml, quickstart.md, updated agent context.

### Phase 2: Implementation Plan (Execution-Ready)

**Start after Phase 1 design approved**

#### Phase 2.1: Backend Schema & Persistence

1. Add four new tables to `apps/backend/app/core/metadata_db.py`:
   - `saved_queries`: library identity, owner, lifecycle state, created/updated/deleted/recoverable timestamps
   - `saved_query_versions`: immutable snapshot, version number, parent link, builder/SQL serialization, validation state
   - `saved_query_executions`: execution run history with status, row count, duration
   - `saved_query_events`: audit events (delete, restore, duplicate, variant creation)

2. Add migration script or initialization logic to create tables and indexes.

3. Add query DAO/repository layer in `apps/backend/app/services/query_service.py`:
   - `create_saved_query(workspace_id, user_id, name, description, tags, builder_snapshot, sql_snapshot)`
   - `list_saved_queries(workspace_id, user_id, state='active', tag_filter, pagination)`
   - `search_saved_queries(workspace_id, user_id, keyword, state='active')`
   - `get_saved_query(workspace_id, query_id)`
   - `get_saved_query_version(workspace_id, query_id, version_id)`
   - `create_new_version(workspace_id, query_id, name, description, tags, builder_snapshot, sql_snapshot, change_summary)`
   - `duplicate_saved_query(workspace_id, query_id, source_version_id, new_name, new_description, new_tags)`
   - `create_variant(workspace_id, query_id, source_version_id, new_name, new_description, new_tags)`
   - `soft_delete_saved_query(workspace_id, query_id, recoverable_until)`
   - `restore_saved_query(workspace_id, query_id)`
   - `record_execution(workspace_id, query_id, version_id, status, row_count, execution_ms, executed_by)`
   - `get_execution_history(workspace_id, query_id, pagination)`

#### Phase 2.2: Backend REST Endpoints

1. Extend `apps/backend/app/schemas.py` with Pydantic models:
   - SaveQueryRequest, SaveQueryResponse
   - SavedQuerySummary (list item metadata)
   - SavedQueryDetail (full metadata + version summary)
   - SavedQueryVersion (immutable snapshot)
   - SavedQueryExecution (run history item)
   - SaveQueryErrorResponse (validation, conflict, notfound, expired)

2. Extend `apps/backend/app/main.py` with endpoints (all workspace-scoped):
   - `POST /api/saved-queries` → create
   - `GET /api/saved-queries` → list (with state, tag, pagination)
   - `GET /api/saved-queries/search` → keyword search
   - `GET /api/saved-queries/{queryId}` → detail
   - `GET /api/saved-queries/{queryId}/versions/{versionId}` → specific version
   - `POST /api/saved-queries/{queryId}/versions` → new version
   - `POST /api/saved-queries/{queryId}/duplicate` → duplicate
   - `POST /api/saved-queries/{queryId}/variants` → variant
   - `POST /api/saved-queries/{queryId}/load` → load with revalidation
   - `DELETE /api/saved-queries/{queryId}` → soft delete
   - `POST /api/saved-queries/{queryId}/restore` → restore
   - `GET /api/saved-queries/{queryId}/executions` → execution history

3. Implement request validation and error handling:
   - 400: invalid builder snapshot, blank name, invalid tags
   - 404: query not found, version not found
   - 409: duplicate name in workspace, recovery window expired
   - 422: unprocessable—broken relationship/column in snapshot

#### Phase 2.3: Builder UI Integration

1. Add `apps/builder/src/api/queryApi.js`:
   - Axios/fetch client for saved-queries endpoints
   - Request/response interceptors for error handling and workspace context injection

2. Create SavedQueryLibrary pages in `apps/builder/src/pages/SavedQueryLibrary/`:
   - **SavedQueryLibraryPage**: route/layout, active/deleted tabs, search bar, list results
   - **SavedQuerySearch**: keyword search + tag filter controls
   - **SavedQueryList**: paginated results grid with key metadata columns
   - **SavedQueryDetail**: metadata + version history + SQL + executions + actions

3. Create SavedQuery components in `apps/builder/src/components/SavedQuery/`:
   - **SaveQueryDialog**: modal for first save (name, description, tags)
   - **UpdateSavedQueryDialog**: modal for save-as-new-version or update-metadata
   - **VersionTimeline**: immutable version list with metadata
   - **ExecutionHistoryTable**: run history with status, row count, duration
   - **DeleteRestoreControls**: delete confirmation, undo affordance, countdown

4. Integrate into builder workflow:
   - Add "Save Query" button to top builder toolbar
   - Add "Saved Queries" nav item to library page
   - Add "Load in Builder" action to detail view
   - Add revalidation warnings modal when loading version with broken dependencies
   - Add "Update Query" / "Save as Variant" buttons to builder after loading

#### Phase 2.4: Verification & Testing

1. Add backend contract tests in `apps/backend/tests/contract/test_saved_queries_contract.py`:
   - Request/response shape validation
   - Error response schemas (400, 404, 409, 422)
   - Field type and length constraints

2. Add backend integration tests in `apps/backend/tests/integration/`:
   - `test_saved_query_lifecycle.py`: create → list → load → new version → duplicate → restore
   - `test_saved_query_search.py`: keyword matching, tag filtering, pagination
   - `test_saved_query_recovery.py`: soft delete → restore within 24h → expire after 24h

3. Add builder smoke checks:
   - Vite build passes
   - Manual flow: builder → save → library → search → load → builder

4. Run full test suite: `cd apps/backend && pytest` and `cd apps/builder && pnpm build`

## Requirement Traceability (Plan-Level)

| Requirement                     | Phase | Component                                   | Notes                                      |
| ------------------------------- | ----- | ------------------------------------------- | ------------------------------------------ |
| FR-001 (save query)             | 2.2   | POST /api/saved-queries                     | Accept builder snapshot, create version 1  |
| FR-002 (store builder snapshot) | 2.1   | saved_query_versions.builder_snapshot_json  | Immutable per version                      |
| FR-003 (store SQL snapshot)     | 2.1   | saved_query_versions.sql_snapshot           | Immutable per version                      |
| FR-004 (workspace-scoped)       | 2.2   | All endpoints                               | Enforce workspace_id, user_id scope        |
| FR-005 (library listing)        | 2.2   | GET /api/saved-queries                      | Include all metadata fields                |
| FR-006 (keyword search)         | 2.2   | GET /api/saved-queries/search               | Basic substring/token matching             |
| FR-007 (tag filter)             | 2.2   | GET /api/saved-queries query param          | Filter by tags_json                        |
| FR-008 (detail view)            | 2.2   | GET /api/saved-queries/{queryId}            | Return versions + executions               |
| FR-009 (load into builder)      | 2.2   | POST /api/saved-queries/{queryId}/load      | Return builder_snapshot + warnings         |
| FR-010 (revalidate)             | 2.2   | POST /api/saved-queries/{queryId}/load      | Check relationship/column validity         |
| FR-011 (duplicate)              | 2.2   | POST /api/saved-queries/{queryId}/duplicate | Create new entry from snapshot             |
| FR-012 (new version on edit)    | 2.2   | POST /api/saved-queries/{queryId}/versions  | Immutable prior versions                   |
| FR-013 (save as variant)        | 2.2   | POST /api/saved-queries/{queryId}/variants  | Preserve source_query_id                   |
| FR-014 (metadata update)        | 2.2   | POST /api/saved-queries/{queryId}/versions  | New version per update                     |
| FR-015 (soft delete)            | 2.2   | DELETE /api/saved-queries/{queryId}         | Set deleted_at, recoverable_until          |
| FR-016 (recovery window)        | 2.2   | POST /api/saved-queries/{queryId}/restore   | Check recoverable_until timestamp          |
| FR-017 (exclude deleted)        | 2.2   | GET /api/saved-queries                      | Filter by deleted_at when state=active     |
| FR-018 (author + timestamps)    | 2.1   | saved_queries, saved_query_versions         | owner_user_id, created_at, updated_at      |
| FR-019 (execution history)      | 2.2   | GET /api/saved-queries/{queryId}/executions | Record per version + status                |
| FR-020 (user-friendly errors)   | 2.2   | All endpoints                               | Structured error payloads, no stack traces |
| FR-021 (preserve after delete)  | 2.1   | saved_query_events                          | Append-only audit trail                    |
| FR-022 (traceability)           | 2.1   | saved_query_versions                        | Capture relationship context               |

## Complexity Tracking

| Violation                      | Why Needed                                                    | Simpler Alternative Rejected Because                                                           |
| ------------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Four new tables + audit events | Immutability + traceability per Constitution VI/VII           | Single table with update history would lose temporal snapshots and make recovery logic complex |
| Soft-delete + recovery window  | MVP 2 requirement from spec; prevents accidental loss         | Hard delete is faster but loses analyst workflow safety                                        |
| Revalidation on load           | Constitution III (relationship rules) + schema drift handling | Skipping validation would allow broken snapshots to load undetected                            |
| Parent-version linking         | Support variant lineage without corruption                    | Flat versioning loses fork-source relationship                                                 |

## Next Steps

1. **Phase 0**: Run research to confirm decisions in this plan
2. **Phase 1**: Produce data-model.md, contracts, and quickstart
3. **Phase 1**: Update agent context reference
4. **Phase 2**: Implementation via /speckit.tasks (to be generated in next command)
