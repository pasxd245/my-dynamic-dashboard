// R201 (item 4.8) — the definition pack and the import plan, as the builder
// reads them. Design: .agents/design/data-management/_shared/definition-pack.md.
// Hand-aligned to packages/contracts/_shared/definition-pack.yaml.
//
// A pack is a FILE the builder downloads and uploads; it never edits one. The
// definitions inside are free objects here (the server reads them with its own
// models), so this file types only what the modal shows.

export type PackColumn = { name: string; dtype: string };

export type PackDataset = { name: string; columns: PackColumn[] };

export type PackQuery = { name: string; dataset: string; definition: Record<string, unknown> };

export type PackWorkflowSource = { query: string } | { workflow: string };

export type PackWorkflow = {
  name: string;
  definition: { sources: PackWorkflowSource[] } & Record<string, unknown>;
};

export type PackDashboard = { name: string; slug: string; definition: Record<string, unknown> };

export type DefinitionPack = {
  packVersion: number;
  exportedAt: string;
  /** The exporting app's version (informational). */
  exportedBy: string;
  /** The exporting workspace's name (informational). */
  workspace: string;
  datasets: PackDataset[];
  queries: PackQuery[];
  workflows: PackWorkflow[];
  dashboards: PackDashboard[];
};

/** What to do with a same-named noun whose definition differs. */
export type OnConflict = 'refuse' | 'replace' | 'skip';

export type PlanKind = 'query' | 'workflow' | 'dashboard';

export type PlanAction = 'create' | 'replace' | 'unchanged' | 'skip' | 'conflict' | 'invalid';

/** Why a row is a conflict or cannot be imported; `detail` carries the name
 *  (a dataset, the noun it needs) or the save check's own message. */
export type PlanReason =
  | 'exists'
  | 'source_differs'
  | 'slug_taken'
  | 'dataset_missing'
  | 'columns_differ'
  | 'needs'
  | 'check_failed';

export type PlanItem = {
  kind: PlanKind;
  name: string;
  action: PlanAction;
  /** The target noun's id (absent for a `create` in a dry run). */
  id?: string;
  reason?: PlanReason;
  detail?: string;
};

export type PlanDataset = {
  name: string;
  status: 'found' | 'missing' | 'columns_differ';
  /** Both column lists, only when they differ. */
  columns?: { expected: PackColumn[]; found: PackColumn[] };
};

export type ImportPlan = {
  dryRun: boolean;
  applied: boolean;
  onConflict: OnConflict;
  /** No dataset missing or differing, no `conflict`, no `invalid`. */
  ok: boolean;
  datasets: PlanDataset[];
  /** In write order: queries, workflows, dashboards. */
  items: PlanItem[];
  counts: Record<PlanAction, number>;
};

/** A problem the server found in the pack itself (`422 pack_invalid`) or in the
 *  exporting workspace (`409 pack_unresolved`). */
export type PackProblem = {
  kind?: PlanKind | 'dataset';
  name?: string;
  /** What the noun references (a name), or a widget's title. */
  ref?: string;
  refKind?: PlanKind;
};

export type PackInvalidReason = 'version' | 'too_large' | 'duplicate' | 'reference' | 'cycle';

export type PackUnresolvedReason = 'query_missing' | 'source_missing' | 'dataset_missing';

export type PackError =
  | {
      code: 'pack_invalid';
      reason: PackInvalidReason;
      problems: PackProblem[];
      packVersion?: number;
      supported?: number[];
    }
  | { code: 'pack_refused'; plan: ImportPlan }
  | { code: 'pack_unresolved'; problems: (PackProblem & { reason: PackUnresolvedReason })[] };
