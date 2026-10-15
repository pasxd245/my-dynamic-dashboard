// R178 — date coverage on the dataset page. The server profiles every
// `date` / `datetime` column (min, max, blank share) and the page shows it:
// a strip under the metadata, and a line per column in the Properties drawer.
// A dataset with no coverage (committed before R178) shows no strip.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { App } from 'antd';
import { describe, expect, it } from 'vitest';

import { AntdConfig } from '@mdd/ui';
import { AppLayout } from '@/components/AppLayout';
import { DatasetDetailPage } from '@/features/data-management/datasets/DatasetDetailPage';
import { formatCoverage } from '@/features/data-management/datasets/DateCoverage';
import { MOCK_DATASET } from '@/mocks/fixtures';
import { server } from '@/mocks/server';

function renderPage(id: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AntdConfig>
        <App>
          <MemoryRouter initialEntries={[`/data-management/datasets/${id}`]}>
            <AppLayout>
              <Routes>
                <Route path="/data-management/datasets/:id" element={<DatasetDetailPage />} />
              </Routes>
            </AppLayout>
          </MemoryRouter>
        </App>
      </AntdConfig>
    </QueryClientProvider>,
  );
}

const t = (key: string, opts?: Record<string, unknown>) => {
  const table: Record<string, string> = {
    'datasets.detail.coverage.range': `${opts?.min} → ${opts?.max}`,
    'datasets.detail.coverage.blank': `${opts?.share}% blank`,
    'datasets.detail.coverage.allBlank': 'all blank',
  };
  return table[key] ?? key;
};

describe('R178 formatCoverage', () => {
  it('shows the range, the blank share only when non-zero, and a datetime without seconds', () => {
    expect(formatCoverage({ min: '2026-03-01', max: '2026-05-14', blankShare: 0.25 }, t)).toBe(
      '2026-03-01 → 2026-05-14 · 25% blank',
    );
    expect(formatCoverage({ min: '2026-02-28T14:02:00', max: '2026-05-08T15:22:00', blankShare: 0 }, t)).toBe(
      '2026-02-28 14:02 → 2026-05-08 15:22',
    );
    expect(formatCoverage({ blankShare: 1 }, t)).toBe('all blank');
  });
});

describe('R178 dataset page', () => {
  it('shows a coverage strip for the profiled columns', async () => {
    const { container } = renderPage(MOCK_DATASET.id);
    await waitFor(() => expect(container.querySelector('[data-component="DatasetDateCoverage"]')).not.toBeNull());
    const items = container.querySelectorAll('[data-component="DatasetDateCoverageItem"]');
    expect([...items].map((el) => el.getAttribute('data-column'))).toEqual(['won_at', 'created_at']);
    expect(screen.getByText('2026-03-01 → 2026-05-14 · 25% blank')).toBeInTheDocument();
    expect(screen.getByText('2026-02-28 14:02 → 2026-05-08 15:22')).toBeInTheDocument();
  });

  it('shows no strip for a dataset without coverage (committed before R178)', async () => {
    server.use(
      http.get('*/datasets/:id', () =>
        HttpResponse.json({
          ...MOCK_DATASET,
          columns: MOCK_DATASET.columns.map(({ coverage: _c, ...rest }) => rest),
        }),
      ),
    );
    const { container } = renderPage(MOCK_DATASET.id);
    expect((await screen.findAllByText(MOCK_DATASET.name)).length).toBeGreaterThan(0);
    await screen.findByText('D-0001');
    expect(container.querySelector('[data-component="DatasetDateCoverage"]')).toBeNull();
  });
});
