// R181 — table footer totals. The server sums numeric columns over the WHOLE
// filtered result (post-step when the query has steps); the footer shows a
// `sum` as-is and a `ratio` as Σnum / Σden — never the mean of the rows'
// rates. Here the MSW totals mock stands in for the server.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { draftToConfig } from '@/features/dashboard/WidgetBuilder';
import { WidgetView, formatTotal } from '@/features/dashboard/WidgetView';
import { computeTotals, totalsColumns } from '@/features/dashboard/totals';
import type { Widget } from '@/features/dashboard/types';
import { MOCK_QUERY } from '@/mocks/fixtures';

function Providers({ children }: Readonly<{ children: ReactNode }>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('R181 totals helpers', () => {
  it('lists the distinct columns a spec needs summed', () => {
    expect(totalsColumns({ calls: { agg: 'sum' }, cr: { agg: 'ratio', num: 'quotes', den: 'calls' } })).toEqual([
      'calls',
      'quotes',
    ]);
    expect(totalsColumns(undefined)).toEqual([]);
  });

  it('derives a ratio from the two sums and nulls a zero denominator', () => {
    const sums = { calls: '600', quotes: '175', zero: '0' };
    const out = computeTotals({ calls: { agg: 'sum' }, cr: { agg: 'ratio', num: 'quotes', den: 'calls' }, bad: { agg: 'ratio', num: 'quotes', den: 'zero' } }, sums);
    expect(out.calls).toBe(600);
    expect(out.cr).toBeCloseTo(175 / 600, 9);
    expect(out.bad).toBeNull();
  });

  it('formats an integer sum grouped and a ratio as a percent under percent mode (the table formatters)', () => {
    expect(formatTotal(5587000, 'integer', false, false)).toBe('5,587,000');
    expect(formatTotal(0.2917, 'integer', true, false)).toBe('29.2%');
    expect(formatTotal(0.2917, 'float', false, false)).toBe('0.29');
  });

  it('draftToConfig carries totals on a table and drops an empty map', () => {
    const base = { queryId: 'qr_12345678', title: 'T', chartType: 'table' as const, agg: 'count' as const, span: 3 as const };
    expect(draftToConfig({ ...base, totals: { amount: { agg: 'sum' } } }).totals).toEqual({ amount: { agg: 'sum' } });
    expect('totals' in draftToConfig({ ...base, totals: {} })).toBe(false);
    expect('totals' in draftToConfig({ ...base, chartType: 'bar', dimensionCol: 'x', totals: { amount: { agg: 'sum' } } })).toBe(false);
  });
});

describe('R181 table footer', () => {
  // MOCK_QUERY = stage won AND amount > 1000 → D-0001 (12400), D-0005 (24500), D-0007 (58750): Σ amount = 95,650.
  const table: Widget = {
    id: 'wdg_00000181',
    queryId: MOCK_QUERY.id,
    title: 'Deals',
    chartType: 'table',
    agg: 'count',
    span: 3,
    totals: { amount: { agg: 'sum' }, probability: { agg: 'ratio', num: 'amount', den: 'amount' } },
  };

  it('shows the server sum (over all matched rows, not the page) and a derived ratio', async () => {
    const { container } = render(
      <Providers>
        <WidgetView widget={{ ...table, numberFormat: 'percent' }} />
      </Providers>,
    );
    await waitFor(() => expect(container.querySelector('[data-component="TableTotalsRow"]')).not.toBeNull());
    await waitFor(() => expect(container.querySelector('[data-total="amount"]')?.textContent).toBe('95,650'));
    expect(container.querySelector('[data-total="probability"]')?.textContent).toBe('100%');
    expect(container.querySelector('[data-component="TableTotalsRow"]')?.textContent).toContain('Total');
  });

  it('renders no footer when the widget has no totals', async () => {
    const { container } = render(
      <Providers>
        <WidgetView widget={{ ...table, totals: undefined }} />
      </Providers>,
    );
    await waitFor(() => expect(container.querySelector('.ant-table-tbody tr.ant-table-row')).not.toBeNull());
    expect(container.querySelector('[data-component="TableTotalsRow"]')).toBeNull();
  });
});

describe('R181 editing a table widget keeps it a table', async () => {
  const { WidgetBuilder } = await import('@/features/dashboard/WidgetBuilder');
  const { MOCK_WORKSPACE } = await import('@/mocks/fixtures');
  const { App } = await import('antd');

  it('does not auto-default a dimensionless kind to a bar chart once the columns load', async () => {
    const table: Widget = { id: 'wdg_00000181', queryId: MOCK_QUERY.id, title: 'Deals', chartType: 'table', agg: 'count', span: 3 };
    const { container } = render(
      <Providers>
        <App>
          <WidgetBuilder open workspaceId={MOCK_WORKSPACE.id} initial={table} onSubmit={() => {}} onCancel={() => {}} />
        </App>
      </Providers>,
    );
    // The totals editor only exists for a TABLE with a query whose columns loaded —
    // so its presence proves the kind survived the columns arriving.
    await waitFor(() => expect(document.body.querySelector('[data-component="WidgetBuilderTotals"]')).not.toBeNull(), {
      timeout: 4000,
    });
    expect(document.body.querySelector('[data-component="WidgetBuilderDimension"]')).toBeNull();
    expect(container).toBeDefined();
  });
});
