// R177 — widget height. `Widget.rows` (1–3, absent = 1) scales the card body:
// one row is the standard 300 px; each extra row adds a row plus the gap it
// would have sat in (grid gutter + one card's chrome), so a `rows: 2` widget
// is exactly as tall as two `rows: 1` widgets stacked beside it. A `table`
// widget shows proportionally more rows per page (8 × rows).

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { ChartCard, ROW_GAP, ROW_HEIGHT, bodyHeight } from '@/features/dashboard/ChartCard';
import type { Widget } from '@/features/dashboard/types';
import { TABLE_PAGE_ROWS, WidgetView } from '@/features/dashboard/WidgetView';
import { MOCK_QUERY } from '@/mocks/fixtures';
import { server } from '@/mocks/server';

function Providers({ children }: Readonly<{ children: ReactNode }>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

/** The card body: the `<div style="height: …">` wrapping the children. */
function bodyOf(container: HTMLElement): HTMLElement {
  const card = container.querySelector('[data-component="DashboardChartCard"]');
  const body = card?.querySelector('.ant-card-body > div');
  if (!(body instanceof HTMLElement)) throw new Error('card body not rendered');
  return body;
}

describe('R177 bodyHeight', () => {
  it('is one row when rows is absent or 1, and grows by a row plus a gap per extra row', () => {
    expect(bodyHeight(undefined)).toBe(ROW_HEIGHT);
    expect(bodyHeight(1)).toBe(ROW_HEIGHT);
    expect(bodyHeight(2)).toBe(ROW_HEIGHT * 2 + ROW_GAP);
    expect(bodyHeight(3)).toBe(ROW_HEIGHT * 3 + ROW_GAP * 2);
  });
});

describe('R177 ChartCard height', () => {
  const base = { title: 'T', isLoading: false, isError: false, isMissingQuery: false, isEmpty: false };

  it('renders the loaded body at 300 px with no rows (a pre-R177 widget)', () => {
    const { container } = render(
      <ChartCard {...base}>
        <span>chart</span>
      </ChartCard>,
    );
    expect(bodyOf(container).style.height).toBe('300px');
    expect(container.querySelector('[data-component="DashboardChartCard"]')?.getAttribute('data-rows')).toBe('1');
  });

  it('renders every state at the taller height for rows=3', () => {
    const h = `${bodyHeight(3)}px`;
    for (const state of [{}, { isLoading: true }, { isError: true }, { isEmpty: true }, { isMissingQuery: true }]) {
      const { container, unmount } = render(
        <ChartCard {...base} {...state} rows={3}>
          <span>chart</span>
        </ChartCard>,
      );
      expect(bodyOf(container).style.height).toBe(h);
      unmount();
    }
  });
});

describe('R177 table widget page size', () => {
  // 20 rows shaped like MOCK_ROWS (7 columns), so a one-row table pages at 8
  // and a two-row table at 16.
  const twenty = Array.from({ length: 20 }, (_, i) => [
    `D-${String(i + 1).padStart(4, '0')}`,
    String(1000 + i),
    '2026-03-01',
    'won',
    '0.5',
    'true',
    '2026-02-28 14:02:00',
  ]);
  const table: Widget = {
    id: 'wdg_00000177',
    queryId: MOCK_QUERY.id,
    title: 'All deals',
    chartType: 'table',
    agg: 'count',
    span: 3,
  };

  function useTwentyRows() {
    server.use(
      http.get('*/queries/:id/rows', () =>
        HttpResponse.json({ rows: twenty, page: 1, pageSize: twenty.length, total: twenty.length }),
      ),
    );
  }

  it('shows 8 rows per page at the default height', async () => {
    useTwentyRows();
    render(
      <Providers>
        <WidgetView widget={table} />
      </Providers>,
    );
    await waitFor(() => expect(screen.getByText('D-0001')).toBeInTheDocument());
    expect(screen.getByText('D-0008')).toBeInTheDocument();
    expect(screen.queryByText('D-0009')).not.toBeInTheDocument();
    expect(TABLE_PAGE_ROWS).toBe(8);
  });

  it('shows 16 rows per page when the widget is two rows tall', async () => {
    useTwentyRows();
    render(
      <Providers>
        <WidgetView widget={{ ...table, rows: 2 }} />
      </Providers>,
    );
    await waitFor(() => expect(screen.getByText('D-0001')).toBeInTheDocument());
    expect(screen.getByText('D-0016')).toBeInTheDocument();
    expect(screen.queryByText('D-0017')).not.toBeInTheDocument();
  });
});

describe('R177 dashboard grid placement', async () => {
  const { gridCell, gridColumns } = await import('@/features/dashboard/DashboardDetailPage');

  it('keeps the old responsive collapse: 3 columns at xl, 2 at md, 1 below', () => {
    expect(gridColumns({ xs: true, sm: true, md: true, lg: true, xl: true })).toBe(3);
    expect(gridColumns({ xs: true, sm: true, md: true, lg: true, xl: false })).toBe(2);
    expect(gridColumns({ xs: true, sm: true, md: false })).toBe(1);
    expect(gridColumns({})).toBe(3); // nothing known yet → desktop
  });

  it('clips span to the columns available and defaults rows to 1', () => {
    expect(gridCell({ span: 1 }, 3)).toEqual({ cols: 1, rows: 1 });
    expect(gridCell({ span: 2, rows: 2 }, 3)).toEqual({ cols: 2, rows: 2 });
    expect(gridCell({ span: 3, rows: 3 }, 2)).toEqual({ cols: 2, rows: 3 }); // a full row on a 2-col grid
    expect(gridCell({ span: 2 }, 1)).toEqual({ cols: 1, rows: 1 });
  });
});
