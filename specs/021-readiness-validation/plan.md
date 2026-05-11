# Implementation Plan: Readiness Validation

**Spec**: [spec.md](spec.md) | **Date**: 2026-05-11

## Summary

Implement readiness validation service and stage gate.

## Phase 1: Backend Readiness Service

- [ ] GET /api/v1/workspaces/{workspace_id}/readiness endpoint
- [ ] Check: ≥1 source uploaded
- [ ] Check: roles assigned to key columns
- [ ] Check: no blocking schema issues
- [ ] Return readiness JSON + guidance

## Phase 2: Readiness Validation Logic

- [ ] Implement readiness checks (sources, roles, relationships)
- [ ] Generate actionable error messages
- [ ] Support override flag (for testing/admin)

## Phase 3: Builder UI

- [ ] ReadinessGate component (status display + guidance)
- [ ] Wire readiness fetch to app state
- [ ] Block query builder stage until ready=true
- [ ] Show next steps for incomplete workspaces
- [ ] Manual bypass button (testing mode)

## Phase 4: Integration & Tests

- [ ] Backend unit tests: readiness checks, guidance generation
- [ ] Builder component tests: gate render, state transitions
- [ ] E2E: incomplete workspace → guidance → complete → unlock

## Verification

- Backend: pytest tests all pass
- Builder: vitest suite passes
- Manual: test incomplete (fail) and complete (pass) scenarios
