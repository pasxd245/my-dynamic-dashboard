# Round 06: Builder UI — Visual Relationship Builder

**Status**: Planning
**Date started**:
**Date completed**:
**MVP**: 1
**DoD tasks**: 6.1–6.7

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

_Progress log — update as work proceeds._

## Check

- [ ] Tables appear as draggable nodes with column lists
- [ ] Dragging edge opens connection modal
- [ ] Relationship saves and edge renders
- [ ] Page reload shows saved relationships
- [ ] Delete removes edge and backend record
- [ ] User builds Sales → Agents relationship visually

## Act

## **Learnings**

**Promotions**:

- [ ] → context/ :
- [ ] → skills/ :
