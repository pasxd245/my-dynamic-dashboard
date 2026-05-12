# Implementation Tasks: File Upload & Sheet Discovery

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Task List

<!-- Reconciled 2026-05-12 (Round 38 close). Backend endpoints pre-existed before
     this spec was written (upload.py). Frontend components built across Rounds 33–38.
     speckit.analyze C1: backend tasks were greenfield in spec but implemented already.
     speckit.analyze C2: task IDs missing — doc-debt tracked for cleanup round. -->

- [x] Implement POST /api/v1/workspaces/{workspace_id}/sources/discover-sheets endpoint
      <!-- pre-existing in apps/backend/app/api/upload.py -->
- [x] Implement openpyxl/calamine sheet discovery logic
      <!-- pre-existing in apps/backend/app/api/upload.py -->
- [x] Implement POST /api/v1/workspaces/{workspace_id}/sources/upload endpoint
      <!-- pre-existing in apps/backend/app/api/upload.py -->
- [x] Integrate source registry detection + parsing
      <!-- pre-existing; SourceTypeSelector + sourceTypeRules.ts -->
- [x] Add Parquet write + metadata persistence (transaction)
      <!-- pre-existing; confirmed via test_upload_flow_contract.py -->
- [x] Build FileUploadPicker React component
      <!-- implemented as SourceTypeSelector + file input in App.tsx; ExcelSheetPicker for sheet selection -->
- [x] Build SheetSelector React component
      <!-- implemented as ExcelSheetPicker.tsx (Round 33) -->
- [x] Build LoadingMask component
      <!-- implemented as UploadLoadingMask.tsx (Round 33); migrated to AntD Spin (Round 37) -->
- [x] Wire upload flow state management
      <!-- uploadFlowStore.ts + App.tsx upload handler chain -->
- [x] Add toast feedback service
      <!-- AntD App.useApp() message API wired in App.tsx (Round 37) -->
- [x] Write backend unit tests (discovery, upload, parsing)
      <!-- 45+ backend test files: test_upload_flow_contract.py, test_csv_source.py, test_excel_source.py, etc. -->
- [x] Write builder component tests (picker, selector, mask)
      <!-- UploadFlowPage.test.tsx, UploadLoadingMask.test.tsx, UploadFlowFeedback.test.tsx, etc. -->
- [ ] E2E tests: CSV, single-sheet Excel, multi-sheet Excel
      <!-- not yet implemented; no E2E framework in place -->
- [x] Error handling tests: encrypted, malformed, unsupported type
      <!-- errorKinds.test.ts (17 cases) + ActionableErrorPanel.test.tsx (6 cases); Round 38 -->
- [ ] Manual acceptance test checklist
      <!-- manual QA; not automated -->
