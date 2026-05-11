# Round 32: UI-Visible Source Abstraction Flow

**Status**: Complete
**Date started**: 2026-05-11
**Date completed**: 2026-05-11

**Governance**: Spec-Kit PDCA (Plan -> Do -> Check -> Act)

> **Round type**: Feature completion — closes Gate-A #2 from Round 29 by
> delivering the user-visible upload flow that sits on top of Round 31's
> backend source-dispatch foundation.

## Goal

Deliver one complete, user-visible upload feature end-to-end: source-type
selection, Excel sheet picker where applicable, upload progress feedback,
and successful workspace arrival, while preserving the Round 31 backend
registry dispatch path. Acceptance is functional and user-visible across
US1+US2+US3 in Spec 015 (no MVP-only stop).

## Plan

- [x] Confirm Round 31 is Complete and Round 31 selection note is recorded
- [x] Identify/confirm owning Spec-Kit artifact path for this UI flow
      (new spec directory): `specs/015-builder-upload-flow/`
- [x] Spec bootstrap: ensure spec bundle exists (`spec.md`, `plan.md`,
      `tasks.md`) for the selected artifact path
- [x] Define explicit in-scope surfaces (`apps/builder/**`, backend upload
      API integration points, docs) and out-of-scope items
- [x] Define acceptance checks and command matrix for Do/Check
- [x] Resolve any decision gates before implementation starts
- [x] Status flip: `Planning` -> `In Progress` after all Plan items are done

Decision resolution (2026-05-11):

- "Complete feature per round" is locked for Round 32 as full completion of
  Spec 015 US1+US2+US3 within this round. Incremental checkpoints are allowed,
  but round acceptance requires complete feature closure.

## Do

- 2026-05-11 Plan bootstrap complete: - Created spec directory `specs/015-builder-upload-flow/` via Spec-Kit. - Generated and validated `spec.md`, `plan.md`, and `tasks.md`. - Generated supporting artifacts: `research.md`, `data-model.md`,
  `contracts/builder-upload-flow-contract.md`, `quickstart.md`, and
  `checklists/requirements.md`. - Round 32 accepted as a single-feature completion round (no partial close).
- Next Do action: execute `specs/015-builder-upload-flow/tasks.md` in order
  with mandatory reconciliation after each implementation pass.
- 2026-05-11 Setup execution (Spec 015 Phase 1): - Completed T001-T003 with file evidence in: - `specs/015-builder-upload-flow/checklists/acceptance-evidence.md` - `apps/builder/src/pages/__tests__/UploadFlowPage.test.tsx` - `apps/builder/src/components/__tests__/UploadProgressPanel.test.tsx` - `apps/backend/tests/contract/test_upload_flow_contract.py` - `apps/backend/tests/integration/test_upload_flow_builder_transition.py` - Validation commands: - `cd apps/backend && PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/contract/test_upload_flow_contract.py tests/integration/test_upload_flow_builder_transition.py -q` -> `2 passed` - `cd apps/builder && pnpm -s vitest run src/pages/__tests__/UploadFlowPage.test.tsx src/components/__tests__/UploadProgressPanel.test.tsx` -> `2 files skipped (todo scaffolds), 5 todo` - Task reconciliation: `specs/015-builder-upload-flow/tasks.md` now marks
  T001-T003 as `[x]`.
- 2026-05-11 Foundational execution (Spec 015 Phase 2): - Completed T004-T008 implementation surfaces: - Builder contracts/state: - `apps/builder/src/api/types.ts` - `apps/builder/src/api/workspaceApi.ts` - `apps/builder/src/state/uploadFlowStore.ts` - `apps/builder/src/state/index.ts` - Backend contracts/parsing: - `apps/backend/app/schemas.py` - `apps/backend/app/api/upload.py` - `apps/backend/app/services/upload_service.py` - `apps/backend/app/sources/excel_source.py` - Completed T009 evidence logging in: - `specs/015-builder-upload-flow/checklists/acceptance-evidence.md` - Validation commands: - `cd apps/backend && PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/integration/test_upload_flow_with_sources.py tests/contract/test_upload_flow_contract.py tests/integration/test_upload_flow_builder_transition.py -q` -> `5 passed` - `cd apps/builder && pnpm -s vitest run src/pages/__tests__/UploadFlowPage.test.tsx src/components/__tests__/UploadProgressPanel.test.tsx src/pages/__tests__/BuilderWorkflowPage.test.tsx` -> `1 passed file, 2 scaffold files with todo tests` - Task reconciliation: `specs/015-builder-upload-flow/tasks.md` now marks
  T004-T009 as `[x]`.
- 2026-05-11 US1 execution (Spec 015 Phase 3): - Completed builder source-selection and compatibility UI: - `apps/builder/src/components/upload-flow/SourceTypeSelector.tsx` - `apps/builder/src/components/upload-flow/UploadValidationNotice.tsx` - `apps/builder/src/components/upload-flow/sourceTypeRules.ts` - `apps/builder/src/App.tsx` - Completed backend source-type-aware validation: - `apps/backend/app/api/upload.py` - `apps/backend/tests/contract/test_upload_flow_contract.py` - Preserved upload dispatch semantics coverage via: - `apps/backend/tests/integration/test_upload_flow_with_sources.py` - Validation commands: - `cd apps/backend && PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/contract/test_upload_flow_contract.py tests/integration/test_upload_flow_with_sources.py -q` -> `6 passed` - `cd apps/builder && pnpm -s vitest run src/pages/__tests__/UploadFlowPage.test.tsx src/pages/__tests__/BuilderWorkflowPage.test.tsx src/components/__tests__/UploadProgressPanel.test.tsx` -> `2 files passed; 1 scaffold file with todo tests` - Task reconciliation: `specs/015-builder-upload-flow/tasks.md` now marks
  T010-T017 as `[x]`.
- 2026-05-11 US2 execution (Spec 015 Phase 4): - Added Excel sheet discovery and explicit selected-sheet support: - `apps/backend/app/api/upload.py` - `apps/backend/app/schemas.py` - `apps/backend/app/sources/excel_source.py` - `apps/backend/tests/integration/test_upload_flow_builder_transition.py` - Added builder sheet-discovery client + picker UI: - `apps/builder/src/api/workspaceApi.ts` - `apps/builder/src/components/upload-flow/ExcelSheetPicker.tsx` - `apps/builder/src/App.tsx` - Added explicit shared error-stage rendering for upload/sheet discovery failures: - `apps/builder/src/api/httpErrors.ts` - `apps/builder/src/components/errors/ActionableErrorPanel.tsx` - Validation commands: - `cd apps/backend && PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/contract/test_upload_flow_contract.py tests/integration/test_upload_flow_with_sources.py tests/integration/test_upload_flow_builder_transition.py -q` -> `11 passed` - `cd apps/builder && pnpm -s vitest run src/pages/__tests__/UploadFlowPage.test.tsx src/components/__tests__/UploadProgressPanel.test.tsx src/pages/__tests__/BuilderWorkflowPage.test.tsx` -> `13 passed`
- 2026-05-11 US3 execution (Spec 015 Phase 5): - Added upload progress state store and progress panel: - `apps/builder/src/state/uploadFlowStore.ts` - `apps/builder/src/components/upload-flow/UploadProgressPanel.tsx` - Successful upload now resolves active context and routes to workflow shell via `schema_sheet` stage from `apps/builder/src/App.tsx` using existing `builderSessionApi.ts`/`BuilderWorkflowPage.tsx` behavior. - Failed upload remains in upload context with retry guidance.
- 2026-05-11 Polish execution (Spec 015 Phase 6): - Reconciled all remaining tasks in `specs/015-builder-upload-flow/tasks.md` to `[x]`. - Updated `specs/015-builder-upload-flow/checklists/acceptance-evidence.md` with US2/US3 and scope-audit evidence. - Scope audit captured via `git status --short`. - Builder type-check run shows pre-existing unrelated errors outside upload-flow scope; feature-focused tests for the touched slice are green.

## Check

- [x] UI flow verification passes for .csv upload path
- [x] UI flow verification passes for .xlsx with sheet picker path
- [x] Upload progress/error states are validated
- [x] Backend registry-dispatch path remains active and tested
- [x] Relevant tests/verification commands pass
- [ ] `/speckit.analyze` run with no CRITICAL findings

Check evidence collected 2026-05-11:

- Builder validation: - `cd apps/builder && pnpm -s vitest run src/pages/__tests__/UploadFlowPage.test.tsx src/components/__tests__/UploadProgressPanel.test.tsx src/pages/__tests__/BuilderWorkflowPage.test.tsx` -> `13 passed`
- Backend validation: - `cd apps/backend && PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/contract/test_upload_flow_contract.py tests/integration/test_upload_flow_with_sources.py tests/integration/test_upload_flow_builder_transition.py -q` -> `11 passed`
- Spec task reconciliation: - `specs/015-builder-upload-flow/tasks.md` is 100% `[x]`
- `speckit.analyze` result: - CRITICAL findings present in Spec 015 governance artifacts (constitution fields/traceability gaps in `spec.md`, `plan.md`, and `tasks.md`). - Per PDCA gate rules, the round stops here for human review/remediation direction before Act.

## Act

**Learnings**:

- Completing one feature per round improved delivery quality: the upload-flow
  slice now ships as a coherent end-to-end path (selection, sheet decision,
  progress, transition) rather than fragmented checkpoints.
- The most expensive late-round risk was governance artifact drift, not runtime
  behavior. Feature tests and flows passed, while `speckit.analyze` still
  reported constitution/traceability gaps in spec artifacts.
- Local-vs-docker environment parity remains a practical operational concern:
  missing Alembic artifacts in image and interpreter mismatch in local venv can
  block validation even when feature code is correct.

**Promotions**:

- [ ] -> context/ : add local-env dependency/install guardrail note
- [ ] -> skills/ : add PDCA close-out checklist item for governance artifact reconciliation

**Next-round decision**:

- Round 33 is approved to focus on builder UI/UX overhaul using
  `docs/agents/design/Layout_A.png` as moodboard direction: - sidebar navigation - explicit multi-step upload form UX - loading mask for async operations - inline and toast-style actionable error messaging

Round-close note (2026-05-11):

- User-approved closure for Round 32 implementation scope.
- `speckit.analyze` CRITICAL governance findings for Spec 015 are deferred as
  tracked follow-up work and do not block this implementation handoff.
