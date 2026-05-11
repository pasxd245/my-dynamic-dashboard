# Data Model: Builder Upload UX Refresh

**Date**: 2026-05-11  
**Spec**: [spec.md](spec.md)  
**Research**: [research.md](research.md)

## Overview

This feature introduces frontend UX state models for the builder upload journey. Backend persistence and upload semantics remain unchanged.

## Entities

### 1) UploadJourneyStage

Represents one visible stage in the sidebar and guided flow.

| Field          | Type                                        | Required | Description                                        |
| -------------- | ------------------------------------------- | -------- | -------------------------------------------------- |
| stage_id       | enum(source, file, sheet, review, submit)   | Yes      | Stable stage key.                                  |
| label          | string                                      | Yes      | User-facing stage title.                           |
| order          | number                                      | Yes      | Deterministic stage position.                      |
| state          | enum(active, completed, blocked, available) | Yes      | Current status for rendering and navigation rules. |
| blocked_reason | string \| null                              | No       | Actionable reason shown when stage is blocked.     |

Validation rules:

- Exactly one stage is `active` at a time.
- A stage can be `available` only if all prerequisites are satisfied.

### 2) UploadSessionInputSet

Represents cumulative user inputs across guided steps.

| Field               | Type             | Required    | Description                                          |
| ------------------- | ---------------- | ----------- | ---------------------------------------------------- |
| workspace_id        | string           | Yes         | Destination workspace identifier.                    |
| source_type         | enum(csv, excel) | Yes         | User-selected source type.                           |
| file_name           | string \| null   | Conditional | Selected upload file name.                           |
| file_extension      | string \| null   | Conditional | Derived extension for compatibility checks.          |
| selected_sheet      | string \| null   | Conditional | Required for multi-sheet excel path.                 |
| is_valid_for_submit | boolean          | Yes         | Aggregated validation result across required stages. |

Validation rules:

- `source_type` and compatible file are required before submit.
- `selected_sheet` required only when discovered sheet count > 1.
- Upstream changes clear or revalidate downstream dependent values.

### 3) AsyncOperationState

Represents async upload/discovery processing state used by loading mask.

| Field        | Type                                      | Required | Description                                |
| ------------ | ----------------------------------------- | -------- | ------------------------------------------ |
| operation    | enum(idle, discovering_sheets, uploading) | Yes      | Current async operation type.              |
| is_blocking  | boolean                                   | Yes      | Whether UI must block conflicting actions. |
| started_at   | datetime \| null                          | No       | Operation start timestamp.                 |
| completed_at | datetime \| null                          | No       | Operation completion timestamp.            |
| outcome      | enum(none, success, failure)              | Yes      | Last operation result.                     |

Rules:

- Loading mask is shown when `is_blocking=true`.
- Mask clears on both success and failure completion states.

### 4) UserFeedbackMessage

Represents structured feedback displayed as inline guidance or toast.

| Field       | Type                                              | Required    | Description                                 |
| ----------- | ------------------------------------------------- | ----------- | ------------------------------------------- |
| message_id  | string                                            | Yes         | Stable identifier for dedupe and rendering. |
| channel     | enum(inline, toast)                               | Yes         | UI message channel.                         |
| severity    | enum(info, success, warning, error)               | Yes         | Message type styling and semantics.         |
| stage_id    | enum(source, file, sheet, review, submit) \| null | Conditional | Stage context for inline messages.          |
| text        | string                                            | Yes         | Actionable user-facing message text.        |
| action_hint | string \| null                                    | No          | Recovery guidance for user next step.       |
| announced   | boolean                                           | Yes         | Accessibility announcement tracking.        |

Rules:

- Validation and stage-specific failures use `inline` channel.
- Upload/discovery operation outcomes emit `toast` channel messages.

## Relationships

- One UploadSessionInputSet maps to many UploadJourneyStage records.
- One UploadSessionInputSet has one AsyncOperationState at a time.
- One UploadSessionInputSet can emit many UserFeedbackMessage events.

## State Transitions

```text
source -> file -> sheet? -> review -> submit

submit + async start:
  idle -> discovering_sheets (if needed) -> uploading -> success|failure

on upstream change:
  downstream values reset/revalidate
  stage states recomputed (completed/blocked/available)
```

Invariants:

- Blocked stage cannot be activated.
- Blocking mask cannot coexist with conflicting actionable controls.
- Success transition to workspace occurs only after confirmed upload success.
