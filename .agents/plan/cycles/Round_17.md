# Round 17: Spec 004 — Saved Queries

**Status**: Complete
**Date started**: 2026-05-09
**Date completed**: 2026-05-09

**Governance**: Spec-integrated PDCA (Round → Spec-Kit → Validate → Next Round)

---

## Goal

Implement **Spec 004: Saved Queries** — enable users to persist, version, and reuse ad-hoc queries built in Spec 003. This feature bridges query building (Spec 003) and dashboard automation (Spec 005).

**Why now**: Spec 004 depends on Spec 003 backend execution engine. Once Spec 003 is implemented and tested, Saved Queries adds the persistence layer needed for dashboard automation and team collaboration.

---

## Plan

**Requirements from Spec 004 artifacts** (already finalized):

- [x] Review Spec 004 artifact set (spec.md, plan.md, data-model.md, contracts/)
- [x] Verify immutable versioning model (soft-delete recovery, version lineage)
- [x] Assess backend dependencies: Query audit table, version schema, archive mechanism
- [x] Prioritize Phase 1-2 tasks: Setup (T001-T005), Foundation (T006-T010)
- [x] Identify integration points with Spec 003 execution engine

**Decision Gates**:

1. ✅ Immutable versioning: Spec 003 provides `saved_queries` + `query_execution_log` tables as foundation; Spec 004 adds `saved_query_versions`, `saved_query_events`, soft-delete columns (`deleted_at`, `recoverable_until`), and tags. All implementable.
2. ✅ Capacity: SQLite JSON column for builder snapshot is sufficient for MVP; no blocking constraint.
3. ✅ Dashboard integration: Spec 005 consumes saved queries via `GET /api/v1/saved-queries` list; no blocking ambiguities in contracts.

**Risks & Unknowns**:

- [x] Version retention: unlimited versions per query (MVP scope — no archiving threshold set yet)
- [x] Tag search: LIKE/ILIKE on JSON tags column is sufficient for MVP scale
- [x] Soft-delete recovery integrates cleanly: 24h window, NULL out `deleted_at`/`recoverable_until`

**Plan assessment (2026-05-09)**: Spec 003 stub layer (query_persistence_service.py, basic saved_queries table) provides the integration foundation. Spec 004 implementation replaces stubs with full CRUD + versioning + tags + search + soft-delete + execution history. Phase 1-2 of tasks.md (T001-T013) are the critical-path blockers; US1-US5 (T014-T090) + Phase 8-9 (T091-T106) follow sequentially. No blocking ambiguities. Proceeding to Do phase.

---

## Do

**Execute Spec-Kit workflow based on Plan requirements**:

- [x] Run `/speckit.specify` to refine spec requirements from Plan section
- [x] Run `/speckit.plan` to generate implementation phases and technical context
- [x] Run `/speckit.tasks` to decompose phases into granular, parallelizable tasks
- [x] Verify spec artifacts (spec.md, plan.md, data-model.md, contracts/\*, tasks.md) are committed
- [x] Implement Spec 004 backend foundations and APIs (saved query versioning/events/executions + service layer + endpoint wiring)
- [x] Add Spec 004 contract and integration tests (`test_saved_queries_contract.py`, `test_saved_query_lifecycle.py`, `test_saved_query_search.py`, `test_saved_query_recovery.py`)
- [x] Add compatibility bridge for legacy saved-query payloads (`config`) and responses (`queries`, `executions`) to avoid regressions in Spec 003 E2E tests
- [x] Restore accidentally removed upload endpoint (`/api/v1/workspaces/{workspace_id}/sources/upload`) so non-Spec-004 flows remain intact

**Execution log (2026-05-09)**:

- `speckit.implement` executed for Spec 004 scope.
- Fixed implementation integration defects introduced during broad rewrite:
  - removed duplicate/legacy route collisions in `main.py`
  - restored missing helper `_sq_service`
  - resolved route registration bug where decorator was attached to helper
  - restored upload endpoint that had been removed during endpoint refactor
- Added DB additive migrations for Spec 004 tables/columns/indexes in `metadata_db.py`.
- Added new service implementation in `app/services/query_service.py`.
- Completed documentation tasks (T105-T109): SC verification protocols in quickstart.md; README Spec 004 feature section.
- Completed frontend routing and integration (T004-T005, T023-T102):
  - Installed react-router-dom; BrowserRouter in `main.tsx`
  - App.tsx: Routes for `/`, `/saved-queries`, `/saved-queries/:queryId`; nav links
  - QueryBuilderPanel: `onSaveRequest` + `initialSnapshot` props; Save Query button
  - Load in Builder flow: `SavedQueryDetail` → hydrate builder state → navigate to `/`
  - Fixed 5 incorrect relative import paths across frontend components
  - Build passes: `pnpm --filter builder build` (321 kB, 75 modules)
- **Tasks complete: 109/109**

## Check

**Validation outcomes**:

- [x] `speckit.analyze` executed for `spec.md` / `plan.md` / `tasks.md`
- [x] Spec 004 backend integration tests pass: `26 passed`
- [x] Full backend test suite pass: `90 passed`
- [x] Builder production build pass: `pnpm build` successful (321 kB, 75 modules)
- [x] All 109/109 tasks marked complete in `tasks.md`

**Analyze findings summary**:

- Implementation is complete and test-verified for code paths.
- Governance/document alignment gaps remain in Spec 004 artifacts (constitution traceability sections, tasks checklist state, and spec/plan/task wording drifts).
- These are documentation/process-quality gaps, not runtime blockers for implemented behavior.

**Remediation update (2026-05-09, post-analyze rerun)**:

- Spec/plan/tasks were reconciled for endpoint model consistency (PATCH update + duplicate lineage).
- Tasks checklist completion state was updated to reflect merged backend work.
- Additional SC verification tasks were added for SC-001/SC-002/SC-003 measurement protocols.
- Execution-history integration hook task (T093) was implemented to close FR-019/SC-004 coverage gap.

**Check decision**: PASS for implementation quality and integration safety; carry governance-document cleanup as follow-up work item.

**Round closure note**: Awaiting explicit human confirmation to move status from `Review` to `Complete` per PDCA governance.

## Act

**Learnings**:

- [x] Immutable versioning model works with additive SQLite migrations and event/audit tables.
- [x] Backward-compatible API adaptation is required when evolving payload shapes (`config` -> `builder_snapshot`) across MVP phases.
- [x] Endpoint refactors in `main.py` can create high-blast-radius regressions; full-suite regression run is mandatory in Check phase.

**Decisions**:

- [x] Round 17 implementation accepted as complete (tests and build green).
- [x] Keep Rounds 18 and 19 in Planning (sequential execution).
- [x] Execute governance-document remediation pass on Spec 004 artifacts and rerun `speckit.analyze`.

**Status transition**:

- [x] Transitioned to `Review` after Check pass.
- [x] Marked `Complete` after human confirmation (2026-05-09). Backend delivery ready for git commit.

**Next Round**:

- Round_18 goal remains: Implement **Spec 005: Dashboard & Visualizations**.
- Entry condition: keep backend baseline from Round 17 unchanged; treat Spec 004 governance-doc cleanup as parallel documentation maintenance, not a blocker.

## Promotions

- [x] → context/ : no direct promotion (captured in round record)
- [x] → skills/ : no new reusable skill promoted in this round
