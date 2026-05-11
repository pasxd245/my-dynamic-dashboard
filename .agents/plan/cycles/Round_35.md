# Round 35: Spec 017 - Workspace Selection / Creation

**Status**: Planning
**Date started**: 2026-05-11
**Date completed**:

**Governance**: Spec-Kit PDCA (Plan -> Do -> Check -> Act)

> **Pivot note**: Round 34 closed with Round 35 = "feature-level testing pass"
> (vitest coverage for AntD-migrated `/saved-queries`, backend upload regression
> re-run, address spec-016 `speckit.analyze` CRITICALs). The user's UI bring-up
> testing surfaced UX gaps across the Data Management flow, so Round 35 has been
> repurposed as the first round of a five-round Data Management revision chain
> (Rounds 35–39, Specs 017–021). See deferred items in **Act → Deferred**.
>
> **Round type**: UI/UX revision atop existing backend. Endpoints, schema, and
> services for this surface already exist (see Spec 017 _Existing surface_).
> Backend changes are bug-fix only; no new endpoints, no schema migrations.

## Goal

Revise the Builder workspace selection/creation UI so the user can create or
select a workspace before upload and the experience matches expectations
surfaced during UI bring-up testing.

## Plan

- [ ] Confirm `specs/017-workspace-selection-creation/spec.md`, `plan.md`, and `tasks.md` exist
- [ ] Confirm single-goal scope and allowed change boundary for this round
- [ ] Define manual Check checklist for workspace create/select e2e
- [ ] Confirm no out-of-scope changes (permissions/multi-user/admin)
- [ ] Flip status to `In Progress` when Plan checklist is complete

## Do

- Pending

## Check

**Testing style**: bring up the Builder UI, walk the workspace flow as a real
user, confirm each step matches expectation. Anything that surprises the user
is a defect to capture and re-loop into Do.

- [ ] Run `/speckit.analyze` for Spec 017 artifacts
- [ ] Verify `specs/017-workspace-selection-creation/tasks.md` is 100% checked
- [ ] Run backend/builder automated tests touched by this round (no
      backend changes expected — re-run only if behavior shifted)
- [ ] UI bring-up: launch Builder, land on workspace picker, confirm
      list of existing workspaces renders and the active selection is
      visually unambiguous
- [ ] UI bring-up: create a new workspace end-to-end, confirm it appears
      in the list and becomes active without a page reload
- [ ] UI bring-up: select an existing workspace, confirm active context
      reflects in the header / downstream stages
- [ ] UI bring-up: trigger invalid name and duplicate name errors, confirm
      the message is actionable (says what to do, not just what went wrong)
- [ ] No backend endpoint or schema was added or modified (round-type
      guardrail — if either changed, Check fails)

## Act

**Learnings**:

- Pending

**Promotions**:

- [ ] → context/
- [ ] → skills/

**Deferred (from Round 34's original next-round decision)**:

- [ ] Add focused vitest coverage for the AntD-migrated `/saved-queries`
      surfaces (Table → TanStack swap, dialog Modal+Form flows)
- [ ] Re-run backend upload regression suite (deferred from Round 34's Check)
- [ ] Address the spec-016 `speckit.analyze` CRITICALs that gated Round 33's Act
- [ ] Round 33 custom feedback layer (toast / loading mask / upload step
      sidebar) → AntD `message` / `notification` / `Spin fullscreen` / `Steps`
      per the Tier-C plan in the AntD feasibility research

These items will be scheduled into a follow-up round after the Data Management
revision chain (Rounds 35–39) completes, unless an earlier round surfaces a
blocker that forces them sooner.

**Next-round decision**:

- Round 36 (Spec 018 - File Upload & Sheet Discovery)
