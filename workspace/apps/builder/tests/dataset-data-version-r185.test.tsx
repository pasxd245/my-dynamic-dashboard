// R185 (W-4) — the dataset's server-stamped data identity: the page shows which
// version of the rows it is reading and when they last changed; the MSW commit /
// refresh mock stamps it the way the server does (commit → v1, refresh → +1).

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { App } from 'antd';
import { describe, expect, it } from 'vitest';

import { AntdConfig } from '@mdd/ui';
import { datasetsApi } from '@/api/datasetsApi';
import { AppLayout } from '@/components/AppLayout';
import { DatasetDetailPage } from '@/features/data-management/datasets/DatasetDetailPage';
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

describe('R185 data version on the dataset page', () => {
  it('the metadata strip names the data version', async () => {
    server.use(http.get('*/datasets/:id', () => HttpResponse.json({ ...MOCK_DATASET, dataVersion: 4 })));
    const { container } = renderPage(MOCK_DATASET.id);
    await screen.findByText('Data version');
    const strip = container.querySelector('[data-component="DatasetMetadataStrip"]') as HTMLElement;
    expect(within(strip).getByText(/^v4 · /)).toBeInTheDocument();
  });
});

describe('R185 MSW stamps like the server', () => {
  it('a commit is version 1 and a refresh bumps the version', async () => {
    const created = await datasetsApi.commitBatch(MOCK_DATASET.workspaceId, {
      temp_id: 'tmp_aaaaaaaa',
      items: [{ name: 'fresh' }],
    });
    const first = Array.isArray(created) ? created[0] : created.datasets[0];
    expect(first?.dataVersion).toBe(1);
    expect(first?.refreshedAt).toBe(first?.createdAt);

    const refreshed = await datasetsApi.commitBatch(MOCK_DATASET.workspaceId, {
      temp_id: 'tmp_aaaaaaaa',
      items: [{ name: 'IGNORED', target_dataset_id: MOCK_DATASET.id }],
    });
    const again = Array.isArray(refreshed) ? refreshed[0] : refreshed.datasets[0];
    expect(again?.id).toBe(MOCK_DATASET.id);
    expect(again?.dataVersion).toBe(MOCK_DATASET.dataVersion + 1);
  });
});
