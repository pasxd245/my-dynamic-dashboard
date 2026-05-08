# Implementation Plan: Relationship Rules (Spec 002)

**Branch**: `002-relationship-rules` | **Date**: 2026-05-08 | **Spec**: `/specs/002-relationship-rules/spec.md`
**Input**: Feature specification from `/specs/002-relationship-rules/spec.md`

## Summary

Implement governed relationship rules between workspace columns with lifecycle review, overlap/cardinality validation, and immutable audit trail. The design replaces the legacy relationship stub table with two canonical tables, adds backend services for overlap/cardinality and broken-state evaluation, exposes complete REST endpoints, and adds builder UI flows for create/review/edit/delete. The outcome is constitution-aligned relationship governance for cross-table readiness.

## Technical Context

**Language/Version**: Python 3.12 (backend), JavaScript ES2022 (React 18 + Vite builder)
**Primary Dependencies**: FastAPI, Pydantic, Polars, DuckDB, SQLite (`sqlite3`), React 18
**Storage**: SQLite metadata DB for rules/audit; parquet-backed data frames for overlap checks
**Testing**: `pytest` backend contract + integration suites; builder smoke via Vite build and manual flow checks
**Target Platform**: Linux local/dev container with browser-based builder UI
**Project Type**: Web application (backend API + frontend builder)
**Performance Goals**: SC-002 overlap compute under 5 seconds for up to 100k rows; SC-001 create-to-approve flow under 3 minutes
**Constraints**: Block approval for overlap `< 0.05` without override reason; warn/acknowledge for overlap `< 0.80`; preserve append-only audit history
**Scale/Scope**: Single-workspace, single-user governance flow for MVP; cross-workspace joins out of scope

## Constitution Check

Pre-design gate review (must pass):

1. Data quality gate: PASS
   Relationship creation and review depend on existing profiled columns and type metadata.
2. Relationship confidence gate: PASS
   Lifecycle enforces suggested/reviewed/approved and blocks low-confidence approvals without override.
3. Metric contract gate: PASS
   Feature does not invent metrics; it provides governed relationships used by downstream metric gates.
4. Reconciliation residual gate: PASS
   No recommendation output is introduced; reconciliation behavior remains unchanged.
5. Challenge stability gate: PASS
   Feature is governance plumbing and does not promote unstable findings to decision-ready output.

Post-design re-check: PASS

- `research.md` defines overlap/cardinality/broken detection decisions with governance thresholds.
- `data-model.md` enforces traceability with immutable audit entities.
- API contract keeps approved-only semantics explicit for downstream eligibility filters.

## Project Structure

### Documentation (this feature)

```text
specs/002-relationship-rules/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── relationship-rules.openapi.yaml
└── tasks.md
```

### Source Code (planned touch points)

```text
apps/backend/
├── app/
│   ├── main.py
│   ├── schemas.py
│   ├── core/
│   │   └── metadata_db.py
│   └── services/
│       ├── profile_service.py
│       ├── upload_service.py
│       └── relationship_service.py            # new
└── tests/
    ├── contract/
    │   └── test_relationship_rules_contract.py # new
    └── integration/
        ├── test_relationship_lifecycle.py      # new
        └── test_relationship_broken_rules.py   # new

apps/builder/
└── src/
    ├── App.jsx
    └── api/
        └── workspaceApi.js
```

## Implementation Phases

### Phase 0: Research

- Completed in `research.md`.
- Resolved unknowns for overlap strategy, cardinality mapping, broken rule detection, and profile-vs-scan decision policy.

### Phase 1: Data Model + DB Migration

- Drop the legacy `relationships` stub table.
- Create `relationship_rules` and `relationship_audit` tables with indexes.
- Add migration-safe initialization logic in `apps/backend/app/core/metadata_db.py`.
- Ensure status/value constraints are enforced in application validations.

### Phase 2: Relationship Service

- Add `apps/backend/app/services/relationship_service.py`.
- Implement create/edit/list/get/delete/review orchestration.
- Compute overlap via adaptive path:
  - Fast estimate from profile top-k when valid.
  - Exact DuckDB distinct-intersection SQL when required.
- Compute cardinality from `column_profiles.uniqueness_ratio` thresholds.
- Implement broken-rule detection for missing columns and incompatible type drift.

### Phase 3: API Endpoints

- Extend `apps/backend/app/schemas.py` with request/response DTOs.
- Extend `apps/backend/app/main.py` with endpoints:
  - `POST /api/v1/workspaces/{workspaceId}/relationships`
  - `GET /api/v1/workspaces/{workspaceId}/relationships`
  - `GET /api/v1/workspaces/{workspaceId}/relationships/{relationshipId}`
  - `PATCH /api/v1/workspaces/{workspaceId}/relationships/{relationshipId}/review`
  - `PUT /api/v1/workspaces/{workspaceId}/relationships/{relationshipId}`
  - `DELETE /api/v1/workspaces/{workspaceId}/relationships/{relationshipId}`
- Enforce response/error semantics for 400/404/409 as documented in contract.

### Phase 4: Builder UI

- Add relationship panel in `apps/builder/src/App.jsx`:
  - Column selectors for source/target columns.
  - Join type and relationship type controls.
  - Overlap percentage + cardinality display.
  - Review actions (`reviewed`, `approved`, `rejected`) with reason capture.
  - Warning and override flows for low overlap.
  - Relationship list with status and broken indicators.
- Extend `apps/builder/src/api/workspaceApi.js` for relationship endpoints.

### Phase 5: Tests

- Add contract tests for request/response shape and error policies.
- Add integration tests for:
  - Create -> reviewed -> approved lifecycle.
  - Approval block at `< 5%` overlap without override.
  - Warning/acknowledgement behavior at `< 80%` overlap.
  - Edit reset to `suggested` and recompute behavior.
  - Delete behavior with retained audit trace.
  - Broken flag updates after schema change/deleted column.
- Run `cd apps/backend && pytest` and keep existing suite green.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| None      | N/A        | N/A                                  |
