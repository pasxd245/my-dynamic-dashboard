# Round 05: Builder UI — Upload & Schema

**Status**: Deferred
**Date started**:
**Date completed**:
**MVP**: 1
**DoD tasks**: 5.1–5.7
**Canonical state**: Branch `001-upload-profile-field-roles` (US1-US3 complete)

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

**Context**: Builder currently only has stub App.jsx. This round will implement the primary UI shell: multi-step workflow (upload → schema → relationships → queries). Core backend (upload, profile, roles) is complete and tested. Will start after US4 manifest endpoints finalized.

## Check

- [ ] Can drag-drop or click to select a file
- [ ] Upload progress shown, success toast on completion
- [ ] Tables list refreshes automatically after upload
- [ ] Schema viewer shows correct column info
- [ ] User uploads a file through the UI without confusion

## Act

## **Learnings**

**Foundation**: Core builder UI shell. Establishes routing, state management (TanStack Query), and component library baseline (Tailwind).

**Promotions**:

- [ ] → context/ :
- [ ] → skills/ :
