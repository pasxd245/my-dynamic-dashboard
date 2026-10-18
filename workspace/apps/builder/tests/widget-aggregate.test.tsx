// R119 — the dashboard aggregate binding. `useWidgetChartData` for the
// aggregating kinds (bar/pie/line/stat) fetches the SERVER aggregate
// (POST /queries/{id}/aggregate) instead of rolling up raw rows client-side.
// Exercised end-to-end through the MSW handler (which is contract-validated by
// the global setup, so a drifted response body fails the test in afterEach).

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { useWidgetChartData } from '@/features/dashboard/WidgetView';
import type { Widget } from '@/features/dashboard/types';
import { MOCK_DATASET, MOCK_QUERY } from '@/mocks/fixtures';
import { server } from '@/mocks/server';

type WidgetConfig = Pick<
  Widget,
  'queryId' | 'chartType' | 'dimensionCol' | 'seriesCol' | 'measureCol' | 'measureCol2' | 'agg'
>;

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// MOCK_QUERY = "stage = won AND amount > 1000" → D-0001 (12400), D-0005 (24500),
// D-0007 (58750), all stage 'won'. So a bar by stage / sum amount = one group.
const BAR: WidgetConfig = {
  queryId: MOCK_QUERY.id,
  chartType: 'bar',
  dimensionCol: 'stage',
  measureCol: 'amount',
  agg: 'sum',
};

describe('R119 widget aggregate binding', () => {
  it('bar sums the measure by dimension via the server aggregate (correct total, not capped)', async () => {
    const { result } = renderHook(() => useWidgetChartData(BAR), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.chartData).toEqual([{ label: 'won', value: 95650 }]);
    // The aggregate is complete → the over-cap warning never fires.
    expect(result.current.capped).toBe(false);
  });

  it('a scalar stat counts the matched rows server-side', async () => {
    const stat: WidgetConfig = { queryId: MOCK_QUERY.id, chartType: 'stat', agg: 'count' };
    const { result } = renderHook(() => useWidgetChartData(stat), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.statValue).toBe(3);
  });

  it('pushes the active dashboard filter into the aggregate request', async () => {
    // Filter stage to 'lost' — none of the (all-'won') matched rows survive, so
    // the server returns no groups (proving the filter is applied server-side,
    // before the group-by, not ignored).
    const { result } = renderHook(() => useWidgetChartData(BAR, [{ column: 'stage', values: ['lost'] }]), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.chartData).toEqual([]);
  });
});

// R191 — the two states the round fixed: a string measure (server `sum` skipped,
// R151) must roll up on the client instead of reading "empty", and a deleted
// bound query must surface as "query unavailable", not a generic error.
// The query's columns as the server resolves them, with `amount` ingested as text.
const STRING_AMOUNT = MOCK_DATASET.columns.map((c) => ({
  name: c.name,
  dtype: c.name === 'amount' ? 'string' : c.dtype,
}));

describe('R191 widget fallbacks', () => {
  it('a sum over a measure the query resolves as string rolls up client-side (same total)', async () => {
    let aggregateCalls = 0;
    server.use(
      http.get('*/queries/:id', () =>
        HttpResponse.json({
          ...MOCK_QUERY,
          resolvedColumns: STRING_AMOUNT,
        }),
      ),
      http.post('*/queries/:id/aggregate', () => {
        aggregateCalls += 1;
        return HttpResponse.json({ code: 'measure_not_numeric' }, { status: 422 });
      }),
    );
    const { result } = renderHook(() => useWidgetChartData(BAR), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.chartData).toEqual([{ label: 'won', value: 95650 }]));
    expect(aggregateCalls).toBe(0);
  });

  it('a stat over a string measure sums client-side too', async () => {
    server.use(http.get('*/queries/:id', () => HttpResponse.json({ ...MOCK_QUERY, resolvedColumns: STRING_AMOUNT })));
    const stat: WidgetConfig = { queryId: MOCK_QUERY.id, chartType: 'stat', measureCol: 'amount', agg: 'sum' };
    const { result } = renderHook(() => useWidgetChartData(stat), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.statValue).toBe(95650));
  });

  it('a bound query that 404s reads as missing, not as a generic error', async () => {
    const gone: WidgetConfig = { ...BAR, queryId: 'qr_0dead404' };
    const { result } = renderHook(() => useWidgetChartData(gone), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isMissingQuery).toBe(true));
  });
});
