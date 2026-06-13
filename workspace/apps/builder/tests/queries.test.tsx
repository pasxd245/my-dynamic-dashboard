// R69 Saved Query tests (MSW). Default handlers in src/mocks/handlers.ts
// cover the happy paths; per-test `server.use(...)` overrides supply the
// empty-list and stale-run cases.

import { AntdConfig } from '@mdd/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { http, HttpResponse } from 'msw';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AppLayout } from '@/components/AppLayout';
import { DatasetDetailPage } from '@/features/data-management/datasets/DatasetDetailPage';
import { QueriesPage } from '@/features/data-management/queries/QueriesPage';
import { QueryDetailPage } from '@/features/data-management/queries/QueryDetailPage';
import { MOCK_DATASET, MOCK_QUERY } from '@/mocks/fixtures';
import { server } from '@/mocks/server';

const QR_ID = MOCK_QUERY.id;
const DS_ID = MOCK_DATASET.id;

function renderApp(initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AntdConfig>
        <App>
          <MemoryRouter initialEntries={[initialPath]}>
            <AppLayout>
              <Routes>
                <Route path="/data-management/datasets/:id" element={<DatasetDetailPage />} />
                <Route path="/data-management/queries" element={<QueriesPage />} />
                <Route path="/data-management/queries/:id" element={<QueryDetailPage />} />
              </Routes>
            </AppLayout>
          </MemoryRouter>
        </App>
      </AntdConfig>
    </QueryClientProvider>,
  );
}

describe('Queries catalog', () => {
  it('lists a saved query with its name and source dataset', async () => {
    renderApp('/data-management/queries');
    expect(await screen.findByText(MOCK_QUERY.name)).toBeInTheDocument();
    // Source-dataset link renders the dataset's name (resolved from datasets list).
    expect(await screen.findByText(MOCK_DATASET.name)).toBeInTheDocument();
  });

  it('shows the empty state when the workspace has no saved queries', async () => {
    server.use(
      http.get('*/workspaces/:id/queries', () => HttpResponse.json([])),
    );
    renderApp('/data-management/queries');
    expect(await screen.findByText('No saved queries yet')).toBeInTheDocument();
  });
});

describe('QueryDetailPage (query mode)', () => {
  it('reopens a query: predicate summary, matched counter, and reused row table', async () => {
    renderApp(`/data-management/queries/${QR_ID}`);
    // Live re-run of (stage=won AND amount>1000) over MOCK_ROWS → 3 rows.
    // (The name appears in both breadcrumb + title, so key readiness off the
    // unique matched counter instead.)
    expect(await screen.findByText(/Matched 3 \/ 8/)).toBeInTheDocument();
    // The query name renders (in the title at minimum).
    expect(screen.getAllByText(MOCK_QUERY.name).length).toBeGreaterThan(0);
    // The read-only predicate summary shows the saved chip filter.
    const summaryEl = document.querySelector('[data-component="QueryPredicateSummary"]');
    expect(summaryEl).not.toBeNull();
    expect(within(summaryEl as HTMLElement).getByText(/stage/)).toBeInTheDocument();
    // The shared PagedRowsView renders the matched rows.
    expect(screen.getByText('D-0001')).toBeInTheDocument();
  });

  it('renders the stale state on 409 query_stale', async () => {
    server.use(
      http.get('*/queries/:id/rows', () => HttpResponse.json({ code: 'query_stale' }, { status: 409 })),
    );
    renderApp(`/data-management/queries/${QR_ID}`);
    expect(await screen.findByText('This query needs attention')).toBeInTheDocument();
    expect(document.querySelector('[data-component="QueryDetailStale"]')).not.toBeNull();
  });
});

describe('Save as Query (from the dataset detail page)', () => {
  it('disables the action when no predicate is active', async () => {
    renderApp(`/data-management/datasets/${DS_ID}`);
    const action = (await screen.findByText('Save as Query')).closest('button');
    expect(action).toBeDisabled();
  });

  it('saves the active predicate state and navigates to the new query', async () => {
    // Return MOCK_QUERY from create so the post-save navigate lands on a
    // handled /queries/:id (full save → navigate → reopen → run round-trip).
    server.use(
      http.post('*/workspaces/:id/queries', () => HttpResponse.json(MOCK_QUERY, { status: 201 })),
    );
    // A per-column filter is active → the action is enabled.
    renderApp(`/data-management/datasets/${DS_ID}?f3_op=equals&f3_val=won`);
    const action = (await screen.findByText('Save as Query')).closest('button') as HTMLButtonElement;
    await waitFor(() => expect(action).not.toBeDisabled());
    fireEvent.click(action);
    // Modal opens; submit with the suggested name.
    expect(await screen.findByText('Save as Query', { selector: '.ant-modal-title' })).toBeInTheDocument();
    const okBtn = document.querySelector('.ant-modal-footer .ant-btn-primary') as HTMLButtonElement;
    fireEvent.click(okBtn);
    // Lands on the query-mode detail of the saved query.
    expect(await screen.findByText(/Matched 3 \/ 8/)).toBeInTheDocument();
  });
});
