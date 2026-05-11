# Contract: Builder Upload Flow Completion

**Scope**: User-visible upload flow in builder UI over existing upload API semantics  
**Spec**: [../spec.md](../spec.md)  
**Plan**: [../plan.md](../plan.md)

## Purpose

Define the frontend/backend integration contract and UI-state behavior required to complete Round 32 upload flow, without changing Round 31 backend dispatch semantics.

## Contract Surface A: Source-Type and File Compatibility

- Source type is required before final submission.
- File compatibility is validated in UI before submit and revalidated by backend parse path.
- Supported upload formats remain unchanged: `.csv`, `.xlsx`, `.xlsm`, `.xlsb`, `.xls`.
- No new source type contracts are introduced this round.

## Contract Surface B: Excel Sheet Selection Behavior

- Multi-sheet Excel uploads require explicit sheet choice before submission.
- Single-sheet Excel uploads must not force unnecessary sheet picker interaction.
- Sheet discovery failure must produce actionable error state with retry/reselect guidance.

## Contract Surface C: Upload Lifecycle Visibility

The UI must expose explicit lifecycle states:

- `idle`
- `validating`
- `uploading`
- `resolving_sheet` (if applicable)
- `success`
- `failed`

Rules:

- `success` may only render after backend confirms upload completion.
- `failed` must provide clear retry action and remain in upload context.

## Contract Surface D: Success and Failure Navigation

- On success: transition to workspace context using existing builder session/active-context surfaces.
- On failure: keep user in upload context with actionable message and retry path.
- If transition metadata is missing after upload success, treat as controlled failure rather than partial navigation.

## Contract Surface E: Backend Semantics Preservation

Backend upload contract remains unchanged:

- Endpoint: `POST /api/v1/workspaces/{workspace_id}/sources/upload`
- Request body: `multipart/form-data` with `file`
- Response semantics remain compatible with existing `SourceUploadResponse`
- Backend continues dispatch via source registry (`parse_dataframe_via_source_registry`) and existing file-type guardrails

No changes this round to:

- Endpoint path/version
- Request payload shape
- Existing parse/dispatch semantics for CSV and Excel
- Persistence semantics for source/sheet/profile records

## Verification Matrix

| Surface                              | Verification                                                  |
| ------------------------------------ | ------------------------------------------------------------- |
| Source-type required + compatibility | Builder interaction tests for valid/invalid combinations      |
| Multi-sheet conditional picker       | Excel multi-sheet and single-sheet scenario tests             |
| Progress states                      | State transition tests + manual stall/failure checks          |
| Success transition                   | Workflow navigation/context assertion after successful upload |
| Failure recovery                     | No-navigation assertion + retry CTA assertions                |
| Backend semantics preservation       | API regression tests + source registry behavior checks        |
| Round scope guardrail                | Changed-file audit limited to upload-flow surfaces            |
