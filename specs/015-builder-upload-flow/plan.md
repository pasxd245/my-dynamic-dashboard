# Implementation Plan: Builder Upload Flow Completion

**Branch**: `015-builder-upload-flow` | **Date**: 2026-05-11 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/015-builder-upload-flow/spec.md`

## Summary

Complete the Round 32 single-feature objective by delivering a user-visible upload journey in the builder: source-type selection, Excel sheet choice when required, progress/error feedback, and successful workspace arrival. The plan preserves Round 31 backend source registry dispatch and upload endpoint semantics, and constrains work to upload UX and integration touchpoints only.

## Technical Context

**Language/Version**: TypeScript 5.x + React 18 (builder), Python 3.12 + FastAPI (existing upload API integration)  
**Primary Dependencies**: React Router, TanStack Query, Zustand, FastAPI, Polars-backed ingestion services  
**Storage**: Existing backend metadata DB + parquet persistence (unchanged by this feature)  
**Testing**: Vitest + React Testing Library (builder), pytest API/integration tests (backend), manual smoke workflow checks  
**Target Platform**: Linux dev + containerized deployment, browser-based builder UI  
**Project Type**: Web application (frontend builder flow with existing backend integration)  
**Performance Goals**: Upload state changes visible without perceived lag; progress state transitions must remain responsive under normal local/dev network conditions  
**Constraints**:

- Round 32 is single-feature only (upload flow completion)
- Preserve Round 31 source-dispatch and upload request semantics
- No unrelated refactors in builder shell, query flow, or backend architecture
- No new source types or endpoint contract rewrites

**Scale/Scope**:

- Primary: `apps/builder/src/**` upload flow surfaces and state transitions
- Integration touchpoints only: `apps/builder/src/api/workspaceApi.ts`, `apps/backend/app/api/upload.py` behavior compatibility checks
- Spec artifacts: `specs/015-builder-upload-flow/**`

## Implementation Constraints (Round 32)

1. Only one user-visible feature outcome is allowed this round: complete upload flow UX.
2. Existing backend upload endpoint path and dispatch (`parse_dataframe_via_source_registry`) remain behaviorally unchanged.
3. Existing non-Excel upload path (CSV and single-sheet behavior) must preserve user-visible outcome parity.
4. Any additional improvements not required for FR-001..FR-012 are explicitly deferred.
5. Changed files must remain limited to builder upload UX, targeted integration tests, and spec docs.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Pre-Phase 0 gate review:

1. **Business-question-first**: PASS. Feature directly answers whether users can complete upload-to-workspace reliably in one guided flow.
2. **Metric contract before visualization**: PASS. No KPI/chart logic introduced.
3. **Relationship rule before cross-table query**: PASS. Upload UX does not alter relationship-rule lifecycle.
4. **Reconciliation before recommendation**: PASS. No recommendation outputs in scope.
5. **Challenge/sensitivity before decision-ready**: PASS. No decision-ready claims added.
6. **Traceability for every claim**: PASS WITH REQUIREMENT. Upload state, selected source type, selected sheet, and transition outcome must be observable in UI/test evidence.
7. **Reproducibility from raw inputs**: PASS WITH REQUIREMENT. Same file + same selections must route through same backend semantics and produce stable outcomes.

Post-Phase 1 design re-check:

1. PASS. Design keeps backend semantics untouched and scopes change to upload UX state handling.
2. PASS. Requirement mapping includes gate coverage and explicit verification commands.
3. PASS. Out-of-scope refactors remain excluded.

## Project Structure

### Documentation (this feature)

```text
specs/015-builder-upload-flow/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── builder-upload-flow-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/builder/src/
├── App.tsx
├── api/
│   ├── workspaceApi.ts
│   └── types.ts
├── pages/
│   └── BuilderWorkflowPage.tsx
├── components/
│   └── workflow-shell/
└── state/

apps/backend/app/
├── api/
│   └── upload.py
└── services/
   ├── upload_service.py
   └── source_registry.py
```

**Structure Decision**: Web application structure with frontend-first changes in `apps/builder/src/**`, plus backend upload compatibility verification only. No architectural expansion beyond current upload and session-stage boundaries.

## Phase Plan

### Phase 0: Research and Clarification

Goals:

1. Resolve unknowns around source-type/file compatibility rules for current backend behavior.
2. Resolve Excel sheet-picking trigger logic (single-sheet bypass vs multi-sheet required).
3. Resolve progress visibility strategy without introducing new backend contracts.
4. Resolve workspace transition contract and controlled failure handling.

Outputs:

- `research.md` with decisions, rationale, and alternatives for all uncertainties.

### Phase 1: Design and Contracts

Goals:

1. Define upload-session, source-type, sheet-selection, progress-state, and workspace-transition entities.
2. Define UI/API integration contract preserving existing endpoint semantics.
3. Define state-transition and validation rules for revised selection paths.

Outputs:

- `data-model.md`
- `contracts/builder-upload-flow-contract.md`
- `quickstart.md`

### Phase 2: Implementation Planning and Verification Design

Goals:

1. Convert FR/NFR/SC into concrete implementation slices with strict single-feature boundaries.
2. Define test command matrix (unit/integration/manual) that proves gates A-F.
3. Define regression checks proving Round 31 semantics are preserved.

Outputs:

- Requirement mapping matrix (this plan)
- Verification approach (this plan)
- Scope and constraint enforcement checklist (this plan)

## Requirement Mapping Matrix

| Requirement | Scope Surface                                              | Gate           | Test / Evidence                                                                |
| ----------- | ---------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------ |
| FR-001      | Upload form source-type control                            | Gate A, Gate D | Builder UI interaction test for required source-type selection                 |
| FR-002      | Source-type/file compatibility validation                  | Gate A, Gate D | Validation tests for mismatched file/type combinations                         |
| FR-003      | Existing upload API request semantics                      | Gate B         | API contract regression check against `/api/v1/workspaces/{id}/sources/upload` |
| FR-004      | Excel multi-sheet path requires explicit sheet choice      | Gate C         | Multi-sheet acceptance scenario test + manual smoke                            |
| FR-005      | Single-sheet Excel bypasses extra picker                   | Gate C         | Single-sheet acceptance scenario test                                          |
| FR-006      | Sheet discovery failure recovery path                      | Gate F         | Error-state UI test with retry/reselect route                                  |
| FR-007      | Upload lifecycle visibility                                | Gate D         | Progress state rendering tests (in-progress/success/failure)                   |
| FR-008      | Success transition to workspace context                    | Gate E         | Navigation + active context assertion after upload success                     |
| FR-009      | Failure keeps user in upload context                       | Gate F         | Failure scenario test asserts no transition and actionable retry               |
| FR-010      | State consistency on revised selections                    | Gate D, Gate F | State reset/clear tests when source type or sheet changes                      |
| FR-011      | Single-feature round scope only                            | Gate A         | `git diff --name-only` scope audit against allowed paths                       |
| FR-012      | Non-Excel behavior remains unchanged                       | Gate B         | CSV upload regression tests and manual parity smoke                            |
| NFR-001     | First-time user clarity                                    | Gate D         | UX acceptance walkthrough in quickstart with no external docs                  |
| NFR-002     | Timely progress updates                                    | Gate D         | UI timing assertions and manual perceived responsiveness check                 |
| NFR-003     | Clear/actionable errors                                    | Gate F         | Error-message consistency assertions with actionable guidance                  |
| NFR-004     | Tight round scope                                          | Gate A         | Plan/task scope review + changed-file audit                                    |
| SC-001      | >=95% valid upload attempts complete in acceptance runs    | Gate D, Gate E | Acceptance test suite summary log                                              |
| SC-002      | 100% multi-sheet uploads require sheet choice              | Gate C         | Multi-sheet scenario matrix results                                            |
| SC-003      | 100% single-sheet uploads skip unnecessary picker          | Gate C         | Single-sheet scenario matrix results                                           |
| SC-004      | 100% successful uploads transition correctly               | Gate E         | Transition test and session-state evidence                                     |
| SC-005      | 100% failed uploads stay in upload context with retry path | Gate F         | Failure-path evidence and retry assertions                                     |
| SC-006      | Users correctly identify status in 9/10 observations       | Gate D         | Stakeholder validation notes and quickstart observation checklist              |

## Verification Approach

### Automated verification

1. Builder unit/integration tests (Vitest + RTL)

- Source-type selector required-state behavior
- Compatibility validation for type/file mismatch
- Sheet-picker conditional rendering and required selection
- Progress state transitions and failure messaging
- Success routing and context resolution

1. Backend regression tests (pytest)

- Upload endpoint request/response compatibility
- Registry-dispatch path remains active for csv/excel

1. Static scope checks

- Changed file audit constrained to planned scope

### Manual acceptance verification

1. CSV upload happy path to workspace transition.
2. Excel single-sheet path without extra picker.
3. Excel multi-sheet path with required sheet selection.
4. Upload failure path with actionable retry guidance.
5. Temporary progress stall path confirms no false success UI.

### Command matrix (planned)

```bash
# Builder tests
pnpm --filter builder test --run

# Backend tests focused on upload semantics
cd apps/backend && pytest tests -k "upload or source_registry" -q

# Scope audit
git diff --name-only
```

## Complexity Tracking

No constitution violations are accepted. Complexity is constrained to completing one user-visible upload flow over existing backend dispatch semantics, with no unrelated architectural or product-surface expansion.
