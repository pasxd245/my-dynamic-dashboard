// R200 (item 4.4) — the History drawer on the query, dashboard and workflow pages
// (design: .agents/design/data-management/_shared/definition-history.md C12–C13,
// BA pass 1 folds BA-C1..C9).

import { AntdConfig } from '@mdd/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { historyApi } from '@/api/historyApi';
import { workflowsApi } from '@/api/workflowsApi';
import { DashboardDetailPage } from '@/features/dashboard/DashboardDetailPage';
import { QueryDetailPage } from '@/features/data-management/queries/QueryDetailPage';
import { WorkflowDetailPage } from '@/features/data-management/workflows/WorkflowDetailPage';
import { canRestore, currentSeqOf, sameAsOf } from '@/features/history/sameAs';
import type { HistoryEntry, HistoryList } from '@/features/history/types';
import { i18n } from '@/i18n';
import { MOCK_DASHBOARD, MOCK_QUERY, MOCK_WORKFLOW, MOCK_WORKSPACE } from '@/mocks/fixtures';
import { mockDefinitionVersion, resetMockHistory } from '@/mocks/handlers';
import { server } from '@/mocks/server';

const A = 'aaaaaaaaaaaa';
const B = 'bbbbbbbbbbbb';
const C = 'cccccccccccc';

const entry = (seq: number, version: string, over: Partial<HistoryEntry> = {}): HistoryEntry => ({
  seq,
  version,
  change: 'update',
  changedAt: '2026-10-19T10:00:00Z',
  changedBy: null,
  changedSource: null,
  ...over,
});

// #4 restored #2's definition (A = current); #3 is B; #1 is the baseline C.
const ENTRIES: HistoryEntry[] = [
  entry(4, A, { changedBy: 'report-agent', changedSource: 'ai' }),
  entry(3, B),
  entry(2, A),
  entry(1, C, { change: 'baseline' }),
];

function wrap(ui: React.ReactNode, path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AntdConfig>
        <App>
          <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
        </App>
      </AntdConfig>
    </QueryClientProvider>,
  );
}

const q = (sel: string) => document.querySelector(sel) as HTMLElement | null;
const row = (seq: number) => q(`[data-component="HistoryRow"][data-seq="${seq}"]`) as HTMLElement;

/** Serve a fixed history for one noun; the version read echoes `versionSeq`
 *  (deliberately NOT the clicked row's seq) so labels must come from the click. */
const versionReads: URL[] = [];

function serveHistory(
  route: string,
  id: string,
  list: HistoryList | (() => HistoryList),
  extra: Record<string, unknown> = {},
) {
  versionReads.length = 0;
  server.use(
    http.get(`*/${route}/${id}/history`, () => HttpResponse.json(typeof list === 'function' ? list() : list)),
    http.get(`*/${route}/${id}/history/:version`, ({ params, request }) => {
      versionReads.push(new URL(request.url));
      return HttpResponse.json({
        ...entry(99, String(params.version)),
        definition: { marker: `def-${String(params.version)}` },
        ...extra,
      });
    }),
  );
}

afterEach(async () => {
  resetMockHistory();
  await i18n.changeLanguage('en');
});

describe('R200 pure rules', () => {
  it('Same as #k points at the newest older row with the hash; Current is the newest row with the current hash', () => {
    const same = sameAsOf(ENTRIES);
    expect(same.get(4)).toBe(2);
    expect(same.has(3)).toBe(false);
    expect(same.has(2)).toBe(false);
    expect(currentSeqOf(ENTRIES, A)).toBe(4);
    expect(currentSeqOf(ENTRIES, 'ffffffffffff')).toBeNull();
  });

  it('BA-C1 — Restore is offered only where it would change the definition', () => {
    expect(ENTRIES.filter((e) => canRestore(e, A)).map((e) => e.seq)).toEqual([3, 1]);
  });
});

describe('R200 History drawer — workflow page', () => {
  const path = `/data-management/workflows/${MOCK_WORKFLOW.id}`;
  const page = () =>
    wrap(
      <Routes>
        <Route path="/data-management/workflows/:id" element={<WorkflowDetailPage />} />
      </Routes>,
      path,
    );

  it('lists rows newest first with the tags, the writer, the intro, and Restore only off the current version', async () => {
    serveHistory('workflows', MOCK_WORKFLOW.id, { kind: 'workflow', id: MOCK_WORKFLOW.id, current: A, entries: ENTRIES });
    page();
    fireEvent.click(await screen.findByRole('button', { name: /History/ }));
    await waitFor(() => expect(q('[data-component="HistoryList"]')).not.toBeNull());

    const seqs = [...document.querySelectorAll('[data-component="HistoryRow"]')].map((r) => r.getAttribute('data-seq'));
    expect(seqs).toEqual(['4', '3', '2', '1']);
    expect(within(row(4)).getByText('Current')).toBeInTheDocument();
    expect(within(row(4)).getByText('Same as #2')).toBeInTheDocument();
    expect(within(row(4)).getByText(/· report-agent/)).toBeInTheDocument();
    expect(within(row(3)).queryByText(/·/)).toBeNull(); // no writer, no placeholder
    expect(within(row(1)).getByText('History started')).toBeInTheDocument();
    expect(within(row(1)).getByText(/earlier changes were not recorded/)).toBeInTheDocument();
    // BA-C1 — #4 (current) and #2 (same hash as current) offer no Restore.
    const restorable = [...document.querySelectorAll('[data-component="HistoryRestore"]')].map(
      (b) => b.closest('[data-component="HistoryRow"]')?.getAttribute('data-seq'),
    );
    expect(restorable).toEqual(['3', '1']);
    expect(screen.getByText(/Names appear only for changes made through the API with a writer token\./)).toBeInTheDocument();
    expect(within(row(3)).getByText('Technical definition (JSON)')).toBeInTheDocument();
  });

  it('the JSON view is labelled by the CLICKED row, not the seq the version read answers', async () => {
    serveHistory('workflows', MOCK_WORKFLOW.id, { kind: 'workflow', id: MOCK_WORKFLOW.id, current: A, entries: ENTRIES });
    page();
    fireEvent.click(await screen.findByRole('button', { name: /History/ }));
    await waitFor(() => expect(row(2)).not.toBeNull());
    fireEvent.click(within(row(2)).getByRole('button', { name: 'Technical definition (JSON)' }));
    await waitFor(() => expect(q('[data-component="HistoryJson"]')).not.toBeNull());
    expect(screen.getByText('#2 — technical definition (JSON), read-only')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(new RegExp(`def-${A}`))).toBeInTheDocument());
    expect(screen.queryByText(/#99/)).toBeNull();
    // the read names the clicked row (a version can occur more than once)
    expect(versionReads.at(-1)?.searchParams.get('seq')).toBe('2');
  });

  it('a restore sends the workflow PUT with the current name and the old definition; the confirm names the clicked row', async () => {
    const puts: unknown[] = [];
    serveHistory('workflows', MOCK_WORKFLOW.id, () => ({
      kind: 'workflow',
      id: MOCK_WORKFLOW.id,
      current: puts.length ? B : A,
      entries: puts.length ? [entry(5, B), ...ENTRIES] : ENTRIES,
    }));
    server.use(
      http.put('*/workflows/:id', async ({ request }) => {
        puts.push(await request.json());
        return HttpResponse.json(MOCK_WORKFLOW);
      }),
    );
    page();
    fireEvent.click(await screen.findByRole('button', { name: /History/ }));
    await waitFor(() => expect(row(3)).not.toBeNull());
    fireEvent.click(within(row(3)).getByRole('button', { name: 'Restore' }));
    expect((await screen.findAllByText('Restore version #3?')).length).toBeGreaterThan(0);
    expect(q('[data-component="HistoryRestoreConfirm"]')?.getAttribute('data-seq')).toBe('3');
    expect(screen.getByText("The workflow's output is cleared; run it again to rebuild it.")).toBeInTheDocument();
    expect(q('[data-component="HistorySourceChanged"]')).toBeNull(); // queries only
    expect(versionReads.at(-1)?.searchParams.get('seq')).toBe('3');
    const confirm = q('[data-component="HistoryRestoreConfirm"]')?.closest('.ant-modal') as HTMLElement;
    fireEvent.click(within(confirm).getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({ name: MOCK_WORKFLOW.name, definition: { marker: `def-${B}` } });
    expect(await screen.findByText('Restored #3 as #5')).toBeInTheDocument();
  });

  it('CR-5 — a restore that wrote no row says so instead of "Restored #k as #n"', async () => {
    serveHistory('workflows', MOCK_WORKFLOW.id, { kind: 'workflow', id: MOCK_WORKFLOW.id, current: A, entries: ENTRIES });
    server.use(http.put('*/workflows/:id', () => HttpResponse.json(MOCK_WORKFLOW)));
    page();
    fireEvent.click(await screen.findByRole('button', { name: /History/ }));
    await waitFor(() => expect(row(3)).not.toBeNull());
    fireEvent.click(within(row(3)).getByRole('button', { name: 'Restore' }));
    await screen.findAllByText('Restore version #3?');
    const confirm = q('[data-component="HistoryRestoreConfirm"]')?.closest('.ant-modal') as HTMLElement;
    fireEvent.click(within(confirm).getByRole('button', { name: 'Restore' }));
    // the served list still ends at #4: nothing was written
    expect(await screen.findByText('#3 is already the current definition; nothing was saved.')).toBeInTheDocument();
    expect(screen.queryByText(/Restored #3 as/)).toBeNull();
  });

  it('BA-C7 — no History button while editing', async () => {
    page();
    await screen.findByRole('button', { name: /History/ });
    fireEvent.click(q('[data-component="WorkflowDetailEdit"]') as HTMLElement);
    await waitFor(() => expect(q('[data-component="WorkflowEditSave"]')).not.toBeNull());
    expect(q('[data-component="DefinitionHistoryButton"]')).toBeNull();
  });

  it('BA-C8 — the delete confirm names the saved versions', async () => {
    serveHistory('workflows', MOCK_WORKFLOW.id, { kind: 'workflow', id: MOCK_WORKFLOW.id, current: A, entries: ENTRIES });
    page();
    fireEvent.click(await screen.findByText('Delete'));
    expect(await screen.findByText('This also deletes its 4 saved versions.')).toBeInTheDocument();
  });
});

describe('R200 History drawer — query page', () => {
  const page = () =>
    wrap(
      <Routes>
        <Route path="/data-management/queries/:id" element={<QueryDetailPage />} />
      </Routes>,
      `/data-management/queries/${MOCK_QUERY.id}`,
    );
  const list: HistoryList = { kind: 'query', id: MOCK_QUERY.id, current: A, entries: [entry(2, A), entry(1, B, { change: 'create' })] };

  it('BA-C2 — the confirm warns when a source changed after the version was saved', async () => {
    serveHistory('queries', MOCK_QUERY.id, list, { sourceChangedSince: true });
    page();
    fireEvent.click(await screen.findByRole('button', { name: /History/ }));
    await waitFor(() => expect(row(1)).not.toBeNull());
    fireEvent.click(within(row(1)).getByRole('button', { name: 'Restore' }));
    expect((await screen.findAllByText('Restore version #1?')).length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        'The data source changed after this version was saved; column positions may differ — check the filters after restoring.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Dashboards and workflows that use this query will read the restored definition.')).toBeInTheDocument();
  });

  it('no warning when the sources did not change', async () => {
    serveHistory('queries', MOCK_QUERY.id, list, { sourceChangedSince: false });
    page();
    fireEvent.click(await screen.findByRole('button', { name: /History/ }));
    await waitFor(() => expect(row(1)).not.toBeNull());
    fireEvent.click(within(row(1)).getByRole('button', { name: 'Restore' }));
    expect((await screen.findAllByText('Restore version #1?')).length).toBeGreaterThan(0);
    expect(q('[data-component="HistorySourceChanged"]')).toBeNull();
  });

  it('BA-C9 — a refused restore shows one readable line, never the raw detail', async () => {
    serveHistory('queries', MOCK_QUERY.id, list, { sourceChangedSince: false });
    server.use(
      http.put('*/queries/:id', () =>
        HttpResponse.json({ detail: [{ loc: ['body', 'definition'], msg: 'col 7 out of range', type: 'value_error' }] }, { status: 422 }),
      ),
    );
    page();
    fireEvent.click(await screen.findByRole('button', { name: /History/ }));
    await waitFor(() => expect(row(1)).not.toBeNull());
    fireEvent.click(within(row(1)).getByRole('button', { name: 'Restore' }));
    await screen.findAllByText('Restore version #1?');
    const confirm = q('[data-component="HistoryRestoreConfirm"]')?.closest('.ant-modal') as HTMLElement;
    fireEvent.click(within(confirm).getByRole('button', { name: 'Restore' }));
    expect(
      await screen.findByText('This version can no longer be saved: it does not fit the current data or queries.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/out of range/)).toBeNull();
  });

  it('the History button sits in the view-mode header and leaves while editing', async () => {
    page();
    await screen.findByRole('button', { name: /History/ });
    fireEvent.click(q('[data-component="QueryDetailEdit"]') as HTMLElement);
    await waitFor(() => expect(q('[data-component="QueryBuilderSave"]')).not.toBeNull());
    expect(q('[data-component="DefinitionHistoryButton"]')).toBeNull();
  });
});

describe('R200 History drawer — dashboard page', () => {
  it('a restore sends the dashboard PUT with the current name and slug; the confirm has the dashboard line', async () => {
    serveHistory('dashboards', MOCK_DASHBOARD.id, {
      kind: 'dashboard',
      id: MOCK_DASHBOARD.id,
      current: A,
      entries: [entry(2, A), entry(1, B, { change: 'create' })],
    });
    const puts: unknown[] = [];
    server.use(
      http.put('*/dashboards/:id', async ({ request }) => {
        puts.push(await request.json());
        return HttpResponse.json(MOCK_DASHBOARD);
      }),
    );
    wrap(
      <Routes>
        <Route path="/dashboards/:workspaceId/:slug" element={<DashboardDetailPage />} />
      </Routes>,
      `/dashboards/${MOCK_WORKSPACE.id}/${MOCK_DASHBOARD.slug}`,
    );
    fireEvent.click(await screen.findByRole('button', { name: /History/ }));
    await waitFor(() => expect(row(1)).not.toBeNull());
    fireEvent.click(within(row(1)).getByRole('button', { name: 'Restore' }));
    expect(
      await screen.findByText(
        'Viewer links that name filters this version lacks will open without those selections. Notes on widgets this version lacks are set aside and come back if you restore a version that has the widget.',
      ),
    ).toBeInTheDocument();
    const confirm = q('[data-component="HistoryRestoreConfirm"]')?.closest('.ant-modal') as HTMLElement;
    fireEvent.click(within(confirm).getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({ name: MOCK_DASHBOARD.name, slug: MOCK_DASHBOARD.slug, definition: { marker: `def-${B}` } });
  });
});

describe('R200 MSW history', () => {
  it('seeds a baseline, appends on a definition change, not on a rename, and 404s an unknown noun', async () => {
    const before = await historyApi.list('workflow', MOCK_WORKFLOW.id);
    expect(before.entries.map((e) => e.change)).toEqual(['baseline']);
    expect(before.current).toBe(mockDefinitionVersion(MOCK_WORKFLOW.definition));
    await workflowsApi.update(MOCK_WORKFLOW.id, { name: 'renamed', definition: MOCK_WORKFLOW.definition });
    const renamed = await historyApi.list('workflow', MOCK_WORKFLOW.id);
    expect(renamed.entries).toHaveLength(1);
    const v = await historyApi.version('workflow', MOCK_WORKFLOW.id, before.current);
    expect(v.definition).toEqual(MOCK_WORKFLOW.definition);
    await expect(historyApi.list('workflow', 'wf_0000dead')).rejects.toMatchObject({ status: 404 });
  });

  it('VI copy for the drawer', async () => {
    await i18n.changeLanguage('vi');
    serveHistory('workflows', MOCK_WORKFLOW.id, { kind: 'workflow', id: MOCK_WORKFLOW.id, current: A, entries: ENTRIES });
    wrap(
      <Routes>
        <Route path="/data-management/workflows/:id" element={<WorkflowDetailPage />} />
      </Routes>,
      `/data-management/workflows/${MOCK_WORKFLOW.id}`,
    );
    fireEvent.click(await screen.findByRole('button', { name: /Lịch sử/ }));
    await waitFor(() => expect(row(4)).not.toBeNull());
    expect(within(row(4)).getByText('Hiện tại')).toBeInTheDocument();
    expect(within(row(4)).getByText('Giống #2')).toBeInTheDocument();
    expect(within(row(1)).getByText('Bắt đầu lịch sử')).toBeInTheDocument();
    expect(within(row(3)).getByText('Định nghĩa kỹ thuật (JSON)')).toBeInTheDocument();
    expect(within(row(3)).getByText('Khôi phục')).toBeInTheDocument();
  });
});

describe('R200 BA pass 2 folds', () => {
  /** The app's own QueryClient defaults (main.tsx): 60 s staleTime. */
  function wrapApp(ui: React.ReactNode, path: string) {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 60_000, refetchOnWindowFocus: false } },
    });
    return render(
      <QueryClientProvider client={qc}>
        <AntdConfig>
          <App>
            <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
          </App>
        </AntdConfig>
      </QueryClientProvider>,
    );
  }

  const restoreRow = async (seq: number) => {
    fireEvent.click(await screen.findByRole('button', { name: /History/ }));
    await waitFor(() => expect(row(seq)).not.toBeNull());
    fireEvent.click(within(row(seq)).getByRole('button', { name: 'Restore' }));
    await screen.findAllByText(`Restore version #${seq}?`);
    const confirm = q('[data-component="HistoryRestoreConfirm"]')?.closest('.ant-modal') as HTMLElement;
    fireEvent.click(within(confirm).getByRole('button', { name: 'Restore' }));
  };

  it('BA-F1 — after a restore the Metadata panel re-reads (no 30 s stale notes)', async () => {
    const metadataReads: string[] = [];
    let restored = false;
    serveHistory('queries', MOCK_QUERY.id, () => ({
      kind: 'query',
      id: MOCK_QUERY.id,
      current: restored ? B : A,
      entries: restored ? [entry(3, B), entry(2, A), entry(1, B, { change: 'create' })] : [entry(2, A), entry(1, B, { change: 'create' })],
    }), { sourceChangedSince: false });
    server.use(
      http.get(`*/metadata/query/${MOCK_QUERY.id}`, ({ request }) => {
        metadataReads.push(request.url);
        return HttpResponse.json({ entries: {}, current: { definitionVersion: restored ? B : A } });
      }),
      http.put('*/queries/:id', async ({ request }) => {
        restored = true;
        const body = (await request.json()) as { definition: unknown };
        return HttpResponse.json({ ...MOCK_QUERY, definition: { ...MOCK_QUERY.definition, ...(body.definition as object) } });
      }),
    );
    wrapApp(
      <Routes>
        <Route path="/data-management/queries/:id" element={<QueryDetailPage />} />
      </Routes>,
      `/data-management/queries/${MOCK_QUERY.id}`,
    );
    await waitFor(() => expect(metadataReads.length).toBeGreaterThan(0));
    const before = metadataReads.length;
    await restoreRow(1);
    expect(await screen.findByText('Restored #1 as #3')).toBeInTheDocument();
    await waitFor(() => expect(metadataReads.length).toBeGreaterThan(before));
  });

  it('BA-F4 — "already current" is judged on the list re-read right before the PUT', async () => {
    // The drawer reads #4 newest; meanwhile another tab restores #3 (→ #5 = B). Our
    // restore of #3 then writes nothing: the toast must not claim "Restored #3 as #5".
    let reads = 0;
    serveHistory('workflows', MOCK_WORKFLOW.id, () => {
      reads += 1;
      return reads === 1
        ? { kind: 'workflow', id: MOCK_WORKFLOW.id, current: A, entries: ENTRIES }
        : { kind: 'workflow', id: MOCK_WORKFLOW.id, current: B, entries: [entry(5, B), ...ENTRIES] };
    });
    server.use(http.put('*/workflows/:id', () => HttpResponse.json(MOCK_WORKFLOW)));
    wrapApp(
      <Routes>
        <Route path="/data-management/workflows/:id" element={<WorkflowDetailPage />} />
      </Routes>,
      `/data-management/workflows/${MOCK_WORKFLOW.id}`,
    );
    await restoreRow(3);
    expect(await screen.findByText('#3 is already the current definition; nothing was saved.')).toBeInTheDocument();
    expect(screen.queryByText(/Restored #3 as/)).toBeNull();
  });
});
