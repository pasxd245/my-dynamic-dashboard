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
