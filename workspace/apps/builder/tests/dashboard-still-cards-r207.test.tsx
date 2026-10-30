// R207 (item 5.7) — a note action leaves the dashboard's widget cards as they were:
// opening, reading, going back and closing a note re-render no card when the grid
// keeps its columns (the dock over the page, or reading inside an open dock); only
// the grid's column change beside the dock re-lays the cards out. Maps to
// metadata.md § Reading by layer ("Charts stay still") and AC 11.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AntdConfig } from '@mdd/ui';
import { AppLayout } from '@/components/AppLayout';
import { DashboardDetailPage } from '@/features/dashboard/DashboardDetailPage';
import { MOCK_DASHBOARD, MOCK_WORKSPACE } from '@/mocks/fixtures';

// Count every widget card render through the card's body component.
const cards = vi.hoisted(() => ({ renders: 0 }));
vi.mock('@/features/dashboard/WidgetView', async (orig) => {
  const real = await orig<typeof import('@/features/dashboard/WidgetView')>();
  const Counted = (props: Parameters<typeof real.WidgetView>[0]) => {
    cards.renders += 1;
    return <real.WidgetView {...props} />;
  };
  return { ...real, WidgetView: Counted };
});

function setWindowWidth(width: number) {
  (
    window as unknown as { happyDOM: { setWindowSize: (s: { width: number; height: number }) => void } }
  ).happyDOM.setWindowSize({ width, height: 900 });
}

function page() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AntdConfig>
        <App>
          <MemoryRouter initialEntries={[`/dashboards/${MOCK_WORKSPACE.id}/${MOCK_DASHBOARD.slug}`]}>
            <Routes>
              <Route path="/dashboards/:workspaceId/:slug" element={<DashboardDetailPage />} />
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

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 300));
  });
}

beforeEach(() => localStorage.clear());
afterEach(() => setWindowWidth(1024));

describe('R207 the widget cards stay still on a note action', () => {
  it('over the page (1024 px): open, read, back and close re-render no card', async () => {
    setWindowWidth(1024);
    page();
    await find('[data-component="AtAGlance"]');
    await waitFor(() => expect(document.querySelector('[data-component="DashboardGridCell"]')).not.toBeNull());
    await settle();
    const before = cards.renders;
    fireEvent.click(await find('[data-component="MetadataBarOpen"]'));
    await find('[data-component="MetadataDock"]');
    fireEvent.click(document.querySelector('[data-component="MetadataCardRead"]') as HTMLElement);
    await find('[data-component="MetadataDock"][data-view="read"]');
    fireEvent.click(document.querySelector('[data-component="MetadataReadBack"]') as HTMLElement);
    await find('[data-component="MetadataDock"][data-view="notes"]');
    fireEvent.keyDown(document.body, { key: 'Escape' });
    await waitFor(() => expect(document.querySelector('[data-component="MetadataDock"]')).toBeNull());
    await settle();
    expect(cards.renders).toBe(before);
  });

  it('beside (1440 px): reading inside the open dock re-renders no card; the column change does', async () => {
    setWindowWidth(1440);
    page();
    await find('[data-component="AtAGlance"]');
    await settle();
    const before = cards.renders;
    fireEvent.click(await find('[data-component="MetadataBarOpen"]'));
    await find('[data-component="MetadataDock"]');
    await settle();
    const opened = cards.renders;
    expect(opened).toBeGreaterThan(before); // the grid gave up a column
    fireEvent.click(document.querySelector('[data-component="MetadataCardRead"]') as HTMLElement);
    await find('[data-component="MetadataDock"][data-view="read"]');
    fireEvent.click(document.querySelector('[data-component="MetadataReadBack"]') as HTMLElement);
    await find('[data-component="MetadataDock"][data-view="notes"]');
    await settle();
    expect(cards.renders).toBe(opened);
  });

  it('the card menu still acts on the latest page state (Edit opens the builder for that widget)', async () => {
    setWindowWidth(1024);
    page();
    // Wait for the grid, then for the card's menu (CR-4: the first find raced the reads).
    await find('[data-component="DashboardGridCell"]');
    fireEvent.click(await waitFor(() => find('[data-component="WidgetMoreButton"]'), { timeout: 5000 }));
    fireEvent.click(
      await waitFor(() => {
        const el = [...document.querySelectorAll('.ant-dropdown-menu-item')].find((n) => n.textContent === 'Edit');
        if (!el) throw new Error('no Edit');
        return el as HTMLElement;
      }),
    );
    await find('[data-component="WidgetBuilder"]');
  });
});

describe('R207 two layout gaps from R206 QA', () => {
  it('QA-3: the sticky dock is as tall as the viewport from where it sits, not a fixed height', async () => {
    setWindowWidth(1440);
    // happy-dom lays nothing out: the dock's row sits 200 px down (CR-5).
    const rect = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({
        top: 200,
        bottom: 0,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 200,
        toJSON: () => ({}),
      });
    page();
    fireEvent.click(await find('[data-component="MetadataBarOpen"]'));
    const dock = await find('[data-component="MetadataDock"]');
    const wrapper = dock.parentElement as HTMLElement;
    // 900 − 200 − 16 (the bottom gap).
    await waitFor(() => expect(wrapper.style.maxHeight).toBe('684px'));
    rect.mockRestore();
  });

  it('P2-2: on a phone-width window the side menu starts collapsed, with no group popped open', async () => {
    setWindowWidth(390);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <AntdConfig>
          <App>
            <MemoryRouter initialEntries={['/']}>
              <AppLayout>
                <div>page</div>
              </AppLayout>
            </MemoryRouter>
          </App>
        </AntdConfig>
      </QueryClientProvider>,
    );
    await find('.ant-layout-sider-collapsed');
    await settle();
    expect(document.querySelector('.ant-menu-submenu-popup:not(.ant-menu-submenu-hidden)')).toBeNull();
  });

  it('a wide window keeps the side menu open', async () => {
    setWindowWidth(1440);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <AntdConfig>
          <App>
            <MemoryRouter initialEntries={['/']}>
              <AppLayout>
                <div>page</div>
              </AppLayout>
            </MemoryRouter>
          </App>
        </AntdConfig>
      </QueryClientProvider>,
    );
    await find('.ant-layout-sider');
    expect(document.querySelector('.ant-layout-sider-collapsed')).toBeNull();
  });
});
