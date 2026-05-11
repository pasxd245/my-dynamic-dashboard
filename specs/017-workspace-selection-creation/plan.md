# Implementation Plan: Workspace Selection / Creation

**Spec**: [spec.md](spec.md) | **Date**: 2026-05-11

## Summary

Implement Builder UI workspace picker and backend workspace CRUD endpoints.

## Phase 1: Backend API Setup

- [ ] POST /api/v1/workspaces → create_workspace() endpoint
- [ ] GET /api/v1/workspaces → list_workspaces() endpoint
- [ ] SQLite workspace table + migration
- [ ] Schema validation (name length, uniqueness)

## Phase 2: Builder UI

- [ ] Add WorkspacePicker component (list + create form)
- [ ] Wire createWorkspace() + selectWorkspace() to state
- [ ] Show active workspace in header/context
- [ ] Toast feedback on create/select success/error

## Phase 3: Integration & Tests

- [ ] Backend unit tests (create, list, validation)
- [ ] Builder component tests (picker render, click, submit)
- [ ] E2E: create → select → verify active
- [ ] Mobile responsive check

## Verification

- Backend: pytest tests pass, pytest integration tests pass
- Builder: vitest suite passes, manual UI check
- Manual acceptance: workspace picker + create + select all work end-to-end
