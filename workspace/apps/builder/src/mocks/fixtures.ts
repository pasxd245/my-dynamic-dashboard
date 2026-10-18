// R41: shared MSW fixtures. R42 extends with the YAML-examples-as-
// fixture-source discipline.
//
// Frozen — handlers read from these; per-test overrides via
// `server.use(...)` supply alternate handlers, not alternate fixture
// data.
//
// One workspace, one CSV dataset mirroring the R34
// `rows-get.contract.yaml` example shape. The rows cover all six
// dtypes so the filter handler exercises the per-dtype CAST
// semantics (integer, string, float, date, datetime, boolean).
//
// R42 convention: when adding NEW fixtures whose shape mirrors a
// contract example, derive them from the YAML via
// `loadYamlExampleRows()` below. The R41 in-line MOCK_ROWS stay as
// they are (test-stable), but the convention applies forward —
// "YAML examples are the canonical reference; fixtures conform."

import type { Column, Dataset, Dtype, RowsPage } from '@/features/data-management/datasets/types';
import type { Query, ResolvedColumn } from '@/features/data-management/queries/types';
import type { Workflow } from '@/features/data-management/workflows/types';
import type { Relationship, RelationshipCheck } from '@/features/data-management/relationships/types';
import type { DashboardWire } from '@/features/dashboard/wire';
import type { MetadataRead } from '@/features/metadata/types';
import type { Workspace } from '@/features/data-management/workspaces/types';

import { CONTRACTS_ROOT } from './contracts-root';

export const MOCK_WORKSPACE: Workspace = {
  id: 'ws_aaaaaaa1',
  name: 'Marketing',
  kind: 'main',
  createdAt: '2026-05-21T10:00:00Z',
};

/** R93 — attach column provenance to a dataset's columns for a joined query's
 *  `resolvedColumns` fixture: each effective column traces 1:1 to its leaf
 *  (`ownerSourceId`) with the pre-qualification `sourceColumn` (the bare name on
 *  that leaf). `qualify` renames the collision-qualified DISPLAY `name`
 *  (`tier` → `accounts.tier`) while `sourceColumn` stays the bare leaf name. */
function withProvenance(
  cols: readonly Column[],
  ownerSourceId: string,
  qualify: (name: string) => string = (n) => n,
): ResolvedColumn[] {
  return cols.map((c) => ({
    name: qualify(c.name),
    dtype: c.dtype,
    ownerSourceId,
    sourceColumn: c.name,
  }));
}

export const MOCK_DATASET: Dataset = {
  id: 'ds_11111111',
  workspaceId: MOCK_WORKSPACE.id,
  name: 'q1_pipeline_Deals',
  sizeBytes: 86_016,
  rowCount: 8,
  columnCount: 7,
  columns: [
    { name: 'deal_id', dtype: 'string' },
    { name: 'amount', dtype: 'integer' },
    // R178 — coverage as the server would profile MOCK_ROWS: won_at blank in
    // 2 of 8 rows; created_at never blank.
    { name: 'won_at', dtype: 'date', coverage: { min: '2026-03-01', max: '2026-05-14', blankShare: 0.25 } },
    { name: 'stage', dtype: 'string' },
    { name: 'probability', dtype: 'float' },
    { name: 'is_priority', dtype: 'boolean' },
    {
      name: 'created_at',
      dtype: 'datetime',
      coverage: { min: '2026-02-28T14:02:00', max: '2026-05-08T15:22:00', blankShare: 0 },
    },
  ],
  sourceFormat: 'csv',
  createdAt: '2026-05-22T12:00:00Z',
  refreshedAt: '2026-05-22T12:00:00Z',
  dataVersion: 1,
};

/** Row-major; cell order matches `MOCK_DATASET.columns`. Cells are
 *  stringified BE-side per the rows-get contract. */
/** R178 — a dataset column's SCHEMA part (name / dtype / hidden), without the
 *  server-profiled `coverage`. Everything that re-uses dataset columns as the
 *  columns of something else (a query's resolved columns, a parse preview)
 *  takes this shape — coverage describes one dataset's rows, nothing else. */
export function schemaOf<T extends { name: string; dtype: Dtype; hidden?: boolean }>(
  columns: readonly T[],
): { name: string; dtype: Dtype; hidden?: boolean }[] {
  return columns.map(({ name, dtype, hidden }) => (hidden ? { name, dtype, hidden } : { name, dtype }));
}

export const MOCK_ROWS: readonly (readonly (string | null)[])[] = [
  ['D-0001', '12400', '2026-03-01', 'won', '0.95', 'true', '2026-02-28 14:02:00'],
  ['D-0002', null, null, 'open', '0.45', 'false', '2026-03-15 09:18:00'],
  ['D-0003', '102000', '2026-04-12', 'negotiating', '0.72', 'true', '2026-04-01 11:30:00'],
  ['D-0004', '7800', '2026-04-18', 'open', '0.30', 'false', '2026-04-10 16:50:00'],
  ['D-0005', '24500', '2026-05-02', 'won', '1.00', 'true', '2026-04-22 08:11:00'],
  ['D-0006', '3200', null, 'lost', '0.00', 'false', '2026-05-05 13:45:00'],
  ['D-0007', '58750', '2026-05-10', 'won', '0.88', 'true', '2026-04-29 10:00:00'],
  ['D-0008', '9250', '2026-05-14', 'open', '0.55', 'false', '2026-05-08 15:22:00'],
];

export const MOCK_ROWS_FULL: RowsPage = {
  rows: MOCK_ROWS.map((r) => [...r]),
  page: 1,
  pageSize: 50,
  total: MOCK_ROWS.length,
};

// ─── Saved Query fixtures (R69) ──────────────────────────────────────
//
// One saved query over MOCK_DATASET: "stage = won AND amount > 1000".
// Its `definition` col indices reference MOCK_DATASET.columns (col 3 =
// stage, col 1 = amount). Mirrors the queries/post.contract.yaml example.

export const MOCK_QUERY: Query = {
  id: 'qr_9c2f10ab',
  workspaceId: MOCK_WORKSPACE.id,
  sourceId: MOCK_DATASET.id, // R79 — the canonical driving source (a `ds_`)
  name: 'Won deals over $1k',
  definition: {
    q: null,
    filters: [{ col: 3, dtype: 'string', op: 'equals', val: 'won' }],
    advanced: [[{ col: 1, dtype: 'integer', op: 'gt', val: 1000 }]],
  },
  createdAt: '2026-06-12T14:02:00Z',
};

export const MOCK_QUERIES: readonly Query[] = [MOCK_QUERY];

// R132–R135 — a MATERIALIZED workflow consolidating one saved query. `getWorkflow`
// returns it materialized so the detail page shows its output table in dev;
// `runWorkflow` echoes the same materialized shape; `workflowRows` pages MOCK_ROWS.
export const MOCK_WORKFLOW: Workflow = {
  id: 'wf_11111111',
  workspaceId: MOCK_WORKSPACE.id,
  name: 'Consolidated leads',
  definition: { sources: [MOCK_QUERY.id], steps: [] },
  resolvedColumns: schemaOf(MOCK_DATASET.columns),
  materializedAt: '2026-07-01T12:00:00Z',
  // R187 — the server's run stamp (one query source over MOCK_DATASET at v1).
  run: {
    id: 'run_1a2b3c4d',
    number: 3,
    definitionHash: 'a1b2c3d4e5f6',
    sources: [{ id: MOCK_QUERY.id, definitionHash: '0f1e2d3c4b5a', dataVersions: { [MOCK_DATASET.id]: 1 } }],
  },
  createdAt: '2026-07-01T10:00:00Z',
};

export const MOCK_WORKFLOWS: readonly Workflow[] = [MOCK_WORKFLOW];

// R192 — MOCK_WORKFLOW's output published as a dataset: `sourceFormat:
// workflow`, its lineage copied from the run stamp above. Not in the datasets
// list fixture (list tests count rows); reachable by id.
export const MOCK_PUBLISHED_DATASET: Dataset = {
  id: 'ds_9b11c0de',
  workspaceId: MOCK_WORKSPACE.id,
  name: 'Consolidated leads',
  sizeBytes: 2048,
  rowCount: MOCK_ROWS.length,
  columnCount: MOCK_DATASET.columns.length,
  columns: MOCK_DATASET.columns.map((c) => ({ ...c })),
  sourceFormat: 'workflow',
  createdAt: '2026-07-01T12:05:00Z',
  refreshedAt: '2026-07-01T12:05:00Z',
  dataVersion: 1,
  lineage: {
    workflowId: MOCK_WORKFLOW.id,
    workflowName: MOCK_WORKFLOW.name,
    runId: MOCK_WORKFLOW.run!.id,
    runNumber: MOCK_WORKFLOW.run!.number,
    runAt: MOCK_WORKFLOW.materializedAt!,
    definitionHash: MOCK_WORKFLOW.run!.definitionHash,
    sources: MOCK_WORKFLOW.run!.sources,
    publishedAt: '2026-07-01T12:05:00Z',
  },
};

// R193 — MOCK_WORKSPACE's saved (frozen-copies) workspace and one copy of
// MOCK_DATASET in it, frozen at data version 1. Reachable by id (not in the
// list fixtures, which list tests count).
export const MOCK_SAVED_WORKSPACE: Workspace = {
  id: 'ws_5a7ed001',
  name: `${MOCK_WORKSPACE.name}-saved`,
  kind: 'saved',
  parentWorkspaceId: MOCK_WORKSPACE.id,
  createdAt: '2026-10-18T09:00:00Z',
};

export const MOCK_SAVED_COPY: Dataset = {
  ...MOCK_DATASET,
  id: 'ds_5a7ed0c1',
  workspaceId: MOCK_SAVED_WORKSPACE.id,
  name: `${MOCK_DATASET.name} @2026-10-18`,
  savedFrom: {
    datasetId: MOCK_DATASET.id,
    datasetName: MOCK_DATASET.name,
    workspaceId: MOCK_WORKSPACE.id,
    dataVersion: MOCK_DATASET.dataVersion,
    refreshedAt: MOCK_DATASET.refreshedAt,
    label: '2026-10-18',
    savedAt: '2026-10-18T09:12:00Z',
  },
};

/** R192 — a workflow id the publish handler refuses as out of date. */
export const MOCK_STALE_WORKFLOW_ID = 'wf_57a1e000';

/** A query id whose run returns 409 query_stale (the source dataset's
 *  schema drifted). Lets the FE/integration exercise the stale state
 *  deterministically without mutating a dataset. */
export const MOCK_STALE_QUERY_ID = 'qr_dead0000';

// ─── Dashboard fixtures (R101 — dashboard-as-a-persisted-noun) ───────
//
// One dashboard in MOCK_WORKSPACE, slug `weekly-report`, with a single
// formula-free widget over MOCK_QUERY (deals by stage, summed). Mirrors the
// dashboards/*.contract.yaml examples; columns by NAME, `dsh_`/`wdg_` ids.
export const MOCK_DASHBOARD: DashboardWire = {
  id: 'dsh_71a4e2f0',
  workspaceId: MOCK_WORKSPACE.id,
  name: 'Weekly report',
  slug: 'weekly-report',
  definition: {
    widgets: [
      {
        id: 'wdg_4d7b91ce',
        queryId: MOCK_QUERY.id,
        title: 'Won deals by stage',
        chartType: 'bar',
        dimensionCol: 'stage',
        measureCol: 'amount',
        agg: 'sum',
        span: 1,
      },
    ],
  },
  createdAt: '2026-06-27T14:02:00Z',
};

export const MOCK_DASHBOARDS: readonly DashboardWire[] = [MOCK_DASHBOARD];

// ─── Relationship fixtures (R70 — governance) ────────────────────────
//
// A second dataset in the same workspace so relationships have two sides
// to connect. The governed edge below joins Deals.deal_id ↔ Accounts.
// account_id (string ↔ string — dtype-compatible). A second, stale edge
// references a column that no longer exists on the left, to exercise the
// computed `status: stale` flag deterministically.

export const MOCK_DATASET_2: Dataset = {
  id: 'ds_22222222',
  workspaceId: MOCK_WORKSPACE.id,
  name: 'accounts',
  sizeBytes: 20_480,
  rowCount: 5,
  columnCount: 3,
  columns: [
    { name: 'account_id', dtype: 'string' },
    { name: 'account_name', dtype: 'string' },
    { name: 'tier', dtype: 'string' },
  ],
  sourceFormat: 'csv',
  createdAt: '2026-05-23T12:00:00Z',
  refreshedAt: '2026-05-23T12:00:00Z',
  dataVersion: 1,
};

export const MOCK_RELATIONSHIP: Relationship = {
  id: 'rel_a1b2c3d4',
  workspaceId: MOCK_WORKSPACE.id,
  leftDatasetId: MOCK_DATASET.id,
  leftColumn: 'deal_id',
  rightDatasetId: MOCK_DATASET_2.id,
  rightColumn: 'account_id',
  cardinality: 'one_to_many',
  status: 'valid',
  createdAt: '2026-06-13T09:00:00Z',
};

/** A governed edge whose left column no longer exists → computed `stale`. */
export const MOCK_STALE_RELATIONSHIP: Relationship = {
  id: 'rel_57a1e000',
  workspaceId: MOCK_WORKSPACE.id,
  leftDatasetId: MOCK_DATASET.id,
  leftColumn: 'legacy_code',
  rightDatasetId: MOCK_DATASET_2.id,
  rightColumn: 'account_id',
  cardinality: 'one_to_one',
  status: 'stale',
  createdAt: '2026-06-13T08:00:00Z',
};

export const MOCK_RELATIONSHIPS: readonly Relationship[] = [MOCK_RELATIONSHIP, MOCK_STALE_RELATIONSHIP];

// ─── Joined Query fixtures (R71 — join execution) ────────────────────
//
// A Query that consumes MOCK_RELATIONSHIP (Deals.deal_id ↔ Accounts.
// account_id) to read both datasets as one. Its `resolvedColumns` is the
// effective space Deals.columns ++ accounts.columns (no name collisions
// here, so names stay bare); the run returns joined rows in that order.

export const MOCK_JOINED_QUERY: Query = {
  id: 'qr_101a0001',
  workspaceId: MOCK_WORKSPACE.id,
  sourceId: MOCK_DATASET.id, // R79 — the driving source (the LEFT `ds_` source)
  name: 'Deals × Accounts',
  definition: {
    q: null,
    filters: [],
    advanced: [],
    // R88 — the query OWNS its join relationship (a copy of the governed rel,
    // with `originRelationshipId` provenance); the hop references it by id.
    relationships: [
      {
        id: 'qrel_a1b2c3d4',
        leftSourceId: MOCK_RELATIONSHIP.leftDatasetId,
        leftColumn: MOCK_RELATIONSHIP.leftColumn,
        rightSourceId: MOCK_RELATIONSHIP.rightDatasetId,
        rightColumn: MOCK_RELATIONSHIP.rightColumn,
        cardinality: MOCK_RELATIONSHIP.cardinality,
        originRelationshipId: MOCK_RELATIONSHIP.id,
      },
    ],
    joins: [{ queryRelId: 'qrel_a1b2c3d4', type: 'inner' }],
  },
  resolvedColumns: [
    ...withProvenance(schemaOf(MOCK_DATASET.columns), MOCK_DATASET.id),
    ...withProvenance(schemaOf(MOCK_DATASET_2.columns), MOCK_DATASET_2.id),
  ],
  createdAt: '2026-06-13T10:00:00Z',
};

/** Row-major joined result; cell order matches MOCK_JOINED_QUERY.resolvedColumns
 *  (7 Deals cols ++ 3 accounts cols = 10). */
export const MOCK_JOINED_ROWS: RowsPage = {
  rows: [
    ['D-0001', '12400', '2026-03-01', 'won', '0.95', 'true', '2026-02-28 14:02:00', 'D-0001', 'Acme', 'gold'],
    ['D-0005', '24500', '2026-05-02', 'won', '1.00', 'true', '2026-04-22 08:11:00', 'D-0005', 'Globex', 'silver'],
  ],
  page: 1,
  pageSize: 50,
  total: 2,
};

/** A joined query whose consumed edge is stale (its join key column drifted):
 *  run returns 409 relationship_stale, blocking the join. */
export const MOCK_STALE_JOIN_QUERY_ID = 'qr_5ta1e000';

// ─── Multi-join chain fixtures (R73 — linear multi-hop) ──────────────
//
// A THIRD dataset (owners) + a SECOND governed edge (accounts.tier ↔
// owners.tier) so a chain can extend Deals ⋈ Accounts ⋈ Owners. The chain's
// effective space is Deals.columns ++ accounts.columns ++ owners.columns
// (7 + 3 + 3 = 13; no name collisions here, so names stay bare). The F1
// preview handler returns MOCK_CHAIN_ROWS for a 2-hop chain.

export const MOCK_DATASET_3: Dataset = {
  id: 'ds_33333333',
  workspaceId: MOCK_WORKSPACE.id,
  name: 'owners',
  sizeBytes: 12_288,
  rowCount: 3,
  columnCount: 3,
  columns: [
    { name: 'tier', dtype: 'string' },
    { name: 'owner_name', dtype: 'string' },
    { name: 'region', dtype: 'string' },
  ],
  sourceFormat: 'csv',
  createdAt: '2026-05-24T12:00:00Z',
  refreshedAt: '2026-05-24T12:00:00Z',
  dataVersion: 1,
};

/** The second hop: accounts.tier ↔ owners.tier (drives FROM accounts, the
 *  chain's tail after hop 1). Valid → offered by the chain editor's add. */
export const MOCK_RELATIONSHIP_2: Relationship = {
  id: 'rel_b2c3d4e5',
  workspaceId: MOCK_WORKSPACE.id,
  leftDatasetId: MOCK_DATASET_2.id,
  leftColumn: 'tier',
  rightDatasetId: MOCK_DATASET_3.id,
  rightColumn: 'tier',
  cardinality: 'one_to_many',
  status: 'valid',
  createdAt: '2026-06-13T09:30:00Z',
};

// ─── Join-graph (tree) fixtures (R74 — non-linear topology) ──────────
//
// Two more leaf datasets + two more edges so the graph can BRANCH (a tree,
// not a path). After Deals ⋈ Accounts ⋈ Owners, BOTH Accounts (→ tiers) and
// Owners (→ regions) carry an eligible outgoing edge — so the chain editor's
// add offers a LEFT-SOURCE choice, and a hop can extend from Accounts (NOT the
// tail, Owners) — the R74 branch the linear chain (R73) could not express.

export const MOCK_DATASET_4: Dataset = {
  id: 'ds_44444444',
  workspaceId: MOCK_WORKSPACE.id,
  name: 'tiers',
  sizeBytes: 4_096,
  rowCount: 2,
  columnCount: 2,
  columns: [
    { name: 'acct', dtype: 'string' },
    { name: 'tier_label', dtype: 'string' },
  ],
  sourceFormat: 'csv',
  createdAt: '2026-05-25T12:00:00Z',
  refreshedAt: '2026-05-25T12:00:00Z',
  dataVersion: 1,
};

export const MOCK_DATASET_5: Dataset = {
  id: 'ds_55555555',
  workspaceId: MOCK_WORKSPACE.id,
  name: 'regions',
  sizeBytes: 4_096,
  rowCount: 3,
  columnCount: 2,
  columns: [
    { name: 'region', dtype: 'string' },
    { name: 'region_label', dtype: 'string' },
  ],
  sourceFormat: 'csv',
  createdAt: '2026-05-25T13:00:00Z',
  refreshedAt: '2026-05-25T13:00:00Z',
  dataVersion: 1,
};

/** Accounts → tiers (accounts.account_id ↔ tiers.acct). Drives FROM Accounts —
 *  so once Owners is the tail, this edge BRANCHES from a non-tail source (R74). */
export const MOCK_RELATIONSHIP_3: Relationship = {
  id: 'rel_c3d4e5f6',
  workspaceId: MOCK_WORKSPACE.id,
  leftDatasetId: MOCK_DATASET_2.id,
  leftColumn: 'account_id',
  rightDatasetId: MOCK_DATASET_4.id,
  rightColumn: 'acct',
  cardinality: 'one_to_one',
  status: 'valid',
  createdAt: '2026-06-13T09:45:00Z',
};

/** Owners → regions (owners.region ↔ regions.region). Drives FROM Owners (the
 *  tail), so the two add-sources (Accounts, Owners) coexist → the left-source
 *  <Select> appears. */
export const MOCK_RELATIONSHIP_4: Relationship = {
  id: 'rel_d4e5f6a7',
  workspaceId: MOCK_WORKSPACE.id,
  leftDatasetId: MOCK_DATASET_3.id,
  leftColumn: 'region',
  rightDatasetId: MOCK_DATASET_5.id,
  rightColumn: 'region',
  cardinality: 'one_to_many',
  status: 'valid',
  createdAt: '2026-06-13T09:50:00Z',
};

/** All edges live in the workspace: hop-1 (Deals→Accounts), a stale edge,
 *  hop-2 (Accounts→Owners), and the R74 branch edges (Accounts→tiers,
 *  Owners→regions). */
export const MOCK_RELATIONSHIPS_CHAIN: readonly Relationship[] = [
  MOCK_RELATIONSHIP,
  MOCK_STALE_RELATIONSHIP,
  MOCK_RELATIONSHIP_2,
  MOCK_RELATIONSHIP_3,
  MOCK_RELATIONSHIP_4,
];

/** Row-major 2-hop chain result; cell order matches Deals(7) ++ accounts(3) ++
 *  owners(3) = 13 columns. The inner join of MOCK_JOINED_ROWS with owners on
 *  tier (gold/silver) yields 2 rows. */
export const MOCK_CHAIN_ROWS: RowsPage = {
  rows: [
    [
      'D-0001',
      '12400',
      '2026-03-01',
      'won',
      '0.95',
      'true',
      '2026-02-28 14:02:00',
      'D-0001',
      'Acme',
      'gold',
      'gold',
      'Dana Lee',
      'APAC',
    ],
    [
      'D-0005',
      '24500',
      '2026-05-02',
      'won',
      '1.00',
      'true',
      '2026-04-22 08:11:00',
      'D-0005',
      'Globex',
      'silver',
      'silver',
      'Sam Ruiz',
      'EMEA',
    ],
  ],
  page: 1,
  pageSize: 50,
  total: 2,
};

/** The chain's effective (combined) columns — Deals ++ accounts ++ owners.
 *  `tier` exists in BOTH accounts and owners, so per the collision rule
 *  (multi-join.md § Result-column collision) the duplicate is qualified by
 *  dataset name on both sides (`accounts.tier` / `owners.tier`); names unique
 *  across the chain stay bare. Cell order/values are unchanged (13 columns). */
export const MOCK_CHAIN_COLUMNS: ResolvedColumn[] = [
  ...withProvenance(MOCK_DATASET.columns, MOCK_DATASET.id),
  ...withProvenance(MOCK_DATASET_2.columns, MOCK_DATASET_2.id, (n) => (n === 'tier' ? 'accounts.tier' : n)),
  ...withProvenance(MOCK_DATASET_3.columns, MOCK_DATASET_3.id, (n) => (n === 'tier' ? 'owners.tier' : n)),
];

// R42 YAML-example loader: read `paths.<*>.<*>.responses["200"]
// .content["application/json"].examples[exampleName].value.rows`
// from a contract YAML so a fixture mirrors the spec verbatim.
// Node-only; returns [] in browser.
export function loadYamlExampleRows(yamlPath: string, exampleName: string): (string | null)[][] {
  if (globalThis.window !== undefined) return [];
  // Lazy-require so the browser bundle doesn't see fs/path/js-yaml.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('node:path');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const yaml = require('js-yaml');

  const fullPath = path.resolve(CONTRACTS_ROOT, yamlPath);
  if (!fs.existsSync(fullPath)) return [];

  const doc = yaml.load(fs.readFileSync(fullPath, 'utf8')) as Record<string, unknown>;
  const paths = (doc as { paths?: Record<string, unknown> }).paths ?? {};
  for (const methods of Object.values(paths)) {
    for (const op of Object.values(methods as Record<string, unknown>)) {
      const examples = (
        op as {
          responses?: Record<
            string,
            { content?: Record<string, { examples?: Record<string, { value?: { rows?: (string | null)[][] } }> }> }
          >;
        }
      ).responses?.['200']?.content?.['application/json']?.examples;
      const candidate = examples?.[exampleName]?.value?.rows;
      if (candidate) return candidate;
    }
  }
  return [];
}

// ─── R180 metadata ──────────────────────────────────────────────────────
// Read-only entries as the server stores them: one AI entry (with a
// frontmatter block) on MOCK_DATASET and one on its `won_at` column; one
// human entry on MOCK_DASHBOARD's widget. Every other noun reads as empty.
export const MOCK_METADATA: Record<string, MetadataRead> = {
  [`dataset/${MOCK_DATASET.id}`]: {
    entries: {
      aicowork: {
        md: '---\nsource: q1 export\nexported_on: 2026-05-26\n---\n\n## What this is\n\nOne row per **deal**, as exported.',
        source: 'ai',
        author: 'agent',
        writtenAt: '2026-10-15T08:00:00Z',
        definitionVersion: '3f1c9a0b7d2e',
        stale: false,
        anchor: { definitionVersion: '3f1c9a0b7d2e', dataVersions: { [MOCK_DATASET.id]: 1 } },
        state: 'current',
      },
    },
    current: { definitionVersion: '3f1c9a0b7d2e', dataVersions: { [MOCK_DATASET.id]: 1 } },
    childrenCurrent: { won_at: { definitionVersion: '1c9a0b7d2e3f', dataVersions: { [MOCK_DATASET.id]: 1 } } },
    children: {
      won_at: {
        aicowork: {
          md: 'Blank while the deal is open.',
          source: 'ai',
          author: 'agent',
          writtenAt: '2026-10-15T08:00:00Z',
          definitionVersion: '9a0b7d2e3f1c',
          stale: true,
          anchor: { definitionVersion: '9a0b7d2e3f1c' },
          state: 'other_definition',
        },
      },
    },
  },
  [`dashboard/${MOCK_DASHBOARD.id}`]: {
    entries: {},
    current: { definitionVersion: '7d2e3f1c9a0b' },
    childrenCurrent: { wdg_4d7b91ce: { definitionVersion: '0b7d2e3f1c9a' } },
    children: {
      wdg_4d7b91ce: {
        notes: {
          md: 'Won deals only — see the query filter.',
          source: 'human',
          author: 'analyst',
          writtenAt: '2026-10-14T09:30:00Z',
          definitionVersion: '0b7d2e3f1c9a',
          stale: false,
          anchor: { definitionVersion: '0b7d2e3f1c9a' },
          state: 'current',
        },
      },
    },
  },
};

// ─── R183 relationship check ────────────────────────────────────────────
export const MOCK_RELATIONSHIP_CHECK: RelationshipCheck = {
  leftRows: 8,
  rightRows: 5,
  leftMatchedRows: 8,
  rightMatchedRows: 4,
  leftUnmatchedRows: 0,
  rightUnmatchedRows: 1,
  leftCoverage: 1,
  rightCoverage: 0.8,
  leftDistinctKeys: 8,
  rightDistinctKeys: 4,
  leftMaxPerKey: 1,
  rightMaxPerKey: 2,
  observedCardinality: 'one_to_many',
  declaredCardinality: 'one_to_one',
  cardinalityMatches: false,
  multipliesLeft: true,
  multipliesRight: false,
  checkedAt: '2026-10-15T09:00:00Z',
};
