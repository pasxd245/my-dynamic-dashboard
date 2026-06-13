// R70 relationship-governance tests (MSW). Default handlers in
// src/mocks/handlers.ts cover the happy paths (list returns a valid + a stale
// edge, declare returns 201); per-test `server.use(...)` overrides supply the
// empty-list and delete cases.

import { AntdConfig } from '@mdd/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { http, HttpResponse } from 'msw';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AppLayout } from '@/components/AppLayout';
import { WorkspaceRelationshipsPage } from '@/features/data-management/relationships/WorkspaceRelationshipsPage';
import { MOCK_WORKSPACE } from '@/mocks/fixtures';
import { server } from '@/mocks/server';

const WS_ID = MOCK_WORKSPACE.id;
const REL_PATH = `/data-management/workspaces/${WS_ID}/relationships`;

function renderApp(initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AntdConfig>
        <App>
          <MemoryRouter initialEntries={[initialPath]}>
            <AppLayout>
              <Routes>
                <Route
                  path="/data-management/workspaces/:id/relationships"
                  element={<WorkspaceRelationshipsPage />}
                />
              </Routes>
            </AppLayout>
          </MemoryRouter>
        </App>
      </AntdConfig>
    </QueryClientProvider>,
  );
}

/** Open an AntD <Select> by its data-component (AntD v6 forwards it to the
 *  `.ant-select` root; mousedown opens the dropdown). */
function openSelect(component: string) {
  fireEvent.mouseDown(document.querySelector(`[data-component="${component}"]`)!);
}

/** Click an option (by `title`) in a visible dropdown. Scoping the title match
 *  to non-hidden dropdowns avoids a previous select's still-animating-out
 *  dropdown (which lacks `-hidden` briefly but does not contain this title). */
async function pickOption(title: string) {
  const sel = `.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option[title="${title}"]`;
  await waitFor(() => expect(document.querySelectorAll(sel).length).toBeGreaterThan(0));
  const opts = document.querySelectorAll(sel);
  fireEvent.click(opts[opts.length - 1]);
}

describe('Workspace relationships — list', () => {
  it('lists governed edges with keys, cardinality, and computed status', async () => {
    renderApp(REL_PATH);
    // The valid edge's keys (deal_id ↔ account_id).
    const keys = await screen.findAllByText(/deal_id/);
    expect(keys.length).toBeGreaterThan(0);
    // Both a valid and a stale status tag render (the two fixtures).
    expect(document.querySelector('[data-component="RelationshipValidTag"]')).not.toBeNull();
    expect(document.querySelector('[data-component="RelationshipStaleTag"]')).not.toBeNull();
  });

  it('shows the empty state when the workspace has no relationships', async () => {
    server.use(http.get('*/workspaces/:id/relationships', () => HttpResponse.json([])));
    renderApp(REL_PATH);
    expect(await screen.findByText('No relationships yet')).toBeInTheDocument();
  });
});

describe('Declare relationship', () => {
  it('declares a dtype-compatible edge end to end (open → pick → declare)', async () => {
    renderApp(REL_PATH);
    fireEvent.click(await screen.findByText('Declare relationship'));
    expect(await screen.findByText('Declare relationship', { selector: '.ant-modal-title' })).toBeInTheDocument();

    openSelect('DeclareLeftDataset');
    await pickOption('q1_pipeline_Deals');
    openSelect('DeclareLeftColumn');
    await pickOption('deal_id (string)');
    openSelect('DeclareRightDataset');
    await pickOption('accounts');
    openSelect('DeclareRightColumn');
    await pickOption('account_id (string)');

    // Compatible → the live check shows + Declare enables.
    expect(await screen.findByText(/join-compatible/)).toBeInTheDocument();
    const okBtn = document.querySelector('.ant-modal-footer .ant-btn-primary') as HTMLButtonElement;
    await waitFor(() => expect(okBtn).not.toBeDisabled());
    fireEvent.click(okBtn);

    // Success toast confirms the POST round-tripped.
    expect(await screen.findByText('Relationship declared')).toBeInTheDocument();
  });

  it('disables Declare and flags incompatible dtypes', async () => {
    renderApp(REL_PATH);
    fireEvent.click(await screen.findByText('Declare relationship'));
    await screen.findByText('Declare relationship', { selector: '.ant-modal-title' });

    // Deals.amount (integer) ↔ accounts.account_id (string) → incompatible.
    openSelect('DeclareLeftDataset');
    await pickOption('q1_pipeline_Deals');
    openSelect('DeclareLeftColumn');
    await pickOption('amount (integer)');
    openSelect('DeclareRightDataset');
    await pickOption('accounts');
    openSelect('DeclareRightColumn');
    await pickOption('account_id (string)');

    expect(await screen.findByText(/can't join/)).toBeInTheDocument();
    const okBtn = document.querySelector('.ant-modal-footer .ant-btn-primary') as HTMLButtonElement;
    expect(okBtn).toBeDisabled();
  });
});

describe('Delete relationship', () => {
  it('opens the confirm modal and deletes the edge', async () => {
    let deleted = false;
    server.use(
      http.delete('*/relationships/:id', () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp(REL_PATH);
    // Click the first row's delete button.
    const delBtn = await waitFor(() => {
      const b = document.querySelector('[data-component="RelationshipDeleteButton"]');
      expect(b).not.toBeNull();
      return b as HTMLElement;
    });
    fireEvent.click(delBtn);
    // Confirm modal (shared DeleteConfirmModal, data-resource="relationship").
    const modal = await waitFor(() => {
      const m = document.querySelector('[data-component="DeleteConfirmModal"][data-resource="relationship"]');
      expect(m).not.toBeNull();
      return m as HTMLElement;
    });
    fireEvent.click(within(modal).getByText('Delete').closest('button') as HTMLButtonElement);
    await waitFor(() => expect(deleted).toBe(true));
  });
});
