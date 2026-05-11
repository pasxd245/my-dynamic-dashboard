# Contract: Builder Upload UX Refresh

**Scope**: Builder upload UX surfaces only (sidebar, guided steps, loading mask, inline/toast feedback)  
**Spec**: [../spec.md](../spec.md)  
**Plan**: [../plan.md](../plan.md)

## Purpose

Define the frontend behavior contract for upload UX refresh while preserving existing backend upload endpoint semantics and supported flows.

## Contract Surface A: Sidebar Stage Navigation

- Sidebar renders ordered stages with `active`, `completed`, `blocked`, or `available` state.
- Selecting a blocked stage must keep the user on the required prerequisite stage.
- Blocked-stage interaction must show actionable inline guidance for unmet requirements.

## Contract Surface B: Guided Multi-Step Form

- Only current-stage inputs are primary and actionable.
- Stage progression requires stage-level validation pass.
- Upstream changes invalidate or clear dependent downstream values.

## Contract Surface C: Loading Mask Behavior

- Loading mask appears during async sheet discovery and upload operations.
- While visible, conflicting actions (submit, stage jump, duplicated triggers) are blocked.
- Loading mask is removed immediately when operation resolves to success or failure.

## Contract Surface D: Inline and Toast Feedback

- Inline messages are required for validation and stage-specific operation errors.
- Toast notifications are required for async operation outcomes (success and failure).
- Message text must be concise and include actionable recovery guidance for errors.

## Contract Surface E: Backend Semantic Preservation

Backend contract remains unchanged:

- Endpoint: `POST /api/v1/workspaces/{workspace_id}/sources/upload`
- Request transport: `multipart/form-data` with existing expected file field semantics
- Response behavior: must remain compatible with current builder upload handling
- Dispatch behavior: existing backend source registry and parse semantics remain unchanged

No changes in this feature to:

- Upload endpoint version/path
- Upload request/response schema contracts
- Parsing or persistence semantics for supported upload file types

## Verification Matrix

| Surface                      | Verification                                                          |
| ---------------------------- | --------------------------------------------------------------------- |
| Sidebar stage model + guards | Builder interaction tests for blocked/available/current transitions   |
| Guided step validation       | Step progression and required-input validation tests                  |
| Loading mask blocking        | Async operation tests asserting mask visibility and control lockout   |
| Inline + toast feedback      | Validation and async outcome message behavior tests                   |
| Backend semantics unchanged  | Backend regression command and API behavior checks                    |
| Scope control                | Changed-file audit restricted to builder upload UX and spec artifacts |
