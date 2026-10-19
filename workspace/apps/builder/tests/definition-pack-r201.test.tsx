// R201 (item 4.8) — the definition pack in the builder: the workspace card's
// Export / Import actions and the import modal (design:
// .agents/design/data-management/_shared/definition-pack.md criteria 14–15).

import { AntdConfig } from '@mdd/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ERROR_CODES, PACK } from '@/_generated/constants';
import { definitionsApi } from '@/api/definitionsApi';
import { isApiError } from '@/features/data-management/_shared/types';
import { useQueriesQuery } from '@/features/data-management/queries/hooks';
import { WorkspacesPage } from '@/features/data-management/workspaces/WorkspacesPage';
import {
  PACK_MAX_BYTES,
  canImport,
  columnDifference,
  nothingToImport,
  packFileName,
  readPackText,
  writeCount,
} from '@/features/data-management/workspaces/definitionPack/plan';
import type { DefinitionPack, ImportPlan } from '@/features/data-management/workspaces/definitionPack/types';
import { i18n } from '@/i18n';
import { validateResponse } from '@/mocks/contract-validator';
import { mockPackOf, mockPlan } from '@/mocks/definitionPack';
import { MOCK_QUERY, MOCK_SAVED_WORKSPACE, MOCK_WORKSPACE } from '@/mocks/fixtures';
import { server } from '@/mocks/server';

const CLEAN = { id: 'ws_bbbbbbb2', name: 'Acme copy', kind: 'main' as const, createdAt: '2026-10-19T09:00:00Z' };

/** The app's own QueryClient defaults (main.tsx) — after-state checks must
 *  hold under a 60 s staleTime, not only on a bare client (review-qa item 10). */
function appClient() {
  return new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: false } },
  });
}

/** A live reader of one workspace's queries, mounted beside the page: it shows
 *  whether the import made the cached list read again. */
function QueriesCount({ workspaceId }: Readonly<{ workspaceId: string }>) {
  const q = useQueriesQuery(workspaceId);
  return <span data-component="QueriesCount">{q.data ? q.data.length : '…'}</span>;
}

function renderPage(extra?: React.ReactNode) {
  const qc = appClient();
  render(
    <QueryClientProvider client={qc}>
      <AntdConfig>
        <App>
          <MemoryRouter initialEntries={['/data-management/workspaces']}>
            <Routes>
              <Route
                path="/data-management/workspaces"
                element={
                  <>
                    <WorkspacesPage />
                    {extra}
                  </>
                }
              />
            </Routes>
          </MemoryRouter>
        </App>
      </AntdConfig>
    </QueryClientProvider>,
  );
  return qc;
}

const serveWorkspaces = (...ws: object[]) => server.use(http.get('*/workspaces', () => HttpResponse.json(ws)));

const el = async (sel: string, root: ParentNode = document) =>
  waitFor(() => {
    const found = root.querySelector(sel);
    if (!found) throw new Error(`no ${sel}`);
    return found as HTMLElement;
  });

async function openMenu(workspaceId: string): Promise<string[]> {
  const card = await el(`[data-component="WorkspaceCard"][data-workspace-id="${workspaceId}"]`);
  fireEvent.click(within(card).getByRole('button'));
  return waitFor(() => {
    const items = [...document.querySelectorAll('.ant-dropdown:not(.ant-dropdown-hidden) [role="menuitem"]')].map(
      (n) => n.textContent ?? '',
    );
    if (items.length === 0) throw new Error('no menu');
    return items;
  });
}

async function chooseFile(content: string, name = 'pack.json') {
  const modal = await el('[data-component="ImportDefinitionsModal"]');
  const input = modal.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File([content], name, { type: 'application/json' })] } });
  return modal;
}

async function openImport(workspace: { id: string }) {
  await openMenu(workspace.id);
  fireEvent.click(await screen.findByText('Import definitions…'));
  return el('[data-component="ImportDefinitionsModal"]');
}

const planRow = (kind: string, name: string) =>
  document.querySelector(`[data-component="PlanRow"][data-kind="${kind}"][data-name="${name}"]`) as HTMLElement | null;

const importButton = () => document.querySelector('[data-component="PackImportButton"]') as HTMLButtonElement | null;

/** The fixture pack with the one query's filter changed — a conflict in the
 *  fixture workspace. */
function changedPack(): DefinitionPack {
  const pack = mockPackOf(MOCK_WORKSPACE.name);
  pack.queries[0] = {
    ...pack.queries[0],
    definition: { ...pack.queries[0].definition, filters: [{ col: 3, dtype: 'string', op: 'equals', val: 'lost' }] },
  };
  return pack;
}

const plan = (over: Partial<ImportPlan>): ImportPlan => ({
  dryRun: true,
  applied: false,
  onConflict: 'refuse',
  ok: true,
  datasets: [],
  items: [],
  planHash: 'aaaaaaaaaaaa',
  warnings: 0,
  counts: { create: 0, replace: 0, unchanged: 0, skip: 0, deferred: 0, conflict: 0, invalid: 0 },
  ...over,
});

beforeEach(() => {
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:pack'), revokeObjectURL: vi.fn() }));
});

afterEach(async () => {
  vi.unstubAllGlobals();
  if (i18n.language !== 'en') await i18n.changeLanguage('en');
});

describe('R201 pack rules (pure)', () => {
  it('reads a pack file, and names what is not one', () => {
    expect(readPackText('{"packVersion":1,"workspace":"Acme demo","exportedAt":"2026-10-19T09:00:00Z"}')).toMatchObject(
      {
        ok: true,
        packVersion: 1,
        workspace: 'Acme demo',
        exportedAt: '2026-10-19T09:00:00Z',
      },
    );
    expect(readPackText('not json')).toEqual({ ok: false, reason: 'not_json' });
    expect(readPackText('[1,2]')).toEqual({ ok: false, reason: 'not_pack' });
    expect(readPackText('{"queries":[]}')).toEqual({ ok: false, reason: 'not_pack' });
    expect(readPackText('{"packVersion":"1"}')).toEqual({ ok: false, reason: 'not_pack' });
    expect(readPackText('{"packVersion":1}', PACK_MAX_BYTES + 1)).toEqual({ ok: false, reason: 'too_large' });
  });

  it('names the exported file safely, any script kept', () => {
    const day = new Date('2026-10-19T12:00:00Z');
    expect(packFileName('Acme demo', day)).toBe('Acme demo-definitions-2026-10-19.json');
    expect(packFileName('Báo cáo / tuần: 3?', day)).toBe('Báo cáo _ tuần_ 3_-definitions-2026-10-19.json');
    expect(packFileName('   ', day)).toBe('workspace-definitions-2026-10-19.json');
  });

  it('finds where two column lists first part', () => {
    const a = { name: 'id', dtype: 'integer' };
    const b = { name: 'team', dtype: 'string' };
    expect(columnDifference([a, b], [a, b])).toBeNull();
    expect(columnDifference([a, b], [b, a])).toEqual({ position: 1, expected: a, found: b });
    expect(columnDifference([a, b], [a, { ...b, dtype: 'integer' }])).toMatchObject({ position: 2 });
    expect(columnDifference([a, b], [a])).toEqual({ position: 2, expected: b, found: undefined });
    expect(columnDifference([a], [a, b])).toEqual({ position: 2, expected: undefined, found: b });
  });

  it('offers Import only for an ok plan that writes something', () => {
    const counts = { create: 2, replace: 1, unchanged: 3, skip: 0, deferred: 0, conflict: 0, invalid: 0 };
    expect(writeCount(plan({ counts }))).toBe(3);
    expect(canImport(plan({ counts }))).toBe(true);
    expect(canImport(plan({ counts, ok: false }))).toBe(false);
    const none = { ...counts, create: 0, replace: 0 };
    expect(canImport(plan({ counts: none }))).toBe(false);
    const one = [{ kind: 'query' as const, name: 'q', action: 'unchanged' as const }];
    expect(nothingToImport(plan({ counts: none, items: one }))).toBe(true);
    expect(nothingToImport(plan({ counts: none }))).toBe(false); // an empty pack says so instead
    expect(nothingToImport(plan({ counts: none, ok: false }))).toBe(false);
  });
});

describe('R201 contract (C): MSW answers the YAML, the codes are in the chain', () => {
  it('the export and both plans validate; an extra field does not', async () => {
    const pack = await definitionsApi.export(MOCK_WORKSPACE.id);
    expect(validateResponse('exportDefinitions', pack)).toEqual({ ok: true });
    expect(validateResponse('exportDefinitions', { ...pack, extra: 1 }).ok).toBe(false);
    const dry = await definitionsApi.importPack(MOCK_WORKSPACE.id, changedPack(), {
      dryRun: true,
      onConflict: 'replace',
    });
    expect(validateResponse('importDefinitions', dry)).toEqual({ ok: true });
    const blocked = await definitionsApi.importPack(CLEAN.id, pack, { dryRun: true, onConflict: 'refuse' });
    expect(blocked.ok).toBe(false);
    expect(validateResponse('importDefinitions', blocked)).toEqual({ ok: true });
    const applied = await definitionsApi.importPack(MOCK_WORKSPACE.id, changedPack(), {
      dryRun: false,
      onConflict: 'replace',
    });
    expect(applied.applied).toBe(true);
    expect(validateResponse('importDefinitions', applied)).toEqual({ ok: true });
    expect(validateResponse('importDefinitions', { ...applied, counts: { ...applied.counts, extra: 1 } }).ok).toBe(
      false,
    );
  });

  it('the three pack codes are known to the shared error union; the caps come from values.yaml', () => {
    expect([ERROR_CODES.PACK_UNRESOLVED, ERROR_CODES.PACK_INVALID, ERROR_CODES.PACK_REFUSED]).toEqual([
      'pack_unresolved',
      'pack_invalid',
      'pack_refused',
    ]);
    expect(isApiError({ code: 'pack_refused', plan: {} })).toBe(true);
    expect(isApiError({ code: 'pack_invalid', reason: 'version', problems: [] })).toBe(true);
    expect(isApiError({ code: 'pack_unresolved', problems: [] })).toBe(true);
    expect(PACK).toEqual({ VERSION: 1, MAX_BYTES: 10 * 1024 * 1024, MAX_NOUNS: 1000 });
    expect(PACK_MAX_BYTES).toBe(PACK.MAX_BYTES);
  });
});

describe('R201 the card actions', () => {
  it('a main workspace offers Export and Import', async () => {
    serveWorkspaces(MOCK_WORKSPACE, MOCK_SAVED_WORKSPACE);
    renderPage();
    const main = await openMenu(MOCK_WORKSPACE.id);
    expect(main).toEqual(expect.arrayContaining(['Export definitions', 'Import definitions…']));
  });

  it('a saved workspace offers Export only (it is read-only)', async () => {
    serveWorkspaces(MOCK_WORKSPACE, MOCK_SAVED_WORKSPACE);
    renderPage();
    const saved = await openMenu(MOCK_SAVED_WORKSPACE.id);
    expect(saved).toContain('Export definitions');
    expect(saved).not.toContain('Import definitions…');
  });

  it('Export downloads <name>-definitions-<date>.json and says what it holds', async () => {
    serveWorkspaces(MOCK_WORKSPACE);
    const clicks: string[] = [];
    const orig = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
      clicks.push(this.download);
    };
    try {
      renderPage();
      await openMenu(MOCK_WORKSPACE.id);
      fireEvent.click(await screen.findByText('Export definitions'));
      await screen.findByText('Exported 1 query, 1 dashboard and 1 workflow.');
      expect(clicks).toHaveLength(1);
      expect(clicks[0]).toMatch(/^Marketing-definitions-\d{4}-\d{2}-\d{2}\.json$/);
    } finally {
      HTMLAnchorElement.prototype.click = orig;
    }
  });

  it('a refused export lists what to fix', async () => {
    serveWorkspaces(MOCK_WORKSPACE);
    server.use(
      http.get('*/workspaces/:id/definitions', () =>
        HttpResponse.json(
          {
            code: 'pack_unresolved',
            problems: [
              { kind: 'dashboard', name: 'Weekly', reason: 'query_missing', ref: 'Calls by agent' },
              { kind: 'workflow', name: 'Calls rollup', reason: 'source_missing' },
            ],
          },
          { status: 409 },
        ),
      ),
    );
    renderPage();
    await openMenu(MOCK_WORKSPACE.id);
    fireEvent.click(await screen.findByText('Export definitions'));
    const list = await el('[data-component="PackUnresolvedList"]');
    expect(list.textContent).toContain('Dashboard Weekly › widget “Calls by agent”: its query was deleted.');
    expect(list.textContent).toContain('Workflow Calls rollup: one of its sources was deleted.');
    expect(screen.getByText('Fix these before exporting Marketing')).toBeInTheDocument();
  });
});

describe('R201 the import modal', () => {
  it('a file that is not a pack says so and checks nothing', async () => {
    serveWorkspaces(MOCK_WORKSPACE);
    const posts: string[] = [];
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'POST') posts.push(request.url);
    });
    renderPage();
    await openImport(MOCK_WORKSPACE);
    await chooseFile('{"hello": 1}');
    await screen.findByText('This file is not a definitions pack.');
    expect(posts.filter((u) => u.includes('/definitions/import'))).toHaveLength(0);
    server.events.removeAllListeners('request:start');
  });

  it('into a clean workspace: missing datasets block the import with the list', async () => {
    serveWorkspaces(MOCK_WORKSPACE, CLEAN);
    renderPage();
    await openImport(CLEAN);
    await chooseFile(JSON.stringify(mockPackOf(MOCK_WORKSPACE.name)), 'marketing.json');
    const ds = await el('[data-component="PackDatasetLine"][data-status="missing"]');
    expect(ds.textContent).toContain('q1_pipeline_Deals');
    expect(ds.textContent).toContain('not in this workspace');
    expect(screen.getByText(/marketing\.json · from “Marketing” · 2026-10-19/)).toBeInTheDocument();
    const q = planRow('query', MOCK_QUERY.name) as HTMLElement;
    expect(q.textContent).toContain("Can't import");
    expect(q.textContent).toContain('needs dataset q1_pipeline_Deals, which is not in this workspace');
    expect((planRow('dashboard', 'Weekly report') as HTMLElement).textContent).toContain(`needs ${MOCK_QUERY.name}`);
    expect(importButton()).toBeDisabled();
    expect(document.querySelector('[data-component="PackBlocked"]')).not.toBeNull();
  });

  it('a same-named dataset with its columns in another order is refused at the first difference', async () => {
    serveWorkspaces(MOCK_WORKSPACE);
    renderPage();
    await openImport(MOCK_WORKSPACE);
    const pack = mockPackOf(MOCK_WORKSPACE.name);
    const cols = pack.datasets[0].columns;
    [cols[0], cols[1]] = [cols[1], cols[0]];
    await chooseFile(JSON.stringify(pack));
    const ds = await el('[data-component="PackDatasetLine"][data-status="columns_differ"]');
    expect(ds.textContent).toContain(
      'columns differ — column 1 is amount (integer) in the pack, deal_id (string) here',
    );
    expect(planRow('query', MOCK_QUERY.name)?.textContent).toContain(
      'dataset q1_pipeline_Deals has different columns here',
    );
    expect(importButton()).toBeDisabled();
  });

  it('the same pack again: nothing to import, no Import button', async () => {
    serveWorkspaces(MOCK_WORKSPACE);
    renderPage();
    await openImport(MOCK_WORKSPACE);
    await chooseFile(JSON.stringify(mockPackOf(MOCK_WORKSPACE.name)));
    await el('[data-component="PackNothingToImport"]');
    expect((planRow('query', MOCK_QUERY.name) as HTMLElement).textContent).toContain('Unchanged');
    expect(screen.getByText('3 unchanged')).toBeInTheDocument();
    expect(importButton()).toBeNull();
  });

  it('a conflict stops; Replace re-checks, warns, imports, and the lists read again', async () => {
    serveWorkspaces(MOCK_WORKSPACE);
    let listCalls = 0;
    server.use(
      http.get('*/workspaces/:id/queries', () => {
        listCalls += 1;
        return HttpResponse.json(
          listCalls === 1 ? [MOCK_QUERY] : [MOCK_QUERY, { ...MOCK_QUERY, id: 'qr_00000002', name: 'B' }],
        );
      }),
    );
    const imports: URL[] = [];
    server.events.on('request:start', ({ request }) => {
      if (request.url.includes('/definitions/import')) imports.push(new URL(request.url));
    });
    renderPage(<QueriesCount workspaceId={MOCK_WORKSPACE.id} />);
    await waitFor(() => expect(document.querySelector('[data-component="QueriesCount"]')?.textContent).toBe('1'));

    await openImport(MOCK_WORKSPACE);
    await chooseFile(JSON.stringify(changedPack()));
    await waitFor(() => expect(planRow('query', MOCK_QUERY.name)?.textContent).toContain('Conflict'));
    expect(planRow('query', MOCK_QUERY.name)?.textContent).toContain('already here with a different definition');
    expect(importButton()).toBeDisabled();
    expect(imports.at(-1)?.searchParams.get('dryRun')).toBe('true');
    expect(imports.at(-1)?.searchParams.get('onConflict')).toBe('refuse');

    fireEvent.click(screen.getByText('Replace it'));
    await waitFor(() => expect(planRow('query', MOCK_QUERY.name)?.textContent).toContain('Replace'));
    expect(imports.at(-1)?.searchParams.get('onConflict')).toBe('replace');
    expect(document.querySelector('[data-component="PackReplaceWarning"]')?.textContent).toContain(
      "Replacing saves the pack's definition as a new version",
    );
    expect(importButton()).toBeEnabled();
    expect(importButton()?.textContent).toBe('Import 1 into Marketing');

    fireEvent.click(importButton() as HTMLButtonElement);
    // BA C7 — zero counts are left out.
    await screen.findByText('Imported into Marketing: 1 replaced, 2 unchanged.');
    // BA C10 — the apply named the dry run it follows.
    expect(imports.at(-1)?.searchParams.get('expectedPlan')).toBe(
      mockPlan(MOCK_WORKSPACE.id, changedPack(), 'replace', true).planHash,
    );
    expect(imports.at(-1)?.searchParams.get('dryRun')).toBe('false');
    // The cached list (fresh for 60 s under the app's defaults) read again.
    await waitFor(() => expect(document.querySelector('[data-component="QueriesCount"]')?.textContent).toBe('2'));
    server.events.removeAllListeners('request:start');
  });

  it('Keep mine skips the conflict and leaves nothing to import', async () => {
    serveWorkspaces(MOCK_WORKSPACE);
    renderPage();
    await openImport(MOCK_WORKSPACE);
    await chooseFile(JSON.stringify(changedPack()));
    await waitFor(() => expect(planRow('query', MOCK_QUERY.name)?.textContent).toContain('Conflict'));
    fireEvent.click(screen.getByText('Keep mine'));
    await waitFor(() => expect(planRow('query', MOCK_QUERY.name)?.textContent).toContain('Keep mine'));
    const nothing = await el('[data-component="PackNothingToImport"]');
    expect(nothing.textContent).toContain('the rows marked Keep mine stay as they are here');
  });

  it('a 409 on Import shows the server’s new plan and says the workspace changed', async () => {
    serveWorkspaces(MOCK_WORKSPACE);
    const refused = plan({
      dryRun: false,
      ok: false,
      onConflict: 'replace',
      items: [
        {
          kind: 'query',
          name: MOCK_QUERY.name,
          action: 'invalid',
          reason: 'check_failed',
          detail: 'unknown_column: col 9',
        },
      ],
      counts: { create: 0, replace: 0, unchanged: 0, skip: 0, deferred: 0, conflict: 0, invalid: 1 },
    });
    server.use(
      http.post('*/workspaces/:id/definitions/import', ({ request }) =>
        new URL(request.url).searchParams.get('dryRun') === 'true'
          ? HttpResponse.json(
              plan({
                onConflict: 'replace',
                items: [{ kind: 'query', name: MOCK_QUERY.name, action: 'replace', id: MOCK_QUERY.id }],
                counts: { create: 0, replace: 1, unchanged: 0, skip: 0, deferred: 0, conflict: 0, invalid: 0 },
              }),
            )
          : HttpResponse.json({ code: 'pack_refused', reason: 'plan_changed', plan: refused }, { status: 409 }),
      ),
    );
    renderPage();
    await openImport(MOCK_WORKSPACE);
    await chooseFile(JSON.stringify(changedPack()));
    await waitFor(() => expect(importButton()).toBeEnabled());
    fireEvent.click(importButton() as HTMLButtonElement);
    await el('[data-component="PackRefusedOnApply"]');
    expect(screen.getByText('This workspace changed since the check. Review the new plan.')).toBeInTheDocument();
    expect(planRow('query', MOCK_QUERY.name)?.textContent).toContain('would not save: unknown_column: col 9');
    expect(importButton()).toBeDisabled();
    expect(document.querySelector('[data-component="ImportDefinitionsModal"]')).not.toBeNull();
  });

  it('Keep mine: a reader of a kept, differing query carries the warning and the count (BA-C1)', async () => {
    serveWorkspaces(MOCK_WORKSPACE);
    renderPage();
    await openImport(MOCK_WORKSPACE);
    const pack = changedPack();
    pack.dashboards[0] = { ...pack.dashboards[0], name: 'Weekly copy', slug: 'weekly-copy' };
    await chooseFile(JSON.stringify(pack));
    await waitFor(() => expect(planRow('query', MOCK_QUERY.name)?.textContent).toContain('Conflict'));
    fireEvent.click(screen.getByText('Keep mine'));
    await waitFor(() => expect(planRow('query', MOCK_QUERY.name)?.textContent).toContain('Keep mine'));
    const row = planRow('dashboard', 'Weekly copy') as HTMLElement;
    expect(row.textContent).toContain('New');
    expect(row.querySelector('[data-component="PlanBindsWarning"]')?.textContent).toBe(
      `uses the query ${MOCK_QUERY.name} here, which differs from the pack — numbers may differ`,
    );
    expect(screen.getByText(/2 with a warning/)).toBeInTheDocument();
    expect(importButton()?.textContent).toBe('Import 1 into Marketing');
  });

  it('a dataset a workflow of the pack publishes defers its readers; the rest imports (BA-C2)', async () => {
    serveWorkspaces(MOCK_WORKSPACE, CLEAN);
    renderPage();
    await openImport(MOCK_WORKSPACE);
    const pack = mockPackOf(MOCK_WORKSPACE.name);
    const wf = pack.workflows[0].name;
    pack.datasets.push(
      { name: 'rollup_out', columns: [{ name: 'stage', dtype: 'string' }], publishedBy: wf },
      { name: 'zz_spare', columns: [{ name: 'x', dtype: 'string' }] },
    );
    pack.queries.push(
      { name: 'Lost deals', dataset: pack.queries[0].dataset, definition: { filters: [], advanced: [] } },
      { name: 'Rollup view', dataset: 'rollup_out', definition: { filters: [], advanced: [] } },
    );
    pack.dashboards.push({
      name: 'Rollup board',
      slug: 'rollup-board',
      definition: {
        widgets: [{ id: 'wdg_0000000c', query: 'Rollup view', title: 'R', chartType: 'stat', agg: 'count', span: 1 }],
      },
    });
    await chooseFile(JSON.stringify(pack));
    const ds = await el('[data-component="PackDatasetLine"][data-status="awaits_publish"]');
    expect(ds.textContent).toContain(`published by workflow ${wf}: run and publish it, then import this pack again`);
    expect(document.querySelector('[data-component="PackDatasetLine"][data-status="unused"]')?.textContent).toContain(
      'zz_spare not used by the pack',
    );
    expect(planRow('query', 'Rollup view')?.textContent).toContain('Deferred');
    expect(planRow('query', 'Rollup view')?.textContent).toContain(
      `needs rollup_out, which workflow ${wf} publishes — run and publish it, then import this pack again`,
    );
    expect(planRow('dashboard', 'Rollup board')?.textContent).toContain('needs Rollup view, which is not imported now');
    expect(importButton()?.textContent).toBe('Import 1 into Marketing');
    fireEvent.click(importButton() as HTMLButtonElement);
    await screen.findByText('Imported into Marketing: 1 new, 3 unchanged, 2 deferred.');
  });

  it('a blocked plan keeps a disabled "Import into …" and names the next step per cause (BA C5)', async () => {
    serveWorkspaces(MOCK_WORKSPACE, CLEAN);
    renderPage();
    await openImport(CLEAN);
    await chooseFile(JSON.stringify(mockPackOf(MOCK_WORKSPACE.name)));
    await waitFor(() => expect(importButton()).not.toBeNull());
    expect(importButton()?.textContent).toBe('Import into Acme copy');
    expect(importButton()).toBeDisabled();
    expect(document.querySelector('[data-component="PackNextStep"][data-cause="datasets"]')?.textContent).toBe(
      "load q1_pipeline_Deals into Acme copy first (with the pack's columns)",
    );
  });

  it('an empty pack says so once — no counts, no table, no button (BA C7)', async () => {
    serveWorkspaces(MOCK_WORKSPACE);
    renderPage();
    await openImport(MOCK_WORKSPACE);
    await chooseFile(
      JSON.stringify({ ...mockPackOf('Marketing'), datasets: [], queries: [], workflows: [], dashboards: [] }),
    );
    await el('[data-component="PackEmpty"]');
    expect(screen.getAllByText('This pack holds no definitions.')).toHaveLength(1);
    expect(document.querySelector('[data-component="PackPlanSummary"]')).toBeNull();
    expect(document.querySelector('[data-component="PackNothingToImport"]')).toBeNull();
    expect(importButton()).toBeNull();
  });

  it('a shape error names its path (BA-C3)', async () => {
    serveWorkspaces(MOCK_WORKSPACE);
    server.use(
      http.post('*/workspaces/:id/definitions/import', () =>
        HttpResponse.json(
          {
            code: 'pack_invalid',
            reason: 'shape',
            problems: [{ path: 'queries/0/dataset', detail: 'Field required' }],
          },
          { status: 422 },
        ),
      ),
    );
    renderPage();
    await openImport(MOCK_WORKSPACE);
    await chooseFile(JSON.stringify(mockPackOf('Marketing')));
    const alert = await el('[data-component="PackInvalidAlert"]');
    expect(alert.textContent).toContain("The pack's shape is wrong at queries/0/dataset: Field required");
  });

  it('a pack from a newer version is named, with no plan', async () => {
    serveWorkspaces(MOCK_WORKSPACE);
    renderPage();
    await openImport(MOCK_WORKSPACE);
    await chooseFile(JSON.stringify({ ...mockPackOf('Marketing'), packVersion: 2 }));
    const alert = await el('[data-component="PackInvalidAlert"]');
    expect(alert.textContent).toContain(
      'This pack was made by a newer version (pack version 2); this one reads version 1.',
    );
    expect(document.querySelector('[data-component="PackPlan"]')).toBeNull();
  });

  it('pack_invalid lines: a reference outside the pack, a duplicate, a loop', async () => {
    serveWorkspaces(MOCK_WORKSPACE);
    server.use(
      http.post('*/workspaces/:id/definitions/import', () =>
        HttpResponse.json(
          {
            code: 'pack_invalid',
            reason: 'reference',
            problems: [
              { kind: 'dashboard', name: 'Weekly', ref: 'North calls', refKind: 'query' },
              { kind: 'query', name: 'Team list', ref: 'teams_demo', refKind: 'dataset' },
            ],
          },
          { status: 422 },
        ),
      ),
    );
    renderPage();
    await openImport(MOCK_WORKSPACE);
    await chooseFile(JSON.stringify(mockPackOf('Marketing')));
    const alert = await el('[data-component="PackInvalidAlert"]');
    expect(alert.textContent).toContain('Dashboard Weekly names query North calls, which is not in the pack.');
    expect(alert.textContent).toContain(
      "Query Team list names dataset teams_demo, which is not in the pack's datasets.",
    );
  });

  it('VI copy', async () => {
    await i18n.changeLanguage('vi');
    serveWorkspaces(MOCK_WORKSPACE, CLEAN);
    renderPage();
    const menu = await openMenu(CLEAN.id);
    expect(menu).toEqual(expect.arrayContaining(['Xuất định nghĩa', 'Nhập định nghĩa…']));
    fireEvent.click(await screen.findByText('Nhập định nghĩa…'));
    await screen.findByText('Nhập định nghĩa vào Acme copy');
    await chooseFile(JSON.stringify(mockPackOf('Marketing')));
    const ds = await el('[data-component="PackDatasetLine"][data-status="missing"]');
    expect(ds.textContent).toContain('không có trong không gian làm việc này');
    expect(planRow('query', MOCK_QUERY.name)?.textContent).toContain('Không nhập được');
    expect(screen.getByText('Không nhập nếu có xung đột')).toBeInTheDocument();
    expect(screen.getByText('Thay thế')).toBeInTheDocument();
    expect(screen.getByText('Nhập vào Acme copy')).toBeInTheDocument();
  });
});
