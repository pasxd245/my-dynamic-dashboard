// R199 (item 4.3) — shared filters in the builder: the `values` control.
//
// Design criterion 6 (a values control reaches exactly its targets; a target
// lacking the column is skipped with a badge; `(blank)` survives the URL as
// `~blank`), the URL round trip, the BA pass-1 folds — the one raw URL writer
// (BA-C2: a `p.` change leaves `f.` byte-identical; `%7Eblank` ≠ `~blank`), the
// parsing edges (BA-C5), a stale `f.` key dropped on load (BA-C1) — the share
// link, the export request, the editor, and MSW contract parity.

import { AntdConfig } from '@mdd/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { dashboardsApi } from '@/api/dashboardsApi';
import { queriesApi } from '@/api/queriesApi';
import { DashboardDetailPage } from '@/features/dashboard/DashboardDetailPage';
import { controlReach, shareUrl } from '@/features/dashboard/DashboardParams';
import { exportRequest } from '@/features/dashboard/exportWidget';
import {
  encodeSelection,
  parseFilterSelections,
  rowsFilterSuffix,
  sharedItemsFor,
  staleFilterKeys,
  withParamsRaw,
  withSelectionRaw,
  withoutStaleRaw,
  withoutViewerRaw,
} from '@/features/dashboard/sharedFilters';
import type { ParamControl, ValuesControl, Widget } from '@/features/dashboard/types';
import { widgetsToDefinition } from '@/features/dashboard/wire';
import type { Query } from '@/features/data-management/queries/types';
import { MOCK_DASHBOARD, MOCK_QUERY, MOCK_WORKSPACE } from '@/mocks/fixtures';
import { server } from '@/mocks/server';

const CTL = 'ctl_00000199';
const STAGE: ValuesControl = { id: CTL, kind: 'values', label: 'Stage', column: 'stage', targets: 'all' };
const AS_OF: ParamControl = { id: 'ctl_000000a5', kind: 'param', label: 'As of', param: 'as_of', targets: 'all' };

const W_STAGE = 'wdg_00000001';
const W_NOSTAGE = 'wdg_00000002';
const W_OTHER = 'wdg_00000003';

const widget = (id: string, queryId: string, chartType: Widget['chartType'] = 'table'): Widget => ({
  id,
  queryId,
  title: id,
  chartType,
  agg: 'count',
  span: 1,
});

// A query whose result has no `stage` (its resolved columns say so).
const NO_STAGE: Query = {
  ...MOCK_QUERY,
  id: 'qr_00000299',
  resolvedColumns: [
    { name: 'deal_id', dtype: 'string' },
    { name: 'amount', dtype: 'integer' },
  ],
};

describe('R199 URL — the raw f.* spelling (mirrors the server)', () => {
  it('parses split-before-decode, raw ~blank, empty tokens, last-wins and cleared (BA-C2/C5)', () => {
    expect(parseFilterSelections(`?f.${CTL}=North,South`)).toEqual({ [CTL]: ['North', 'South'] });
    expect(parseFilterSelections(`?f.${CTL}=A%2CB,C`)).toEqual({ [CTL]: ['A,B', 'C'] });
    // The raw token is blank; `%7Eblank` is the literal string "~blank".
    expect(parseFilterSelections(`?f.${CTL}=~blank,%7Eblank`)).toEqual({ [CTL]: [null, '~blank'] });
    expect(parseFilterSelections(`?f.${CTL}=a+b,%20x`)).toEqual({ [CTL]: ['a+b', ' x'] });
    expect(parseFilterSelections(`?f.${CTL}=North,,South,`)).toEqual({ [CTL]: ['North', 'South'] });
    expect(parseFilterSelections(`?f.${CTL}=North&f.${CTL}=South`)).toEqual({ [CTL]: ['South'] });
    expect(parseFilterSelections(`?f.${CTL}=`)).toEqual({ [CTL]: [] });
    expect(parseFilterSelections('?p.as_of=2026-10-01&f.=x')).toEqual({});
    // CR-2 — a malformed token stays raw, the server's rule too.
    expect(parseFilterSelections(`?f.${CTL}=a%2Cb%,ok%2`)).toEqual({ [CTL]: ['a%2Cb%', 'ok%2'] });
    expect(parseFilterSelections(`?f.${CTL}=%C3,%C3%A0`)).toEqual({ [CTL]: ['%C3', 'à'] });
  });

  it('encodes so every value round-trips — a comma, a literal ~blank, a plus, (blank)', () => {
    const values = ['Ops, East', '~blank', 'a+b', null, 'Hà Nội'];
    const raw = encodeSelection(values);
    expect(raw).toBe('Ops%2C%20East,%7Eblank,a%2Bb,~blank,H%C3%A0%20N%E1%BB%99i');
    expect(parseFilterSelections(`?f.${CTL}=${raw}`)).toEqual({ [CTL]: values });
  });

  it('one raw writer: a p. change leaves f. byte-identical; Reset drops both; others kept (BA-C2)', () => {
    const start = `?x=1&f.${CTL}=North,South,~blank&p.as_of=2026-10-01`;
    const next = withParamsRaw(start, { as_of: '2026-10-02' });
    expect(next).toBe(`?x=1&f.${CTL}=North,South,~blank&p.as_of=2026-10-02`);
    expect(withParamsRaw(next, { as_of: '' })).toBe(`?x=1&f.${CTL}=North,South,~blank`);
    expect(withoutViewerRaw(next)).toBe('?x=1');
    // A selection: `[]` = cleared (`f.<id>=`), `undefined` drops the key (saved applies).
    expect(withSelectionRaw('?x=1', CTL, ['Ops, East', null])).toBe(`?x=1&f.${CTL}=Ops%2C%20East,~blank`);
    expect(withSelectionRaw(`?f.${CTL}=North`, CTL, [])).toBe(`?f.${CTL}=`);
    expect(withSelectionRaw(`?f.${CTL}=North`, CTL, undefined)).toBe('');
  });

  it('drops an f. key that names no values control of the dashboard (BA-C1)', () => {
    const search = `?f.ctl_0000dead=South&f.${CTL}=North&p.as_of=2026-10-01`;
    expect(staleFilterKeys(search, [STAGE, AS_OF])).toEqual(['ctl_0000dead']);
    expect(withoutStaleRaw(search, [STAGE, AS_OF])).toBe(`?f.${CTL}=North&p.as_of=2026-10-01`);
    // A param control's id is not a values control.
    expect(staleFilterKeys(`?f.${AS_OF.id}=x`, [STAGE, AS_OF])).toEqual([AS_OF.id]);
    expect(withoutStaleRaw('?p.a=1', [STAGE])).toBe('?p.a=1');
  });
});

describe('R199 pure rules', () => {
  it('reaches a targeted widget whose result has the column; skips one that lacks it; unknown → neither', () => {
    const w = widget(W_STAGE, MOCK_QUERY.id);
    expect(controlReach([STAGE], w, MOCK_QUERY, ['deal_id', 'stage']).reached).toEqual([STAGE]);
    expect(controlReach([STAGE], w, MOCK_QUERY, ['deal_id']).skipped).toEqual([
      { control: STAGE, reason: 'stage', count: 1 },
    ]);
    expect(controlReach([STAGE], w, MOCK_QUERY, undefined)).toEqual({ reached: [], skipped: [] });
    // Not targeted → nothing; a note → nothing.
    expect(controlReach([{ ...STAGE, targets: [W_OTHER] }], w, MOCK_QUERY, ['stage'])).toEqual({
      reached: [],
      skipped: [],
    });
    expect(controlReach([STAGE], { ...w, chartType: 'note', queryId: undefined }, undefined, [])).toEqual({
      reached: [],
      skipped: [],
    });
  });

  it('routes a viewer selection only to the widgets its control targets, as a control item', () => {
    const some = { ...STAGE, targets: [W_STAGE] };
    expect(sharedItemsFor([some], { [CTL]: ['won', null] }, W_STAGE)).toEqual([
      { column: 'stage', values: ['won', null], control: CTL },
    ]);
    expect(sharedItemsFor([some], { [CTL]: ['won'] }, W_OTHER)).toEqual([]);
    // No viewer selection → nothing sent: the saved one is the server's to apply.
    expect(sharedItemsFor([{ ...STAGE, saved: ['won'] }], {}, W_STAGE)).toEqual([]);
    expect(rowsFilterSuffix([{ column: 'stage', values: ['won', null], control: CTL }])).toBe(`&f.${CTL}=won,~blank`);
    expect(rowsFilterSuffix([{ column: 'stage', values: ['won'] }])).toBe('');
  });

  it('pins every values control in the share link, keeps viewer f. bytes, drops a stale key', () => {
    const saved: ValuesControl = { ...STAGE, id: 'ctl_000000b1', column: 'owner', saved: ['Ann', null] };
    const none: ValuesControl = { ...STAGE, id: 'ctl_000000b2', column: 'region' };
    const url = shareUrl(
      `http://x/dashboards/ws/d?f.${CTL}=North,~blank&f.ctl_0000dead=x`,
      [STAGE, saved, none, AS_OF],
      {},
      { as_of: '2026-10-11' },
      { [CTL]: ['North', null] },
    );
    expect(url).toBe(
      `http://x/dashboards/ws/d?f.${CTL}=North,~blank&f.ctl_000000b1=Ann,~blank&f.ctl_000000b2=&p.as_of=2026-10-11`,
    );
  });

  it('exports with the widget filters first, then the shared selections (D7)', () => {
    const body = exportRequest(
      widget(W_STAGE, MOCK_QUERY.id),
      [{ column: 'amount', values: ['10'] }],
      'xlsx',
      { dashboard: { id: MOCK_DASHBOARD.id, widgetId: W_STAGE } },
      [{ column: 'stage', values: ['won'], control: CTL }],
    );
    expect(body.filters).toEqual([
      { column: 'amount', values: ['10'] },
      { column: 'stage', values: ['won'], control: CTL },
    ]);
  });

  it('keeps a values control through a widget removal like the others', () => {
    const w = widget(W_STAGE, MOCK_QUERY.id);
    const some: ValuesControl = { ...STAGE, targets: [W_STAGE, 'wdg_gone0000'] };
    expect(widgetsToDefinition([w], [some])).toEqual({ widgets: [w], controls: [{ ...some, targets: [W_STAGE] }] });
  });
});

describe('R199 contract parity (MSW validates against the contracts)', () => {
  it('echoes a values control beside a param and a date_range control', async () => {
    const definition = widgetsToDefinition(
      [widget(W_STAGE, MOCK_QUERY.id)],
      [
        { ...STAGE, saved: ['won', null] },
        AS_OF,
        { id: 'ctl_000000c1', kind: 'date_range', label: 'P', from: 'a', to: 'b', targets: 'all' },
      ],
    );
    const echoed = await dashboardsApi.update(MOCK_DASHBOARD.id, { name: 'W', slug: 'w', definition });
    expect(echoed.definition.controls).toEqual(definition.controls);
  });

  it('reads a column’s options from GET /queries/{id}/values', async () => {
    const got = await queriesApi.values(MOCK_QUERY.id, 'stage');
    expect(got.column).toBe('stage');
    expect(got.partial).toBe(false);
    expect(got.values.length).toBeGreaterThan(0);
    await expect(queriesApi.values(MOCK_QUERY.id, 'nope')).rejects.toMatchObject({
      body: { code: 'unknown_column', column: 'nope' },
    });
  });
});

// --- the page ----------------------------------------------------------------------

let seenSearch = '';
function LocationProbe() {
  seenSearch = useLocation().search;
  return null;
}

function wrap(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AntdConfig>
        <App>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route
                path="/dashboards/:workspaceId/:slug"
                element={
                  <>
                    <DashboardDetailPage />
                    <LocationProbe />
                  </>
                }
              />
            </Routes>
          </MemoryRouter>
        </App>
      </AntdConfig>
    </QueryClientProvider>,
  );
}

function serve(controls: (ValuesControl | ParamControl)[], targets: ValuesControl['targets'] = 'all') {
  const reads: string[] = [];
  const posts: unknown[] = [];
  const valuesAsked: URL[] = [];
  const widgets = [widget(W_STAGE, MOCK_QUERY.id), widget(W_NOSTAGE, NO_STAGE.id), widget(W_OTHER, MOCK_QUERY.id)];
  const ctls = controls.map((c) => (c.kind === 'values' ? { ...c, targets } : c));
  const queryOf = (id: unknown) => (id === NO_STAGE.id ? NO_STAGE : MOCK_QUERY);
  server.use(
    http.get('*/workspaces/:id/dashboards', () =>
      HttpResponse.json([{ ...MOCK_DASHBOARD, definition: { widgets, controls: ctls } }]),
    ),
    http.get('*/workspaces/:id/queries', () => HttpResponse.json([MOCK_QUERY, NO_STAGE])),
    http.get('*/queries/:id', ({ params }) => HttpResponse.json(queryOf(params.id))),
    http.get('*/queries/:id/values', ({ request }) => {
      valuesAsked.push(new URL(request.url));
      return HttpResponse.json({ column: 'stage', values: [null, 'lost', 'won'], partial: true });
    }),
    http.get('*/queries/:id/rows', ({ request }) => {
      reads.push(request.url);
      return HttpResponse.json({ rows: [], page: 1, pageSize: 0, total: 0 });
    }),
    http.put('*/dashboards/:id', async ({ request }) => {
      const body = (await request.json()) as { name: string; slug: string; definition: unknown };
      posts.push(body);
      return HttpResponse.json({ ...MOCK_DASHBOARD, ...body });
    }),
  );
  return { reads, posts, valuesAsked };
}

const rawF = (url: string) => /[?&](f\.[^&]*)/.exec(url)?.[1];

describe('R199 dashboard bar — criterion 6 and the URL round trip', () => {
  it('sends the URL selection raw to the targeted widget, badges the one lacking the column, outlines the control', async () => {
    const { reads, valuesAsked } = serve([STAGE], [W_STAGE, W_NOSTAGE]);
    wrap(`/dashboards/${MOCK_WORKSPACE.id}/${MOCK_DASHBOARD.slug}?f.${CTL}=won,~blank`);
    await waitFor(() => expect(document.querySelector('[data-component="SharedFilterControl"]')).not.toBeNull());
    const ctl = document.querySelector('[data-component="SharedFilterControl"]');
    expect(ctl?.getAttribute('data-viewer')).toBe('true');
    expect(document.querySelector('[data-component="ParamResetToSaved"]')).not.toBeNull();
    // The targeted widget's read carries the selection byte-for-byte; the
    // untargeted one (W_OTHER) carries none.
    await waitFor(() => expect(reads.some((u) => u.includes(`widget=${W_STAGE}`))).toBe(true));
    expect(rawF(reads.find((u) => u.includes(`widget=${W_STAGE}`)) as string)).toBe(`f.${CTL}=won,~blank`);
    await waitFor(() => expect(reads.some((u) => u.includes(`widget=${W_OTHER}`))).toBe(true));
    expect(rawF(reads.find((u) => u.includes(`widget=${W_OTHER}`)) as string)).toBeUndefined();
    // W_NOSTAGE is targeted: it is sent the selection (the server skips it) and badged skipped.
    await waitFor(() => expect(document.querySelectorAll('[data-component="ReachSkippedTag"]').length).toBe(1));
    expect(document.querySelectorAll('[data-component="ReachTag"]').length).toBe(1);
    expect(document.querySelector('[data-component="ReachSkippedTag"]')?.getAttribute('aria-label')).toBe(
      "Stage skipped — This widget's result has no column stage, so the filter does not change it.",
    );
    // Options: read over the first targeted widget whose result has the column; partial noted.
    await waitFor(() => expect(valuesAsked.length).toBeGreaterThan(0));
    expect(valuesAsked[0].pathname).toContain(MOCK_QUERY.id);
    expect(valuesAsked[0].searchParams.get('widget')).toBe(W_STAGE);
    expect(await waitFor(() => document.querySelector('[data-component="ValuesPartial"]'))).not.toBeNull();
    // The selection shows as selected options, the blank one under its label
    // (the tags collapse responsively — jsdom has no width).
    fireEvent.mouseDown(document.querySelector('[data-component="SharedFilterSelect"]') as HTMLElement);
    const selected = '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option-selected';
    await waitFor(() => expect(document.querySelectorAll(selected).length).toBe(2));
    // QA-3 — the open list says it is partial, in its own footer.
    expect(
      document.querySelector(
        '.ant-select-dropdown:not(.ant-select-dropdown-hidden) [data-component="ValuesPartialFooter"]',
      )?.textContent,
    ).toBe('First 1 000 values');
    expect(Array.from(document.querySelectorAll(selected)).map((o) => o.getAttribute('title'))).toEqual([
      '(blank)',
      'won',
    ]);
  });

  it('a p. change leaves the f. bytes identical; Reset drops both (BA-C2)', async () => {
    serve([STAGE, AS_OF]);
    wrap(`/dashboards/${MOCK_WORKSPACE.id}/${MOCK_DASHBOARD.slug}?f.${CTL}=Ops%2C%20East,~blank,%7Eblank`);
    await waitFor(() => expect(document.querySelector('[data-component="ParamControlInput"]')).not.toBeNull());
    fireEvent.change(document.querySelector('[data-component="ParamControlInput"]') as HTMLInputElement, {
      target: { value: '2026-10-11' },
    });
    await waitFor(() => expect(seenSearch).toContain('p.as_of=2026-10-11'));
    expect(seenSearch).toBe(`?f.${CTL}=Ops%2C%20East,~blank,%7Eblank&p.as_of=2026-10-11`);
    fireEvent.click(document.querySelector('[data-component="ParamResetToSaved"]') as HTMLElement);
    await waitFor(() => expect(seenSearch).toBe(''));
  });

  it('picking options writes f.<id> raw — (blank) as ~blank; clearing writes f.<id>= (no filter)', async () => {
    serve([STAGE]);
    wrap(`/dashboards/${MOCK_WORKSPACE.id}/${MOCK_DASHBOARD.slug}?x=1`);
    await waitFor(() => expect(document.querySelector('[data-component="SharedFilterSelect"]')).not.toBeNull());
    await waitFor(() =>
      expect(document.querySelector('[data-component="SharedFilterSelect"]')?.className).not.toContain('disabled'),
    );
    fireEvent.mouseDown(document.querySelector('[data-component="SharedFilterSelect"]') as HTMLElement);
    const opt = (title: string) =>
      `.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option[title="${title}"]`;
    await waitFor(() => expect(document.querySelector(opt('won'))).not.toBeNull());
    fireEvent.click(document.querySelector(opt('won')) as HTMLElement);
    await waitFor(() => expect(seenSearch).toBe(`?x=1&f.${CTL}=won`));
    fireEvent.click(document.querySelector(opt('(blank)')) as HTMLElement);
    await waitFor(() => expect(seenSearch).toBe(`?x=1&f.${CTL}=won,~blank`));
    fireEvent.click(document.querySelector(opt('won')) as HTMLElement);
    fireEvent.click(document.querySelector(opt('(blank)')) as HTMLElement);
    await waitFor(() => expect(seenSearch).toBe(`?x=1&f.${CTL}=`));
  });

  it('an old link to a deleted control opens, reads, and loses the stale key (BA-C1)', async () => {
    const { reads } = serve([AS_OF]);
    wrap(`/dashboards/${MOCK_WORKSPACE.id}/${MOCK_DASHBOARD.slug}?f.ctl_0000dead=South&p.as_of=2026-10-01`);
    await waitFor(() => expect(seenSearch).toBe('?p.as_of=2026-10-01'));
    await waitFor(() => expect(reads.length).toBeGreaterThan(0));
    // No read carries the stale key once the URL is clean.
    await waitFor(() => expect(reads.at(-1)).not.toContain('f.ctl_0000dead'));
    expect(document.querySelectorAll('[data-component="DashboardGridCell"]').length).toBe(3);
  });
});

describe('R199 editor', () => {
  it('re-binding a values control to another column gives it a new id, so an old f. key goes stale (BA-F4)', async () => {
    const { posts } = serve([{ ...STAGE, saved: ['won'] }]);
    wrap(`/dashboards/${MOCK_WORKSPACE.id}/${MOCK_DASHBOARD.slug}`);
    await waitFor(() => expect(document.querySelector('[data-component="DashboardEditControls"]')).not.toBeNull());
    fireEvent.click(document.querySelector('[data-component="DashboardEditControls"]') as HTMLElement);
    await waitFor(() => expect(document.querySelector('[data-component="ValuesColumn"]')).not.toBeNull());
    const option = '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option[title="deal_id"]';
    await waitFor(() => {
      fireEvent.mouseDown(document.querySelector('[data-component="ValuesColumn"]') as HTMLElement);
      expect(document.querySelector(option)).not.toBeNull();
    });
    fireEvent.click(document.querySelector(option) as HTMLElement);
    await waitFor(() =>
      expect(
        document.querySelector('[data-component="ControlRow"][data-kind="values"]')?.getAttribute('data-column'),
      ).toBe('deal_id'),
    );
    fireEvent.click(document.querySelector('[data-component="ControlsSave"]') as HTMLElement);
    await waitFor(() => expect(posts.length).toBe(1));
    const [c] = (posts[0] as { definition: { controls: ValuesControl[] } }).definition.controls;
    expect(c.column).toBe('deal_id');
    expect(c.id).not.toBe(CTL);
    expect(c.id).toMatch(/^ctl_[0-9a-f]{8}$/);
    expect('saved' in c).toBe(false); // the old column's selection does not carry over
    // An old link to the previous id is now a stale key — dropped on load (BA-C1).
    expect(staleFilterKeys(`?f.${CTL}=won`, [c])).toEqual([CTL]);
  });

  it('adds a values control on a text column, targets all, and saves it with the dashboard', async () => {
    const { posts } = serve([]);
    wrap(`/dashboards/${MOCK_WORKSPACE.id}/${MOCK_DASHBOARD.slug}`);
    await waitFor(() => expect(document.querySelector('[data-component="DashboardEditControls"]')).not.toBeNull());
    fireEvent.click(document.querySelector('[data-component="DashboardEditControls"]') as HTMLElement);
    await waitFor(() => expect(document.querySelector('[data-component="ControlsEditor"]')).not.toBeNull());
    const add =
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option[title="Values (a shared filter)"]';
    await waitFor(() => {
      fireEvent.mouseDown(document.querySelector('[data-component="ControlAdd"]') as HTMLElement);
      expect(document.querySelectorAll(add).length).toBeGreaterThan(0);
    });
    fireEvent.click(document.querySelectorAll(add)[0] as HTMLElement);
    await waitFor(() => expect(document.querySelector('[data-component="ValuesColumn"]')).not.toBeNull());
    // The first text column of the queries (MOCK_DATASET: deal_id).
    const row = document.querySelector('[data-component="ControlRow"][data-kind="values"]');
    expect(row?.getAttribute('data-column')).toBe('deal_id');
    fireEvent.click(document.querySelector('[data-component="ControlsSave"]') as HTMLElement);
    await waitFor(() => expect(posts.length).toBe(1));
    const sent = posts[0] as { definition: { controls: ValuesControl[] } };
    expect(sent.definition.controls).toHaveLength(1);
    expect(sent.definition.controls[0]).toMatchObject({
      kind: 'values',
      label: 'deal_id',
      column: 'deal_id',
      targets: 'all',
    });
    expect(sent.definition.controls[0].id).toMatch(/^ctl_[0-9a-f]{8}$/);
    expect('saved' in sent.definition.controls[0]).toBe(false);
  });
});
