// R126 — the steps-aware MSW preview mock: a previewed stepped definition returns
// the SHAPED result (rows + post-step resolvedColumns), mirroring the backend
// run_steps, so the builder's live preview is real in dev + tests. API-level
// through MSW (no UI driving); the response is contract-validated by the setup.

import { describe, expect, it } from 'vitest';

import { queriesApi } from '@/api/queriesApi';
import type { PreviewQueryRequest } from '@/features/data-management/queries/types';
import { MOCK_DATASET } from '@/mocks/fixtures';

const previewWith = (steps: PreviewQueryRequest['definition']['steps']): PreviewQueryRequest => ({
  sourceId: MOCK_DATASET.id,
  definition: { q: null, filters: [], advanced: [], steps },
});

describe('R126 steps-aware preview mock', () => {
  it('applies an aggregate step → shaped rows + post-step resolvedColumns', async () => {
    // MOCK_ROWS grouped by stage, SUM(amount): won 95650, open 17050,
    // negotiating 102000, lost 3200.
    const res = await queriesApi.preview(
      MOCK_DATASET.workspaceId,
      previewWith([{ kind: 'aggregate', dimensions: ['stage'], measures: [{ col: 'amount', agg: 'sum' }] }]),
      1,
      25,
    );
    expect(Object.fromEntries(res.rows.map((r) => [r[0], Number(r[1])]))).toEqual({
      won: 95650,
      open: 17050,
      negotiating: 102000,
      lost: 3200,
    });
    expect(res.resolvedColumns).toEqual([
      { name: 'stage', dtype: 'string' },
      { name: 'amount', dtype: 'integer' },
    ]);
    // R129 — the PRE-step (base) columns are reported too (the source columns).
    expect(res.baseColumns?.map((c) => c.name)).toEqual(MOCK_DATASET.columns.map((c) => c.name));
  });

  it('chains aggregate → top_n, ordering numerically', async () => {
    const res = await queriesApi.preview(
      MOCK_DATASET.workspaceId,
      previewWith([
        { kind: 'aggregate', dimensions: ['stage'], measures: [{ col: 'amount', agg: 'sum' }] },
        { kind: 'top_n', col: 'amount', n: 2, descending: true },
      ]),
      1,
      25,
    );
    // Top 2 totals: negotiating 102000, won 95650 (numeric, not lexical).
    expect(res.rows.map((r) => r[0])).toEqual(['negotiating', 'won']);
  });
});
