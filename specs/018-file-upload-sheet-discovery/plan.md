# Implementation Plan: File Upload & Sheet Discovery

**Spec**: [spec.md](spec.md) | **Date**: 2026-05-11

## Summary

Implement file picker, sheet discovery, and upload with loading/error feedback.

## Phase 1: Backend Endpoints

- [ ] POST /api/v1/workspaces/{workspace_id}/sources/discover-sheets endpoint
- [ ] POST /api/v1/workspaces/{workspace_id}/sources/upload endpoint
- [ ] Sheet discovery via openpyxl/calamine
- [ ] File parsing via source registry (Polars)
- [ ] Parquet write + SQLite metadata insert in transaction

## Phase 2: Builder UI

- [ ] Add FileUploadPicker component
- [ ] Add SheetSelector component
- [ ] Add loading mask component (blocks actions during upload)
- [ ] Wire discoverExcelSheets() → uploadSource() flow
- [ ] Toast feedback on success/error

## Phase 3: Integration & Tests

- [ ] Backend tests: discover-sheets, upload, error cases
- [ ] Builder component tests: picker, selector, loading mask
- [ ] E2E: CSV upload → success; Excel multi-sheet → select → upload
- [ ] Error handling: encrypted file, malformed, etc.

## Verification

- Backend: pytest tests all pass
- Builder: vitest suite passes
- Manual: upload CSV, Excel single-sheet, Excel multi-sheet
