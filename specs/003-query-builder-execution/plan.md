# Implementation Plan: Query Builder & Execution (MVP 1)

**Branch**: `002-relationship-rules` | **Date**: 2026-05-09 | **Spec**: `/specs/003-query-builder-execution/spec.md`
**Input**: Feature specification from `/specs/003-query-builder-execution/spec.md`

## Summary

Deliver a governed query-builder and execution pipeline that lets analysts build multi-table DuckDB queries without writing SQL, preview safely with a hard timeout, execute/export results with lineage, and persist reusable query configurations. The implementation enforces approved relationship rules from spec 002, parameterized filters for injection safety, and immutable execution lineage for traceability and reproducibility.

## Technical Context

**Language/Version**: Python 3.12 (FastAPI backend), TypeScript/React (builder UI)  
**Primary Dependencies**: FastAPI, DuckDB, Polars/metadata services, React, TanStack Query  
**Storage**: SQLite metadata + Parquet data files queried through DuckDB  
**Testing**: `pytest` (contract + integration), builder UI flows, export validation checks  
**Target Platform**: Linux host/dev environment (local via Vite + Uvicorn)  
**Project Type**: Web application feature (backend API + frontend builder UX)  
**Performance Goals**: Preview (LIMIT 100) <5s or timeout; full execution target <5s or timeout with messaging; safe export for large datasets  
**Constraints**: Approved-relationship-only joins, hard 5s timeout, parameterized filters only, preview LIMIT 100, Excel/CSV export only  
**Scale/Scope**: Single workspace per query, 100k+ row to 1M+ row result scenarios, MVP 1 analyst workflow

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Pre-Phase 0 gate review:

1. Principle I (Business-question-first): PASS. Spec defines concrete analyst decision path from upload/relationships to governed query outputs.
2. Principle II (Metric contract before visualization): PASS. Scope is query execution and export, not metric-definition or dashboard semantics.
3. Principle III (Relationship rule before cross-table query): PASS. Joins explicitly restricted to approved relationship rules from spec 002.
4. Principle IV (Reconciliation before recommendation): PASS. Feature does not emit recommendation language.
5. Principle V (Challenge/sensitivity before decision-ready): PASS. Surface role is exploration/analysis workbench, not decision-ready recommendation.
6. Principle VI (Traceability for every claim): PASS WITH REQUIREMENT. Execution/export lineage must include source tables, rules, filters, aggregations, and timestamps.
7. Principle VII (Reproducibility from raw inputs): PASS WITH REQUIREMENT. Persist query configuration hash + execution snapshot for reproducible reruns and audits.

Post-Phase 1 re-check:

- PASS. `research.md`, `data-model.md`, `quickstart.md`, and `contracts/query-builder-execution.openapi.yaml` align to approved-rule joins, lineage traceability, and reproducible query snapshots.

## Project Structure

### Documentation (this feature)

```text
specs/003-query-builder-execution/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── query-builder-execution.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
apps/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── schemas.py
│   │   ├── core/
│   │   └── services/
│   └── tests/
│       ├── contract/
│       └── integration/
└── builder/
    └── src/
        ├── api/
        └── App.tsx

specs/001-upload-profile-field-roles/
specs/002-relationship-rules/
specs/003-query-builder-execution/
```

**Structure Decision**: Keep existing monorepo boundaries. Implement query execution, validation, lineage, and persistence in backend services/APIs and query-builder UX in builder frontend, while preserving hard dependencies on specs 001 and 002 metadata/rule flows.

## Phase 0: Research (Completed)

Resolved in `research.md`:

1. DuckDB SQL generation with strict filter parameterization.
2. Hard timeout and memory/cardinality safety policy.
3. Immutable lineage snapshot structure and export embedding.
4. Join ordering and circular-dependency validation.
5. Dual-point approved-rule enforcement (build-time + execution-time).
6. Injection-defense boundaries and safe query templating.

## Phase 1: Design And Contracts (Completed)

1. `data-model.md`: Query DSL, execution state/log, lineage metadata, saved-query persistence model.
2. `contracts/query-builder-execution.openapi.yaml`: Validate/preview/execute/export and saved-query CRUD + execution history endpoints.
3. `quickstart.md`: End-to-end acceptance walkthrough covering US-1 through US-7 and edge-case verification.
4. Agent context updated in `.github/copilot-instructions.md` to point to this plan.

## Phase 2: Implementation Plan (Execution-Ready)

### Track 1: Query DSL Validation And SQL Translation

1. Implement/verify backend query-config validator for base table, selected columns, operators, aggregations, group-by consistency, and join shape rules (FR-001 to FR-006, FR-015).
2. Implement SQL translation pipeline that emits DuckDB-compatible SQL + ordered parameters only (FR-006, FR-010).
3. Add join-graph checks (acyclic order, approved-rule-only enforcement) before SQL generation (FR-005, FR-015).

**Gate A (Translation Safe)**

- Invalid configs are rejected pre-execution with actionable validation errors.
- Generated SQL matches query config structure and is parameterized.

### Track 2: Preview/Execute Runtime Safety

1. Implement preview endpoint semantics: enforced LIMIT 100 + estimated total row metadata (FR-008).
2. Enforce hard 5-second timeout and user-facing timeout responses for preview and execute (FR-007, FR-016).
3. Add memory estimation and large-result safeguards before execution/materialization (FR-009).
4. Ensure empty-result, null-handling, and execution outcome logging paths are explicit (FR-013, FR-014, FR-020).

**Gate B (Execution Safe)**

- Preview and execution either complete within policy or fail with clear guidance.
- Runtime safeguards prevent backend/browser degradation for large query shapes.

### Track 3: Export Lineage And Traceability

1. Implement Excel/CSV export pipeline with format-specific lineage embedding (FR-011, FR-012, FR-021).
2. Snapshot lineage fields at execution/export time (tables, relationships/status, filters, aggregations, group-by, timestamp, config hash) (FR-020, FR-021).
3. Validate special-character/null handling and large export behavior in integration checks (FR-013, FR-021).

**Gate C (Audit-Ready Export)**

- Every export contains required lineage fields.
- Export artifacts are usable and consistent across Excel and CSV formats.

### Track 4: Saved Query Lifecycle

1. Implement save/load/update/delete/duplicate flow against workspace metadata storage (FR-017, FR-018).
2. Add schema-drift validation when loading or executing saved queries; return guided remediation messages (FR-019).
3. Expose execution history retrieval for saved queries and retain immutable snapshots for audit (FR-020).

**Gate D (Reuse + Reproducibility)**

- Saved queries round-trip with full config fidelity.
- Schema drift and rule-status changes are detected and communicated clearly.

### Track 5: Frontend Builder UX Integration

1. Bind builder panels (base table, columns, filters, joins, aggregations, group-by) to contract endpoints with live validation (FR-001 to FR-005, FR-015).
2. Implement preview/execute/export UX states and error messaging contracts (FR-007, FR-008, FR-011, FR-016).
3. Integrate saved-query library actions (save/load/duplicate/delete/history) into builder flow (FR-017, FR-018, FR-020).

**Gate E (Analyst Workflow Complete)**

- Analyst can complete build → preview → execute → export → save/reload path without writing SQL.

## Requirement Traceability (Plan-Level)

- FR-001 to FR-006, FR-010, FR-015: Track 1 + Track 5
- FR-007 to FR-009, FR-013, FR-014, FR-016: Track 2 + Track 5
- FR-011, FR-012, FR-021: Track 3
- FR-017 to FR-020: Track 4 + Track 5

## Verification Matrix

1. Contract/API verification: schema and response semantics for validate/preview/execute/export/saved-query operations.
2. Backend verification: SQL generation correctness, timeout enforcement, approved-rule checks, lineage capture, execution logging.
3. Frontend verification: continuous validation UX, preview/execute flows, export actions, saved-query lifecycle.
4. Scale/error verification: large result safeguards, empty/null handling, schema drift behavior, unapproved-rule rejection.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| None      | N/A        | N/A                                  |
