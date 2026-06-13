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
import { MOCK_DATASET, MOCK_JOINED_QUERY, MOCK_QUERY } from '@/mocks/fixtures';
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

describe('Join execution (R71)', () => {
  const JOIN_ID = MOCK_JOINED_QUERY.id;

  it('reopens a joined query: read-only join summary + joined rows via the reused table', async () => {
    renderApp(`/data-management/queries/${JOIN_ID}`);
    // Joined run → MOCK_JOINED_ROWS (total 2); the joined-aware counter omits "/ Y".
    expect(await screen.findByText(/Matched 2 rows/)).toBeInTheDocument();
    // The read-only join summary renders the governed edge's key pair (the
    // relationship fetch resolves independently of the rows — poll for it).
    const keyPair = await screen.findByText(/deal_id ↔ account_id/);
    expect(keyPair.closest('[data-component="QueryJoinSummary"]')).not.toBeNull();
    // The reused <PagedRowsView> shows a cell from the RIGHT (joined-in) source.
    expect(screen.getByText('Acme')).toBeInTheDocument();
  });

  it('blocks the join on 409 relationship_stale (join-unavailable state, not a crash)', async () => {
    server.use(
      http.get('*/queries/:id/rows', () => HttpResponse.json({ code: 'relationship_stale' }, { status: 409 })),
    );
    renderApp(`/data-management/queries/${JOIN_ID}`);
    expect(await screen.findByText('This join is unavailable')).toBeInTheDocument();
    expect(document.querySelector('[data-component="QueryDetailJoinUnavailable"]')).not.toBeNull();
  });

  it('creates a joined query from the dataset detail page and lands on its detail', async () => {
    server.use(
      http.post('*/workspaces/:id/queries', () => HttpResponse.json(MOCK_JOINED_QUERY, { status: 201 })),
    );
    renderApp(`/data-management/datasets/${DS_ID}`);
    // The affordance is enabled — MOCK_DATASET has a valid relationship.
    const joinBtn = (await screen.findByText('Join with related dataset')).closest('button') as HTMLButtonElement;
    await waitFor(() => expect(joinBtn).not.toBeDisabled());
    fireEvent.click(joinBtn);
    // Modal opens; the relationship Select is pre-seeded with the first valid edge.
    expect(await screen.findByText('Join with a related dataset', { selector: '.ant-modal-title' })).toBeInTheDocument();
    const nameInput = document.querySelector('[data-component="JoinQueryNameInput"]') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Deals × Accounts' } });
    const okBtn = document.querySelector('.ant-modal-footer .ant-btn-primary') as HTMLButtonElement;
    await waitFor(() => expect(okBtn).not.toBeDisabled());
    fireEvent.click(okBtn);
    // Round-trip: lands on the joined query's detail (joined-aware counter).
    expect(await screen.findByText(/Matched 2 rows/)).toBeInTheDocument();
  });

  it('disables the join affordance when the dataset has no valid relationships', async () => {
    server.use(http.get('*/workspaces/:id/relationships', () => HttpResponse.json([])));
    renderApp(`/data-management/datasets/${DS_ID}`);
    const joinBtn = (await screen.findByText('Join with related dataset')).closest('button') as HTMLButtonElement;
    await waitFor(() => expect(joinBtn).toBeDisabled());
  });
});

describe('Query construction (R72 — editable builder)', () => {
  const JOIN_ID = MOCK_JOINED_QUERY.id;

  function clickEdit() {
    const editBtn = document.querySelector('[data-component="QueryDetailEdit"]') as HTMLButtonElement;
    fireEvent.click(editBtn);
  }

  it('enters edit mode and live-previews the joined definition', async () => {
    renderApp(`/data-management/queries/${JOIN_ID}`);
    expect(await screen.findByText(/Matched 2 rows/)).toBeInTheDocument();
    clickEdit();
    // The builder panel replaces the read-only summaries; the join editor +
    // the live-preview status render. The preview re-runs the unsaved copy
    // (joined, no filters) → 2 rows.
    expect(await screen.findByText(/Preview · 2 rows/)).toBeInTheDocument();
    expect(document.querySelector('[data-component="QueryBuilderPanel"]')).not.toBeNull();
    expect(document.querySelector('[data-component="JoinEditor"]')).not.toBeNull();
    // A cell from the RIGHT (joined-in) source renders in the preview table.
    expect(await screen.findByText('Acme')).toBeInTheDocument();
  });

  it('edits the definition, previews, and saves — returning to the read-only view', async () => {
    renderApp(`/data-management/queries/${JOIN_ID}`);
    expect(await screen.findByText(/Matched 2 rows/)).toBeInTheDocument();
    clickEdit();
    await screen.findByText(/Preview · 2 rows/);
    // Save is disabled until the working copy differs from the saved one.
    const saveBtn = document.querySelector('[data-component="QueryBuilderSave"]') as HTMLButtonElement;
    expect(saveBtn).toBeDisabled();
    // Type a row search → the definition is now dirty; preview re-runs.
    const searchInput = screen.getByPlaceholderText('Match any cell…') as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'D-0001' } });
    await waitFor(() => expect(saveBtn).not.toBeDisabled());
    fireEvent.click(saveBtn);
    // PUT round-trips; the builder closes and the read-only [Edit] reappears.
    await waitFor(() => expect(document.querySelector('[data-component="QueryDetailEdit"]')).not.toBeNull());
    expect(document.querySelector('[data-component="QueryBuilderPanel"]')).toBeNull();
  });

  it('blocks save with the join-unavailable state when the previewed edge is stale', async () => {
    server.use(
      http.post('*/workspaces/:id/queries/preview', () =>
        HttpResponse.json({ code: 'relationship_stale' }, { status: 409 }),
      ),
    );
    renderApp(`/data-management/queries/${JOIN_ID}`);
    expect(await screen.findByText(/Matched 2 rows/)).toBeInTheDocument();
    clickEdit();
    expect(await screen.findByText(/This join is unavailable/)).toBeInTheDocument();
    expect(document.querySelector('[data-component="QueryBuilderJoinStale"]')).not.toBeNull();
    const saveBtn = document.querySelector('[data-component="QueryBuilderSave"]') as HTMLButtonElement;
    expect(saveBtn).toBeDisabled();
  });

  it('cancels out of edit mode with no changes, restoring the read-only view', async () => {
    renderApp(`/data-management/queries/${JOIN_ID}`);
    expect(await screen.findByText(/Matched 2 rows/)).toBeInTheDocument();
    clickEdit();
    await screen.findByText(/Preview · 2 rows/);
    const cancelBtn = document.querySelector('[data-component="QueryBuilderCancel"]') as HTMLButtonElement;
    fireEvent.click(cancelBtn);
    await waitFor(() => expect(document.querySelector('[data-component="QueryDetailEdit"]')).not.toBeNull());
    expect(document.querySelector('[data-component="QueryBuilderPanel"]')).toBeNull();
  });

  // AC #5 (client-side, flag-don't-crash): a filter on a RIGHT-source column,
  // then clearing the join, leaves the atom dangling out of the (now smaller)
  // effective space → the builder flags it and disables Save. No server help.
  it('flags a dangling predicate after the join is cleared and blocks save', async () => {
    renderApp(`/data-management/queries/${JOIN_ID}`);
    expect(await screen.findByText(/Matched 2 rows/)).toBeInTheDocument();
    clickEdit();
    await screen.findByText(/Preview · 2 rows/);
    // Effective space when joined = 7 (deals) + 3 (accounts) = 10 columns;
    // a FilterTrigger renders per column. Index 9 = the last right-source col.
    const triggers = document.querySelectorAll('[data-component="FilterTrigger"]');
    expect(triggers.length).toBe(10);
    fireEvent.click(triggers[9]);
    await waitFor(() => expect(document.querySelector('[data-component="FilterPopoverContent"]')).not.toBeNull());
    const valueEl = document.querySelector('[data-component="FilterValueInput"]') as HTMLElement;
    const valueInput = (valueEl.tagName === 'INPUT' ? valueEl : valueEl.querySelector('input')) as HTMLInputElement;
    fireEvent.change(valueInput, { target: { value: 'gold' } });
    const applyBtn = document.querySelector('[data-component="FilterApplyButton"]') as HTMLButtonElement;
    await waitFor(() => expect(applyBtn).not.toBeDisabled());
    fireEvent.click(applyBtn);
    // Now clear the join → effective space shrinks to 7; the col-9 atom dangles.
    const clearJoin = document.querySelector('[data-component="BuilderClearJoin"]') as HTMLButtonElement;
    fireEvent.click(clearJoin);
    expect(await screen.findByText(/references a column that isn't in these results/)).toBeInTheDocument();
    expect(document.querySelector('[data-component="QueryBuilderPredInvalid"]')).not.toBeNull();
    const saveBtn = document.querySelector('[data-component="QueryBuilderSave"]') as HTMLButtonElement;
    expect(saveBtn).toBeDisabled();
  });
});
