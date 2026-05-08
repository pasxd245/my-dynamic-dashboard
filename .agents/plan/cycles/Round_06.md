# Round 06: Builder UI — Visual Relationship Builder

**Status**: Deferred
**Date started**:
**Date completed**:
**MVP**: 1
**DoD tasks**: 6.1–6.7
**Canonical state**: Branch `001-upload-profile-field-roles` (US1-US3 complete)

## Goal

Users visually connect tables by dragging edges between nodes in a React
Flow graph. Relationships save to the backend and persist across sessions.

## Plan

- [ ] Install reactflow; create custom `TableNode` component showing columns
- [ ] Fetch tables from API and render as nodes
- [ ] On edge connection → open modal to select from-column, to-column, join type
- [ ] Save relationship via `POST /api/v1/relationships`; show edge on graph
- [ ] Load existing relationships as edges on page mount
- [ ] Sidebar list of current relationships with delete button
- [ ] Persist node positions (localStorage or backend) so layout survives reload

## Do

**Context**: Depends on Round 05 builder UI scaffolding. Backend relationship endpoints not yet implemented (deferred from Round 03). Will start after Round 04 SQL translator to ensure DuckDB joins are compatible with relationship metadata.

## Check

- [ ] Tables appear as draggable nodes with column lists
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
