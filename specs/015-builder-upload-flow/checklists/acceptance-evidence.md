# Acceptance Evidence Ledger: Spec 015 Builder Upload Flow

## Run Metadata

- Date: 2026-05-11
- Round: 32
- Scope guardrail: complete one upload-flow feature end-to-end (US1+US2+US3)

## Setup Evidence (Phase 1)

- T001: Acceptance evidence ledger created at this file path.
- T002: Builder upload-flow test scaffolds created:
  - `apps/builder/src/pages/__tests__/UploadFlowPage.test.tsx`
  - `apps/builder/src/components/__tests__/UploadProgressPanel.test.tsx`
- T003: Backend upload-flow test scaffolds created:
  - `apps/backend/tests/contract/test_upload_flow_contract.py`
  - `apps/backend/tests/integration/test_upload_flow_builder_transition.py`
- Setup validation commands:
  - `cd apps/backend && PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/contract/test_upload_flow_contract.py tests/integration/test_upload_flow_builder_transition.py -q` -> `2 passed`
  - `cd apps/builder && pnpm -s vitest run src/pages/__tests__/UploadFlowPage.test.tsx src/components/__tests__/UploadProgressPanel.test.tsx` -> `2 files skipped (todo scaffolds), 5 todo`

## Foundational Evidence (Phase 2)

- T004: Upload flow API types extended in `apps/builder/src/api/types.ts` with source type, sheet-option, request payload, progress state, and lifecycle callback contracts.
- T005: Upload API client extended in `apps/builder/src/api/workspaceApi.ts` with optional `sourceType`, optional `sheetName`, and lifecycle callback hooks while preserving current call sites.
- T006: Upload flow state model implemented and exported:
  - `apps/builder/src/state/uploadFlowStore.ts`
  - `apps/builder/src/state/index.ts`
- T007: Backend schemas added for source selection and sheet discovery in `apps/backend/app/schemas.py`.
- T008: Upload request parsing helpers added in `apps/backend/app/api/upload.py` for source-type normalization, source/file compatibility, and optional sheet-name validation.
- Compatibility support for selected Excel sheet was added in:
  - `apps/backend/app/services/upload_service.py`
  - `apps/backend/app/sources/excel_source.py`
- Foundational validation commands:
  - `cd apps/backend && PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/integration/test_upload_flow_with_sources.py tests/contract/test_upload_flow_contract.py tests/integration/test_upload_flow_builder_transition.py -q` -> `5 passed`
  - `cd apps/builder && pnpm -s vitest run src/pages/__tests__/UploadFlowPage.test.tsx src/components/__tests__/UploadProgressPanel.test.tsx src/pages/__tests__/BuilderWorkflowPage.test.tsx` -> `1 passed file, 2 scaffold files with todo tests`

## US1 Evidence

- Source selection + compatibility implementation:
  - `apps/builder/src/components/upload-flow/SourceTypeSelector.tsx`
  - `apps/builder/src/components/upload-flow/UploadValidationNotice.tsx`
  - `apps/builder/src/components/upload-flow/sourceTypeRules.ts`
  - `apps/builder/src/App.tsx`
- Source-type-aware upload request wiring:
  - `apps/builder/src/api/workspaceApi.ts`
  - `apps/backend/app/api/upload.py`
- Compatibility validation behavior:
  - Backend rejects mismatched source/file combinations with actionable error code `source_type_mismatch`.
  - Backend rejects `sheet_name` for non-Excel source types.
  - Existing non-Excel dispatch behavior remains covered by `test_upload_flow_with_sources.py`.
- US1 test evidence:
  - `cd apps/backend && PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/contract/test_upload_flow_contract.py tests/integration/test_upload_flow_with_sources.py -q` -> `6 passed`
  - `cd apps/builder && pnpm -s vitest run src/pages/__tests__/UploadFlowPage.test.tsx src/pages/__tests__/BuilderWorkflowPage.test.tsx src/components/__tests__/UploadProgressPanel.test.tsx` -> `2 files passed; 1 scaffold file with todo tests`

## US2 Evidence

- Excel sheet-selection support is implemented in:
  - `apps/backend/app/sources/excel_source.py`
  - `apps/backend/app/api/upload.py`
  - `apps/backend/app/schemas.py`
  - `apps/builder/src/api/workspaceApi.ts`
  - `apps/builder/src/components/upload-flow/ExcelSheetPicker.tsx`
  - `apps/builder/src/App.tsx`
- Shared actionable error path for sheet-discovery failures is surfaced through:
  - `apps/builder/src/api/httpErrors.ts`
  - `apps/builder/src/components/errors/ActionableErrorPanel.tsx`
- Focused behavior evidence:
  - Multi-sheet Excel discovery requires explicit selection.
  - Single-sheet Excel discovery bypasses extra selection.
  - Selected sheet name is forwarded into `ExcelSourceConfig.sheet_name`.
  - Discovery failures stay in upload context and surface retry guidance through the shared actionable-error path.
- US2 test evidence:
  - `cd apps/backend && PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/contract/test_upload_flow_contract.py tests/integration/test_upload_flow_with_sources.py tests/integration/test_upload_flow_builder_transition.py -q` -> `11 passed`
  - `cd apps/builder && pnpm -s vitest run src/pages/__tests__/UploadFlowPage.test.tsx src/components/__tests__/UploadProgressPanel.test.tsx src/pages/__tests__/BuilderWorkflowPage.test.tsx` -> `3 passed files, 13 passed tests`

## US3 Evidence

- Upload progress and workflow transition are implemented in:
  - `apps/builder/src/components/upload-flow/UploadProgressPanel.tsx`
  - `apps/builder/src/state/uploadFlowStore.ts`
  - `apps/builder/src/App.tsx`
  - `apps/builder/src/api/builderSessionApi.ts` (existing API reused)
  - `apps/builder/src/pages/BuilderWorkflowPage.tsx` (existing workflow stage routing reused)
- Success path evidence:
  - Upload response `source_id` is used to resolve active context via `/api/v1/workspaces/active-context`.
  - After successful upload and active-context resolution, builder session state reports `current_stage = "schema_sheet"`.
- Failure path evidence:
  - Upload failures remain in upload context and surface retry guidance through `UploadProgressPanel` and `ActionableErrorPanel`.
- US3 test evidence:
  - `cd apps/backend && PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/contract/test_upload_flow_contract.py tests/integration/test_upload_flow_with_sources.py tests/integration/test_upload_flow_builder_transition.py -q` -> `11 passed`
  - `cd apps/builder && pnpm -s vitest run src/pages/__tests__/UploadFlowPage.test.tsx src/components/__tests__/UploadProgressPanel.test.tsx src/pages/__tests__/BuilderWorkflowPage.test.tsx` -> `3 passed files, 13 passed tests`

## Polish Evidence

- T035 builder validation:
  - `cd apps/builder && pnpm -s vitest run src/pages/__tests__/UploadFlowPage.test.tsx src/components/__tests__/UploadProgressPanel.test.tsx src/pages/__tests__/BuilderWorkflowPage.test.tsx` -> `3 passed files, 13 passed tests`
- T036 backend validation:
  - `cd apps/backend && PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/contract/test_upload_flow_contract.py tests/integration/test_upload_flow_with_sources.py tests/integration/test_upload_flow_builder_transition.py -q` -> `11 passed`
- T037 non-Excel behavior remains covered by `apps/backend/tests/integration/test_upload_flow_with_sources.py`, including CSV dispatch and unsupported-file rejection.
- T038 scope audit (`git status --short`) confirms Round 32 changes are confined to upload-flow feature surfaces, spec artifacts, and PDCA/spec bookkeeping files.
- Builder type-check note:
  - `cd apps/builder && pnpm -s tsc --noEmit` still reports pre-existing errors in `src/api/hooks/useSavedQueries.ts`, `src/api/hooks/useWorkspace.ts`, `src/config/appConfig.ts`, and `src/pages/SavedQueryLibrary/SavedQueryLibraryPage.tsx` that are outside Round 32 upload-flow scope.
