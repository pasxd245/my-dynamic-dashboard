// R182 — export a table widget's numbers. The request mirrors what the widget
// shows (query, active filters, totals spec, percent format); the download
// button exists on a table widget only.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AntdConfig } from '@mdd/ui';
import { AppLayout } from '@/components/AppLayout';
import { DashboardDetailPage } from '@/features/dashboard/DashboardDetailPage';
import { exportRequest } from '@/features/dashboard/exportWidget';
import type { Widget } from '@/features/dashboard/types';
import { MOCK_DASHBOARD, MOCK_QUERY, MOCK_WORKSPACE } from '@/mocks/fixtures';
import { server } from '@/mocks/server';

const table: Widget = {
  id: 'wdg_00000182',
  queryId: MOCK_QUERY.id,
  title: 'Deals',
  chartType: 'table',
  agg: 'count',
  span: 3,
  numberFormat: 'percent',
  totals: { amount: { agg: 'sum' } },
};

describe('R182 exportRequest', () => {
  it('carries format, filters (blank → null), totals and the percent flag', () => {
    expect(exportRequest(table, [{ column: 'stage', values: ['won', '(blank)'] }], 'xlsx')).toEqual({
      format: 'xlsx',
      filters: [{ column: 'stage', values: ['won', null] }],
      totals: { amount: { agg: 'sum' } },
      percent: true,
      title: 'Deals',
    });
  });
  it('omits totals and percent when the widget has neither', () => {
    const req = exportRequest({ ...table, totals: undefined, numberFormat: undefined }, [], 'csv');
    expect(req).toEqual({ format: 'csv', filters: [], title: 'Deals' });
  });
});

function renderDashboard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AntdConfig>
        <App>
          <MemoryRouter initialEntries={[`/dashboards/${MOCK_WORKSPACE.id}/${MOCK_DASHBOARD.slug}`]}>
            <AppLayout>
              <Routes>
                <Route path="/dashboards/:workspaceId/:slug" element={<DashboardDetailPage />} />
              </Routes>
            </AppLayout>
          </MemoryRouter>
        </App>
      </AntdConfig>
    </QueryClientProvider>,
  );
}

describe('R182 export button', () => {
  it('is on a table widget and not on a chart', async () => {
    server.use(
      http.get('*/workspaces/:id/dashboards', () =>
        HttpResponse.json([
          { ...MOCK_DASHBOARD, definition: { widgets: [...MOCK_DASHBOARD.definition.widgets, table] } },
        ]),
      ),
    );
    const { container } = renderDashboard();
    await waitFor(() => expect(container.querySelectorAll('[data-component="DashboardChartCard"]').length).toBe(2));
    const buttons = container.querySelectorAll('[data-component="WidgetExportButton"]');
    expect(buttons.length).toBe(1);
    const cell = buttons[0]?.closest('[data-component="DashboardGridCell"]');
    expect(cell?.textContent).toContain('Deals');
  });
});
