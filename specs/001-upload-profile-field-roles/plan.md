# Implementation Plan: Upload + Profile + Field Roles (MVP 1)

**Branch**: `001-upload-profile-field-roles` | **Date**: 2026-05-08 | **Spec**: `/specs/001-upload-profile-field-roles/spec.md`
**Input**: Feature specification from `/specs/001-upload-profile-field-roles/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Implement MVP 1 upload workspace capabilities so an analyst can ingest Excel/CSV sources, inspect per-column quality, assign governed business field roles, and export/import a reproducible manifest. The technical approach extends the existing FastAPI + Polars + SQLite backend with workspace/sheet/profile/role models and APIs, then connects the React builder UI to drive parsing overrides, profile review, role assignment, readiness evaluation, and manifest round-trip verification.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: Python 3.x (backend), JavaScript ES2022 (builder React app)  
**Primary Dependencies**: FastAPI, Polars, openpyxl, python-multipart, SQLite (`sqlite3`), React 18, Vite 7  
**Storage**: SQLite metadata DB + Parquet files + versioned manifest JSON export/import  
**Testing**: Backend pytest + FastAPI TestClient API tests (to add), builder smoke via `pnpm --filter builder build`, focused manual upload/profile/manifest E2E checks  
**Target Platform**: Linux container/local dev (Docker + VS Code terminal), browser-based builder UI  
**Project Type**: Web application (backend API + frontend builder)  
**Performance Goals**: Meet SC-001 to complete 3-file/8-sheet setup in <10 minutes, return malformed/encrypted upload errors within 5 seconds (SC-005), keep profile runs to a few seconds on bundled sample dataset  
**Constraints**: No relationship-rule or metric-contract execution in MVP 1; enforce hard time-anchor type rule and override auditability for soft constraints; sampled profiling for oversized files must record sample size and seed  
**Scale/Scope**: Single-user workspace in MVP 1, multiple files/sheets per workspace, 100k+ rows with sampled profiling for large uploads

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Pre-Phase 0 gate review:

- Principle I (Business-question-first): PASS. Spec defines business question, decision, and primary roles.
- Principle II (Metric contract before visualization): PASS. Feature explicitly defers metric contracts and only prepares role-ready fields.
- Principle III (Relationship rule before cross-table query): PASS. Feature is scoped to single-table profiling/roles; relationship logic remains out of scope.
- Principle IV (Reconciliation before recommendation): PASS. No recommendation outputs are introduced.
- Principle V (Challenge/sensitivity before decision-ready): PASS. Surfaces remain exploration + analysis workbench only.
- Principle VI (Traceability): PASS WITH DESIGN REQUIREMENT. Plan must persist source->sheet->column lineage and override history for every role summary.
- Principle VII (Reproducibility): PASS WITH DESIGN REQUIREMENT. Manifest import/export + source hash verification required before readiness badge is trusted.

Post-Phase 1 re-check:

- PASS. `data-model.md`, `contracts/`, and `quickstart.md` preserve exploration-only scope, include lineage and reproducibility artifacts, and avoid recommendation language.

## Project Structure

### Documentation (this feature)

```text
specs/001-upload-profile-field-roles/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
apps/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── schemas.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── metadata_db.py
│   │   └── services/
│   │       └── upload_service.py
│   └── requirements.txt
└── builder/
   ├── src/
   │   ├── App.jsx
   │   └── main.jsx
   └── package.json

data/
└── parquet/

specs/001-upload-profile-field-roles/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
```

**Structure Decision**: Use the existing backend + builder web-app monorepo layout. Add new upload/profile/role domain models and APIs inside `apps/backend/app/*`, wire builder workflow in `apps/builder/src/*`, and keep all planning artifacts under `specs/001-upload-profile-field-roles/`.

## Phase 0: Research Plan

1. Finalize parsing/profile strategy for `.xlsx` + `.csv` including ambiguous encoding and sampled profiling for oversized files.
2. Define manifest reproducibility contract (hashing algorithm, versioning, import mismatch behavior).
3. Define role compatibility enforcement matrix (hard vs soft constraints, override policy, audit fields).
4. Define API contract shape between backend and builder for upload, profile retrieval, role assignment, readiness status, and manifest import/export.

Phase 0 output: `research.md` with decisions, rationale, and rejected alternatives.

## Phase 1: Design And Contracts

1. Produce `data-model.md` with entities, relationships, validation rules, and state transitions.
2. Produce `contracts/upload-profile-roles.openapi.yaml` with REST endpoints and payload schemas for MVP 1.
3. Produce `quickstart.md` with an executable local flow to verify Stories 1-4 and SC-001..SC-005.
4. Update agent context marker in `.github/copilot-instructions.md` to reference this plan path.

Phase 1 output: data model, contract, and quickstart aligned with Constitution I/VI/VII and MVP 1 scope.

## Phase 2: Implementation Plan (Execution-Ready)

1. Backend schema migration and persistence layer:
   Add workspace/source/sheet/column/profile/role/override/manifest tables in `apps/backend/app/core/metadata_db.py`, and add deterministic hash + manifest serializer/deserializer utilities in `apps/backend/app/services/upload_service.py` (or a dedicated services module).

1. Backend API surface:
   Extend `apps/backend/app/schemas.py` with request/response models for profile snapshots, role assignments, readiness summaries, and manifest operations; then extend `apps/backend/app/main.py` with endpoints for upload overrides, profile fetch, role assignment, readiness status, and manifest export/import.

1. Builder integration:
   Add upload/profile/role screens and API client calls in `apps/builder/src/App.jsx` (plus extracted components as needed), and render warnings, override reason capture, and MVP 1 readiness indicator with traceability links.

1. Verification and hardening:
   Add backend tests for role compatibility rules, sampled profiling flags, and manifest round-trip hash validation, plus smoke checks for builder build and manual end-to-end flow.

## Requirement Traceability (Plan-Level)

- FR-001..FR-004: Upload parsing + profiling endpoints and persistence in Phase 2.1 and Phase 2.2.
- FR-005..FR-006: Role assignment rules and overrides in Phase 2.2 + Phase 2.3.
- FR-007..FR-008: Manifest export/import and reproducibility checks in Phase 2.1 and Phase 2.2.
- FR-009..FR-011: Readiness indicator + traceability rendering in Phase 2.2 and Phase 2.3.
- FR-012..FR-013: Upload rejection and sampled profiling behavior in Phase 2.2 with tests in Phase 2.4.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| None      | N/A        | N/A                                  |
