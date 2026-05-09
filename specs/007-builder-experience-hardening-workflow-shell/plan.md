# Implementation Plan: Builder Experience Hardening + Workflow Shell

**Branch**: `feat/enhance-ui-ux` | **Date**: 2026-05-09 | **Spec**: `/specs/007-builder-experience-hardening-workflow-shell/spec.md`
**Input**: Feature specification from `/specs/007-builder-experience-hardening-workflow-shell/spec.md`

## Summary

Harden the builder workflow so analysts always operate against explicit, visible workspace/source context, receive actionable guidance-first errors, and can trust connection readiness before actions. Deliver a workflow-oriented shell (upload/source -> schema/sheet -> query -> results/saved) with strict no-fallback state rules and dockerized stage-attributed smoke coverage for release confidence.

## Technical Context

**Language/Version**: Python 3.12 (FastAPI backend), TypeScript/React (Vite builder)  
**Primary Dependencies**: FastAPI, Pydantic, React, TanStack Query, existing backend workspace/query/saved-query services  
**Storage**: SQLite metadata + Parquet-backed data sources (via existing backend stack)  
**Testing**: `pytest` (contract/integration), builder UI flow checks, docker smoke script/runner for core journey  
**Target Platform**: Linux local/dev and dockerized pre-release environment  
**Project Type**: Web application feature hardening (backend API + builder UX + release smoke)  
**Performance Goals**: Preflight status available at shell entry and refreshable without full restart; smoke run completes in practical CI/local gate window  
**Constraints**: No hidden workspace/source fallbacks, explicit state required for query/saved actions, standardized guidance-first errors, preserve existing business behavior from specs 001-006  
**Scale/Scope**: Single workspace/source active context per session, four shell stages, one lightweight four-stage smoke path

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Pre-Phase 0 gate review:

1. Principle I (Business-question-first): PASS. Business question is whether analysts can complete core builder actions reliably without hidden state assumptions; decision informed is release-readiness of builder UX hardening.
2. Principle II (Metric contract before visualization): PASS. Feature does not introduce new metrics or dashboard KPI semantics.
3. Principle III (Relationship rule before cross-table query): PASS. Query/saved paths remain governed by prior specs; this feature hardens context gating and UX.
4. Principle IV (Reconciliation before recommendation): PASS. No recommendation outputs are added.
5. Principle V (Challenge/sensitivity before decision-ready): PASS. Scope is exploration/workbench UX reliability, not decision-ready promotion.
6. Principle VI (Traceability for every claim): PASS WITH REQUIREMENT. Actionable errors and smoke diagnostics must include stage attribution and correlation context.
7. Principle VII (Reproducibility from raw inputs): PASS WITH REQUIREMENT. Smoke flow must report deterministic stage outcomes and first-failure evidence.

Post-Phase 1 re-check:

- PASS. `research.md`, `data-model.md`, `quickstart.md`, and `contracts/builder-experience-hardening.openapi.yaml` encode explicit active-context rules, standardized actionable errors, shell stage prerequisites, and stage-by-stage smoke reporting.

## Project Structure

### Documentation (this feature)

```text
specs/007-builder-experience-hardening-workflow-shell/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── builder-experience-hardening.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
apps/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── schemas.py
│   │   ├── api/
│   │   └── services/
│   └── tests/
│       ├── contract/
│       └── integration/
├── builder/
│   └── src/
│       ├── api/
│       ├── components/
│       ├── pages/
│       └── state/
└── dashboard/
    └── streamlit_app.py

devops/
├── compose.yaml
└── compose.prod.yml

specs/001-upload-profile-field-roles/
specs/002-relationship-rules/
specs/003-query-builder-execution/
specs/004-saved-queries/
specs/005-dashboard-visualizations/
specs/006-production-deployment/
specs/007-builder-experience-hardening-workflow-shell/
```

**Structure Decision**: Keep existing monorepo boundaries. Implement preflight/context/error contracts in `apps/backend`, workflow-shell and persistent state visualization in `apps/builder`, and smoke orchestration at the existing docker/devops layer.

## Phase 0: Research (Completed)

Resolved in `research.md`:

1. Connectivity preflight model and status taxonomy (`ready|degraded|unavailable`).
2. Persistent in-shell connection indicator behavior.
3. Standard actionable error envelope with optional technical details.
4. Explicit workspace/source state and stale/unresolved handling with no fallback.
5. Workflow shell IA and prerequisite-linking behavior.
6. Docker E2E smoke scope and stage-attributed diagnostics.

## Phase 1: Design And Contracts (Completed)

1. `data-model.md`: connection status, active context, workflow stages, actionable error, session state, smoke flow entities.
2. `contracts/builder-experience-hardening.openapi.yaml`: preflight, session-state, active-context mutation, guarded query/saved routes, smoke run/result contracts.
3. `quickstart.md`: five verification gates covering preflight, explicit context, errors, shell IA, and docker smoke.
4. Agent context updated in `.github/copilot-instructions.md` to point to this plan.

## Phase 2: Implementation Plan (Execution-Ready)

### Track 1: Connectivity Preflight And Persistent Status

1. Add/extend backend preflight endpoint that emits normalized dependency readiness and guidance (FR-001, FR-002).
2. Integrate builder shell with a persistent status component sourced from unified preflight/session state query cache (FR-001, FR-013).
3. Support transient recovery refresh behavior without full application restart (US2 AC-3).

**Gate A (Readiness Visible)**

- Preflight runs before workflow actions are enabled.
- Indicator stays visible and accurate across shell navigation.

### Track 2: Actionable Error Standardization

1. Standardize backend error envelope for upload/profile/query/saved-query flows with guidance-first shape (FR-003, FR-004, FR-005).
2. Map existing failure modes to stable error codes and stage attribution.
3. Implement builder renderer that prioritizes guidance and exposes technical details only via explicit user action.

**Gate B (Errors Actionable)**

- Scoped failures always show actionable next steps.
- Technical details are optional and non-blocking to user comprehension.

### Track 3: Explicit Workspace/Source State Enforcement

1. Enforce explicit active workspace/source requirements for query validate/execute and saved-query actions (FR-008).
2. Remove/disable any hidden implicit default context fallback in relevant backend routes and frontend route assumptions (FR-009).
3. Detect and surface unresolved/stale context states, block dependent actions, and drive explicit reselection UX (FR-010).
4. Persist visible active context across stage transitions without masking stale states (FR-007, FR-013).

**Gate C (No Hidden Fallbacks)**

- No scoped action executes without explicit resolved workspace/source.
- Stale context is surfaced and blocked deterministically.

### Track 4: Workflow Shell IA And Prerequisite Guidance

1. Implement/align shell stage scaffold: upload/source -> schema/sheet -> query -> results/saved (FR-006).
2. Add prerequisite indicators and route-back links from blocked downstream stages (US3 AC-2).
3. Ensure backward/forward navigation preserves context/status visibility (FR-013).

**Gate D (Workflow Clarity)**

- First-time users can discover next actions from shell structure.
- Missing prerequisites are explicit and actionable.

### Track 5: Docker E2E Smoke For Release Confidence

1. Add smoke flow runner/script for: create workspace -> upload -> validate query -> list saved queries (FR-011).
2. Emit stage-by-stage pass/fail output with first-failure diagnostics (FR-012).
3. Integrate smoke command into pre-release verification path (manual and CI-compatible).

**Gate E (Release Evidence)**

- Smoke pass gives release confidence for feature scope.
- Smoke fail blocks acceptance and identifies exact failed stage.

## Requirement Traceability (Plan-Level)

- FR-001, FR-002: Track 1
- FR-003, FR-004, FR-005: Track 2
- FR-007, FR-008, FR-009, FR-010, FR-013: Track 3 (+ Track 4 visibility continuity)
- FR-006, FR-013: Track 4
- FR-011, FR-012: Track 5

## Verification Matrix

1. Backend contract verification: preflight, active-context guards, error-envelope consistency.
2. Builder UX verification: persistent status/context, prerequisite routing, stage navigation continuity.
3. State safety verification: unresolved/stale context blocks and no implicit fallback behavior.
4. Smoke verification: deterministic four-stage flow with stage-attributed diagnostics.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| None      | N/A        | N/A                                  |
