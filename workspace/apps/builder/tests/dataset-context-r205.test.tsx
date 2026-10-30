// R205 (item 5.5) — the dataset page's context controls sit beside what they open and nothing is
// said twice: the Details toggle ends the subtitle line; the Details strip leaves out what the
// subtitle says (the Properties drawer keeps all seven fields — column-visibility.test.tsx); the
// subtitle's relative time is lower case inline; the Metadata bar explains the column dots when a
// column has notes. Maps to dataset-detail.md AC 12 and metadata.md § Metadata bar.

import { AntdConfig } from '@mdd/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppLayout } from '@/components/AppLayout';
import { DatasetDetailPage } from '@/features/data-management/datasets/DatasetDetailPage';
import { SHORT_VIEWPORT_PX } from '@/features/data-management/datasets/foldable';
import { MOCK_DATASET, MOCK_METADATA } from '@/mocks/fixtures';
import { server } from '@/mocks/server';

const PATH = `/data-management/datasets/${MOCK_DATASET.id}`;

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AntdConfig>
        <App>
          <MemoryRouter initialEntries={[PATH]}>
            <AppLayout>
              <Routes>
                <Route path="/data-management/datasets/:id" element={<DatasetDetailPage />} />
              </Routes>
            </AppLayout>
          </MemoryRouter>
        </App>
      </AntdConfig>
    </QueryClientProvider>,
  );
}

/** A tall viewport (sections open unless a choice says otherwise), as `matchMedia` sees it. */
function tallViewport() {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: /max-height:\s*(\d+)px/.test(query)
          ? SHORT_VIEWPORT_PX + 200 <= Number(/(\d+)px/.exec(query)?.[1])
          : false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

const q = (sel: string) => document.querySelector(`[data-component="${sel}"]`) as HTMLElement | null;

beforeEach(() => {
  localStorage.clear();
  tallViewport();
});

afterEach(async () => {
  vi.restoreAllMocks();
  localStorage.clear();
  await act(async () => {
    await i18n.changeLanguage('en');
  });
});

describe('R205 dataset page context beside its control', () => {
  it('C1: the Details toggle ends the subtitle line; the toolbar keeps only Advanced query and Columns', async () => {
    renderApp();
    await screen.findByText('D-0001');
    const toggle = q('DatasetDetailsToggle');
    expect(toggle).not.toBeNull();
    expect(q('DatasetDetailSearchBar')?.contains(toggle)).toBe(false);
    expect(toggle?.closest('.ant-typography')?.textContent).toMatch(/rows ·/);
    expect(q('DatasetDetailSearchBar')?.contains(q('AdvancedQueryToggle'))).toBe(true);
    // the toggle still opens and folds the section it controls
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle!);
    expect(q('DatasetMetadataStrip')).toBeNull();
    expect(q('DatasetDetailsToggle')?.getAttribute('aria-expanded')).toBe('false');
  });

  it('C2: the strip shows only what the subtitle does not say', async () => {
    renderApp();
    await screen.findByText('D-0001');
    const strip = q('DatasetMetadataStrip')!;
    for (const label of ['Workspace', 'Data version', 'Format'])
      expect(within(strip).getByText(label)).toBeInTheDocument();
    for (const label of ['Rows', 'Columns', 'Size', 'Uploaded']) expect(within(strip).queryByText(label)).toBeNull();
  });

  it('C3: the subtitle reads the relative time inline (lower case), EN and VI', async () => {
    const now = new Date().toISOString();
    server.use(
      http.get('*/datasets/:id', () => HttpResponse.json({ ...MOCK_DATASET, createdAt: now, refreshedAt: now })),
    );
    renderApp();
    await screen.findByText('D-0001');
    const line = () => q('DatasetDetailsToggle')?.closest('.ant-typography')?.textContent ?? '';
    expect(line()).toMatch(/Uploaded just now/);
    await act(async () => {
      await i18n.changeLanguage('vi');
    });
    expect(line()).toMatch(/Tải lên vừa xong/);
    // a standalone value keeps its capital
    expect(within(q('DatasetMetadataStrip')!).getByText(/Vừa xong/)).toBeInTheDocument();
  });

  it('C4: with column notes the Metadata bar explains the dots; with dataset notes only, no hint', async () => {
    const view = renderApp();
    await screen.findByText('D-0001');
    expect(await screen.findByText(/Dots on column headers mark notes/)).toBeInTheDocument();
    expect(q('MetadataBar')?.contains(q('MetadataBarHint'))).toBe(true);
    view.unmount();

    const own = MOCK_METADATA[`dataset/${MOCK_DATASET.id}`]!;
    server.use(
      http.get('*/metadata/:kind/:id', () => HttpResponse.json({ entries: own.entries, current: own.current })),
    );
    renderApp();
    await screen.findByText('D-0001');
    await screen.findByText('Metadata');
    expect(q('MetadataBarHint')).toBeNull();
  });
});
