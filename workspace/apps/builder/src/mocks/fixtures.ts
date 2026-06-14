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

import type { Dataset, RowsPage } from '@/features/data-management/datasets/types';
import type { Query } from '@/features/data-management/queries/types';
import type { Relationship } from '@/features/data-management/relationships/types';
import type { Workspace } from '@/features/data-management/workspaces/types';

import { CONTRACTS_ROOT } from './contracts-root';

export const MOCK_WORKSPACE: Workspace = {
  id: 'ws_aaaaaaa1',
  name: 'Marketing',
  createdAt: '2026-05-21T10:00:00Z',
};

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
    { name: 'won_at', dtype: 'date' },
    { name: 'stage', dtype: 'string' },
    { name: 'probability', dtype: 'float' },
    { name: 'is_priority', dtype: 'boolean' },
    { name: 'created_at', dtype: 'datetime' },
  ],
  sourceFormat: 'csv',
  createdAt: '2026-05-22T12:00:00Z',
};

/** Row-major; cell order matches `MOCK_DATASET.columns`. Cells are
 *  stringified BE-side per the rows-get contract. */
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
  datasetId: MOCK_DATASET.id,
  name: 'Won deals over $1k',
  definition: {
    q: null,
    filters: [{ col: 3, dtype: 'string', op: 'equals', val: 'won' }],
    advanced: [[{ col: 1, dtype: 'integer', op: 'gt', val: 1000 }]],
  },
  createdAt: '2026-06-12T14:02:00Z',
};

export const MOCK_QUERIES: readonly Query[] = [MOCK_QUERY];

/** A query id whose run returns 409 query_stale (the source dataset's
 *  schema drifted). Lets the FE/integration exercise the stale state
 *  deterministically without mutating a dataset. */
export const MOCK_STALE_QUERY_ID = 'qr_dead0000';

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

export const MOCK_RELATIONSHIPS: readonly Relationship[] = [
  MOCK_RELATIONSHIP,
  MOCK_STALE_RELATIONSHIP,
];

// ─── Joined Query fixtures (R71 — join execution) ────────────────────
//
// A Query that consumes MOCK_RELATIONSHIP (Deals.deal_id ↔ Accounts.
// account_id) to read both datasets as one. Its `resolvedColumns` is the
// effective space Deals.columns ++ accounts.columns (no name collisions
// here, so names stay bare); the run returns joined rows in that order.

export const MOCK_JOINED_QUERY: Query = {
  id: 'qr_101a0001',
  workspaceId: MOCK_WORKSPACE.id,
  datasetId: MOCK_DATASET.id, // the LEFT source
  name: 'Deals × Accounts',
  definition: {
    q: null,
    filters: [],
    advanced: [],
    joins: [{ relationshipId: MOCK_RELATIONSHIP.id, type: 'inner' }],
  },
  resolvedColumns: [...MOCK_DATASET.columns, ...MOCK_DATASET_2.columns],
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
    ['D-0001', '12400', '2026-03-01', 'won', '0.95', 'true', '2026-02-28 14:02:00', 'D-0001', 'Acme', 'gold', 'gold', 'Dana Lee', 'APAC'],
    ['D-0005', '24500', '2026-05-02', 'won', '1.00', 'true', '2026-04-22 08:11:00', 'D-0005', 'Globex', 'silver', 'silver', 'Sam Ruiz', 'EMEA'],
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
export const MOCK_CHAIN_COLUMNS = [
  ...MOCK_DATASET.columns,
  ...MOCK_DATASET_2.columns.map((c) => (c.name === 'tier' ? { ...c, name: 'accounts.tier' } : c)),
  ...MOCK_DATASET_3.columns.map((c) => (c.name === 'tier' ? { ...c, name: 'owners.tier' } : c)),
];

// R42 YAML-example loader: read `paths.<*>.<*>.responses["200"]
// .content["application/json"].examples[exampleName].value.rows`
// from a contract YAML so a fixture mirrors the spec verbatim.
// Node-only; returns [] in browser.
export function loadYamlExampleRows(
  yamlPath: string,
  exampleName: string,
): (string | null)[][] {
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
        (op as { responses?: Record<string, { content?: Record<string, { examples?: Record<string, { value?: { rows?: (string | null)[][] } }> }> }> })
          .responses?.['200']?.content?.['application/json']?.examples
      );
      const candidate = examples?.[exampleName]?.value?.rows;
      if (candidate) return candidate;
    }
  }
  return [];
}
