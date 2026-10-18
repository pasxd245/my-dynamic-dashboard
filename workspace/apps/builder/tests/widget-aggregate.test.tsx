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

// R191 QA — adversarial edges on the string-measure client roll-up.
describe('R191 QA — string-measure client roll-up edges', () => {
  const stringQuery = () =>
    http.get('*/queries/:id', () => HttpResponse.json({ ...MOCK_QUERY, resolvedColumns: STRING_AMOUNT }));

  it('applies the dashboard filter on the client fallback (no won total leaks through)', async () => {
    let aggregateCalls = 0;
    server.use(
      stringQuery(),
      http.post('*/queries/:id/aggregate', () => {
        aggregateCalls += 1;
        return HttpResponse.json({ code: 'measure_not_numeric' }, { status: 422 });
      }),
    );
    const { result } = renderHook(() => useWidgetChartData(BAR, [{ column: 'stage', values: ['lost'] }]), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.chartData).toEqual([]);
    expect(aggregateCalls).toBe(0);
  });

  it('null and blank measure cells count as 0; the other group still sums', async () => {
    const row = (id: string, amount: string | null, stage: string) => [
      id,
      amount,
      null,
      stage,
      '0.5',
      'true',
      '2026-04-01 00:00:00',
    ];
    const rows = [row('D-1', null, 'won'), row('D-2', '', 'won'), row('D-3', '100', 'open'), row('D-4', '250', 'won')];
    server.use(
      stringQuery(),
      http.get('*/queries/:id/rows', () =>
        HttpResponse.json({ rows, page: 1, pageSize: rows.length, total: rows.length }),
      ),
    );
    const { result } = renderHook(() => useWidgetChartData(BAR), { wrapper: wrapper() });
    await waitFor(() =>
      expect(result.current.chartData).toEqual([
        { label: 'won', value: 250 },
        { label: 'open', value: 100 },
      ]),
    );
  });

  it('a count over a string measure still uses the server aggregate (dtype is irrelevant to count)', async () => {
    let aggregateCalls = 0;
    server.use(
      stringQuery(),
      http.post('*/queries/:id/aggregate', () => {
        aggregateCalls += 1;
        return HttpResponse.json({ columns: [{ name: 'count', dtype: 'integer' }], rows: [['3']], total: 1 });
      }),
    );
    const stat: WidgetConfig = { queryId: MOCK_QUERY.id, chartType: 'stat', measureCol: 'amount', agg: 'count' };
    const { result } = renderHook(() => useWidgetChartData(stat), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.statValue).toBe(3));
    expect(aggregateCalls).toBeGreaterThan(0);
  });
});

// R191 (BA P0-1) — a text measure with a cell that is not a number must not be
// summed with that cell as 0: the card keeps its empty state.
describe('R191 string measure with non-numeric cells', () => {
  it.each([['1,200'], ['n/a']])('keeps the empty state when a cell reads %s', async (bad) => {
    const row = (id: string, amount: string | null, stage: string) => [
      id,
      amount,
      null,
      stage,
      '0.5',
      'true',
      '2026-04-01 00:00:00',
    ];
    const rows = [row('D-1', '100', 'won'), row('D-2', bad, 'won')];
    server.use(
      http.get('*/queries/:id', () => HttpResponse.json({ ...MOCK_QUERY, resolvedColumns: STRING_AMOUNT })),
      http.get('*/queries/:id/rows', () =>
        HttpResponse.json({ rows, page: 1, pageSize: rows.length, total: rows.length }),
      ),
    );
    const bar = renderHook(() => useWidgetChartData(BAR), { wrapper: wrapper() });
    await waitFor(() => expect(bar.result.current.isLoading).toBe(false));
    expect(bar.result.current.chartData).toEqual([]);
    const stat: WidgetConfig = { queryId: MOCK_QUERY.id, chartType: 'stat', measureCol: 'amount', agg: 'sum' };
    const st = renderHook(() => useWidgetChartData(stat), { wrapper: wrapper() });
    await waitFor(() => expect(st.result.current.isLoading).toBe(false));
    expect(st.result.current.statValue).toBeNull();
  });
});
