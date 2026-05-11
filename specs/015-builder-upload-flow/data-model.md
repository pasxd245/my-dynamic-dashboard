# Data Model: Builder Upload Flow Completion

**Date**: 2026-05-11  
**Spec**: [spec.md](spec.md)  
**Research**: [research.md](research.md)

## Overview

This feature models the user-visible upload flow state over existing backend upload semantics. It introduces no new backend persistence contracts and focuses on front-end state consistency, validation, and transitions.

## Entities

### 1) UploadSession

Represents one user-initiated upload attempt.

| Field          | Type                                                                | Required    | Description                                        |
| -------------- | ------------------------------------------------------------------- | ----------- | -------------------------------------------------- |
| session_id     | string                                                              | Yes         | Client-side unique ID for one attempt (ephemeral). |
| workspace_id   | string                                                              | Yes         | Target workspace receiving the upload.             |
| file_name      | string                                                              | Yes         | Selected file name.                                |
| source_type    | enum(csv, excel)                                                    | Yes         | User-selected source type.                         |
| selected_sheet | string \| null                                                      | Conditional | Required only when multiple sheets are discovered. |
| status         | enum(idle, validating, uploading, resolving_sheet, success, failed) | Yes         | User-visible lifecycle state.                      |
| error_code     | string \| null                                                      | No          | Stable code when status is failed.                 |
| error_message  | string \| null                                                      | No          | User-facing recovery message.                      |
| started_at     | datetime                                                            | Yes         | Start timestamp for state traceability.            |
| completed_at   | datetime \| null                                                    | No          | End timestamp on success/failure.                  |

Validation rules:

- `source_type` must be present before submission (FR-001).
- `file_name` extension must match `source_type` compatibility rules (FR-002).
- `selected_sheet` is required when multiple sheet options exist (FR-004).

### 2) SourceTypeSelection

Represents the active source-type choice and compatibility rules used by UploadSession.

| Field               | Type             | Required | Description                                  |
| ------------------- | ---------------- | -------- | -------------------------------------------- |
| source_type         | enum(csv, excel) | Yes      | UI-selected source class.                    |
| accepted_extensions | string[]         | Yes      | Allowed extensions for selected source type. |
| is_compatible       | boolean          | Yes      | Computed from current selected file.         |
| mismatch_reason     | string \| null   | No       | Human-readable correction guidance.          |

State behavior:

- Changing source type clears stale incompatible choices (FR-010).

### 3) ExcelSheetOption

Represents one sheet candidate from workbook discovery.

| Field         | Type    | Required | Description                                   |
| ------------- | ------- | -------- | --------------------------------------------- |
| sheet_id      | string  | Yes      | Stable identifier in upload response context. |
| sheet_name    | string  | Yes      | Display name shown in picker.                 |
| is_selectable | boolean | Yes      | False when metadata marks sheet as unusable.  |
| ordinal       | number  | Yes      | Display order for deterministic selection.    |

Validation rules:

- Sheet names must be unambiguous in UI (handles hidden/duplicate-like names).
- Only one sheet can be selected for this round.

### 4) UploadProgressState

Tracks user-visible progress and feedback.

| Field           | Type                                                                | Required | Description                                |
| --------------- | ------------------------------------------------------------------- | -------- | ------------------------------------------ |
| phase           | enum(idle, validating, uploading, resolving_sheet, success, failed) | Yes      | Lifecycle phase displayed to user.         |
| message         | string                                                              | Yes      | Human-readable phase text.                 |
| is_retryable    | boolean                                                             | Yes      | Whether retry CTA is shown.                |
| last_updated_at | datetime                                                            | Yes      | Timestamp for stale/stall messaging logic. |

Rules:

- UI must never infer success before backend confirms (FR-007).
- Failure state always includes retry guidance (FR-009).

### 5) WorkspaceTransitionTarget

Represents destination context after successful upload.

| Field             | Type                                                    | Required | Description                                            |
| ----------------- | ------------------------------------------------------- | -------- | ------------------------------------------------------ |
| workspace_id      | string                                                  | Yes      | Destination workspace ID.                              |
| source_id         | string                                                  | Yes      | Uploaded source ID used for active-context resolution. |
| destination_stage | enum(upload_source, schema_sheet, query, results_saved) | Yes      | Initial stage after successful upload transition.      |
| transition_ready  | boolean                                                 | Yes      | True only when required metadata is present.           |

Rules:

- Transition occurs only when upload response and context metadata are complete (FR-008).
- Missing transition metadata yields controlled failure and no navigation (edge case + FR-009).

## Relationships

- UploadSession has one SourceTypeSelection.
- UploadSession has zero or many ExcelSheetOption entries.
- UploadSession has one UploadProgressState.
- UploadSession resolves to zero or one WorkspaceTransitionTarget.

## State Transitions

```text
idle
  -> validating
  -> uploading
  -> resolving_sheet (excel multi-sheet only)
  -> success | failed

failed
  -> validating (retry)

success
  -> workspace transition complete
```

Invariants:

- A transition to success must be immediately followed by workspace transition attempt.
- Any transition failure after upload success must move to failed with actionable recovery path.
- Revising source type or file resets sheet-related state.
