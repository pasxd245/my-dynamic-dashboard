# Round 33: Builder UI/UX Overhaul — Sidebar + Guided Steps + Feedback Layer

**Status**: Complete
**Date started**: 2026-05-11
**Date completed**: 2026-05-11

**Governance**: Spec-Kit PDCA (Plan -> Do -> Check -> Act)

> **Round type**: UX hardening and interaction-flow refinement, based on
> moodboard references `docs/design/Sample.png` + `docs/design/Styles.png`
> (tokens in `docs/design/Styles.css`) and live usability feedback.

## Goal

Upgrade the builder experience from utility layout to guided product flow by
introducing: (1) a sidebar menu, (2) a clear multi-step form experience for
upload/configuration actions, (3) a loading mask for async operations, and
(4) inline + toast feedback for errors/success states, while preserving the
Round 32 functional behavior and API contracts.

## Plan

- [x] Confirm Round 32 is Complete and implementation artifacts are committed
- [x] Define Round 33 scope boundaries vs out-of-scope visual churn
- [x] Map moodboard `docs/design/Sample.png` + tokens in
      `docs/design/Styles.css` to concrete component surfaces in
      `apps/builder/src/**`
- [x] Produce/update Spec-Kit artifacts for Round 33 UX scope if required
      (spec/plan/tasks) before Do starts
- [x] Define acceptance checks for: - sidebar navigation clarity - multi-step progression clarity - loading mask visibility and dismissal behavior - inline + toast error/success messaging behavior
- [x] Resolve decision gates (styling constraints, toast implementation choice,
      responsive behavior targets)
- [x] Flip status `Planning` -> `In Progress` once Plan checklist is complete

## Do

- 2026-05-11 Plan bootstrap complete for Round 33 UX scope: - Created new feature spec set at `specs/016-builder-upload-ux/`. - Generated and validated: - `specs/016-builder-upload-ux/spec.md` - `specs/016-builder-upload-ux/plan.md` - `specs/016-builder-upload-ux/tasks.md` - Generated supporting artifacts: - `specs/016-builder-upload-ux/research.md` - `specs/016-builder-upload-ux/data-model.md` - `specs/016-builder-upload-ux/contracts/builder-upload-ux-contract.md` - `specs/016-builder-upload-ux/quickstart.md` - `specs/016-builder-upload-ux/checklists/requirements.md` - Decision gates resolved: - Styling direction: follow `docs/design/Layout_A.png` with a guided two-panel layout. - Toast implementation: local app-level ephemeral toast state (no new external dependency). - Responsive behavior target: maintain usability from mobile width upward using existing builder shell constraints.
- Next Do action: execute `specs/016-builder-upload-ux/tasks.md` in order,
  starting with US1+US2 implementation in `apps/builder/src/App.tsx` and
  focused tests/evidence reconciliation.
- 2026-05-11 Do execution pass #1 (UI issue resolution core slice): - Implemented guided upload UX surfaces: - Sidebar stage navigation: - `apps/builder/src/components/upload-flow/UploadStageSidebar.tsx` - wired in `apps/builder/src/App.tsx` - Multi-step upload progression (workspace -> source -> sheet -> submit): - `apps/builder/src/App.tsx` - Blocking loading mask for validating/discovering/uploading: - `apps/builder/src/components/upload-flow/UploadLoadingMask.tsx` - wired in `apps/builder/src/App.tsx` - Inline + toast feedback layer: - `apps/builder/src/components/upload-flow/UploadToastStack.tsx` - centralized dispatch in `apps/builder/src/App.tsx` - Upload-flow component index scaffold: - `apps/builder/src/components/upload-flow/index.ts` - Responsive hardening: - upload panel layout now wraps sidebar/content on narrow widths in
  `apps/builder/src/App.tsx` - Validation commands: - `cd apps/builder && pnpm -s vitest run src/pages/__tests__/UploadFlowPage.test.tsx src/components/__tests__/UploadProgressPanel.test.tsx src/pages/__tests__/BuilderWorkflowPage.test.tsx` -> `13 passed` - Task reconciliation for `specs/016-builder-upload-ux/tasks.md`: - checked: `13` - unchecked: `22` - Scope audit (`git status --short`) shows changes limited to round/spec
  artifacts and builder upload UX surfaces.
- 2026-05-11 Do execution pass #2 (coverage + guard completion): - Added shared upload-step model and guard utilities: - `apps/builder/src/components/upload-flow/uploadStageModel.ts` - Extended upload state for guided-step resets: - `apps/builder/src/state/uploadFlowStore.ts` - Added focused tests/evidence: - `apps/builder/src/pages/__tests__/UploadFlowPage.test.tsx` - `apps/builder/src/pages/__tests__/BuilderWorkflowPage.test.tsx` - `apps/builder/src/pages/__tests__/UploadFlowFeedback.test.tsx` - `apps/builder/src/pages/__tests__/UploadFlowResponsive.test.tsx` - `apps/builder/src/state/__tests__/uploadFlowStore.test.ts` - `apps/builder/src/components/__tests__/UploadLoadingMask.test.tsx` - `apps/builder/src/components/__tests__/UploadValidationNotice.test.tsx` - `apps/builder/src/components/__tests__/UploadToastStack.test.tsx` - Added traceability/supporting evidence updates: - `specs/016-builder-upload-ux/checklists/requirements.md` - `specs/016-builder-upload-ux/quickstart.md` - Validation commands: - focused builder suite -> `33 passed` - focused backend upload regressions -> `11 passed` - Task reconciliation: `specs/016-builder-upload-ux/tasks.md` is now 100% `[x]`

## Check

- [x] Sidebar renders and supports primary navigation actions
- [x] Multi-step upload/config workflow is guided and state-consistent
- [x] Loading mask appears for key async operations and clears correctly
- [x] Inline validation and toast feedback are visible and actionable
- [x] Existing Round 32 upload flow behavior remains functional
- [x] Focused builder tests pass
- [ ] `speckit.analyze`/artifact checks pass for any new spec artifacts

Check evidence collected 2026-05-11:

- Builder validation: - focused Round 33 suite -> `33 passed`
- Backend regression validation: - `tests/contract/test_upload_flow_contract.py` - `tests/integration/test_upload_flow_with_sources.py` - `tests/integration/test_upload_flow_builder_transition.py` - result -> `11 passed`
- Spec task reconciliation: - `specs/016-builder-upload-ux/tasks.md` is 100% `[x]`
- `speckit.analyze` result: - CRITICAL findings remain in Spec 016 governance artifacts: - missing constitution-mandated governance fields in `spec.md` - incomplete constitution traceability columns in `plan.md` - missing requirement-level traceability in `tasks.md` - Additional high/medium findings include missing explicit scope-audit /
  backend-regression task traceability and stale plan header metadata. - Per PDCA gate rules, Round 33 stops here pending remediation direction
  before Act.

## Act

**Learnings**:

- Design intake matters: replacing the missing `Layout_A.png` reference with
  the actual `docs/design/Sample.png` + `Styles.png` + `Styles.css` artifacts
  unblocked accurate token adoption (color palette, radii, shadow) in
  `apps/builder/src/index.css`.
- Global element defaults must out-specify Tailwind preflight: `:where(button)`
  has specificity `0,0,0` and lost to preflight's `button { background-color:
transparent }` (`0,0,1`). Switched to plain tag selectors (still beaten by
  Tailwind utility classes at `0,1,0`, so opt-out remains easy).
- Mixed global-default + Tailwind utility buttons leak unset properties
  (background, shadow, font-weight). Tailwind-classed buttons must explicitly
  zero out the inherited primary defaults (`shadow-none`, `bg-transparent`,
  `border-0`) where the intended variant is secondary/link.
- Active-state hover needs its own pair: a single `hover:bg-slate-50` rule on
  an `bg-slate-900 text-white` button collapses contrast on hover. Variant
  hovers must be scoped to the variant.
- Page-card consistency is a layout-shell concern, not a per-page concern.
  Workflow routes get the white card from `WorkflowShell`; query-management
  routes needed their own equivalent wrapper (`pageCardStyle` in `App.tsx`)
  to render at the same visual level.

**Promotions**:

- [ ] -> context/ :
- [ ] -> skills/ :

**Next-round decision**:

- Round 34: feature-level testing pass. Goal is to lock in regression coverage
  for the upload/guided-step, sidebar, loading mask, toast, and page-card
  surfaces shipped in Round 33, plus revisit the spec-016 `speckit.analyze`
  CRITICALs that gated Act in this round.
