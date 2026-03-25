# Round 05: Builder UI — Upload & Schema

**Status**: Planning
**Date started**:
**Date completed**:
**MVP**: 1
**DoD tasks**: 5.1–5.7

## Goal

The React builder has a working upload page with drag-drop, a tables
list, and a schema viewer. TanStack Query handles all API state.

## Plan

- [ ] Set up TanStack Router with root layout + 4 routes (upload, schema, relationships, queries)
- [ ] Build `FileUploader` component (drag-drop zone, file picker, progress)
- [ ] Wire upload mutation via TanStack Query → `POST /api/v1/tables/upload`
- [ ] Build tables list using TanStack Table (file name, rows, version, actions)
- [ ] Invalidate `['tables']` query on successful upload
- [ ] Build schema viewer page (select table → show columns, types, nullability)
- [ ] Add toast notifications for success/error (react-hot-toast or similar)
- [ ] Basic Tailwind layout and navigation

## Do

_Progress log — update as work proceeds._

## Check

- [ ] Can drag-drop or click to select a file
- [ ] Upload progress shown, success toast on completion
- [ ] Tables list refreshes automatically after upload
- [ ] Schema viewer shows correct column info
- [ ] User uploads a file through the UI without confusion

## Act

**Learnings**:
-

**Promotions**:
- [ ] → context/ :
- [ ] → skills/  :
