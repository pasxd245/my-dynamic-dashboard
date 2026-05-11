# Implementation Plan: Column Role Assignment

**Spec**: [spec.md](spec.md) | **Date**: 2026-05-11

## Summary

Implement role assignment UI and backend persistence with validation.

## Phase 1: Backend Role Service

- [ ] PUT /api/v1/workspaces/{workspace_id}/columns/{column_id}/roles endpoint
- [ ] Role validation (allowed roles, type compatibility)
- [ ] Role override reason capture
- [ ] SQLite column role storage + update

## Phase 2: Role Validation Service

- [ ] Validate role assignment (e.g., measure on numeric only)
- [ ] Check for at least one identity_key
- [ ] Generate actionable warnings

## Phase 3: Builder UI

- [ ] RoleAssignmentPanel component (list columns + selectors)
- [ ] RoleSelector dropdown (identity_key, dimension, measure, unassigned)
- [ ] RoleOverrideForm component (reason text)
- [ ] ValidationSummary (warnings, guidance)
- [ ] Submit button + toast feedback

## Phase 4: Integration & Tests

- [ ] Backend unit tests: role validation, persistence
- [ ] Builder component tests: panel render, selector change, submit
- [ ] E2E: assign roles → validate → override → verify

## Verification

- Backend: pytest tests all pass
- Builder: vitest suite passes
- Manual: assign roles, verify validation, override role with reason
