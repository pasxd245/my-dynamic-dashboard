// R204 — the dataset page folds its context sections (Details, Advanced query) on short viewports
// so the table keeps its height; the viewer's choice is remembered; an active advanced query is
// never hidden. Maps to dataset-detail.md § Folding sections (AC F1–F6).

import { AntdConfig } from '@mdd/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

/**
 * A viewport `height` px tall, as far as `matchMedia('(max-height: …)')` is concerned. Returns
 * `resize(h)`: changes the height and fires `change` on every list handed out.
 */
function viewport(height: number) {
  let h = height;
  const lists: { query: string; fns: Set<(e: { matches: boolean; media: string }) => void> }[] = [];
  const matches = (query: string) => {
    const m = /max-height:\s*(\d+)px/.exec(query);
    return m ? h <= Number(m[1]) : false;
  };
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
    const entry = { query, fns: new Set<(e: { matches: boolean; media: string }) => void>() };
    lists.push(entry);
    return {
      get matches() {
        return matches(query);
      },
      media: query,
      onchange: null,
      addEventListener: (_: string, fn: (e: { matches: boolean; media: string }) => void) => entry.fns.add(fn),
      removeEventListener: (_: string, fn: (e: { matches: boolean; media: string }) => void) => entry.fns.delete(fn),
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  });
  return (next: number) => {
    h = next;
    act(() => {
      for (const l of lists) for (const fn of l.fns) fn({ matches: matches(l.query), media: l.query });
    });
  };
}

const strip = () => document.querySelector('[data-component="DatasetMetadataStrip"]');
/** The advanced query input when it is shown; a folded one stays mounted (keeps a draft) but hidden. */
const advanced = () => {
  const el = document.querySelector('[data-component="AdvancedQueryInput"]');
  return el && !el.closest('[hidden]') ? el : null;
};
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

  it('F7: clearing an active query while folded keeps the field shown and focused (R54)', async () => {
    viewport(SHORT_VIEWPORT_PX - 40);
    renderApp(`${PATH}?aq=${encodeURIComponent(JSON.stringify(WON))}`);
    await screen.findByText('D-0001');
    const input = screen.getByLabelText('Advanced query') as HTMLInputElement;
    input.focus();
    fireEvent.keyDown(input, { key: 'Escape' });
    await waitFor(() => expect(input.value).toBe(''));
    expect(advanced()).not.toBeNull();
    expect(document.activeElement).toBe(input);
    // The toggle is back (the query no longer governs the rows) and reads open; it folds the field.
    expect(toggle('AdvancedQueryToggle')?.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle('AdvancedQueryToggle')!);
    expect(advanced()).toBeNull();
  });

  it('F8: folding keeps a typed draft; opening shows it again', async () => {
    viewport(SHORT_VIEWPORT_PX + 200);
    renderApp();
    await screen.findByText('D-0001');
    const input = screen.getByLabelText('Advanced query') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'stage:' } }); // unparseable — never applied
    fireEvent.click(toggle('AdvancedQueryToggle')!);
    expect(advanced()).toBeNull();
    fireEvent.click(toggle('AdvancedQueryToggle')!);
    expect((screen.getByLabelText('Advanced query') as HTMLInputElement).value).toBe('stage:');
  });

  it('F9: with no recorded choice the default follows a resize across the threshold', async () => {
    const resize = viewport(SHORT_VIEWPORT_PX + 200);
    renderApp();
    await screen.findByText('D-0001');
    expect(strip()).not.toBeNull();
    resize(SHORT_VIEWPORT_PX - 1);
    expect(strip()).toBeNull();
    resize(SHORT_VIEWPORT_PX);
    expect(strip()).not.toBeNull();
  });

  it('F10: blocked storage — the page renders and the toggles work for the visit', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    viewport(SHORT_VIEWPORT_PX - 40);
    renderApp();
    await screen.findByText('D-0001');
    expect(strip()).toBeNull();
    fireEvent.click(toggle('DatasetDetailsToggle')!);
    expect(strip()).not.toBeNull();
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
