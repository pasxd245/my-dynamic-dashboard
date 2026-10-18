// R196 (item 3.2c) — a dataset (or a saved copy) exports every row as a file
// from its Actions menu; the server names the file and stamps the version.

import { AntdConfig } from '@mdd/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { queriesApi } from '@/api/queriesApi';
import { ApiErrorThrown } from '@/features/data-management/_shared/types';
import { DatasetDetailPage } from '@/features/data-management/datasets/DatasetDetailPage';
import { MOCK_DATASET, MOCK_SAVED_COPY } from '@/mocks/fixtures';
import { server } from '@/mocks/server';

function renderAt(id: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AntdConfig>
        <App>
          <MemoryRouter initialEntries={[`/data-management/datasets/${id}`]}>
            <Routes>
              <Route path="/data-management/datasets/:id" element={<DatasetDetailPage />} />
            </Routes>
          </MemoryRouter>
        </App>
      </AntdConfig>
    </QueryClientProvider>,
  );
}

const openActions = async () => {
  const trigger = await waitFor(() => {
    const el = document.querySelector('[data-component="DatasetDetailActionsTrigger"]');
    if (!el) throw new Error('no actions trigger yet');
    return el as HTMLElement;
  });
  fireEvent.click(trigger);
};

let seen: { id: string; format: string }[];
let clicked: string[];

beforeEach(() => {
  seen = [];
  clicked = [];
  server.use(
    http.post('*/datasets/:id/export', async ({ params, request }) => {
      const body = (await request.json()) as { format: string };
      seen.push({ id: String(params.id), format: body.format });
      return new HttpResponse('id\n1\n', {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="deals.${body.format}"`,
          'X-MDD-Data-Versions': JSON.stringify({ [String(params.id)]: 2 }),
        },
      });
    }),
  );
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push(this.download);
  });
});

afterEach(() => vi.restoreAllMocks());

describe('R196 export a dataset', () => {
  it('downloads every row under the server’s file name', async () => {
    renderAt(MOCK_DATASET.id);
    await openActions();
    fireEvent.click(await screen.findByText('Export all rows (.xlsx)'));
    await waitFor(() => expect(clicked).toEqual(['deals.xlsx']));
    expect(seen).toEqual([{ id: MOCK_DATASET.id, format: 'xlsx' }]);
    expect(await screen.findByText('Saved deals.xlsx')).toBeInTheDocument();
  });

  it('is offered on a saved copy too', async () => {
    renderAt(MOCK_SAVED_COPY.id);
    await openActions();
    fireEvent.click(await screen.findByText('Export all rows (.csv)'));
    await waitFor(() => expect(seen).toEqual([{ id: MOCK_SAVED_COPY.id, format: 'csv' }]));
  });

  it('says how many rows when there are too many', async () => {
    server.use(
      http.post('*/datasets/:id/export', () =>
        HttpResponse.json({ code: 'export_too_large', rows: 300000, max: 200000 }, { status: 422 }),
      ),
    );
    renderAt(MOCK_DATASET.id);
    await openActions();
    fireEvent.click(await screen.findByText('Export all rows (.csv)'));
    expect(await screen.findByText(/Too many rows to export \(300000; the limit is 200000\)/)).toBeInTheDocument();
    expect(clicked).toEqual([]);
  });
});

describe('R196 export_too_large is a structured error', () => {
  // Before R196 the guard did not know the code, so the R182 widget export fell
  // back to its generic message instead of naming the row count.
  it('throws ApiErrorThrown from the query export, too', async () => {
    server.use(
      http.post('*/queries/:id/export', () =>
        HttpResponse.json({ code: 'export_too_large', rows: 300000, max: 200000 }, { status: 422 }),
      ),
    );
    const err = await queriesApi.exportFile('q_00000001', { format: 'csv' } as never).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiErrorThrown);
    expect((err as ApiErrorThrown).body).toEqual({ code: 'export_too_large', rows: 300000, max: 200000 });
  });
});
