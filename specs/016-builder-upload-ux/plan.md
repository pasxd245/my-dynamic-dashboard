# Implementation Plan: Builder Upload UX Refresh

**Branch**: `014-dashboard-streamlit-foundation-audit` | **Date**: 2026-05-11 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/016-builder-upload-ux/spec.md`

## Summary

Refresh the builder upload flow UX with a stage sidebar, guided multi-step progression, blocking loading mask during async operations, and coordinated inline plus toast feedback, while preserving existing upload backend request/response semantics and constraining changes to builder upload surfaces only.

## Technical Context

**Language/Version**: TypeScript 5.x + React 19 (builder), Python 3.12 + FastAPI (existing backend integration unchanged)
**Primary Dependencies**: React Router, TanStack Query, Zustand, Vitest/RTL, existing builder toast primitives, existing upload API client
**Storage**: Existing backend metadata DB + parquet persistence only (no new storage or schema changes)
**Testing**: Vitest + React Testing Library (builder), pytest focused backend regression for upload semantics, builder smoke checks
**Target Platform**: Browser-based builder UI on Linux/dev containers and standard desktop/mobile viewports
**Project Type**: Web application (frontend UX refresh over stable backend contract)
**Performance Goals**: Step transitions and feedback updates remain responsive; loading mask appears immediately for upload/discovery async actions
**Constraints**:

- Keep scope strictly to builder upload UX surfaces (sidebar, guided steps, loading mask, inline/toast feedback)
- Preserve backend upload endpoint semantics and payload/response contract behavior
- Do not introduce new source types, backend parsing behavior, or unrelated builder-shell refactors
- Maintain accessibility and mobile usability for upload journey controls and messaging

**Scale/Scope**:

- Primary surfaces in `apps/builder/src/**` upload workflow UI/state files
- Compatibility verification touchpoints only for `apps/backend/app/api/upload.py` behavior expectations
- Planning artifacts under `specs/016-builder-upload-ux/**`

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Pre-Phase 0 review:

1. **Business-question-first**: PASS. The business question is whether users can complete upload reliably and confidently with lower confusion in the builder journey.
2. **Metric contract before visualization**: PASS. No KPI/chart or metric-contract changes are in scope.
3. **Relationship rule before cross-table query**: PASS. No relationship-rule or query-join behavior changes are introduced.
4. **Reconciliation before recommendation**: PASS. No recommendation or decision-output surface is modified.
5. **Challenge/sensitivity before decision-ready**: PASS. Feature is workflow UX, not decision-ready findings.
6. **Traceability for every claim**: PASS WITH REQUIREMENT. Step state, blocked progression, async mask state, and message emissions must be test-observable.
7. **Reproducibility from raw inputs**: PASS WITH REQUIREMENT. Same upload inputs must produce same backend behavior; UX improvements must not alter backend outcomes.

Post-Phase 1 design re-check:

1. PASS. Data model and contract define UX-only state objects and preserve backend semantics.
2. PASS. Verification matrix includes requirement-to-test traceability for all UX gates.
3. PASS. Scope controls explicitly reject non-upload and backend-semantic refactors.

## Project Structure

### Documentation (this feature)

```text
specs/016-builder-upload-ux/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── builder-upload-ux-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/builder/src/
├── pages/
│   └── BuilderWorkflowPage.tsx
├── components/
│   └── workflow-shell/
├── state/
├── api/
│   ├── workspaceApi.ts
│   └── types.ts
└── test/

apps/backend/app/
└── api/
    └── upload.py
```

**Structure Decision**: Use the existing web app structure and confine implementation to builder upload UX presentation/state layers plus regression verification of current backend upload behavior.

## Phase Plan

### Phase 0: Research and Clarification

Goals:

1. Confirm sidebar stage model and guarded navigation pattern that prevents bypassing required steps.
2. Confirm loading mask behavior for discovery/upload async lifecycles without backend contract changes.
3. Confirm inline plus toast feedback split (validation/actionability inline, status outcomes toast).
4. Confirm accessibility and responsive constraints for step navigation and messaging.

Output:

- `research.md` with decisions, rationale, and alternatives considered.

### Phase 1: Design and Contracts

Goals:

1. Define UX state entities: stage navigation model, guided step form state, async mask state, and feedback message state.
2. Define integration contract that preserves existing upload API semantics while expanding frontend-only behavior rules.
3. Define validation and transition rules for upstream-change reset/revalidation and blocked-stage guidance.

Outputs:

- `data-model.md`
- `contracts/builder-upload-ux-contract.md`
- `quickstart.md`

### Phase 2: Implementation Planning and Verification Design

Goals:

1. Map FR/NFR/SC requirements to implementation surfaces and tests.
2. Define automated/manual verification commands with builder-first test emphasis.
3. Enforce scope discipline and backend semantic preservation checks.

Outputs:

- Requirement mapping matrix in this plan
- Verification matrix in this plan and contract/quickstart artifacts

## Requirement Mapping Matrix

| Requirement | Implementation Surface                                                           | Gate    | Verification                                                           |
| ----------- | -------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------- |
| FR-001      | Sidebar stage model + current/completion/blocked rendering                       | A       | Builder UI tests for stage states and active highlight                 |
| FR-002      | Stage guard logic for blocked downstream navigation                              | A       | Interaction tests that enforce prerequisite completion                 |
| FR-003      | Guided multi-step form containers and scoped stage inputs                        | B       | Step-by-step progression tests                                         |
| FR-004      | Stage-level required validation + inline corrective messages                     | B, D    | Validation tests asserting inline guidance location/content            |
| FR-005      | Dependent-state reset/revalidation on upstream change                            | B       | State reset tests for changed source/file/step inputs                  |
| FR-006      | Blocking loading mask during discovery/upload async operations                   | C       | Async operation tests asserting mask visibility and blocked actions    |
| FR-007      | Loading mask removal and next-state restoration on completion                    | C       | Success/failure completion tests for mask teardown and control restore |
| FR-008      | Toast emission for upload/discovery success and failure                          | D       | Toast behavior tests for message type and timing                       |
| FR-009      | Inline operation-error messaging at affected step                                | D       | Failure path tests asserting step-local recovery guidance              |
| FR-010      | Preserve backend upload semantics and API contract behavior                      | E       | Backend regression tests + unchanged request/response shape checks     |
| FR-011      | Scope constrained to builder upload UX surfaces                                  | F       | Changed-file audit against planned paths                               |
| FR-012      | Layout direction alignment with `docs/design/Layout_A.png` hierarchy/orientation | A, F    | Manual UX review checklist linked to visual hierarchy points           |
| NFR-001     | Mobile + desktop step navigation and control accessibility                       | A       | Responsive manual runbook + focused component tests                    |
| NFR-002     | Keyboard/assistive usability for stages, mask, and feedback                      | D       | Keyboard flow and ARIA announcement checks                             |
| NFR-003     | Concise, actionable, unambiguous status/error copy                               | D       | Message copy assertions in UI tests/manual checklist                   |
| NFR-004     | Avoid unrelated refactors                                                        | F       | Git scope diff audit                                                   |
| SC-001      | >=90% first-attempt completion in acceptance                                     | A, B, D | Structured acceptance run logs                                         |
| SC-002      | >=95% valid uploads complete without confusion-driven resubmit                   | B, D    | Observed acceptance runs                                               |
| SC-003      | 100% async discovery/upload paths show/remove mask correctly                     | C       | Automated async state tests                                            |
| SC-004      | 100% validation failures show inline corrective guidance                         | D       | Validation failure matrix                                              |
| SC-005      | 100% success/failure outcomes emit correct toast type                            | D       | Toast outcome matrix                                                   |
| SC-006      | 100% regression scenarios preserve backend upload contracts                      | E       | Backend upload regression suite                                        |
| SC-007      | Acceptance gates A-F pass before completion                                      | A-F     | Plan + quickstart verification checklist                               |

## Verification Approach

### Automated

```bash
# Builder unit/integration tests
pnpm --filter builder test --run

# Optional: builder type safety check for changed UX surfaces
pnpm --filter builder type-check

# Backend regression check for preserved upload semantics
cd apps/backend && pytest tests -k "upload or source_registry" -q
```

### Manual Acceptance

1. Stage sidebar shows ordered stages, active highlight, and blocked/completed states.
2. Blocked stage selection keeps user on required step with inline guidance.
3. Upstream input changes reset/revalidate dependent downstream step values.
4. Loading mask appears for discovery/upload, blocks conflicting actions, and clears correctly.
5. Validation failures show inline guidance; async outcomes show correct success/error toasts.
6. Success transitions to ready workspace context; failure remains in upload flow with recovery actions.
7. Mobile and keyboard-only pass over all critical controls and messages.

### Scope Audit

```bash
git diff --name-only
```

Expected: changes limited to builder upload UX surfaces, related tests, and this spec bundle.

## Complexity Tracking

No constitution violations accepted or required for this feature. Complexity remains bounded to UX behavior/state updates and verification around unchanged backend semantics.
