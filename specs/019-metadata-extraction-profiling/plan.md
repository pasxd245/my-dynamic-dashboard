# Implementation Plan: Metadata Extraction & Profiling

**Spec**: [spec.md](spec.md) | **Date**: 2026-05-11

## Summary

Implement profile fetch, display UI, and override persistence.

## Phase 1: Backend Profile Service

- [ ] GET /api/v1/workspaces/{workspace_id}/profile endpoint
- [ ] Query SQLite for source/sheet/column metadata
- [ ] Compute column profiles (type, nullability, sample stats)
- [ ] Return JSON with column list

## Phase 2: Override Service

- [ ] PATCH /api/v1/workspaces/{workspace_id}/sheets/{sheet_id}/override endpoint
- [ ] Accept header_row, data_range overrides
- [ ] Recompute profiles on override
- [ ] Persist to SQLite

## Phase 3: Builder UI

- [ ] ColumnProfileTable component (name, type, nullability, null count)
- [ ] DataRangeEditor component (A1:Z1000 input)
- [ ] HeaderRowEditor component (row number input)
- [ ] OverrideButton + submit flow
- [ ] Toast feedback

## Phase 4: Integration & Tests

- [ ] Backend unit tests: profile fetch, overrides, recomputation
- [ ] Builder component tests: table render, editor inputs
- [ ] E2E: upload → profile display → override → verify

## Verification

- Backend: pytest tests all pass
- Builder: vitest suite passes
- Manual: view profile, override header row, override data range
