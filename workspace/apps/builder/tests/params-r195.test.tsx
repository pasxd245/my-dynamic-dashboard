// R195 (item 3.7b) — typed parameters in the builder: the pure rules (which
// parameters a query uses, which controls reach a widget, URL values, pruning
// a removed widget's targets), the filter popover's "Use parameter", the query
// page asking for a value, and the dashboard bar (viewer values in the URL,
// sent with every widget read, Reset to saved, the reach badge).

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
  shareUrl,
  useWidgetParamContext,
} from '@/features/dashboard/DashboardParams';
import type { DashboardControl, Widget } from '@/features/dashboard/types';
import { widgetsToDefinition } from '@/features/dashboard/wire';
import { FilterPopover } from '@/features/data-management/datasets/filters/FilterPopover';
import type { FilterPredicate } from '@/features/data-management/datasets/filters/types';
import { QueryDetailPage } from '@/features/data-management/queries/QueryDetailPage';
import { paramsFromSearch, usedParams, withParam, withoutParams } from '@/features/data-management/queries/params';
import type { Query, QueryDefinition } from '@/features/data-management/queries/types';
import { MOCK_DASHBOARD, MOCK_DATASET, MOCK_QUERY, MOCK_WORKSPACE } from '@/mocks/fixtures';
import { server } from '@/mocks/server';

const AS_OF = { name: 'as_of', type: 'date' as const, label: 'As of' };

const PARAM_DEF: QueryDefinition = {
  ...MOCK_QUERY.definition,
  params: [AS_OF],
  filters: [{ col: 2, dtype: 'date', op: 'lte', val: { param: 'as_of' } }],
};
const PARAM_QUERY: Query = { ...MOCK_QUERY, definition: PARAM_DEF };

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

describe('R195 pure rules', () => {
  it('finds the parameters a definition uses (filters, advanced, filter steps, case WHEN)', () => {
    const def: QueryDefinition = {
      q: null,
      params: [
        AS_OF,
        { name: 'n', type: 'number' },
        { name: 'who', type: 'string' },
        { name: 'unused', type: 'string' },
      ],
      filters: [{ col: 0, dtype: 'date', op: 'lte', val: { param: 'as_of' } }],
      advanced: [[{ col: 1, dtype: 'integer', op: 'gt', val: { param: 'n' } }]],
      steps: [
        {
          kind: 'case',
          name: 'mine',
          branches: [
            { when: [{ col: 'team', op: 'in', vals: [{ param: 'who' }, 'x'] }], then: { kind: 'const', value: 'y' } },
          ],
        },
      ],
    };
    expect([...usedParams(def)].sort()).toEqual(['as_of', 'n', 'who']);
  });

  it('reads, sets and drops URL values', () => {
    const s = new URLSearchParams('page=2&p.as_of=2026-10-11&p.empty=&x=1');
    expect(paramsFromSearch(s)).toEqual({ as_of: '2026-10-11' });
    expect(withParam(s, 'as_of', '2026-10-12').get('p.as_of')).toBe('2026-10-12');
    expect(withParam(s, 'as_of', '').has('p.as_of')).toBe(false);
    expect(withoutParams(s).toString()).toBe('page=2&x=1');
  });

  it('reaches a targeted widget whose query uses the parameter; skips one whose query does not', () => {
    const ctl: DashboardControl = { id: 'ctl_00000001', kind: 'param', label: 'As of', param: 'as_of', targets: 'all' };
    const w: Widget = {
      id: 'wdg_00000001',
      queryId: PARAM_QUERY.id,
      title: 'A',
      chartType: 'table',
      agg: 'count',
      span: 1,
    };
    expect(controlReach([ctl], w, PARAM_QUERY).reached).toEqual([ctl]);
    const skipped = controlReach([ctl], w, MOCK_QUERY);
    expect(skipped.reached).toEqual([]);
    expect(skipped.skipped[0]?.control).toBe(ctl);
    expect(controlReach([{ ...ctl, targets: ['wdg_99999999'] }], w, PARAM_QUERY).reached).toEqual([]);
    const note: Widget = { id: 'wdg_00000002', title: 'N', chartType: 'note', md: 'x', span: 1 };
    expect(controlReach([ctl], note, undefined)).toEqual({ reached: [], skipped: [] });
  });

  it('drops a removed widget from control targets, and a control left with none', () => {
    const w: Widget = {
      id: 'wdg_00000001',
      queryId: 'qr_00000001',
      title: 'A',
      chartType: 'table',
      agg: 'count',
      span: 1,
    };
    const keep: DashboardControl = {
      id: 'ctl_00000001',
      kind: 'param',
      label: 'A',
      param: 'a',
      targets: ['wdg_00000001', 'wdg_gone0000'],
    };
    const gone: DashboardControl = {
      id: 'ctl_00000002',
      kind: 'param',
      label: 'B',
      param: 'b',
      targets: ['wdg_gone0000'],
    };
    expect(widgetsToDefinition([w], [keep, gone])).toEqual({
      widgets: [w],
      controls: [{ ...keep, targets: ['wdg_00000001'] }],
    });
    expect(widgetsToDefinition([w], undefined)).toEqual({ widgets: [w] });
  });
});

describe('R195 Use parameter in the filter popover', () => {
  it('writes a parameter reference instead of a literal', async () => {
    let applied: FilterPredicate | undefined;
    const col = MOCK_DATASET.columns[2];
    wrap(
      <FilterPopover
        column={col}
        colIndex={2}
        existing={undefined}
        onApply={(p) => (applied = p)}
        onClear={() => undefined}
        params={[AS_OF]}
      />,
      '/',
    );
    fireEvent.click(screen.getByRole('button'));
    const sw = await waitFor(() => {
      const el = document.querySelector('[data-component="UseParameterSwitch"]');
      if (!el) throw new Error('no switch');
      return el as HTMLElement;
    });
    fireEvent.click(sw);
    fireEvent.click(await screen.findByText('Apply'));
    expect(applied).toMatchObject({ col: 2, val: { param: 'as_of' } });
  });

  it('offers no parameter on the dataset page (no params passed)', async () => {
    wrap(
      <FilterPopover
        column={MOCK_DATASET.columns[2]}
        colIndex={2}
        existing={undefined}
        onApply={() => undefined}
        onClear={() => undefined}
      />,
      '/',
    );
    fireEvent.click(screen.getByRole('button'));
    await screen.findByText('Apply');
    expect(document.querySelector('[data-component="UseParameterSwitch"]')).toBeNull();
  });
});

describe('R195 the query page asks for a value', () => {
  it('shows "Pick a value" on param_unbound and sends the typed value as p.<name>', async () => {
    const seen: string[] = [];
    server.use(
      http.get('*/queries/:id', () => HttpResponse.json(PARAM_QUERY)),
      http.get('*/queries/:id/rows', ({ request }) => {
        const v = new URL(request.url).searchParams.get('p.as_of');
        seen.push(v ?? '');
        if (!v) return HttpResponse.json({ code: 'param_unbound', param: 'as_of', label: 'As of' }, { status: 422 });
        return HttpResponse.json({
          rows: [],
          page: 1,
          pageSize: 50,
          total: 0,
          resolvedParams: { as_of: { value: v, source: 'viewer' } },
        });
      }),
    );
    wrap(
      <Routes>
        <Route path="/data-management/queries/:id" element={<QueryDetailPage />} />
      </Routes>,
      `/data-management/queries/${PARAM_QUERY.id}`,
    );
    expect(await screen.findByText('Pick a value for As of.')).toBeInTheDocument();
    const input = document.querySelector('[data-component="ParamValueInput"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2026-10-11' } });
    await waitFor(() => expect(seen).toContain('2026-10-11'));
    expect(await screen.findByText(/as_of = 2026-10-11/)).toBeInTheDocument();
  });
});

describe('R195 dashboard bar', () => {
  const ctl: DashboardControl = {
    id: 'ctl_00000001',
    kind: 'param',
    label: 'As of',
    param: 'as_of',
    targets: 'all',
    saved: '2026-10-10',
  };
  const tableWidget = {
    id: 'wdg_00000195',
    queryId: PARAM_QUERY.id,
    title: 'Calls',
    chartType: 'table' as const,
    agg: 'count' as const,
    span: 1 as const,
  };

  function serve(otherQuery: Query = MOCK_QUERY) {
    const reads: URL[] = [];
    const other = {
      ...MOCK_DASHBOARD.definition.widgets[0],
      queryId: otherQuery.id,
      chartType: 'table' as const,
      agg: 'count' as const,
    };
    delete (other as { measureCol?: string }).measureCol;
    delete (other as { dimensionCol?: string }).dimensionCol;
    server.use(
      http.get('*/workspaces/:id/dashboards', () =>
        HttpResponse.json([{ ...MOCK_DASHBOARD, definition: { widgets: [tableWidget, other], controls: [ctl] } }]),
      ),
      http.get('*/workspaces/:id/queries', () => HttpResponse.json([PARAM_QUERY, otherQuery])),
      http.get('*/queries/:id', ({ params }) =>
        HttpResponse.json(params.id === PARAM_QUERY.id ? PARAM_QUERY : otherQuery),
      ),
      http.get('*/queries/:id/rows', ({ request }) => {
        reads.push(new URL(request.url));
        return HttpResponse.json({ rows: [], page: 1, pageSize: 0, total: 0 });
      }),
    );
    return reads;
  }

  it('shows the saved value, sends viewer values + the widget with every read, and offers Reset', async () => {
    const reads = serve({ ...MOCK_QUERY, id: 'qr_0000beef' });
    wrap(
      <Routes>
        <Route path="/dashboards/:workspaceId/:slug" element={<DashboardDetailPage />} />
      </Routes>,
      `/dashboards/${MOCK_WORKSPACE.id}/${MOCK_DASHBOARD.slug}?p.as_of=2026-10-12`,
    );
    const input = await waitFor(() => {
      const el = document.querySelector('[data-component="ParamControlInput"]');
      if (!el) throw new Error('no bar');
      return el as HTMLInputElement;
    });
    expect(input.value).toBe('2026-10-12');
    expect(document.querySelector('[data-component="ParamResetToSaved"]')).not.toBeNull();
    await waitFor(() => expect(reads.length).toBeGreaterThan(0));
    const read = reads.find((u) => u.pathname.includes(PARAM_QUERY.id));
    expect(read?.searchParams.get('p.as_of')).toBe('2026-10-12');
    expect(read?.searchParams.get('dashboard')).toBe(MOCK_DASHBOARD.id);
    expect(read?.searchParams.get('widget')).toBe('wdg_00000195');
    // The other widget's query does not use as_of: its badge says skipped.
    await waitFor(() => expect(document.querySelectorAll('[data-component="ReachSkippedTag"]').length).toBe(1));
    expect(document.querySelectorAll('[data-component="ReachTag"]').length).toBe(1);

    fireEvent.click(document.querySelector('[data-component="ParamResetToSaved"]') as HTMLElement);
    await waitFor(() =>
      expect((document.querySelector('[data-component="ParamControlInput"]') as HTMLInputElement).value).toBe(
        '2026-10-10',
      ),
    );
    expect(document.querySelector('[data-component="ParamResetToSaved"]')).toBeNull();
  });
});

describe('R195 review round', () => {
  const ctl = (
    param: string,
    targets: DashboardControl['targets'],
    saved?: DashboardControl['saved'],
  ): DashboardControl => ({
    id: `ctl_0000000${param.length}`,
    kind: 'param',
    label: param,
    param,
    targets,
    ...(saved !== undefined ? { saved } : {}),
  });

  it('sends a viewer value only to the widgets its control targets', () => {
    let seen: unknown;
    function Probe() {
      seen = useWidgetParamContext('wdg_00000002');
      return null;
    }
    render(
      <DashboardParamsContext.Provider
        value={{
          viewer: { a: '1', b: '2', stray: '3' },
          dashboardId: 'dsh_00000001',
          controls: [ctl('a', 'all'), ctl('b', ['wdg_00000001'])],
        }}
      >
        <Probe />
      </DashboardParamsContext.Provider>,
    );
    expect(seen).toEqual({ params: { a: '1' }, dashboard: { id: 'dsh_00000001', widgetId: 'wdg_00000002' } });
  });

  it('pins every control as an absolute value in the shared link', () => {
    const url = shareUrl(
      'http://x/dashboards/ws/d?p.a=2026-10-12',
      [ctl('a', 'all'), ctl('rel', 'all', { kind: 'today', offsetDays: -1 }), ctl('fix', 'all', '2026-01-01')],
      { a: '2026-10-12' },
      { rel: '2026-10-17' },
    );
    const q = new URL(url).searchParams;
    expect(q.get('p.a')).toBe('2026-10-12');
    expect(q.get('p.rel')).toBe('2026-10-17');
    expect(q.get('p.fix')).toBe('2026-01-01');
  });
});
