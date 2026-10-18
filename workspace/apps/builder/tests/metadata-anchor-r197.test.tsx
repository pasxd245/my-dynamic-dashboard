// R197 (item 3.8) — a metadata entry read against the reader's view. `current`
// shows as before; `refreshed` carries a small flag; `other_period` and
// `other_definition` collapse to one line saying what the entry was written
// for, and open on click (a definition change warns). The panel reads under
// the page's parameter values, and a widget's footer names its data.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { HttpResponse, http } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AntdConfig } from '@mdd/ui';
import { WidgetDataFooter, dataFooterParts } from '@/features/dashboard/WidgetDataFooter';
import type { Dataset } from '@/features/data-management/datasets/types';
import { MetadataEntriesList, MetadataEntryView, MetadataPanel } from '@/features/metadata/MetadataPanel';
import type { MetadataEntry } from '@/features/metadata/types';
import { MOCK_DATASET } from '@/mocks/fixtures';
import { server } from '@/mocks/server';

function withProviders(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AntdConfig>
        <App>
          <MemoryRouter>{ui}</MemoryRouter>
        </App>
      </AntdConfig>
    </QueryClientProvider>,
  );
}

const base: MetadataEntry = {
  md: 'Week 41 dipped: two reps were out.',
  source: 'ai',
  author: 'agent',
  writtenAt: '2026-10-12T08:00:00Z',
  definitionVersion: 'a',
  stale: false,
};

describe('R197 an entry by state', () => {
  it('current: no flag, the text shows', () => {
    const { container } = withProviders(
      <MetadataEntryView
        namespace="aicowork"
        entry={{ ...base, anchor: { definitionVersion: 'a' }, state: 'current' }}
      />,
    );
    expect(container.querySelector('[data-component="MetadataState"]')).toBeNull();
    expect(screen.getByText(/Week 41 dipped/)).toBeInTheDocument();
  });

  it('refreshed: a small flag, the text still shows', () => {
    const { container } = withProviders(
      <MetadataEntryView namespace="aicowork" entry={{ ...base, state: 'refreshed' }} />,
    );
    expect(container.querySelector('[data-component="MetadataState"]')?.getAttribute('data-state')).toBe('refreshed');
    expect(screen.getByText('Data refreshed since this was written')).toBeInTheDocument();
    expect(screen.getByText(/Week 41 dipped/)).toBeInTheDocument();
  });

  it('other_period: collapsed to what it was written for; opens on click', () => {
    const { container } = withProviders(
      <MetadataEntryView
        namespace="aicowork"
        entry={{
          ...base,
          anchor: { definitionVersion: 'a', params: { as_of: '2026-10-11', team: 'North' } },
          state: 'other_period',
        }}
        current={{ definitionVersion: 'a', params: { as_of: '2026-10-17', team: 'North' } }}
      />,
    );
    expect(screen.getByText('Written for as_of 2026-10-11 · viewing as_of 2026-10-17')).toBeInTheDocument();
    expect(screen.queryByText(/Week 41 dipped/)).toBeNull();
    fireEvent.click(container.querySelector('[data-component="MetadataToggle"]') as HTMLElement);
    expect(screen.getByText(/Week 41 dipped/)).toBeInTheDocument();
    expect(container.querySelector('[data-component="MetadataDefinitionWarning"]')).toBeNull();
  });

  it('other_definition: collapsed; opening it warns', () => {
    const { container } = withProviders(
      <MetadataEntryView namespace="aicowork" entry={{ ...base, stale: true, state: 'other_definition' }} />,
    );
    expect(screen.getByText('Written for an earlier definition.')).toBeInTheDocument();
    expect(screen.queryByText(/Week 41 dipped/)).toBeNull();
    fireEvent.click(screen.getByText('Show'));
    expect(container.querySelector('[data-component="MetadataDefinitionWarning"]')).not.toBeNull();
    expect(screen.getByText(/Week 41 dipped/)).toBeInTheDocument();
  });

  it('says when the writer gave no value, and when a note predates periods', () => {
    const assumed = withProviders(
      <MetadataEntryView
        namespace="a"
        entry={{
          ...base,
          anchor: { definitionVersion: 'a', params: { as_of: '2026-10-11' }, assumedParams: ['as_of'] },
          state: 'current',
        }}
      />,
    );
    expect(assumed.container.querySelector('[data-component="MetadataAssumed"]')?.textContent).toContain('as_of');
    assumed.unmount();
    const before = withProviders(
      <MetadataEntryView
        namespace="a"
        entry={{ ...base, anchor: { definitionVersion: 'a' }, state: 'current' }}
        current={{ definitionVersion: 'a', params: { as_of: '2026-10-17' } }}
      />,
    );
    expect(before.container.querySelector('[data-component="MetadataBeforePeriods"]')).not.toBeNull();
  });

  it('reads an rc.2 server (no state) from `stale`', () => {
    const { container } = withProviders(<MetadataEntryView namespace="a" entry={{ ...base, stale: true }} />);
    expect(container.querySelector('[data-component="MetadataEntry"]')?.getAttribute('data-state')).toBe(
      'other_definition',
    );
  });
});

describe('R197 another reading of the same entry', () => {
  it('a note back to current is open again (keyed by state — review P1)', () => {
    const entry = (state: MetadataEntry['state']): MetadataEntry => ({ ...base, state });
    const r = withProviders(<MetadataEntriesList entries={{ aicowork: entry('other_period') }} />);
    expect(screen.queryByText(/Week 41 dipped/)).toBeNull();
    r.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <AntdConfig>
          <App>
            <MemoryRouter>
              <MetadataEntriesList entries={{ aicowork: entry('current') }} />
            </MemoryRouter>
          </App>
        </AntdConfig>
      </QueryClientProvider>,
    );
    expect(screen.getByText(/Week 41 dipped/)).toBeInTheDocument();
  });

  it('names a parameter by its label', () => {
    withProviders(
      <MetadataEntryView
        namespace="a"
        entry={{ ...base, anchor: { definitionVersion: 'a', params: { as_of: '2026-10-11' } }, state: 'other_period' }}
        current={{ definitionVersion: 'a', params: { as_of: '2026-10-17' } }}
        paramLabels={{ as_of: 'As of' }}
      />,
    );
    expect(screen.getByText('Written for As of 2026-10-11 · viewing As of 2026-10-17')).toBeInTheDocument();
  });
});

describe('R197 the panel reads under the page values', () => {
  it('sends p.<name> and renders the server state', async () => {
    const seen: string[] = [];
    server.use(
      http.get('*/metadata/:kind/:id', ({ request }) => {
        seen.push(new URL(request.url).search);
        return HttpResponse.json({
          entries: {
            aicowork: {
              ...base,
              anchor: { definitionVersion: 'a', params: { as_of: '2026-10-11' } },
              state: 'other_period',
            },
          },
          current: { definitionVersion: 'a', params: { as_of: '2026-10-12' } },
        });
      }),
    );
    const { container } = withProviders(
      <MetadataPanel kind="query" nounId="qr_00000001" params={{ as_of: '2026-10-12' }} />,
    );
    await waitFor(() => expect(container.querySelector('[data-state="other_period"]')).not.toBeNull());
    expect(seen).toEqual(['?p.as_of=2026-10-12']);
    expect(screen.getByText('Written for as_of 2026-10-11 · viewing as_of 2026-10-12')).toBeInTheDocument();
  });
});

describe('R197 widget data footer', () => {
  it('names the latest refresh and the run of a published dataset', () => {
    const a = { ...MOCK_DATASET, id: 'ds_0000000a', refreshedAt: '2026-10-10T08:00:00Z' } as Dataset;
    const b = {
      ...MOCK_DATASET,
      id: 'ds_0000000b',
      refreshedAt: '2026-10-12T08:00:00Z',
      lineage: { runNumber: 7 },
    } as unknown as Dataset;
    expect(dataFooterParts([a, b])).toEqual({ refreshedAt: '2026-10-12T08:00:00Z', run: 7 });
    expect(dataFooterParts([a])).toEqual({ refreshedAt: '2026-10-10T08:00:00Z' });
    expect(dataFooterParts([])).toBeNull();
  });

  it('reads the datasets the widget read — at the version it read', async () => {
    const stale = withProviders(<WidgetDataFooter versions={{ [MOCK_DATASET.id]: MOCK_DATASET.dataVersion + 1 }} />);
    await new Promise((r) => setTimeout(r, 50));
    expect(stale.container.querySelector('[data-component="WidgetDataFooter"]')).toBeNull();
    stale.unmount();
    const { container } = withProviders(
      <WidgetDataFooter versions={{ [MOCK_DATASET.id]: MOCK_DATASET.dataVersion }} />,
    );
    await waitFor(() => expect(container.querySelector('[data-component="WidgetDataFooter"]')).not.toBeNull());
    expect(container.querySelector('[data-component="WidgetDataFooter"]')?.textContent).toMatch(/^Data: refreshed /);
  });
});
