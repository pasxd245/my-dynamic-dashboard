// R186 — a workflow save the server refuses over its SOURCES (unresolved, listed
// twice, different shapes) says which source and why, instead of "Couldn't save".
// The server answers in FastAPI's validation envelope; workflowsApi lifts it into
// `WorkflowSourceError`.

import { AntdConfig } from '@mdd/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { WorkflowSourceError, workflowsApi } from '@/api/workflowsApi';
import { WorkflowDetailPage } from '@/features/data-management/workflows/WorkflowDetailPage';
import { MOCK_QUERY, MOCK_WORKFLOW, MOCK_WORKSPACE } from '@/mocks/fixtures';
import { server } from '@/mocks/server';

describe('R186 workflowsApi lifts the source refusals', () => {
  it('a source listed twice → WorkflowSourceError(duplicate_source, index 1)', async () => {
    const err = await workflowsApi
      .create(MOCK_WORKSPACE.id, { name: 'twice', definition: { sources: [MOCK_QUERY.id, MOCK_QUERY.id], steps: [] } })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(WorkflowSourceError);
    expect((err as WorkflowSourceError).code).toBe('duplicate_source');
    expect((err as WorkflowSourceError).index).toBe(1);
  });

  it('an ordinary 422 stays a plain error', async () => {
    server.use(
      http.post('*/workspaces/:id/workflows', () =>
        HttpResponse.json(
          { detail: [{ loc: ['body', 'name'], msg: 'too long', type: 'value_error' }] },
          { status: 422 },
        ),
      ),
    );
    const err = await workflowsApi
      .create(MOCK_WORKSPACE.id, { name: 'x', definition: { sources: [MOCK_QUERY.id], steps: [] } })
      .catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(WorkflowSourceError);
  });
});

describe('R186 the edit page explains a diverging source', () => {
  it('names the source and the columns that differ', async () => {
    server.use(
      http.put('*/workflows/:id', () =>
        HttpResponse.json(
          {
            detail: [
              {
                loc: ['body', 'definition', 'sources', 1],
                msg: "sources_diverge: qr_bbbbbbbb does not have the shape of qr_aaaaaaaa: extra ['month']",
                type: 'value_error',
              },
            ],
          },
          { status: 422 },
        ),
      ),
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <AntdConfig>
          <App>
            <MemoryRouter initialEntries={[`/data-management/workflows/${MOCK_WORKFLOW.id}`]}>
              <Routes>
                <Route path="/data-management/workflows/:id" element={<WorkflowDetailPage />} />
              </Routes>
            </MemoryRouter>
          </App>
        </AntdConfig>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(document.querySelector('[data-component="WorkflowDetailEdit"]')).toBeInTheDocument());
    fireEvent.click(document.querySelector('[data-component="WorkflowDetailEdit"]') as Element);
    await waitFor(() => expect(document.querySelector('[data-component="WorkflowEditSave"]')).toBeInTheDocument());
    fireEvent.click(document.querySelector('[data-component="WorkflowEditSave"]') as Element);
    expect(
      await screen.findByText(/Source 2 doesn't have the same columns as source 1.*extra \['month'\]/),
    ).toBeInTheDocument();
    // Still in edit mode — the draft is kept for fixing.
    expect(document.querySelector('[data-component="WorkflowForm"]')).toBeInTheDocument();
  });
});
