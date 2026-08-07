---
type: frontend feature system
title: Data management authoring
description: Builder feature ownership for workspaces, import and refresh, relationships, query construction, and workflows.
tags: [frontend, data-management]
---

# Data management authoring

`src/features/data-management` is the builder’s analytical authoring system. It is organized by resource, with each feature supplying page components, local types, React Query hooks, and API-client consumers. It does not own authoritative data semantics: those remain in [backend datasets](../backend/datasets.md), [queries](../backend/queries.md), [workflows](../backend/workflows.md), and [governance](../backend/governance-and-dashboards.md).

## Resource responsibilities

| Feature | Primary UI and symbols | Backend consumer |
| --- | --- | --- |
| Workspaces | `WorkspacesPage`, `hooks.ts` | `workspacesApi` |
| Dataset import/refresh | `datasets/upload/DatasetNewPage`, `wizardReducer`, upload step components | `uploadsApi`, `datasetsApi` |
| Dataset detail/exploration | `DatasetDetailPage`, filters and advanced query modules | `datasetsApi.getRows` | 
| Relationships | `WorkspaceRelationshipsPage`, `DeclareRelationshipModal` | `relationshipsApi` |
| Queries | `QueryCreatePage`, `QueryDetailPage`, `QueryCanvas`, `useQueryBuilder`, `StepsEditor` | `queriesApi` |
| Workflows | `WorkflowCreatePage`, `WorkflowDetailPage`, `WorkflowForm`, `WorkflowSourcePicker` | `workflowsApi` |

For dataset rows, column presentation, simple filters, and the client advanced-query language, use [dataset exploration](dataset-exploration.md) rather than this page.

## Import and refresh wizard

`DatasetNewPage` drives a reducer state machine defined in `datasets/upload/state.ts`. The state distinguishes `create` from `refresh`, tracks staged upload metadata, selected sheets/ranges, parse options, column overrides, and per-sheet units. Excel can produce multiple datasets—including separate ranges from one sheet—while CSV has one logical unit. The UI calls upload, parse, optional append-overlap advisory, and commit APIs through dataset hooks.

The reducer computes schema drift and merge-key issues before commit. A refresh retains the target ID, committed-schema baseline, carried parse options, overrides/exclusions, computed/provenance pointer, and the user’s dataset name while the incoming export is re-parsed. `hidden` is only a presentation hint and must not be treated as an ingestion or query-schema decision. `refresh_mode` is omitted for replace and explicit for merge or append; merge supplies keys, while append can supply an overlap-check date field and shows its advisory result. A drifted schema requires explicit acknowledgement in wizard state before submission; this is a client-side safety gate, not an alternate backend schema. The UI must not treat a successful upload preview as a commit: only batch commit creates or refreshes durable datasets.

## Relationships and query canvas

`DeclareRelationshipModal.dtypeCompatible` mirrors the UI-side compatibility guard, but server validation remains authoritative. Relationship list hooks invalidate workspace relationship queries after mutations.

The query editor stores a working `QueryDefinition` with a polymorphic source, `joins`, query-owned relationships, filters and steps. `chain.ts` reads legacy/single shape and writes the canonical definition; `copyGovernedRel()` snapshots a selected governed relationship and `freeFormRel()` creates an independent edge. `joinGraph.ts` builds graph state, detects divergence from a governed source, and `resolveConnect()` enforces eligible connections/provenance before the definition reaches preview/save. `QueryCanvas` is the graphical editing surface; `useQueryBuilder` coordinates draft state, debounced/explicit preview, create/update and completion callbacks. Do not replace query-owned relationship IDs with live `rel_` lookups: that would violate backend snapshot semantics.

`useQueryBuilder` keeps a normalized working definition (including legacy single-join forms), a debounced preview definition, preview pagination, and an `active` visibility gate. Preview runs only when the editor is active and the debounced draft is eligible; create/edit flows use the same normalized serialization for dirty comparison and API requests. It deliberately distinguishes base/effective columns from post-step output: join/filter editors author against pre-step resolved columns, while `StepsEditor` threads output columns through steps and the preview table displays post-step `resolvedColumns`.

Save is disabled while a preview update is pending or a create/update mutation is running, and when client validation finds bad predicate atoms or the preview/current definition reports stale relationships, stale predicates/query state, or a composition cycle. `StepsEditor` and `steps.ts` thread column types through transform steps so the UI proposes valid follow-on choices. Keep client hints aligned with server plan validation; server errors remain decisive.

## Workflows

Workflow pages use `WorkflowForm` and `WorkflowSourcePicker` to collect source IDs and shared-style steps. Hooks expose list/detail/rows and mutations, including `useRunWorkflowMutation`. A source may be a query or materialized workflow output; UX must communicate that an output source has to be run before downstream execution can succeed.

## Focused tests and validation

- `tests/wizard-reducer.test.ts`, `refresh-wizard.test.tsx`, and `datasets.test.tsx` cover import/refresh transitions and requests.
- `tests/relationships.test.tsx` covers the governance UI.
- `tests/queries.test.tsx`, `query-canvas-connect.test.ts`, `query-provenance.test.ts`, `steps-editor.test.tsx`, and `advanced-query.test.tsx` cover query authoring.
- `tests/workflows.test.tsx` and `workflow-preview-mock.test.ts` cover workflow UI behavior.

Run `pnpm --filter builder test -- <focused test file>` when supported by the local Vitest invocation, or run `pnpm --filter builder test` for the package suite.
