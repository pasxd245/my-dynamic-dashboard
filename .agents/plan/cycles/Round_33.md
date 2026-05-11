# Round 33: Builder UI/UX Overhaul — Sidebar + Guided Steps + Feedback Layer

**Status**: Planning
**Date started**: 2026-05-11
**Date completed**:

**Governance**: Spec-Kit PDCA (Plan -> Do -> Check -> Act)

> **Round type**: UX hardening and interaction-flow refinement, based on
> moodboard reference `docs/design/Layout_A.png` and live usability feedback.

## Goal

Upgrade the builder experience from utility layout to guided product flow by
introducing: (1) a sidebar menu, (2) a clear multi-step form experience for
upload/configuration actions, (3) a loading mask for async operations, and
(4) inline + toast feedback for errors/success states, while preserving the
Round 32 functional behavior and API contracts.

## Plan

- [ ] Confirm Round 32 is Complete and implementation artifacts are committed
- [ ] Define Round 33 scope boundaries vs out-of-scope visual churn
- [ ] Map moodboard `docs/design/Layout_A.png` to concrete component surfaces
      in `apps/builder/src/**`
- [ ] Produce/update Spec-Kit artifacts for Round 33 UX scope if required
      (spec/plan/tasks) before Do starts
- [ ] Define acceptance checks for: - sidebar navigation clarity - multi-step progression clarity - loading mask visibility and dismissal behavior - inline + toast error/success messaging behavior
- [ ] Resolve decision gates (styling constraints, toast implementation choice,
      responsive behavior targets)
- [ ] Flip status `Planning` -> `In Progress` once Plan checklist is complete

## Do

(To be filled during implementation.)

## Check

- [ ] Sidebar renders and supports primary navigation actions
- [ ] Multi-step upload/config workflow is guided and state-consistent
- [ ] Loading mask appears for key async operations and clears correctly
- [ ] Inline validation and toast feedback are visible and actionable
- [ ] Existing Round 32 upload flow behavior remains functional
- [ ] Focused builder tests pass
- [ ] `speckit.analyze`/artifact checks pass for any new spec artifacts

## Act

**Learnings**:

- (to be filled at round close)

**Promotions**:

- [ ] -> context/ :
- [ ] -> skills/ :

**Next-round decision**:

- (to be decided at round close)
