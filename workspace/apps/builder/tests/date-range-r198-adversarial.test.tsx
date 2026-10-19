// R198 (item 4.2) — QA's adversarial probes of the builder side (adopted at close-out) of the view-time date range:
// the preset calendar at year / leap / Monday / Sunday boundaries, `presetOf`
// on a Sunday (BA-F2, documented), `withParams` writing and clearing both
// bounds in one go, the URL round trip of a preset pick in the bar (pick →
// two absolute `p.*` dates → reload → the select shows the preset again),
// half a viewer pair, the D7 note picking the EARLIEST `dataThrough` and never
// showing beside a param message, and the editor saving a fixed pair / a
// preset (Save disabled on a reversed pair, a half pair).

import { AntdConfig } from '@mdd/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { DashboardDetailPage } from '@/features/dashboard/DashboardDetailPage';
import { controlReach } from '@/features/dashboard/DashboardParams';
import { presetOf, resolvePreset } from '@/features/dashboard/dateRange';
import { DATE_RANGE_PRESETS, type DateRangeControl, type Widget } from '@/features/dashboard/types';
import { withParams, withoutParams } from '@/features/data-management/queries/params';
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
const FROM_ONLY_QUERY: Query = {
  ...MOCK_QUERY,
  id: 'qr_00000197',
  definition: {
    ...MOCK_QUERY.definition,
    params: [{ name: 'from', type: 'date' }],
    filters: [{ col: 2, dtype: 'date', op: 'gte', val: { param: 'from' } }],
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

function LocationProbe() {
  const loc = useLocation();
  return <div data-component="QaLocation" data-search={loc.search} />;
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

const search = () => document.querySelector('[data-component="QaLocation"]')?.getAttribute('data-search') ?? '';
const bar = () => document.querySelector('[data-component="DateRangeControl"]');
const input = (name: string) =>
  document.querySelector(`[data-component="ParamControlInput"][data-name="${name}"]`) as HTMLInputElement;
const openSelect = (component: string) =>
  fireEvent.mouseDown(document.querySelector(`[data-component="${component}"]`)!);
async function pickOption(title: string) {
  const sel = `.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option[title="${title}"]`;
  await waitFor(() => expect(document.querySelectorAll(sel).length).toBeGreaterThan(0));
  const opts = document.querySelectorAll(sel);
  fireEvent.click(opts[opts.length - 1]);
}
// AntD v6: the selected label is the `.ant-select-content` title.
const selectText = (component: string) =>
  document.querySelector(`[data-component="${component}"] .ant-select-content`)?.getAttribute('title') ?? '';

type Served = { reads: URL[]; puts: unknown[] };
function serve(
  opts: {
    controls?: DateRangeControl[];
    widgets?: Widget[];
    queries?: Query[];
    resolve?: (q: Query, url: URL) => Record<string, unknown> | undefined;
  } = {},
): Served {
  const out: Served = { reads: [], puts: [] };
  const widgets = opts.widgets ?? [widget('wdg_00000198', PERIOD_QUERY.id), widget('wdg_00000199', MOCK_QUERY.id)];
  const queries = opts.queries ?? [PERIOD_QUERY, MOCK_QUERY];
  const controls = opts.controls ?? [RANGE];
  const byId = new Map(queries.map((q) => [q.id, q]));
  server.use(
    http.get('*/workspaces/:id/dashboards', () =>
      HttpResponse.json([{ ...MOCK_DASHBOARD, definition: { widgets, controls } }]),
    ),
    http.get('*/workspaces/:id/queries', () => HttpResponse.json(queries)),
    http.get('*/queries/:id', ({ params }) => HttpResponse.json(byId.get(String(params.id)) ?? MOCK_QUERY)),
    http.put('*/dashboards/:id', async ({ request }) => {
      const body = (await request.json()) as { name: string; slug: string; definition: unknown };
      out.puts.push(body);
      return HttpResponse.json({ ...MOCK_DASHBOARD, ...body });
    }),
    http.get('*/queries/:id/rows', ({ request, params }) => {
      const url = new URL(request.url);
      out.reads.push(url);
      const q = byId.get(String(params.id));
      const base = { rows: [], page: 1, pageSize: 0, total: 0 };
      const resolvedParams = q && opts.resolve ? opts.resolve(q, url) : defaultResolve(q, url);
      return HttpResponse.json(resolvedParams ? { ...base, resolvedParams } : base);
    }),
  );
  return out;
}

function defaultResolve(q: Query | undefined, url: URL): Record<string, unknown> | undefined {
  if (!q || q.id !== PERIOD_QUERY.id) return undefined;
  const from = url.searchParams.get('p.from');
  const to = url.searchParams.get('p.to');
  return {
    from: { value: from ?? '2026-10-06', source: from ? 'viewer' : 'dashboard' },
    to: { value: to ?? '2026-10-12', source: to ? 'viewer' : 'dashboard' },
  };
}

describe('R198 adversarial — the preset calendar at the edges', () => {
  it('rolls the year, the leap day and the 31st, and starts the week today on a Monday', () => {
    const dec31 = new Date(2026, 11, 31); // Thursday
    expect(resolvePreset('this_week', dec31)).toEqual({ from: '2026-12-28', to: '2027-01-03' });
    expect(resolvePreset('this_month', dec31)).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    expect(resolvePreset('last_7_days', dec31)).toEqual({ from: '2026-12-25', to: '2026-12-31' });
    const jan1 = new Date(2027, 0, 1); // Friday
    expect(resolvePreset('this_week', jan1)).toEqual({ from: '2026-12-28', to: '2027-01-03' });
    expect(resolvePreset('last_week', jan1)).toEqual({ from: '2026-12-21', to: '2026-12-27' });
    expect(resolvePreset('last_month', jan1)).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    const feb29 = new Date(2028, 1, 29); // Tuesday, leap day
    expect(resolvePreset('this_month', feb29)).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(resolvePreset('this_week', feb29)).toEqual({ from: '2028-02-28', to: '2028-03-05' });
    expect(resolvePreset('last_7_days', feb29)).toEqual({ from: '2028-02-23', to: '2028-02-29' });
    expect(resolvePreset('last_month', new Date(2027, 2, 31))).toEqual({ from: '2027-02-01', to: '2027-02-28' });
    expect(resolvePreset('last_month', new Date(2027, 0, 31))).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    const monday = new Date(2026, 9, 19);
    expect(resolvePreset('this_week', monday)).toEqual({ from: '2026-10-19', to: '2026-10-25' });
    expect(resolvePreset('last_week', monday)).toEqual({ from: '2026-10-12', to: '2026-10-18' });
    expect(resolvePreset('last_7_days', monday)).toEqual({ from: '2026-10-13', to: '2026-10-19' });
  });

  it('mirrors the server for every preset on a DST-switch day (the calendar, not the clock)', () => {
    const springForward = new Date(2026, 2, 8, 2, 30); // Sun 8 Mar 2026 02:30 local
    expect(resolvePreset('this_week', springForward)).toEqual({ from: '2026-03-02', to: '2026-03-08' });
    expect(resolvePreset('last_week', springForward)).toEqual({ from: '2026-02-23', to: '2026-03-01' });
    expect(resolvePreset('last_7_days', springForward)).toEqual({ from: '2026-03-02', to: '2026-03-08' });
    expect(resolvePreset('last_month', springForward)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    const late = new Date(2026, 9, 25, 23, 59, 59); // Sun 25 Oct 23:59:59 (EU fall-back day)
    expect(resolvePreset('this_week', late)).toEqual({ from: '2026-10-19', to: '2026-10-25' });
  });

  it('presetOf: on a Sunday the Mon–Sun pair is both "this week" and "last 7 days" — the first wins (BA-F2, documented)', () => {
    const sunday = new Date(2026, 10, 1);
    expect(resolvePreset('this_week', sunday)).toEqual(resolvePreset('last_7_days', sunday));
    expect(presetOf('2026-10-26', '2026-11-01', DATE_RANGE_PRESETS, sunday)).toBe('this_week');
    // Any other day the two differ and each is found.
    const wed = new Date(2026, 9, 21);
    expect(presetOf('2026-10-19', '2026-10-25', DATE_RANGE_PRESETS, wed)).toBe('this_week');
    expect(presetOf('2026-10-15', '2026-10-21', DATE_RANGE_PRESETS, wed)).toBe('last_7_days');
    expect(presetOf('2026-10-01', '2026-10-31', DATE_RANGE_PRESETS, wed)).toBe('this_month');
    expect(presetOf('2026-09-01', '2026-09-30', DATE_RANGE_PRESETS, wed)).toBe('last_month');
    // A half pair, a reversed pair or a malformed date is never a preset.
    expect(presetOf('2026-10-19', undefined, DATE_RANGE_PRESETS, wed)).toBeUndefined();
    expect(presetOf('2026-10-25', '2026-10-19', DATE_RANGE_PRESETS, wed)).toBeUndefined();
    expect(presetOf('2026-10-19', '2026-10-25T00:00', DATE_RANGE_PRESETS, wed)).toBeUndefined();
  });
});

describe('R198 adversarial — withParams', () => {
  it('writes both bounds at once, clears both on empty, and leaves other entries alone', () => {
    const start = new URLSearchParams('tab=x&p.n=5&p.from=2026-01-01');
    const both = withParams(start, { from: '2026-10-19', to: '2026-10-25' });
    expect(both.toString()).toBe('tab=x&p.n=5&p.from=2026-10-19&p.to=2026-10-25');
    const cleared = withParams(both, { from: '', to: undefined });
    expect(cleared.toString()).toBe('tab=x&p.n=5');
    expect(withParams(both, {}).toString()).toBe(both.toString());
    expect(withoutParams(both).toString()).toBe('tab=x');
    // Non-ASCII and `=`-leading values survive the round trip as values, never as keys.
    const odd = withParams(start, { from: '=2026', to: 'tuần' });
    expect(new URLSearchParams(odd.toString()).get('p.from')).toBe('=2026');
    expect(new URLSearchParams(odd.toString()).get('p.to')).toBe('tuần');
  });
});

describe('R198 adversarial — the bar: a preset pick round-trips through the URL', () => {
  it('writes both absolute dates in one entry; a reload of that URL shows the same preset; Reset clears both', async () => {
    const served = serve();
    wrap(`/dashboards/${MOCK_WORKSPACE.id}/${MOCK_DASHBOARD.slug}`);
    await waitFor(() => expect(bar()).not.toBeNull());
    await waitFor(() => expect(input('from').value).toBe('2026-10-06'));
    expect(selectText('DateRangePreset')).toBe('Custom'); // the server's dates are not a preset on this clock
    expect(search()).toBe('');

    openSelect('DateRangePreset');
    await pickOption('Last week');
    const want = resolvePreset('last_week');
    await waitFor(() => expect(input('from').value).toBe(want.from));
    expect(input('to').value).toBe(want.to);
    const q = new URLSearchParams(search());
    expect(q.get('p.from')).toBe(want.from);
    expect(q.get('p.to')).toBe(want.to);
    expect([...q.keys()].sort()).toEqual(['p.from', 'p.to']);
    expect(selectText('DateRangePreset')).toBe('Last week');
    expect(bar()?.getAttribute('data-viewer')).toBe('true');
    // The targeted read carries both as viewer values; the server echoes them as viewer.
    await waitFor(() =>
      expect(
        served.reads.some(
          (u) =>
            u.pathname.includes(PERIOD_QUERY.id) &&
            u.searchParams.get('p.from') === want.from &&
            u.searchParams.get('p.to') === want.to,
        ),
      ).toBe(true),
    );

    // Reset to saved drops both and the select goes back to the server's resolution.
    fireEvent.click(document.querySelector('[data-component="ParamResetToSaved"]') as HTMLElement);
    await waitFor(() => expect(search()).toBe(''));
    await waitFor(() => expect(input('from').value).toBe('2026-10-06'));
    expect(input('to').value).toBe('2026-10-12');
    expect(document.querySelector('[data-component="ParamResetToSaved"]')).toBeNull();
  });

  it('reopening the picked URL shows the preset in the select and the dates in the inputs', async () => {
    serve();
    const want = resolvePreset('this_month');
    wrap(`/dashboards/${MOCK_WORKSPACE.id}/${MOCK_DASHBOARD.slug}?p.from=${want.from}&p.to=${want.to}`);
    await waitFor(() => expect(bar()).not.toBeNull());
    expect(input('from').value).toBe(want.from);
    expect(input('to').value).toBe(want.to);
    await waitFor(() => expect(selectText('DateRangePreset')).toBe('This month'));
    expect(bar()?.getAttribute('data-viewer')).toBe('true');
  });

  it("half a viewer pair: the other bound stays the server's, the select says Custom, no reversed warning", async () => {
    const served = serve();
    wrap(`/dashboards/${MOCK_WORKSPACE.id}/${MOCK_DASHBOARD.slug}?p.to=2026-10-10`);
    await waitFor(() => expect(bar()).not.toBeNull());
    await waitFor(() => expect(input('from').value).toBe('2026-10-06'));
    expect(input('to').value).toBe('2026-10-10');
    expect(selectText('DateRangePreset')).toBe('Custom');
    expect(document.querySelector('[data-component="DateRangeReversed"]')).toBeNull();
    const read = served.reads.find((u) => u.pathname.includes(PERIOD_QUERY.id));
    expect(read?.searchParams.get('p.from')).toBeNull();
    expect(read?.searchParams.get('p.to')).toBe('2026-10-10');
  });

  it('a reversed viewer pair warns and the URL still holds what was typed (never auto-corrected)', async () => {
    serve();
    wrap(`/dashboards/${MOCK_WORKSPACE.id}/${MOCK_DASHBOARD.slug}?p.from=2026-10-20&p.to=2026-10-01`);
    await waitFor(() => expect(bar()).not.toBeNull());
    await waitFor(() => expect(document.querySelector('[data-component="DateRangeReversed"]')).not.toBeNull());
    expect(new URLSearchParams(search()).get('p.from')).toBe('2026-10-20');
    expect(new URLSearchParams(search()).get('p.to')).toBe('2026-10-01');
    expect(selectText('DateRangePreset')).toBe('Custom');
  });
});

describe('R198 adversarial — reach with half a pair', () => {
  it('a query that uses only `from` is reached; a note widget is never badged', () => {
    const fromOnly = widget('wdg_00000002', FROM_ONLY_QUERY.id);
    expect(controlReach([RANGE], fromOnly, FROM_ONLY_QUERY).reached).toEqual([RANGE]);
    const note: Widget = { id: 'wdg_0000000n', chartType: 'note', title: 'n', span: 1, md: 'x' } as Widget;
    expect(controlReach([RANGE], note, undefined)).toEqual({ reached: [], skipped: [] });
    // Unknown query (deleted): the control is skipped, naming both.
    const gone = widget('wdg_00000003', 'qr_gone0000');
    expect(controlReach([RANGE], gone, undefined).skipped).toEqual([{ control: RANGE, reason: 'from, to', count: 2 }]);
  });
});

describe('R198 adversarial — the D7 note', () => {
  it('shows the EARLIEST dataThrough when both bounds report one, once per widget, on the targeted widget only', async () => {
    serve({
      resolve: (q, url) => {
        const r = defaultResolve(q, url);
        if (!r) return undefined;
        return {
          from: { ...(r.from as object), dataThrough: '2026-10-11' },
          to: { ...(r.to as object), dataThrough: '2026-10-09' },
        };
      },
    });
    wrap(`/dashboards/${MOCK_WORKSPACE.id}/${MOCK_DASHBOARD.slug}`);
    expect(await screen.findByText('Data only through 2026-10-09')).toBeInTheDocument();
    expect(screen.queryByText('Data only through 2026-10-11')).toBeNull();
    expect(document.querySelectorAll('[data-component="WidgetDataThrough"]').length).toBe(1);
  });

  it('shows no note when the server reports none, and none for the widget whose query uses neither', async () => {
    serve();
    wrap(`/dashboards/${MOCK_WORKSPACE.id}/${MOCK_DASHBOARD.slug}`);
    await waitFor(() => expect(bar()).not.toBeNull());
    await waitFor(() => expect(document.querySelectorAll('[data-component="ReachSkippedTag"]').length).toBe(1));
    expect(document.querySelectorAll('[data-component="WidgetDataThrough"]').length).toBe(0);
  });
});

describe('R198 adversarial — the editor', () => {
  const open = async () => {
    fireEvent.click(document.querySelector('[data-component="DashboardEditControls"]') as HTMLElement);
    await waitFor(() => expect(document.querySelector('[data-component="ControlsEditor"]')).not.toBeNull());
  };
  const save = () => document.querySelector('[data-component="ControlsSave"]') as HTMLButtonElement;
  const editorInput = (name: string) =>
    document.querySelector(
      `[data-component="ControlsEditor"] [data-component="ParamControlInput"][data-name="${name}"]`,
    ) as HTMLInputElement;

  it('a fixed pair: Save is disabled while half or reversed, enabled when it runs forwards; the PUT carries {from, to}', async () => {
    const served = serve();
    wrap(`/dashboards/${MOCK_WORKSPACE.id}/${MOCK_DASHBOARD.slug}`);
    await waitFor(() => expect(bar()).not.toBeNull());
    await open();
    expect(selectText('RangeSavedMode')).toBe('Last 7 days');
    openSelect('RangeSavedMode');
    await pickOption('Fixed dates');
    await waitFor(() => expect(editorInput('from')).not.toBeNull());
    expect(save().disabled).toBe(true); // an empty pair is not a period
    fireEvent.change(editorInput('from'), { target: { value: '2026-10-20' } });
    expect(save().disabled).toBe(true); // half a pair
    fireEvent.change(editorInput('to'), { target: { value: '2026-10-01' } });
    expect(save().disabled).toBe(true); // reversed
    fireEvent.change(editorInput('to'), { target: { value: '2026-10-20' } });
    expect(save().disabled).toBe(false); // same day runs forwards
    fireEvent.change(editorInput('to'), { target: { value: '2026-10-25' } });
    expect(save().disabled).toBe(false);
    fireEvent.click(save());
    await waitFor(() => expect(served.puts.length).toBe(1));
    const def = (served.puts[0] as { definition: { controls: DateRangeControl[] } }).definition;
    expect(def.controls).toEqual([{ ...RANGE, saved: { from: '2026-10-20', to: '2026-10-25' } }]);
  });

  it('a preset: the PUT carries {preset}; "No saved period" drops `saved`; `to` cannot be bound to `from`', async () => {
    const served = serve();
    wrap(`/dashboards/${MOCK_WORKSPACE.id}/${MOCK_DASHBOARD.slug}`);
    await waitFor(() => expect(bar()).not.toBeNull());
    await open();
    openSelect('RangeSavedMode');
    await pickOption('This month');
    expect(save().disabled).toBe(false);
    // The `to` select offers the control's own names (so a pair can be swapped,
    // QA-1); binding both ends to one parameter disables Save (the server's
    // `range_same_param` stays unreachable from the editor).
    openSelect('RangeToParam');
    const visible = '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option';
    await waitFor(() => expect(document.querySelectorAll(visible).length).toBeGreaterThan(0));
    const titles = Array.from(document.querySelectorAll(visible)).map((o) => o.getAttribute('title'));
    expect(titles).toContain('To (to)');
    expect(titles).toContain('From (from)');
    await pickOption('From (from)');
    await waitFor(() => expect(save().disabled).toBe(true));
    openSelect('RangeToParam');
    await pickOption('To (to)');
    await waitFor(() => expect(save().disabled).toBe(false));
    fireEvent.click(save());
    await waitFor(() => expect(served.puts.length).toBe(1));
    let def = (served.puts[0] as { definition: { controls: DateRangeControl[] } }).definition;
    expect(def.controls).toEqual([{ ...RANGE, saved: { preset: 'this_month' } }]);

    await open();
    openSelect('RangeSavedMode');
    await pickOption('No saved period');
    fireEvent.click(save());
    await waitFor(() => expect(served.puts.length).toBe(2));
    def = (served.puts[1] as { definition: { controls: DateRangeControl[] } }).definition;
    expect(def.controls.length).toBe(1);
    expect('saved' in def.controls[0]!).toBe(false);
  });
});
