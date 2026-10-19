// R198 (item 4.2) — the view-time date range in the builder: the presets'
// calendar (mirrors the server's), a range control's reach, the values it
// routes (both names only to targeted widgets), the shared link pinning both
// dates, the bar (preset pick → two absolute URL dates; Reset to saved) and the
// "Data only through" note (D7).

import { AntdConfig } from '@mdd/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { DashboardDetailPage } from '@/features/dashboard/DashboardDetailPage';
import {
  DashboardParamsContext,
  controlReach,
  controlValuesFrom,
  shareUrl,
  useWidgetParamContext,
} from '@/features/dashboard/DashboardParams';
import { presetOf, resolvePreset } from '@/features/dashboard/dateRange';
import { DATE_RANGE_PRESETS, type DateRangeControl, type Widget } from '@/features/dashboard/types';
import { widgetsToDefinition } from '@/features/dashboard/wire';
import type { Query, QueryDefinition } from '@/features/data-management/queries/types';
import { MOCK_DASHBOARD, MOCK_QUERY, MOCK_WORKSPACE } from '@/mocks/fixtures';
import { server } from '@/mocks/server';

const PERIOD_DEF: QueryDefinition = {
  ...MOCK_QUERY.definition,
  params: [
    { name: 'from', type: 'date', label: 'From' },
    { name: 'to', type: 'date', label: 'To' },
  ],
  filters: [{ col: 2, dtype: 'date', op: 'between', min: { param: 'from' }, max: { param: 'to' } }],
};
const PERIOD_QUERY: Query = { ...MOCK_QUERY, id: 'qr_00000198', definition: PERIOD_DEF };
const TO_ONLY_QUERY: Query = {
  ...MOCK_QUERY,
  id: 'qr_00000199',
  definition: {
    ...MOCK_QUERY.definition,
    params: [{ name: 'to', type: 'date' }],
    filters: [{ col: 2, dtype: 'date', op: 'lte', val: { param: 'to' } }],
  },
};

const RANGE: DateRangeControl = {
  id: 'ctl_00000198',
  kind: 'date_range',
  label: 'Period',
  from: 'from',
  to: 'to',
  targets: 'all',
  saved: { preset: 'last_7_days' },
};

const widget = (id: string, queryId: string): Widget => ({
  id,
  queryId,
  title: id,
  chartType: 'table',
  agg: 'count',
  span: 1,
});

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

describe('R198 presets (the browser mirror of the server calendar)', () => {
  it('reads weeks from Monday, last 7 days through today, and calendar months', () => {
    const sunday = new Date(2026, 10, 1); // Sun 1 Nov 2026
    expect(resolvePreset('this_week', sunday)).toEqual({ from: '2026-10-26', to: '2026-11-01' });
    expect(resolvePreset('last_week', sunday)).toEqual({ from: '2026-10-19', to: '2026-10-25' });
    expect(resolvePreset('last_7_days', sunday)).toEqual({ from: '2026-10-26', to: '2026-11-01' });
    expect(resolvePreset('this_month', sunday)).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(resolvePreset('last_month', sunday)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    const leap = new Date(2028, 2, 1); // 1 Mar 2028
    expect(resolvePreset('last_month', leap)).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(presetOf('2026-10-19', '2026-10-25', DATE_RANGE_PRESETS, sunday)).toBe('last_week');
    expect(presetOf('2026-10-19', '2026-10-24', DATE_RANGE_PRESETS, sunday)).toBeUndefined();
  });
});

describe('R198 pure rules', () => {
  it('reaches a widget whose query uses from or to; skips one that uses neither, naming both', () => {
    const both = widget('wdg_00000001', PERIOD_QUERY.id);
    const toOnly = widget('wdg_00000002', TO_ONLY_QUERY.id);
    const neither = widget('wdg_00000003', MOCK_QUERY.id);
    expect(controlReach([RANGE], both, PERIOD_QUERY).reached).toEqual([RANGE]);
    expect(controlReach([RANGE], toOnly, TO_ONLY_QUERY).reached).toEqual([RANGE]);
    const skipped = controlReach([RANGE], neither, MOCK_QUERY);
    expect(skipped.reached).toEqual([]);
    expect(skipped.skipped).toEqual([{ control: RANGE, reason: 'from, to' }]);
    expect(controlReach([{ ...RANGE, targets: ['wdg_00000009'] }], both, PERIOD_QUERY)).toEqual({
      reached: [],
      skipped: [],
    });
  });

  it('sends both viewer values only to the widgets the control targets', () => {
    let seen: unknown;
    function Probe() {
      seen = useWidgetParamContext('wdg_00000002');
      return null;
    }
    render(
      <DashboardParamsContext.Provider
        value={{
          viewer: { from: '2026-10-05', to: '2026-10-11', stray: 'x' },
          dashboardId: 'dsh_00000001',
          controls: [{ ...RANGE, targets: ['wdg_00000002'] }],
        }}
      >
        <Probe />
      </DashboardParamsContext.Provider>,
    );
    expect(seen).toEqual({
      params: { from: '2026-10-05', to: '2026-10-11' },
      dashboard: { id: 'dsh_00000001', widgetId: 'wdg_00000002' },
    });
  });

  it('takes both resolved values from a targeted widget (viewer or dashboard source only)', () => {
    const r = {
      from: { value: '2026-10-05', source: 'dashboard' as const },
      to: { value: '2026-10-11', source: 'dashboard' as const, dataThrough: '2026-10-09' },
    };
    expect(controlValuesFrom([RANGE], 'wdg_00000001', r)).toEqual({ from: '2026-10-05', to: '2026-10-11' });
    expect(controlValuesFrom([{ ...RANGE, targets: ['wdg_00000009'] }], 'wdg_00000001', r)).toEqual({});
    expect(controlValuesFrom([RANGE], 'wdg_00000001', { from: { value: 'D', source: 'default' } })).toEqual({});
  });

  it('pins both dates in the shared link: the viewer value, else the server-resolved one, else a fixed saved bound', () => {
    const fixed: DateRangeControl = {
      ...RANGE,
      id: 'ctl_00000002',
      from: 'a',
      to: 'b',
      saved: { from: '2026-01-01', to: { kind: 'today', offsetDays: 0 } },
    };
    const url = shareUrl(
      'http://x/dashboards/ws/d?p.to=2026-10-12',
      [RANGE, fixed],
      { to: '2026-10-12' },
      {
        from: '2026-10-06',
        b: '2026-10-17',
      },
    );
    const q = new URL(url).searchParams;
    expect(q.get('p.from')).toBe('2026-10-06');
    expect(q.get('p.to')).toBe('2026-10-12');
    expect(q.get('p.a')).toBe('2026-01-01');
    expect(q.get('p.b')).toBe('2026-10-17');
  });

  it('keeps a range control through a widget removal like a param control', () => {
    const w = widget('wdg_00000001', PERIOD_QUERY.id);
    const some: DateRangeControl = { ...RANGE, targets: ['wdg_00000001', 'wdg_gone0000'] };
    expect(widgetsToDefinition([w], [some])).toEqual({
      widgets: [w],
      controls: [{ ...some, targets: ['wdg_00000001'] }],
    });
  });
});

describe('R198 dashboard bar', () => {
  function serve(resolvedTo?: { dataThrough?: string }) {
    const reads: URL[] = [];
    const period = widget('wdg_00000198', PERIOD_QUERY.id);
    const other = widget('wdg_00000199', MOCK_QUERY.id);
    server.use(
      http.get('*/workspaces/:id/dashboards', () =>
        HttpResponse.json([{ ...MOCK_DASHBOARD, definition: { widgets: [period, other], controls: [RANGE] } }]),
      ),
      http.get('*/workspaces/:id/queries', () => HttpResponse.json([PERIOD_QUERY, MOCK_QUERY])),
      http.get('*/queries/:id', ({ params }) =>
        HttpResponse.json(params.id === PERIOD_QUERY.id ? PERIOD_QUERY : MOCK_QUERY),
      ),
      http.get('*/queries/:id/rows', ({ request, params }) => {
        const url = new URL(request.url);
        reads.push(url);
        if (params.id !== PERIOD_QUERY.id) return HttpResponse.json({ rows: [], page: 1, pageSize: 0, total: 0 });
        const from = url.searchParams.get('p.from');
        const to = url.searchParams.get('p.to');
        // The server: a viewer value, else the saved preset resolved in its zone.
        return HttpResponse.json({
          rows: [],
          page: 1,
          pageSize: 0,
          total: 0,
          resolvedParams: {
            from: { value: from ?? '2026-10-06', source: from ? 'viewer' : 'dashboard' },
            to: { value: to ?? '2026-10-12', source: to ? 'viewer' : 'dashboard', ...(resolvedTo ?? {}) },
          },
        });
      }),
    );
    return reads;
  }

  const bar = () => document.querySelector('[data-component="DateRangeControl"]');
  const input = (name: string) =>
    document.querySelector(`[data-component="ParamControlInput"][data-name="${name}"]`) as HTMLInputElement;

  it('shows the server-resolved saved period, sends the URL period with the targeted read, badges the other widget', async () => {
    const reads = serve();
    wrap(
      <Routes>
        <Route path="/dashboards/:workspaceId/:slug" element={<DashboardDetailPage />} />
      </Routes>,
      `/dashboards/${MOCK_WORKSPACE.id}/${MOCK_DASHBOARD.slug}?p.from=2026-10-01&p.to=2026-10-02`,
    );
    await waitFor(() => expect(bar()).not.toBeNull());
    expect(input('from').value).toBe('2026-10-01');
    expect(input('to').value).toBe('2026-10-02');
    expect(bar()?.getAttribute('data-viewer')).toBe('true');
    expect(document.querySelector('[data-component="ParamResetToSaved"]')).not.toBeNull();
    await waitFor(() => expect(reads.some((u) => u.pathname.includes(PERIOD_QUERY.id))).toBe(true));
    const read = reads.find((u) => u.pathname.includes(PERIOD_QUERY.id));
    expect(read?.searchParams.get('p.from')).toBe('2026-10-01');
    expect(read?.searchParams.get('p.to')).toBe('2026-10-02');
    expect(read?.searchParams.get('widget')).toBe('wdg_00000198');
    // The other widget is targeted too, so it gets the values; its query uses
    // neither, so the server ignores them (D5) and the badge says skipped.
    const otherRead = reads.find((u) => u.pathname.includes(MOCK_QUERY.id));
    expect(otherRead?.searchParams.get('p.from')).toBe('2026-10-01');
    await waitFor(() => expect(document.querySelectorAll('[data-component="ReachSkippedTag"]').length).toBe(1));
    expect(document.querySelectorAll('[data-component="ReachTag"]').length).toBe(1);

    // Reset to saved: the URL is clean and the bar shows the server's resolution of the preset.
    fireEvent.click(document.querySelector('[data-component="ParamResetToSaved"]') as HTMLElement);
    await waitFor(() => expect(input('from').value).toBe('2026-10-06'));
    expect(input('to').value).toBe('2026-10-12');
    expect(document.querySelector('[data-component="ParamResetToSaved"]')).toBeNull();
    expect(bar()?.getAttribute('data-viewer')).toBeNull();
  });

  it('a typed bound goes to the URL as one absolute date; a reversed pair warns', async () => {
    const reads = serve();
    wrap(
      <Routes>
        <Route path="/dashboards/:workspaceId/:slug" element={<DashboardDetailPage />} />
      </Routes>,
      `/dashboards/${MOCK_WORKSPACE.id}/${MOCK_DASHBOARD.slug}`,
    );
    await waitFor(() => expect(bar()).not.toBeNull());
    fireEvent.change(input('to'), { target: { value: '2026-10-20' } });
    await waitFor(() =>
      expect(
        reads.some((u) => u.pathname.includes(PERIOD_QUERY.id) && u.searchParams.get('p.to') === '2026-10-20'),
      ).toBe(true),
    );
    const last = reads.filter((u) => u.pathname.includes(PERIOD_QUERY.id)).at(-1);
    expect(last?.searchParams.get('p.from')).toBeNull(); // only the typed bound is a viewer value
    expect(document.querySelector('[data-component="DateRangeReversed"]')).toBeNull();
    fireEvent.change(input('from'), { target: { value: '2026-10-25' } });
    await waitFor(() => expect(document.querySelector('[data-component="DateRangeReversed"]')).not.toBeNull());
  });

  it('shows "Data only through" when the server says the period runs past the data', async () => {
    serve({ dataThrough: '2026-10-09' });
    wrap(
      <Routes>
        <Route path="/dashboards/:workspaceId/:slug" element={<DashboardDetailPage />} />
      </Routes>,
      `/dashboards/${MOCK_WORKSPACE.id}/${MOCK_DASHBOARD.slug}`,
    );
    expect(await screen.findByText('Data only through 2026-10-09')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-component="WidgetDataThrough"]').length).toBe(1);
  });
});
