# Round 06: Builder UI — Visual Relationship Builder

**Status**: Deferred
**Linked Tasks**: T6.1–T6.7 (see specs/001-upload-profile-field-roles/tasks.md)
**Date started**: —
**Date completed**: —
**MVP**: 1

## Goal

Users visually connect tables via React Flow. Relationships save to backend, persist.

## Implementation Narrative

**Not yet started**. Depends on: Round 05 (builder shell), Round 03 (relationship CRUD), Round 04 (SQL translator).

**Sequencing**: Start after Round 05 UI shell + Round 04 SQL translator to ensure join logic aligns with visual builder.

- [ ] Dragging edge opens connection modal
- [ ] Relationship saves and edge renders
- [ ] Page reload shows saved relationships
- [ ] Delete removes edge and backend record
- [ ] User builds Sales → Agents relationship visually

## Act

## **Learnings**

**Dependencies**: Requires Round 04 SQL translator and Round 05 builder shell. Relationship endpoints (POST/GET/DELETE /api/v1/relationships) must be implemented on backend to persist JOIN metadata.

**Promotions**:

- [ ] → context/ :
- [ ] → skills/ :
