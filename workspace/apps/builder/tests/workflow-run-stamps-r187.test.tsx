// R187 (W-7) — the workflow page names its run and flags an output whose sources
// moved since that run; the frozen output stays on screen (a flag, never a block).

import { AntdConfig } from '@mdd/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { workflowsApi } from '@/api/workflowsApi';
import { WorkflowDetailPage } from '@/features/data-management/workflows/WorkflowDetailPage';
import { MOCK_QUERY, MOCK_WORKFLOW } from '@/mocks/fixtures';
import { server } from '@/mocks/server';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
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
}

describe('R187 run stamp on the workflow page', () => {
  it('shows the run number and no warning when nothing moved', async () => {
    renderPage();
    expect(await screen.findByText('Run #3')).toBeInTheDocument();
    expect(document.querySelector('[data-component="WorkflowStale"]')).toBeNull();
  });

  it('lists each moved source with its reason, above the still-visible output', async () => {
    server.use(
      http.get('*/workflows/:id', () =>
        HttpResponse.json({
          ...MOCK_WORKFLOW,
          staleSources: [
            { sourceId: MOCK_QUERY.id, name: MOCK_QUERY.name, reason: 'data_refreshed' },
            { sourceId: 'wf_22222222', reason: 'source_missing' },
          ],
        }),
      ),
    );
    renderPage();
    await waitFor(() => expect(document.querySelector('[data-component="WorkflowStale"]')).not.toBeNull());
    expect(screen.getByText(/This output is out of date/)).toBeInTheDocument();
    expect(screen.getByText(`Data behind “${MOCK_QUERY.name}” was refreshed after this run.`)).toBeInTheDocument();
    expect(screen.getByText('“wf_22222222” no longer exists (or has no output).')).toBeInTheDocument();
    // The frozen output is still there.
    expect(await screen.findByText('D-0001')).toBeInTheDocument();
  });

  it('the MSW run mock counts the run up', async () => {
    const ran = await workflowsApi.run(MOCK_WORKFLOW.id);
    expect(ran.run?.number).toBe((MOCK_WORKFLOW.run?.number ?? 0) + 1);
    expect(ran.run?.id).not.toBe(MOCK_WORKFLOW.run?.id);
  });
});
