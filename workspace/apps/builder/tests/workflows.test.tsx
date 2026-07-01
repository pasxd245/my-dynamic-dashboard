// R137 — Workflows FE smoke tests (MSW). Exercises the new contract-validated
// handlers (listWorkflows / getWorkflow / workflowRows) end-to-end through the
// catalog + detail surfaces: the responses are validated against
// workspace/packages/contracts/workflows/* by `withContractValidation`, so a
// wire drift fails here. Default handlers in src/mocks/handlers.ts cover the
// happy paths.

import { AntdConfig } from '@mdd/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { WorkflowsPage } from '@/features/data-management/workflows/WorkflowsPage';
import { WorkflowDetailPage } from '@/features/data-management/workflows/WorkflowDetailPage';
import { MOCK_WORKFLOW } from '@/mocks/fixtures';

function renderApp(initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AntdConfig>
        <App>
          <MemoryRouter initialEntries={[initialPath]}>
            <Routes>
              <Route path="/data-management/workflows" element={<WorkflowsPage />} />
              <Route path="/data-management/workflows/:id" element={<WorkflowDetailPage />} />
            </Routes>
          </MemoryRouter>
        </App>
      </AntdConfig>
    </QueryClientProvider>,
  );
}

describe('Workflows catalog + detail (R137)', () => {
  it('lists the workspace workflows (listWorkflows → contract)', async () => {
    renderApp('/data-management/workflows');
    await waitFor(() => expect(screen.getByText(MOCK_WORKFLOW.name)).toBeInTheDocument());
  });

  it('shows a materialized workflow with its output rows (getWorkflow + workflowRows → contract)', async () => {
    renderApp(`/data-management/workflows/${MOCK_WORKFLOW.id}`);
    // A cell from the paged output proves the whole chain: getWorkflow resolved
    // (materialized) → workflowRows fetched → PagedRowsView rendered it.
    await waitFor(() => expect(screen.getByText('D-0001')).toBeInTheDocument());
    expect(screen.getAllByText(MOCK_WORKFLOW.name).length).toBeGreaterThan(0);
  });

  it('404s an unknown workflow (getWorkflow → not_found)', async () => {
    renderApp('/data-management/workflows/wf_00000000');
    await waitFor(() =>
      expect(document.querySelector('[data-component="WorkflowDetailNotFound"]')).toBeInTheDocument(),
    );
  });
});
