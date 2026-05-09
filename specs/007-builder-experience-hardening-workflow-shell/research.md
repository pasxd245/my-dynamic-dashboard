# Research: Builder Experience Hardening + Workflow Shell

**Spec**: `/specs/007-builder-experience-hardening-workflow-shell/spec.md`  
**Plan**: `/specs/007-builder-experience-hardening-workflow-shell/plan.md`  
**Date**: 2026-05-09

This research resolves the Phase 0 unknowns for builder hardening and workflow-shell guidance, aligned to the existing stack (FastAPI backend, React/Vite builder, Streamlit dashboard).

## 1. Connectivity Preflight Model

### Decision

Use a dedicated backend preflight contract consumed by builder on entry and on periodic refresh, returning a normalized status model:

- `ready`: all required dependencies are operational for scoped workflow actions.
- `degraded`: partial capability available; blocked actions are explicitly listed.
- `unavailable`: critical dependency missing; workflow actions are blocked.

The status payload includes per-dependency signals and user guidance text that is safe to display directly.

### Rationale

- Directly satisfies FR-001 and FR-002.
- Avoids late-failure discovery in upload/query/saved-query flows.
- Fits existing FastAPI health-check patterns already used in prior specs.

### Alternatives considered

- Reuse only generic `/health`: rejected because it lacks workflow-stage readiness semantics.
- Frontend-only connectivity heuristics: rejected; causes drift and hidden fallback behavior.

## 2. Persistent In-App Connection Indicator

### Decision

Render a persistent status banner/chip in the workflow shell header with:

- status (`ready|degraded|unavailable`),
- last refresh timestamp,
- "what you can do now" guidance,
- refresh action.

The indicator is sourced from a single query cache key and never replaced by local hidden assumptions.

### Rationale

- Enforces continuous visibility required by User Story 2 and FR-001.
- Keeps UX stable while moving between shell stages (FR-013).

### Alternatives considered

- Stage-local status components only: rejected due to inconsistent visibility and stale state risk.

## 3. Actionable Error Contract

### Decision

Standardize backend error envelopes for scoped actions (upload/profile/validation/execution/saved queries):

- `user_message`: primary actionable guidance,
- `next_steps`: ordered recovery steps,
- `error_code`: stable machine key,
- `stage`: workflow stage context,
- `technical_details` (optional, hidden by default),
- `correlation_id` for diagnostics.

Frontend always renders guidance first and exposes technical details behind explicit user intent (expand/toggle).

### Rationale

- Covers FR-003 through FR-005.
- Prevents low-context or developer-centric errors from blocking analysts.

### Alternatives considered

- Keep current per-route error formats: rejected because it increases user confusion and support effort.

## 4. Explicit Workspace/Source State Without Fallbacks

### Decision

Define explicit state rules in backend and builder:

- No route may infer workspace/source from hidden defaults (FR-009).
- Query validate/execute and saved-query actions require explicit `workspace_id` and `source_id` (FR-008).
- If stored active state becomes stale/unresolved, backend returns a deterministic `ACTIVE_CONTEXT_UNRESOLVED` error and frontend blocks dependent actions until reselection (FR-010).

### Rationale

- Resolves Round 20 failure mode (silent fallback to stale context).
- Makes action targeting auditable and predictable.

### Alternatives considered

- Keep last-known context as implicit fallback: rejected by feature requirement and trust goals.

## 5. Workflow Shell IA

### Decision

Adopt a four-stage shell with explicit prerequisites and completion hints:

1. Upload/Source
2. Schema/Sheet
3. Query
4. Results/Saved

Navigation allows backward/forward movement while preserving globally visible active context and connectivity state.

### Rationale

- Satisfies FR-006 and FR-013.
- Aligns builder UX with the real analyst workflow and reduces "debug-like" navigation.

### Alternatives considered

- Keep existing page-centric navigation: rejected due to prerequisite ambiguity.

## 6. Docker E2E Smoke Scope

### Decision

Implement a dockerized smoke command/script that validates exactly this release-confidence journey:

1. Create workspace
2. Upload data
3. Validate query
4. List saved queries

Output includes stage-by-stage pass/fail plus first-failure diagnostics.

### Rationale

- Satisfies FR-011 and FR-012.
- Fast enough for pre-release CI and local operator validation.

### Alternatives considered

- Full end-to-end regression suite as gate: rejected for MVP timing; too broad for targeted hardening scope.

## 7. Integration With Existing Repo Stack

### Decision

Implement feature 007 by extending current components rather than introducing new services:

- FastAPI: preflight endpoint, active-context guards, standardized error envelope.
- React/Vite builder: workflow shell scaffold, persistent status/context surfaces, guarded actions.
- Docker/devops scripts: smoke orchestration and stage diagnostics.
- Streamlit dashboard: no behavior changes; only compatibility verification in smoke boundary where needed.

### Rationale

- Preserves current monorepo boundaries and prior spec contracts.
- Minimizes regression risk while improving reliability and UX clarity.

### Alternatives considered

- Introduce orchestration/messaging layer for shell state: rejected as unnecessary complexity for MVP hardening.

## Final Research Outcome

All Phase 0 unknowns are resolved for Phase 1 design. The selected approach enforces explicit active-state handling, actionable error UX, connectivity preflight visibility, and deterministic docker smoke evidence without hidden fallbacks.
