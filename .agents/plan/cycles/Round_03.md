# Round 03: Relationship Management

**Status**: Planning
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

_Progress log — update as work proceeds._

## Check

- [ ] Can create, list, delete relationships via API
- [ ] Validation rejects bad table/column references
- [ ] Re-upload with removed column flags the relationship as broken
- [ ] User defines Sales → Agents relationship

## Act

**Learnings**:
-

**Promotions**:
- [ ] → context/ :
- [ ] → skills/  :
