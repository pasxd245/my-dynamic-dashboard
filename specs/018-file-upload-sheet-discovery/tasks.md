# Implementation Tasks: File Upload & Sheet Discovery

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Task List

- [ ] Implement POST /api/v1/workspaces/{workspace_id}/sources/discover-sheets endpoint
- [ ] Implement openpyxl/calamine sheet discovery logic
- [ ] Implement POST /api/v1/workspaces/{workspace_id}/sources/upload endpoint
- [ ] Integrate source registry detection + parsing
- [ ] Add Parquet write + metadata persistence (transaction)
- [ ] Build FileUploadPicker React component
- [ ] Build SheetSelector React component
- [ ] Build LoadingMask component
- [ ] Wire upload flow state management
- [ ] Add toast feedback service
- [ ] Write backend unit tests (discovery, upload, parsing)
- [ ] Write builder component tests (picker, selector, mask)
- [ ] E2E tests: CSV, single-sheet Excel, multi-sheet Excel
- [ ] Error handling tests: encrypted, malformed, unsupported type
- [ ] Manual acceptance test checklist
