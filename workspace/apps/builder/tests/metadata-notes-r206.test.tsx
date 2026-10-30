// R206 (item 5.6) — notes and insights: one block, a link not a toggle, cards you
// click, the title said once, the dock beside the data from 1200 px and over it
// below, and charts that stay still on a note action. Maps to metadata.md
// § Reading by layer and AC 11.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AntdConfig } from '@mdd/ui';
import { DashboardDetailPage } from '@/features/dashboard/DashboardDetailPage';
import GaugeView from '@/features/dashboard/GaugeView';
import HeatmapView from '@/features/dashboard/HeatmapView';
import { useWidgetChartData } from '@/features/dashboard/WidgetView';
import { displayLine, displayTitle, readEntry, withoutLeadingTitle } from '@/features/metadata/reserved';
import type { MetadataEntry } from '@/features/metadata/types';
import { MOCK_DASHBOARD, MOCK_METADATA, MOCK_WORKSPACE } from '@/mocks/fixtures';
import { server } from '@/mocks/server';

// Every recharts chart view renders through `ResponsiveContainer`: count its renders.
const charts = vi.hoisted(() => ({ renders: 0 }));
vi.mock('recharts', async (orig) => {
  const real = await orig<typeof import('recharts')>();
  return {
    ...real,
    ResponsiveContainer: () => {
      charts.renders += 1;
      return null;
    },
  };
});

const DASH_KEY = `dashboard/${MOCK_DASHBOARD.id}`;

function setWindowWidth(width: number) {
  (
    window as unknown as { happyDOM: { setWindowSize: (s: { width: number; height: number }) => void } }
  ).happyDOM.setWindowSize({ width, height: 900 });
}

function Where() {
  return <output data-testid="where">{useLocation().search}</output>;
}

function page(search = '') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AntdConfig>
        <App>
          <MemoryRouter initialEntries={[`/dashboards/${MOCK_WORKSPACE.id}/${MOCK_DASHBOARD.slug}${search}`]}>
            <Routes>
              <Route
                path="/dashboards/:workspaceId/:slug"
                element={
                  <>
                    <DashboardDetailPage />
                    <Where />
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

async function find(sel: string): Promise<HTMLElement> {
  return waitFor(() => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`no ${sel}`);
    return el as HTMLElement;
  });
}

const where = () => screen.getByTestId('where').textContent;

/** The dashboard's metadata read with its own entries replaced. */
function dashboardNotes(entries: Record<string, Partial<MetadataEntry> & { md: string }>) {
  const base = MOCK_METADATA[DASH_KEY]!;
  const own = Object.fromEntries(
    Object.entries(entries).map(([ns, e]) => [ns, { ...base.entries.overview, ...e } as MetadataEntry]),
  );
  server.use(
    http.get('*/metadata/:kind/:id', ({ params }) =>
      params.kind === 'dashboard' ? HttpResponse.json({ ...base, entries: own, children: {} }) : undefined,
    ),
  );
}

beforeEach(() => {
  localStorage.clear();
  setWindowWidth(1440);
});

afterEach(() => {
  setWindowWidth(1024);
  localStorage.clear();
});

describe('R206 N1 the bar: a link to All notes, never a toggle', () => {
  it('opens All notes, then reads "Showing all" (R207: a grey chip); × and Esc close and focus returns to it', async () => {
    page();
    const link = await find('[data-component="MetadataBarOpen"]');
    expect(link.textContent).toBe('View all');
    expect(link.hasAttribute('aria-pressed')).toBe(false);
    expect((await find('[data-component="MetadataBar"]')).textContent).toContain('Notes & insights');
    link.focus();
    fireEvent.click(link);
    await find('[data-component="MetadataDock"]');
    expect(where()).toBe('?note=*');
    const now = await find('[data-component="MetadataBarOpen"]');
    expect(now.textContent).toBe('Showing all');
    expect(now.getAttribute('aria-disabled')).toBe('true');
    // A second click does not close the dock: the bar is not a toggle.
    fireEvent.click(now);
    expect(where()).toBe('?note=*');
    fireEvent.keyDown(document.body, { key: 'Escape' });
    await waitFor(() => expect(document.querySelector('[data-component="MetadataDock"]')).toBeNull());
    await waitFor(() => expect(document.activeElement?.getAttribute('data-component')).toBe('MetadataBarOpen'));
    expect(document.activeElement?.textContent).toBe('View all');
  });

  it('reads "View all" again while one note is open, and goes to All notes', async () => {
    page('?note=overview');
    await find('[data-component="MetadataDock"][data-view="read"]');
    const link = await find('[data-component="MetadataBarOpen"]');
    expect(link.textContent).toBe('View all');
    fireEvent.click(link);
    await waitFor(() => expect(where()).toBe('?note=*'));
  });
});

describe('R206 N2 a dashboard has one block', () => {
  it('holds the glance rows; a row opens its note and is marked; Collapse is remembered', async () => {
    const view = page();
    const block = await find('[data-component="MetadataBar"][data-block="true"]');
    const glance = await find('[data-component="AtAGlance"]');
    expect(block.contains(glance)).toBe(true);
    expect(document.querySelectorAll('[data-component="AtAGlance"]').length).toBe(1);
    expect(glance.getAttribute('aria-label')).toBe('Most serious notes');
    const warn = glance.querySelector('[data-component="AtAGlanceItem"][data-severity="warn"]') as HTMLElement;
    expect(warn.tagName).toBe('BUTTON');
    fireEvent.click(warn);
    await waitFor(() => expect(where()).toBe('?note=overview'));
    await waitFor(() =>
      expect(
        document.querySelector('[data-component="AtAGlanceItem"][data-severity="warn"]')?.getAttribute('aria-current'),
      ).toBe('true'),
    );
    expect(
      document.querySelector('[data-component="AtAGlanceItem"][data-severity="decide"]')?.hasAttribute('aria-current'),
    ).toBe(false);
    const collapse = await find('[data-component="MetadataBarCollapse"]');
    expect(collapse.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(collapse);
    await waitFor(() => expect(document.querySelector('[data-component="AtAGlance"]')).toBeNull());
    view.unmount();
    page();
    expect((await find('[data-component="MetadataBarCollapse"]')).getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('[data-component="AtAGlance"]')).toBeNull();
  });

  it('with no serious note: the header line only, no Collapse', async () => {
    dashboardNotes({ how: { md: '---\ntitle: How to read\nseverity: info\n---\nTop to bottom.' } });
    page();
    const bar = await find('[data-component="MetadataBar"]');
    await waitFor(() => expect(bar.textContent).toContain('1 note'));
    expect(document.querySelector('[data-component="AtAGlance"]')).toBeNull();
    expect(document.querySelector('[data-component="MetadataBarCollapse"]')).toBeNull();
  });
});

describe('R206 N3 cards you click, the title said once', () => {
  it('opens a card from anywhere on it; the details link is named; no namespace on the card', async () => {
    page('?note=*');
    const dock = await find('[data-component="MetadataDock"]');
    const card = dock.querySelector('[data-component="MetadataCard"][data-namespace="review"]') as HTMLElement;
    expect(card.querySelector('[data-component="MetadataNamespace"]')).toBeNull();
    expect(card.textContent).not.toContain('review');
    expect(card.querySelector('[data-component="MetadataCardBy"]')?.textContent).toContain('agent');
    const details = card.querySelector('[data-component="MetadataCardRead"]') as HTMLElement;
    expect(details.tagName).toBe('BUTTON');
    expect(details.getAttribute('aria-label')).toBe('View details: Stage mix to decide');
    fireEvent.click(card.querySelector('[data-component="MetadataCardSummary"]') as HTMLElement);
    await waitFor(() => expect(where()).toBe('?note=review%40wdg_4d7b91ce'));
    expect((await find('[data-component="MetadataReadTitle"]')).textContent).toBe('Stage mix to decide');
    // The Read view keeps the namespace, as a tag.
    expect(
      document.querySelector('[data-component="MetadataRead"] [data-component="MetadataNamespace"]')?.textContent,
    ).toBe('review');
  });

  it('titles a note by its summary, else its first line; the namespace only when there is no text', () => {
    const at = (md: string) =>
      readEntry('agent_ns', { ...MOCK_METADATA[DASH_KEY]!.entries.overview, md } as MetadataEntry);
    const summaryOnly = at('---\nsummary: Sales fell in region North.\n---\nMore text.');
    expect(displayTitle(summaryOnly)).toBe('Sales fell in region North.');
    expect(displayLine(summaryOnly)).toBeUndefined();
    const bodyOnly = at('## Sales fell\n\nMore text.');
    expect(displayTitle(bodyOnly)).toBe('Sales fell');
    expect(displayLine(bodyOnly)).toBeUndefined();
    expect(displayTitle(at('---\nowner: x\n---\n'))).toBe('agent_ns');
    const long = at(`---\nsummary: ${'a'.repeat(120)}\n---\n`);
    expect(displayTitle(long)).toHaveLength(80);
    expect(displayLine(long)).toBe('a'.repeat(120));
    const titled = at('---\ntitle: T\nsummary: S\n---\n');
    expect([displayTitle(titled), displayLine(titled)]).toEqual(['T', 'S']);
  });

  it('a glance row uses the same title rule', async () => {
    dashboardNotes({ watch: { md: '---\nsummary: Returns doubled this week.\nseverity: warn\n---\nBody.' } });
    page();
    const row = await find('[data-component="AtAGlanceItem"]');
    expect(row.textContent).toContain('Returns doubled this week.');
    expect(row.textContent).not.toContain('watch');
  });
});

describe('R206 N4 the Read view does not print the title twice', () => {
  it('drops a leading heading equal to the title, keeps any other', () => {
    expect(withoutLeadingTitle('\n## Week in one line\n\nThe rest.', 'Week in **one** line')).toBe('\nThe rest.');
    expect(withoutLeadingTitle('## Another heading\n\nThe rest.', 'Week in one line')).toBe(
      '## Another heading\n\nThe rest.',
    );
    expect(withoutLeadingTitle('Week in one line\n\nNo heading.', 'Week in one line')).toBe(
      'Week in one line\n\nNo heading.',
    );
    // A closed ATX heading and a setext heading (CR-2).
    expect(withoutLeadingTitle('## Week in one line ##\n\nThe rest.', 'Week in one line')).toBe('\nThe rest.');
    expect(withoutLeadingTitle('Week in one line\n===\n\nThe rest.', 'Week in one line')).toBe('\nThe rest.');
    // A title taken from the body's first prose line is not repeated as the body's opening (BA-F4).
    expect(withoutLeadingTitle('Won deals only.\n\nMore.', 'Won deals only.', true)).toBe('\nMore.');
    const closed = readEntry('ns', {
      ...MOCK_METADATA[DASH_KEY]!.entries.overview,
      md: '## Sales fell ##\n\nx',
    } as MetadataEntry);
    expect(displayTitle(closed)).toBe('Sales fell');
  });

  it('in the dock', async () => {
    dashboardNotes({
      overview: { md: '---\ntitle: Week in one line\nseverity: warn\n---\n\n## Week in one line\n\nThe rest of it.' },
    });
    page('?note=overview');
    const read = await find('[data-component="MetadataRead"]');
    await waitFor(() => expect(read.textContent).toContain('The rest of it.'));
    expect([...read.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) => h.textContent)).toEqual([
      'Week in one line',
    ]);
  });
});

describe('R206 N5 charts stay still on a note action', () => {
  it('opening, reading, going back and closing re-render no chart view', async () => {
    page();
    await find('[data-component="AtAGlance"]');
    // Let the widget's reads settle, then count.
    await waitFor(() => expect(charts.renders).toBeGreaterThan(0));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });
    const before = charts.renders;
    fireEvent.click(await find('[data-component="MetadataBarOpen"]'));
    await find('[data-component="MetadataDock"]');
    fireEvent.click(document.querySelector('[data-component="MetadataCardRead"]') as HTMLElement);
    await find('[data-component="MetadataDock"][data-view="read"]');
    fireEvent.click(document.querySelector('[data-component="MetadataReadBack"]') as HTMLElement);
    await find('[data-component="MetadataDock"][data-view="notes"]');
    fireEvent.click(document.querySelector('[data-component="MetadataDockClose"]') as HTMLElement);
    await waitFor(() => expect(document.querySelector('[data-component="MetadataDock"]')).toBeNull());
    expect(charts.renders).toBe(before);
  });

  it('the chart data is the same object for the same inputs, a new one for a new filter', async () => {
    const widget = MOCK_DASHBOARD.definition.widgets[0]!;
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const none: { column: string; values: string[] }[] = [];
    const { result, rerender } = renderHook(({ f }) => useWidgetChartData(widget, f), {
      wrapper,
      initialProps: { f: none },
    });
    await waitFor(() => expect(result.current.chartData.length).toBeGreaterThan(0));
    const first = result.current.chartData;
    rerender({ f: none });
    expect(result.current.chartData).toBe(first);
    rerender({ f: [{ column: 'stage', values: ['Won'] }] });
    await waitFor(() => expect(result.current.chartData).not.toBe(first));
  });

  it('the lazy heatmap and gauge views are memoised too', () => {
    const memoType = Symbol.for('react.memo');
    expect((HeatmapView as unknown as { $$typeof: symbol }).$$typeof).toBe(memoType);
    expect((GaugeView as unknown as { $$typeof: symbol }).$$typeof).toBe(memoType);
  });
});

describe('R206 N5b every chart kind stays still, with warm and cold caches', () => {
  it('a series bar, a combo, a line, a pie, a stat and a table re-render no chart view on a note action', async () => {
    const q = MOCK_DASHBOARD.definition.widgets[0]!.queryId;
    const w = (id: string, extra: Record<string, unknown>) => ({
      id,
      queryId: q,
      title: id,
      span: 1,
      agg: 'sum',
      ...extra,
    });
    const many = {
      ...MOCK_DASHBOARD,
      definition: {
        widgets: [
          ...MOCK_DASHBOARD.definition.widgets,
          w('wdg_00000001', { chartType: 'bar', dimensionCol: 'stage', seriesCol: 'deal_id', measureCol: 'amount' }),
          w('wdg_00000002', {
            chartType: 'combo',
            dimensionCol: 'stage',
            measureCol: 'amount',
            measureCol2: 'probability',
          }),
          w('wdg_00000003', { chartType: 'line', dimensionCol: 'stage', measureCol: 'amount' }),
          w('wdg_00000004', { chartType: 'pie', dimensionCol: 'stage', measureCol: 'amount' }),
          w('wdg_00000005', { chartType: 'table', dimensionCol: 'stage', measureCol: 'amount' }),
        ],
      },
    };
    server.use(
      http.get('*/workspaces/:id/dashboards', () => HttpResponse.json([many])),
      http.get('*/dashboards/:id', () => HttpResponse.json(many)),
    );
    page();
    await find('[data-component="AtAGlance"]');
    await waitFor(() => expect(charts.renders).toBeGreaterThanOrEqual(5));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });
    const before = charts.renders;
    fireEvent.click(await find('[data-component="MetadataBarOpen"]'));
    await find('[data-component="MetadataDock"]');
    fireEvent.click(document.querySelector('[data-component="MetadataCardRead"]') as HTMLElement);
    await find('[data-component="MetadataDock"][data-view="read"]');
    fireEvent.click(document.querySelector('[data-component="MetadataDockClose"]') as HTMLElement);
    await waitFor(() => expect(document.querySelector('[data-component="MetadataDock"]')).toBeNull());
    expect(charts.renders).toBe(before);
  });

  it('the chart data holds with the bound query already cached and no filters passed (CR-1)', async () => {
    const widget = MOCK_DASHBOARD.definition.widgets[0]!;
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const first = renderHook(() => useWidgetChartData(widget), { wrapper });
    await waitFor(() => expect(first.result.current.chartData.length).toBeGreaterThan(0));
    first.unmount();
    // Warm cache: a second mount reads everything from the cache on its first render.
    const { result, rerender } = renderHook(() => useWidgetChartData(widget), { wrapper });
    await waitFor(() => expect(result.current.chartData.length).toBeGreaterThan(0));
    const data = result.current.chartData;
    rerender();
    expect(result.current.chartData).toBe(data);
  });
});

describe('R206 N6 the dock beside the data from 1200 px, over it below', () => {
  const cols = () =>
    Number(
      /repeat\((\d)/.exec(
        (document.querySelector('[data-component="DashboardGrid"]') as HTMLElement).style.gridTemplateColumns,
      )?.[1],
    );

  it('≥ 1200 px: beside, the grid gives up a column', async () => {
    page();
    await find('[data-component="DashboardGrid"]');
    const before = cols();
    fireEvent.click(await find('[data-component="MetadataBarOpen"]'));
    await find('[data-component="MetadataDock"]');
    expect(document.querySelector('[data-component="MetadataDockRow"]')?.getAttribute('data-docked')).toBe('true');
    expect(document.querySelector('[data-component="MetadataDockDrawer"]')).toBeNull();
    expect(cols()).toBe(Math.max(1, before - 1));
  });

  for (const [width, placement] of [
    [1024, 'right'],
    [600, 'bottom'],
  ] as const) {
    it(`${width} px: over the page (${placement}), the grid keeps its columns; Esc closes, focus returns`, async () => {
      setWindowWidth(width);
      page();
      await find('[data-component="DashboardGrid"]');
      const before = cols();
      const link = await find('[data-component="MetadataBarOpen"]');
      link.focus();
      fireEvent.click(link);
      await find('[data-component="MetadataDock"]');
      expect(document.querySelector('[data-component="MetadataDockRow"]')?.getAttribute('data-docked')).toBe('false');
      // Focus moves into the dock (its heading) on open.
      await waitFor(() => expect(document.activeElement?.closest('[data-component="MetadataDock"]')).not.toBeNull());
      await waitFor(() =>
        expect(document.querySelector('[data-placement]')?.getAttribute('data-placement')).toBe(placement),
      );
      expect(cols()).toBe(before);
      fireEvent.keyDown(document.body, { key: 'Escape' });
      await waitFor(() => expect(where()).toBe(''));
      await waitFor(() => expect(document.activeElement?.getAttribute('data-component')).toBe('MetadataBarOpen'));
    });
  }
});
