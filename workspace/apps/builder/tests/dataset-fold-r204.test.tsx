// R204 — the dataset page folds its context sections (Details, Advanced query) on short viewports
// so the table keeps its height; the viewer's choice is remembered; an active advanced query is
// never hidden. Maps to dataset-detail.md § Folding sections (AC F1–F6).

import { AntdConfig } from '@mdd/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { act, fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppLayout } from '@/components/AppLayout';
import { DatasetDetailPage } from '@/features/data-management/datasets/DatasetDetailPage';
import { SHORT_VIEWPORT_PX } from '@/features/data-management/datasets/foldable';
import type { PredicateGroups } from '@/features/data-management/datasets/advanced-query/types';
import { MOCK_DATASET } from '@/mocks/fixtures';

const DS_ID = MOCK_DATASET.id;
const PATH = `/data-management/datasets/${DS_ID}`;
const WON: PredicateGroups = [[{ col: 3, dtype: 'string', op: 'equals', val: 'won' }]];

function renderApp(initialPath = PATH) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AntdConfig>
        <App>
          <MemoryRouter initialEntries={[initialPath]}>
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

/** A viewport `height` px tall, as far as `matchMedia('(max-height: …)')` is concerned. */
function viewport(height: number) {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
    const m = /max-height:\s*(\d+)px/.exec(query);
    return {
      matches: m ? height <= Number(m[1]) : false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    } as MediaQueryList;
  });
}

const strip = () => document.querySelector('[data-component="DatasetMetadataStrip"]');
const advanced = () => document.querySelector('[data-component="AdvancedQueryInput"]');
const toggle = (name: 'DatasetDetailsToggle' | 'AdvancedQueryToggle') =>
  document.querySelector(`[data-component="${name}"]`) as HTMLButtonElement | null;

beforeEach(() => {
  localStorage.clear();
});

afterEach(async () => {
  vi.restoreAllMocks();
  localStorage.clear();
  await act(async () => {
    await i18n.changeLanguage('en');
  });
});

describe('R204 folding sections on the dataset page', () => {
  it('F1: a short viewport starts with Details and Advanced query folded; the table is there', async () => {
    viewport(SHORT_VIEWPORT_PX - 40);
    renderApp();
    await screen.findByText('D-0001');
    expect(strip()).toBeNull();
    expect(advanced()).toBeNull();
    expect(toggle('DatasetDetailsToggle')?.getAttribute('aria-expanded')).toBe('false');
    expect(toggle('AdvancedQueryToggle')?.getAttribute('aria-expanded')).toBe('false');
  });

  it('F2: a tall viewport starts with both open, as before R204', async () => {
    viewport(SHORT_VIEWPORT_PX + 200);
    renderApp();
    await screen.findByText('D-0001');
    expect(strip()).not.toBeNull();
    expect(advanced()).not.toBeNull();
    expect(toggle('DatasetDetailsToggle')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('F3: the toggles open and fold each section and the choice is remembered', async () => {
    viewport(SHORT_VIEWPORT_PX - 40);
    const first = renderApp();
    await screen.findByText('D-0001');
    fireEvent.click(toggle('DatasetDetailsToggle')!);
    expect(strip()).not.toBeNull();
    fireEvent.click(toggle('AdvancedQueryToggle')!);
    expect(advanced()).not.toBeNull();
    expect(localStorage.getItem('mdd.datasetDetail.open.details')).toBe('1');
    first.unmount();

    renderApp();
    await screen.findByText('D-0001');
    expect(strip()).not.toBeNull(); // remembered over the short-viewport default
    fireEvent.click(toggle('DatasetDetailsToggle')!);
    expect(strip()).toBeNull();
    expect(localStorage.getItem('mdd.datasetDetail.open.details')).toBe('0');
  });

  it('F4: a remembered fold wins on a tall viewport too', async () => {
    localStorage.setItem('mdd.datasetDetail.open.details', '0');
    viewport(SHORT_VIEWPORT_PX + 200);
    renderApp();
    await screen.findByText('D-0001');
    expect(strip()).toBeNull();
    expect(advanced()).not.toBeNull();
  });

  it('F5: an active advanced query is shown even when folded, and its toggle is not offered', async () => {
    localStorage.setItem('mdd.datasetDetail.open.advancedQuery', '0');
    viewport(SHORT_VIEWPORT_PX - 40);
    renderApp(`${PATH}?aq=${encodeURIComponent(JSON.stringify(WON))}`);
    await screen.findByText('D-0001');
    expect(advanced()).not.toBeNull();
    expect((screen.getByLabelText('Advanced query') as HTMLInputElement).value).toContain('won');
    expect(toggle('AdvancedQueryToggle')).toBeNull();
  });

  it('F6: labels in Vietnamese', async () => {
    viewport(SHORT_VIEWPORT_PX - 40);
    await act(async () => {
      await i18n.changeLanguage('vi');
    });
    renderApp();
    await screen.findByText('D-0001');
    expect(toggle('DatasetDetailsToggle')?.textContent).toContain('Thông tin thêm');
    expect(toggle('AdvancedQueryToggle')?.textContent).toContain('Truy vấn nâng cao');
  });
});
