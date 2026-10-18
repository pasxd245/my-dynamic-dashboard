// R193 (item 3.6b) — saved (frozen) copies. Saving a dataset as a labelled
// copy through the contract-validated MSW handler; a copy's page (frozen band,
// Properties + Delete only, read-only columns); the saved workspace's card and
// relationships page; create-flow pickers that never offer a saved workspace.

import { AntdConfig } from '@mdd/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { DatasetDetailPage } from '@/features/data-management/datasets/DatasetDetailPage';
import { DatasetsPage } from '@/features/data-management/datasets/DatasetsPage';
import { DatasetNewPage } from '@/features/data-management/datasets/upload/DatasetNewPage';
import { WorkspaceRelationshipsPage } from '@/features/data-management/relationships/WorkspaceRelationshipsPage';
import { WorkflowCreatePage } from '@/features/data-management/workflows/WorkflowCreatePage';
import { WorkspacesPage } from '@/features/data-management/workspaces/WorkspacesPage';
import { MOCK_DATASET, MOCK_SAVED_COPY, MOCK_SAVED_WORKSPACE, MOCK_WORKSPACE } from '@/mocks/fixtures';
import { server } from '@/mocks/server';

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AntdConfig>
        <App>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/data-management/datasets" element={<DatasetsPage />} />
              <Route path="/data-management/datasets/new" element={<DatasetNewPage />} />
              <Route path="/data-management/datasets/:id/refresh" element={<DatasetNewPage />} />
              <Route path="/data-management/datasets/:id" element={<DatasetDetailPage />} />
              <Route path="/data-management/workspaces" element={<WorkspacesPage />} />
              <Route path="/data-management/workspaces/:id/relationships" element={<WorkspaceRelationshipsPage />} />
              <Route path="/data-management/workflows/new" element={<WorkflowCreatePage />} />
            </Routes>
          </MemoryRouter>
        </App>
      </AntdConfig>
    </QueryClientProvider>,
  );
}

const serveBothWorkspaces = () =>
  server.use(http.get('*/workspaces', () => HttpResponse.json([MOCK_WORKSPACE, MOCK_SAVED_WORKSPACE])));

const openActions = async () => {
  const trigger = await waitFor(() => {
    const el = document.querySelector('[data-component="DatasetDetailActionsTrigger"]');
    if (!el) throw new Error('no actions trigger yet');
    return el as HTMLElement;
  });
  fireEvent.click(trigger);
};

describe('R193 save a frozen copy', () => {
  it('saves under the default date label and offers to open the copy', async () => {
    renderAt(`/data-management/datasets/${MOCK_DATASET.id}`);
    await openActions();
    fireEvent.click(await screen.findByText('Save frozen copy…'));

    const modal = await waitFor(() => {
      const el = document.querySelector('[data-component="SaveCopyModal"]');
      if (!el) throw new Error('no modal');
      return el as HTMLElement;
    });
    const input = modal.querySelector('input') as HTMLInputElement;
    expect(input.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    fireEvent.change(input, { target: { value: 'month-end' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save copy' }));

    const toast = await waitFor(() => {
      const el = document.querySelector('[data-component="SaveCopyToast"]');
      if (!el) throw new Error('no toast');
      return el as HTMLElement;
    });
    expect(toast.textContent).toContain(`${MOCK_DATASET.name} @month-end`);
    expect(toast.textContent).toContain('Open the copy');
  });

  it('disables Save for a blank label', async () => {
    renderAt(`/data-management/datasets/${MOCK_DATASET.id}`);
    await openActions();
    fireEvent.click(await screen.findByText('Save frozen copy…'));
    const modal = await waitFor(() => {
      const el = document.querySelector('[data-component="SaveCopyModal"]');
      if (!el) throw new Error('no modal');
      return el as HTMLElement;
    });
    fireEvent.change(modal.querySelector('input') as HTMLInputElement, { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Save copy' })).toBeDisabled();
  });
});

describe('R193 a copy’s page', () => {
  it('shows the frozen band and offers Properties + Delete only', async () => {
    renderAt(`/data-management/datasets/${MOCK_SAVED_COPY.id}`);
    const band = await waitFor(() => {
      const el = document.querySelector('[data-component="FrozenCopyBand"]');
      if (!el) throw new Error('no band');
      return el as HTMLElement;
    });
    expect(band.textContent).toContain(MOCK_DATASET.name);
    expect(band.textContent).toContain('2026-10-18');

    await openActions();
    expect(await screen.findByText('Properties')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.queryByText('Save frozen copy…')).toBeNull();
    expect(screen.queryByText('Rename')).toBeNull();
    expect(screen.queryByText('Refresh')).toBeNull();
  });

  it('says the original is gone when it 404s', async () => {
    server.use(
      http.get('*/datasets/:id', ({ params }) =>
        params.id === MOCK_DATASET.id
          ? HttpResponse.json({ code: 'not_found' }, { status: 404 })
          : HttpResponse.json(MOCK_SAVED_COPY),
      ),
    );
    renderAt(`/data-management/datasets/${MOCK_SAVED_COPY.id}`);
    await waitFor(() => {
      const band = document.querySelector('[data-component="FrozenCopyBand"]');
      expect(band?.textContent).toContain('no longer exists');
    });
  });
});

describe('R193 the saved workspace', () => {
  it('is tagged on the Workspaces page with its parent', async () => {
    serveBothWorkspaces();
    renderAt('/data-management/workspaces');
    const tag = await waitFor(() => {
      const el = document.querySelector('[data-component="WorkspaceSavedTag"]');
      if (!el) throw new Error('no tag');
      return el as HTMLElement;
    });
    expect(tag.textContent).toContain(MOCK_WORKSPACE.name);
  });

  it('declares no relationships', async () => {
    serveBothWorkspaces();
    server.use(http.get('*/workspaces/:id/relationships', () => HttpResponse.json([])));
    renderAt(`/data-management/workspaces/${MOCK_SAVED_WORKSPACE.id}/relationships`);
    await waitFor(() => expect(document.querySelector('[data-component="RelationshipsReadOnly"]')).not.toBeNull());
    expect(document.querySelector('[data-component="DeclareRelationshipAction"]')).toBeNull();
  });

  it('is never offered by a create flow', async () => {
    serveBothWorkspaces();
    renderAt('/data-management/workflows/new');
    const select = await waitFor(() => {
      const el = document.querySelector('[data-component="WorkflowWorkspaceSelect"] [role="combobox"]');
      if (!el) throw new Error('no select');
      return el as HTMLElement;
    });
    fireEvent.mouseDown(select);
    await screen.findAllByText(MOCK_WORKSPACE.name);
    expect(screen.queryByText(MOCK_SAVED_WORKSPACE.name)).toBeNull();
  });
});

describe('R193 nothing is uploaded into a saved workspace', () => {
  it('offers no Upload on the saved workspace’s datasets list', async () => {
    serveBothWorkspaces();
    renderAt(`/data-management/datasets?workspace=${MOCK_SAVED_WORKSPACE.id}`);
    await waitFor(() => expect(document.querySelector('[data-component="DatasetsEmpty"]')).not.toBeNull());
    expect(screen.queryByRole('button', { name: /upload/i })).toBeNull();
  });

  it('still offers Upload on a main workspace', async () => {
    serveBothWorkspaces();
    renderAt(`/data-management/datasets?workspace=${MOCK_WORKSPACE.id}`);
    expect(await screen.findByRole('button', { name: /upload/i })).toBeInTheDocument();
  });

  it('ignores a saved workspace passed to the upload wizard', async () => {
    serveBothWorkspaces();
    renderAt(`/data-management/datasets/new?workspace=${MOCK_SAVED_WORKSPACE.id}`);
    await waitFor(() => expect(document.querySelector('[data-component="DatasetNewPage"]')).not.toBeNull());
    // Give the workspace list time to settle, then the saved id must not be selected.
    await screen.findAllByText(/workspace/i);
    expect(screen.queryByText(MOCK_SAVED_WORKSPACE.id)).toBeNull();
    expect(screen.queryByText(MOCK_SAVED_WORKSPACE.name)).toBeNull();
  });

  it('sends a refresh URL for a copy back to the copy’s page', async () => {
    server.use(
      http.get('*/datasets/:id/refresh-settings', () => HttpResponse.json({ code: 'not_found' }, { status: 404 })),
    );
    renderAt(`/data-management/datasets/${MOCK_SAVED_COPY.id}/refresh`);
    await waitFor(() => expect(document.querySelector('[data-component="FrozenCopyBand"]')).not.toBeNull());
  });
});
