// Workflow types (R132–R135) — the `queries ⇒ workflows` module.
//
// Hand-aligned to the OpenAPI 3.1 contracts at
// workspace/packages/contracts/_shared/workflow.yaml + workflows/*, and to
// the design at .agents/plan/cycles/Round_136.md.
//
// A Workflow CONSOLIDATES ≥1 saved query (and/or another workflow's output)
// via UNION, applies transform `steps` (reused verbatim from the query module),
// and MATERIALIZES a frozen output on run. `resolvedColumns` + `materializedAt`
// are absent until the first run.

import type { Column } from '@/features/data-management/datasets/types';
import type { Step } from '@/features/data-management/queries/types';

/** A workflow's sources + transform steps. Sources are saved queries (`qr_`)
 *  and/or another workflow's materialized output (`wf_`, output-as-source);
 *  ≥1, consolidated via UNION ALL BY NAME. `steps` reuse the query transform
 *  union (aggregate/derive/filter/top_n/sort/select). Mirrors
 *  `_shared/workflow.yaml#/WorkflowDefinition`. */
export type WorkflowDefinition = {
  /** Source ids (`qr_…` and/or `wf_…`), ≥1. */
  sources: readonly string[];
  /** Ordered transforms; empty/omitted = passthrough (consolidate only). */
  steps?: readonly Step[];
};

/** A saved, workspace-scoped workflow. Mirrors `_shared/workflow.yaml#/Workflow`. */
export type Workflow = {
  /** Server-generated, `^wf_[0-9a-f]{8}$`. */
  id: string;
  workspaceId: string;
  /** User-supplied; unique per workspace; 1–120 chars. */
  name: string;
  definition: WorkflowDefinition;
  /** The MATERIALIZED output's captured columns; present only once run. */
  resolvedColumns?: readonly Column[];
  /** ISO-8601 UTC of the last materialize (run); present only once run. */
  materializedAt?: string;
  createdAt: string;
};

/** POST /workspaces/{id}/workflows request body. Mirrors
 *  `workflows/post.contract.yaml`. */
export type CreateWorkflowRequest = {
  name: string;
  definition: WorkflowDefinition;
};
