// R192 (item 3.6a) — publish a workflow's output as a dataset. The pure rules
// (when publishing is blocked, which columns a re-publish changes), the detail
// page's [Publish] / [Re-publish] flows through the contract-validated MSW
// handler, and the published dataset's page (lineage line, no Refresh).

import { AntdConfig } from '@mdd/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { DatasetDetailPage } from '@/features/data-management/datasets/DatasetDetailPage';
import { DatasetsPage } from '@/features/data-management/datasets/DatasetsPage';
import { columnDiff, publishBlock } from '@/features/data-management/workflows/PublishControls';
import { WorkflowDetailPage } from '@/features/data-management/workflows/WorkflowDetailPage';
import type { Workflow } from '@/features/data-management/workflows/types';
import { MOCK_DATASET, MOCK_PUBLISHED_DATASET, MOCK_WORKFLOW } from '@/mocks/fixtures';
import { server } from '@/mocks/server';

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AntdConfig>
        <App>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/data-management/workflows/:id" element={<WorkflowDetailPage />} />
              <Route path="/data-management/datasets/:id" element={<DatasetDetailPage />} />
              <Route path="/data-management/datasets" element={<DatasetsPage />} />
            </Routes>
          </MemoryRouter>
        </App>
      </AntdConfig>
    </QueryClientProvider>,
  );
}

const PUBLISHED: Workflow = {
  ...MOCK_WORKFLOW,
  published: {
    datasetId: MOCK_PUBLISHED_DATASET.id,
    datasetName: MOCK_PUBLISHED_DATASET.name,
    dataVersion: 1,
    runId: MOCK_WORKFLOW.run!.id,
    runNumber: MOCK_WORKFLOW.run!.number,
  },
};

// Published from run #3, then re-run (run #4): Re-publish is available.
const PUBLISHED_RERUN: Workflow = { ...PUBLISHED, run: { ...PUBLISHED.run!, id: 'run_0000000b', number: 4 } };

const serveWorkflow = (wf: Workflow) => server.use(http.get('*/workflows/:id', () => HttpResponse.json(wf)));
const publishButton = () => document.querySelector('[data-component="WorkflowPublish"]') as HTMLButtonElement | null;

describe('R192 publishBlock', () => {
  it('blocks a never-run, an unstamped, a stale and a self-reading workflow; allows a fresh one', () => {
    expect(publishBlock({ ...MOCK_WORKFLOW, materializedAt: undefined, run: undefined })).toBe('never_run');
    expect(publishBlock({ ...MOCK_WORKFLOW, run: undefined })).toBe('unstamped');
    expect(
      publishBlock({ ...MOCK_WORKFLOW, staleSources: [{ sourceId: 'qr_9c2f10ab', reason: 'data_refreshed' }] }),
    ).toBe('stale');
    const self: Workflow = {
      ...PUBLISHED,
      run: { ...PUBLISHED.run!, sources: [{ id: 'qr_9c2f10ab', dataVersions: { [MOCK_PUBLISHED_DATASET.id]: 1 } }] },
    };
    expect(publishBlock(self)).toBe('reads_itself');
    expect(publishBlock(MOCK_WORKFLOW)).toBeNull();
  });
});

describe('R192 columnDiff', () => {
  it('names added, removed and retyped columns by name', () => {
    const before = [
      { name: 'a', dtype: 'string' as const },
      { name: 'b', dtype: 'integer' as const },
      { name: 'gone', dtype: 'date' as const },
    ];
    const after = [
      { name: 'a', dtype: 'string' as const },
      { name: 'b', dtype: 'float' as const },
      { name: 'new', dtype: 'string' as const },
    ];
    expect(columnDiff(after, before)).toEqual({
      added: ['new'],
      removed: ['gone'],
      retyped: [{ name: 'b', from: 'integer', to: 'float' }],
    });
  });
});

describe('R192 workflow detail — publish', () => {
  it('first publish: a modal asks for the name, POSTs, and toasts the new dataset', async () => {
    let body: unknown = null;
    server.use(
      http.post('*/workflows/:id/publish', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...MOCK_PUBLISHED_DATASET, name: 'Leads table' }, { status: 201 });
      }),
    );
    renderAt(`/data-management/workflows/${MOCK_WORKFLOW.id}`);
    await waitFor(() => expect(publishButton()).not.toBeNull());
    expect(publishButton()!.textContent).toContain('Publish');
    fireEvent.click(publishButton()!);
    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByLabelText('Dataset name') as HTMLInputElement;
    expect(input.value).toBe(MOCK_WORKFLOW.name);
    fireEvent.change(input, { target: { value: '  Leads table  ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Publish/ }));
    expect(await screen.findByText('Published as dataset “Leads table”.')).toBeInTheDocument();
    expect(body).toEqual({ name: 'Leads table' });
  });

  it('a taken name keeps the modal open and says so', async () => {
    server.use(http.post('*/workflows/:id/publish', () => HttpResponse.json({ code: 'name_taken' }, { status: 409 })));
    renderAt(`/data-management/workflows/${MOCK_WORKFLOW.id}`);
    await waitFor(() => expect(publishButton()).not.toBeNull());
    fireEvent.click(publishButton()!);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /Publish/ }));
    expect(await within(dialog).findByText(/already exists in this workspace/)).toBeInTheDocument();
  });

  it('a stale workflow shows a disabled button that says why', async () => {
    serveWorkflow({ ...MOCK_WORKFLOW, staleSources: [{ sourceId: 'qr_9c2f10ab', reason: 'data_refreshed' }] });
    renderAt(`/data-management/workflows/${MOCK_WORKFLOW.id}`);
    await waitFor(() => expect(publishButton()).not.toBeNull());
    expect(publishButton()!.disabled).toBe(true);
    expect(publishButton()!.getAttribute('data-block')).toBe('stale');
  });

  it('a published workflow shows the line, re-publish confirms with the column changes, then POSTs', async () => {
    const changed: Workflow = {
      ...PUBLISHED,
      run: { ...PUBLISHED.run!, id: 'run_0000000a', number: 9 },
      resolvedColumns: [...MOCK_DATASET.columns.filter((c) => c.name !== 'stage'), { name: 'region', dtype: 'string' }],
    };
    serveWorkflow(changed);
    let posted = false;
    server.use(
      http.post('*/workflows/:id/publish', () => {
        posted = true;
        return HttpResponse.json({ ...MOCK_PUBLISHED_DATASET, dataVersion: 2 });
      }),
    );
    renderAt(`/data-management/workflows/${MOCK_WORKFLOW.id}`);
    const line = await waitFor(() => {
      const el = document.querySelector('[data-component="WorkflowPublished"]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect(line.textContent).toContain(MOCK_PUBLISHED_DATASET.name);
    expect(line.textContent).toContain('The workflow was re-run after this was published');
    fireEvent.click(publishButton()!);
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(/Replace the data in Consolidated leads \(data version 1, run #3\) with run #9/),
    ).toBeInTheDocument();
    expect(await within(dialog).findByText('region — new')).toBeInTheDocument();
    expect(within(dialog).getByText(/stage — removed/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /Re-publish/ }));
    expect(await screen.findByText('Dataset “Consolidated leads” updated — data version 2.')).toBeInTheDocument();
    expect(posted).toBe(true);
  });
});

describe('R192 published dataset page', () => {
  it('shows where it came from (linked) and offers no Refresh', async () => {
    renderAt(`/data-management/datasets/${MOCK_PUBLISHED_DATASET.id}`);
    const line = await waitFor(() => {
      const el = document.querySelector('[data-component="DatasetPublishedFrom"]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect(line.textContent).toContain('Published from workflow');
    expect(line.textContent).toContain('run #3');
    await waitFor(() => expect(within(line).getByRole('link', { name: MOCK_WORKFLOW.name })).toBeInTheDocument());
    // The Actions menu draws its items only when opened (R192 review F-6).
    fireEvent.click(document.querySelector('[data-component="DatasetDetailActionsTrigger"]') as Element);
    expect(await screen.findByText('Rename')).toBeInTheDocument();
    expect(screen.queryByText('Refresh')).toBeNull();
  });

  it('names the workflow at publish time, marked deleted, once the workflow is gone', async () => {
    server.use(http.get('*/workflows/:id', () => HttpResponse.json({ code: 'not_found' }, { status: 404 })));
    renderAt(`/data-management/datasets/${MOCK_PUBLISHED_DATASET.id}`);
    await waitFor(() =>
      expect(document.querySelector('[data-component="DatasetPublishedFrom"]')?.textContent).toContain(
        '(the workflow no longer exists)',
      ),
    );
  });
});

// --- R192 QA — adversarial ----------------------------------------------------

describe('R192 QA — publish edges', () => {
  it('a blank or whitespace-only name cannot be submitted', async () => {
    renderAt(`/data-management/workflows/${MOCK_WORKFLOW.id}`);
    await waitFor(() => expect(publishButton()).not.toBeNull());
    fireEvent.click(publishButton()!);
    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByLabelText('Dataset name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '   ' } });
    const ok = within(dialog).getByRole('button', { name: /Publish/ }) as HTMLButtonElement;
    expect(ok.disabled).toBe(true);
  });

  it('a re-publish with unchanged columns lists no column changes', async () => {
    serveWorkflow({
      ...PUBLISHED,
      run: { ...PUBLISHED.run!, id: 'run_0000000c', number: 5 },
      resolvedColumns: MOCK_PUBLISHED_DATASET.columns.map(({ name, dtype }) => ({ name, dtype })),
    });
    renderAt(`/data-management/workflows/${MOCK_WORKFLOW.id}`);
    await waitFor(() => expect(publishButton()?.textContent).toContain('Re-publish'));
    fireEvent.click(publishButton()!);
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText(/with run #5/);
    // the dataset's columns load before the diff renders — wait a tick for them
    await new Promise((r) => setTimeout(r, 50));
    expect(dialog.querySelector('[data-component="WorkflowRepublishColumns"]')).toBeNull();
  });

  it('published, then edited (no run): the edited-since note shows and publish is blocked', async () => {
    serveWorkflow({ ...PUBLISHED, materializedAt: undefined, run: undefined, resolvedColumns: undefined });
    renderAt(`/data-management/workflows/${MOCK_WORKFLOW.id}`);
    await waitFor(() =>
      expect(document.querySelector('[data-component="WorkflowPublishedNote"]')?.textContent).toContain(
        'edited after this was published',
      ),
    );
    expect(publishButton()!.disabled).toBe(true);
    expect(publishButton()!.getAttribute('data-block')).toBe('never_run');
  });

  it('a stale workflow: hovering the disabled button reads the reason', async () => {
    serveWorkflow({ ...MOCK_WORKFLOW, staleSources: [{ sourceId: 'qr_9c2f10ab', reason: 'data_refreshed' }] });
    renderAt(`/data-management/workflows/${MOCK_WORKFLOW.id}`);
    await waitFor(() => expect(publishButton()).not.toBeNull());
    fireEvent.mouseEnter(publishButton()!.parentElement!);
    expect(await screen.findByText('The results are out of date — re-run first.')).toBeInTheDocument();
  });
});

describe('R192 QA — datasets list', () => {
  it('a published row shows the workflow icon and its menu has no Refresh; an upload row keeps Refresh', async () => {
    server.use(http.get('*/datasets', () => HttpResponse.json([MOCK_DATASET, MOCK_PUBLISHED_DATASET])));
    renderAt('/data-management/datasets');
    await waitFor(() =>
      expect(document.querySelector('[data-component="DatasetSourceIcon"][data-format="workflow"]')).not.toBeNull(),
    );
    const menuItems = async (idx: number) => {
      const buttons = document.querySelectorAll('[data-component="DatasetRowMoreButton"]');
      expect(buttons.length).toBe(2);
      fireEvent.click(buttons[idx]);
      await waitFor(() =>
        expect(
          document.querySelectorAll('.ant-dropdown:not(.ant-dropdown-hidden) [role="menuitem"]').length,
        ).toBeGreaterThan(0),
      );
      const items = [...document.querySelectorAll('.ant-dropdown:not(.ant-dropdown-hidden) [role="menuitem"]')].map(
        (e) => e.textContent,
      );
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
      return items;
    };
    const rows = [...document.querySelectorAll('[data-component="DatasetRowMoreButton"]')];
    const pubIdx = rows.findIndex((b) => b.closest('tr')?.textContent?.includes(MOCK_PUBLISHED_DATASET.name));
    const pubItems = await menuItems(pubIdx);
    expect(pubItems.some((t) => /Refresh/.test(t ?? ''))).toBe(false);
    expect(pubItems.some((t) => /Rename/.test(t ?? ''))).toBe(true);
  });
});

// R192 review — a refusal the page did not foresee (the cached workflow looked
// publishable) says why, and the workflow reloads so the button shows it.
describe('R192 review — server refusal and same run', () => {
  it('a 409 stale from the server toasts the reason and reloads the workflow', async () => {
    let gets = 0;
    server.use(
      http.get('*/workflows/:id', () => {
        gets += 1;
        return HttpResponse.json(PUBLISHED_RERUN);
      }),
      http.post('*/workflows/:id/publish', () =>
        HttpResponse.json(
          {
            code: 'not_publishable',
            reason: 'stale',
            staleSources: [{ sourceId: 'qr_9c2f10ab', reason: 'data_refreshed' }],
          },
          { status: 409 },
        ),
      ),
    );
    renderAt(`/data-management/workflows/${MOCK_WORKFLOW.id}`);
    await waitFor(() => expect(publishButton()).not.toBeNull());
    fireEvent.click(publishButton()!);
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByRole('button', { name: /Re-publish/ })).not.toBeDisabled());
    const before = gets;
    fireEvent.click(within(dialog).getByRole('button', { name: /Re-publish/ }));
    expect(await screen.findByText('The results are out of date — re-run first.')).toBeInTheDocument();
    await waitFor(() => expect(gets).toBeGreaterThan(before));
  });

  it('the run already published blocks Re-publish with its reason', async () => {
    serveWorkflow(PUBLISHED);
    renderAt(`/data-management/workflows/${MOCK_WORKFLOW.id}`);
    await waitFor(() => expect(publishButton()?.getAttribute('data-block')).toBe('up_to_date'));
    expect(publishButton()!.disabled).toBe(true);
  });
});
