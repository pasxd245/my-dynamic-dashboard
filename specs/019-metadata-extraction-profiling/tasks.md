# Implementation Tasks: Metadata Extraction & Profiling

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Task List

<!-- Reconciled 2026-05-12 (Round 39 close). Backend endpoints pre-existed before
     this spec was written. Frontend components built in Round 39.
     speckit.analyze C1-C4: constitution/traceability doc-quality issues — logged
     as cleanup debt for a future docs-reconcile round.
     speckit.analyze H2 (nullability) + H3 (type overrides): known gaps documented
     inline in ProfilePanel; blocked by backend scope per Spec 019 intent. -->

- [x] Implement GET /api/v1/workspaces/{workspace_id}/profile endpoint
      <!-- pre-existing; confirmed via tests/contract/test_profile_contract.py -->
- [x] Add profile service (query SQLite, compute profiles, return JSON)
      <!-- pre-existing in backend -->
- [x] Implement PATCH /api/v1/workspaces/{workspace_id}/sheets/{sheet_id}/override endpoint
      <!-- pre-existing; confirmed via tests/integration/test_sheet_override_reparse.py -->
- [x] Add override service (header row, data range, recompute)
      <!-- pre-existing in backend -->
- [x] Build ColumnProfileTable React component
      <!-- apps/builder/src/components/profile/ColumnProfileTable.tsx (Round 39) -->
- [x] Build DataRangeEditor component
      <!-- embedded as Form field in ProfilePanel.tsx "Sheet override" card (Round 39) -->
- [x] Build HeaderRowEditor component
      <!-- embedded as InputNumber in ProfilePanel.tsx "Sheet override" card (Round 39) -->
- [x] Wire profile fetch to app state
      <!-- App.tsx getWorkspaceProfile hook + ProfilePanel props (Round 39) -->
- [x] Wire override submission flow
      <!-- App.tsx onOverride handler + ProfilePanel Form submit (Round 39) -->
- [x] Add toast feedback
      <!-- AntD App.useApp() message API in App.tsx (Round 37) -->
- [x] Write backend unit tests (profile, overrides)
      <!-- test_profile_contract.py, test_profile_warnings.py, test_profile_sampling.py,
               test_sheet_override_reparse.py, etc. (45+ backend test files) -->
- [x] Write builder component tests (table, editors)
      <!-- 12 builder test files; UploadFlowPage.test.tsx covers full workflow -->
- [ ] E2E tests: profile display, override + recompute
      <!-- not yet implemented; no E2E framework in place -->
- [ ] Manual acceptance test checklist
      <!-- manual QA; not automated -->
