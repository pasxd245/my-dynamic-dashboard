// R200 QA — adversarial tests for the History drawer (item 4.4), adopted from the QA
// pass (fix commit, QA-1): a restore adds a
// row tagged Current + "Same as #k" and Restore leaves every current-version row;
// the restore confirm reads a FRESH sourceChangedSince under the app's 60 s
// staleTime; a restored dashboard's controls make links named after the newer
// control ids stale (R199 BA-C1).

import { AntdConfig } from '@mdd/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { staleFilterKeys, withoutStaleRaw } from '@/features/dashboard/sharedFilters';
import { QueryDetailPage } from '@/features/data-management/queries/QueryDetailPage';
import { WorkflowDetailPage } from '@/features/data-management/workflows/WorkflowDetailPage';
import type { HistoryEntry, HistoryList } from '@/features/history/types';
import { MOCK_QUERY, MOCK_WORKFLOW } from '@/mocks/fixtures';
import { resetMockHistory } from '@/mocks/handlers';
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

/** The app's own QueryClient defaults (main.tsx): staleTime 60 s. */
function wrap(ui: React.ReactNode, path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000, refetchOnWindowFocus: false } } });
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
const restorable = () =>
  [...document.querySelectorAll('[data-component="HistoryRestore"]')].map((b) =>
    b.closest('[data-component="HistoryRow"]')?.getAttribute('data-seq'),
  );

afterEach(() => resetMockHistory());

describe('R200 QA — restore adds a Current row tagged Same as #k', () => {
  it('after restoring #2 the list re-reads: #4 Current + Same as #2, Restore gone from every current-version row', async () => {
    // #3 = A (current), #2 = B, #1 = C baseline. Restoring #2 writes #4 = B.
    let list: HistoryList = {
      kind: 'workflow',
      id: MOCK_WORKFLOW.id,
      current: A,
      entries: [entry(3, A), entry(2, B), entry(1, C, { change: 'baseline' })],
    };
    server.use(
      http.get(`*/workflows/${MOCK_WORKFLOW.id}/history`, () => HttpResponse.json(list)),
      http.get(`*/workflows/${MOCK_WORKFLOW.id}/history/:version`, ({ params }) =>
        HttpResponse.json({ ...entry(2, String(params.version)), definition: { marker: String(params.version) } }),
      ),
      http.put('*/workflows/:id', async () => {
        list = { ...list, current: B, entries: [entry(4, B), ...list.entries] };
        return HttpResponse.json(MOCK_WORKFLOW);
      }),
    );
    wrap(
      <Routes>
        <Route path="/data-management/workflows/:id" element={<WorkflowDetailPage />} />
      </Routes>,
      `/data-management/workflows/${MOCK_WORKFLOW.id}`,
    );
    fireEvent.click(await screen.findByRole('button', { name: /History/ }));
    await waitFor(() => expect(row(2)).not.toBeNull());
    expect(restorable()).toEqual(['2', '1']);
    fireEvent.click(within(row(2)).getByRole('button', { name: 'Restore' }));
    await screen.findAllByText('Restore version #2?');
    const confirm = q('[data-component="HistoryRestoreConfirm"]')?.closest('.ant-modal') as HTMLElement;
    fireEvent.click(within(confirm).getByRole('button', { name: 'Restore' }));
    expect(await screen.findByText('Restored #2 as #4')).toBeInTheDocument();
    await waitFor(() => expect(row(4)).not.toBeNull());
    expect(within(row(4)).getByText('Current')).toBeInTheDocument();
    expect(within(row(4)).getByText('Same as #2')).toBeInTheDocument();
    expect(within(row(3)).queryByText('Current')).toBeNull();
    // BA-C1 — #4 and #2 now hold the current version: no Restore there; #3 and #1 offer it.
    expect(restorable()).toEqual(['3', '1']);
  });
});

describe('R200 QA — the restore confirm reads a fresh sourceChangedSince', () => {
  it('a version read cached by the JSON view does not hide a refresh that happened since', async () => {
    let changed = false;
    const list: HistoryList = { kind: 'query', id: MOCK_QUERY.id, current: A, entries: [entry(2, A), entry(1, B, { change: 'create' })] };
    server.use(
      http.get(`*/queries/${MOCK_QUERY.id}/history`, () => HttpResponse.json(list)),
      http.get(`*/queries/${MOCK_QUERY.id}/history/:version`, ({ params }) =>
        HttpResponse.json({ ...entry(1, String(params.version), { change: 'create' }), definition: { m: 1 }, sourceChangedSince: changed }),
      ),
    );
    wrap(
      <Routes>
        <Route path="/data-management/queries/:id" element={<QueryDetailPage />} />
      </Routes>,
      `/data-management/queries/${MOCK_QUERY.id}`,
    );
    fireEvent.click(await screen.findByRole('button', { name: /History/ }));
    await waitFor(() => expect(row(1)).not.toBeNull());
    // the owner looks at #1's JSON (the version read is cached) …
    fireEvent.click(within(row(1)).getByRole('button', { name: 'Technical definition (JSON)' }));
    await waitFor(() => expect(q('[data-component="HistoryJson"] pre')).not.toBeNull());
    // … the source dataset is refreshed (another tab, an agent, the datasets page) …
    changed = true;
    // … then Restore on #1: the confirm must warn.
    fireEvent.click(within(row(1)).getByRole('button', { name: 'Restore' }));
    await screen.findAllByText('Restore version #1?');
    expect(q('[data-component="HistorySourceChanged"]')).not.toBeNull();
  });
});

describe('R200 QA — a dashboard restore and R199 viewer links', () => {
  const values = (id: string) => ({ id, kind: 'values' as const, label: 'Team', column: 'team', targets: 'all' as const });

  it('the restored (older) control ids make an f. key for the newer id stale; the old id stays', () => {
    const search = '?p.as_of=2026-10-01&f.ctl_000000a2=North&f.ctl_000000a1=South&x=1';
    const restored = [values('ctl_000000a1')];
    expect(staleFilterKeys(search, restored)).toEqual(['ctl_000000a2']);
    const cleaned = withoutStaleRaw(search, restored);
    expect(cleaned).not.toContain('f.ctl_000000a2');
    expect(cleaned).toContain('f.ctl_000000a1=South');
    expect(cleaned).toContain('p.as_of=2026-10-01');
    expect(cleaned).toContain('x=1');
    // before the restore (newer controls) the newer key was the live one
    expect(staleFilterKeys(search, [values('ctl_000000a2')])).toEqual(['ctl_000000a1']);
  });
});
