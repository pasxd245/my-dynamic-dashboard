# Round 11: Polish & Production Hardening

**Status**: Deferred
**Date started**:
**Date completed**:
**MVP**: 2
**DoD tasks**: 11.1–11.6
**Canonical state**: Branch `001-upload-profile-field-roles` (US1-US3 complete, MVP1 gates pending)

## Goal

Eliminate rough edges so non-technical users can complete the full
workflow without asking for help.

## Plan

- [ ] Improve error messages across backend (clear `detail` in HTTPException)
- [ ] Add loading skeletons/spinners on all async operations in builder
- [ ] Add help tooltips on relationship builder and query builder
- [ ] Create 2-3 query templates (weekly sales by agent, monthly by product)
- [ ] Fix any console errors in builder; unhandled exceptions in backend
- [ ] Review and polish the full upload → relate → query → dashboard flow

## Do

**Context**: Quality gate before production deployment. Follows all MVP2 features (Rounds 09-10) and validates UX/DX across full workflow.

## Check

- [ ] No console errors during normal usage
- [ ] All loading states render correctly
- [ ] Tooltips are present on non-obvious UI elements
- [ ] Templates load and produce correct queries
- [ ] User completes full flow without asking for help

## Act

## **Learnings**

**Quality Gate**: Eliminates friction for non-technical users. Template queries, error clarity, and UX polish enable self-service workflows.

**Promotions**:

- [ ] → context/ :
- [ ] → skills/ :
