// R41: shared MSW fixtures. Frozen — handlers read from these; per-test
// overrides via `server.use(...)` supply alternate handlers, not
// alternate fixture data.
//
// One workspace, one CSV dataset mirroring the R34
// `rows-get.contract.yaml` example shape. The rows cover all six
// dtypes so the filter handler exercises the per-dtype CAST
// semantics (integer, string, float, date, datetime, boolean).

import type { Dataset, RowsPage } from '@/features/data-management/datasets/types';
import type { Workspace } from '@/features/data-management/workspaces/types';

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
