# Round 03: Relationship Management

**Status**: Planning (Deferred)
**Date started**:
**Date completed**:
**MVP**: 1
**DoD tasks**: 3.1–3.7

## Goal

Users can define, list, and delete relationships between uploaded tables.
Schema changes on re-upload flag affected relationships as broken.

## Plan

- [ ] Add `relationships` table to SQLite (from/to file+column, join type, broken flag)
- [ ] Create `POST /api/v1/relationships` with validation (tables/columns must exist)
- [ ] Create `GET /api/v1/relationships`
- [ ] Create `DELETE /api/v1/relationships/{id}`
- [ ] On schema change (Round 02), check if removed columns break existing relationships
- [ ] Mark broken relationships and include in upload response warnings

## Do

- Round 03 has not started yet in this branch.
- Execution order was intentionally shifted to Spec Kit US1-US3 work
  (upload/profile/roles) before relationship CRUD from DoD 3.x.
- No Round 03 implementation commit exists yet.

## Check

- [ ] Can create, list, delete relationships via API
- [ ] Validation rejects bad table/column references
- [ ] Re-upload with removed column flags the relationship as broken
- [ ] User defines Sales → Agents relationship

## Act

## **Learnings**

- Keep Round 03 deferred until remaining MVP 1 Spec Kit tasks (US4 manifest)
  are completed or the team explicitly reprioritizes relationship work.

**Promotions**:

- [ ] → context/ :
- [ ] → skills/ :
