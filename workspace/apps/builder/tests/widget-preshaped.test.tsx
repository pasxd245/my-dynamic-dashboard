// R127 — a chart widget bound to a PRE-SHAPED query (one that already aggregates
// via transform steps) renders its rows DIRECTLY, without re-aggregating. The
// bound query's `definition.steps` is the signal; the shaped `/rows` feed the
// chart by direct column mapping.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { useWidgetChartData } from '@/features/dashboard/WidgetView';
import type { Widget } from '@/features/dashboard/types';
import { server } from '@/mocks/server';

const SHAPED_ID = 'qr_5ade0001';
const SHAPED_QUERY = {
  id: SHAPED_ID,
  workspaceId: 'ws_3f8a2c91',
  sourceId: 'ds_11111111',
  name: 'Revenue by region (shaped)',
  definition: {
    q: null,
    filters: [],
    advanced: [],
    steps: [{ kind: 'aggregate', dimensions: ['region'], measures: [{ col: 'amount', agg: 'sum' }] }],
  },
  resolvedColumns: [
    { name: 'region', dtype: 'string' },
    { name: 'amount', dtype: 'integer' },
  ],
  createdAt: '2026-06-30T00:00:00Z',
};
// The shaped rows the query's /rows returns (already grouped — EMEA 150, APAC 200).
const SHAPED_ROWS = [
  ['EMEA', '150'],
  ['APAC', '200'],
];

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function useShapedQuery() {
  server.use(
    http.get('*/queries/:id', ({ params }) =>
      params.id === SHAPED_ID
        ? HttpResponse.json(SHAPED_QUERY)
        : HttpResponse.json({ code: 'not_found' }, { status: 404 }),
    ),
    http.get('*/queries/:id/rows', () => HttpResponse.json({ rows: SHAPED_ROWS, page: 1, pageSize: 2, total: 2 })),
  );
}

const BAR: Pick<Widget, 'queryId' | 'chartType' | 'dimensionCol' | 'seriesCol' | 'measureCol' | 'measureCol2' | 'agg'> =
  {
    queryId: SHAPED_ID,
    chartType: 'bar',
    dimensionCol: 'region',
    measureCol: 'amount',
    agg: 'sum',
  };

describe('R127 pre-shaped query widget', () => {
  it('renders the shaped rows directly (no re-aggregation), ordered desc', async () => {
    useShapedQuery();
    const { result } = renderHook(() => useWidgetChartData(BAR), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Direct map of the shaped [region, amount] rows → sorted desc by value.
    expect(result.current.chartData).toEqual([
      { label: 'APAC', value: 200 },
      { label: 'EMEA', value: 150 },
    ]);
    expect(result.current.capped).toBe(false);
  });
});
