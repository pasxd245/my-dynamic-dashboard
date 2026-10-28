// R202 (item 5.2) — metadata read by layer: the reserved keys, the badge and
// At a glance rules, the `?note=` round trip, and the dashboard page — a widget
// badge opens the dock beside the grid, Notes → Read → back, Esc closes, a link
// opens a note.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AntdConfig } from '@mdd/ui';
import { DashboardDetailPage } from '@/features/dashboard/DashboardDetailPage';
import { badgeParts, glanceItems } from '@/features/metadata/badges';
import { parseNote, serializeNote } from '@/features/metadata/dock';
import { firstLine, readEntries, readEntry } from '@/features/metadata/reserved';
import type { MetadataEntry, MetadataRead } from '@/features/metadata/types';
import { MOCK_DASHBOARD, MOCK_WORKSPACE } from '@/mocks/fixtures';

const entry = (md: string, extra: Partial<MetadataEntry> = {}): MetadataEntry => ({
  md,
  source: 'ai',
  author: 'agent',
  writtenAt: '2026-10-15T08:00:00Z',
  definitionVersion: 'a',
  stale: false,
  state: 'current',
  ...extra,
});

describe('R202 reserved keys', () => {
  it('reads title, summary and severity and leaves the other pairs', () => {
    const r = readEntry(
      'ns',
      entry('---\ntitle: "Quoted title"\nsummary: One line.\nseverity: decide\nowner: lead\n---\nBody'),
    );
    expect(r.title).toBe('Quoted title');
    expect(r.summary).toBe('One line.');
    expect(r.severity).toBe('decide');
    expect(r.pairs).toEqual([['owner', 'lead']]);
    expect(r.body).toBe('Body');
  });

  it('shows an invalid value as an ordinary pair', () => {
    const long = 'x'.repeat(201);
    const r = readEntry('ns', entry(`---\ntitle: ${'t'.repeat(81)}\nsummary: ${long}\nseverity: urgent\n---\n`));
    expect(r.title).toBeUndefined();
    expect(r.summary).toBeUndefined();
    expect(r.severity).toBeUndefined();
    expect(r.pairs.map(([k]) => k)).toEqual(['title', 'summary', 'severity']);
  });

  it('keeps keys written in any script, with inner spaces', () => {
    const r = readEntry('ns', entry('---\nDữ liệu đến: 18/10\nmức: lỗi\n---\n'));
    expect(r.pairs).toEqual([
      ['Dữ liệu đến', '18/10'],
      ['mức', 'lỗi'],
    ]);
  });

  it('orders by severity, then namespace', () => {
    const order = readEntries({
      b: entry('---\nseverity: info\n---\n'),
      a: entry('plain'),
      c: entry('---\nseverity: error\n---\n'),
      d: entry('---\nseverity: decide\n---\n'),
    }).map((r) => r.namespace);
    expect(order).toEqual(['c', 'd', 'b', 'a']);
  });

  it('takes the first prose line when there is no summary', () => {
    expect(firstLine('## Heading **bold**\n\ntext')).toBe('Heading bold');
    expect(firstLine('| a | b |\n|---|---|\n| 1 | 2 |')).toBe('a · b');
    expect(firstLine('- [ ] [link](https://x.y) item')).toBe('link item');
  });
});

describe('R202 badges and At a glance', () => {
  it('shows at most two severities, the most serious first, and counts the rest', () => {
    const read = readEntries({
      a: entry('---\nseverity: warn\n---\n'),
      b: entry('---\nseverity: info\n---\n'),
      c: entry('---\nseverity: error\n---\n'),
      d: entry('---\nseverity: decide\n---\n'),
      e: entry('plain'),
    });
    expect(badgeParts(read)).toEqual({ chips: ['error', 'decide'], rest: 3 });
    expect(badgeParts(readEntries({ a: entry('plain') }))).toEqual({ chips: [], rest: 1 });
  });

  it('lifts serious, current notes only — at most three, by severity then widget order', () => {
    const read: MetadataRead = {
      entries: { own: entry('---\nseverity: warn\nsummary: own\n---\n') },
      children: {
        w2: {
          x: entry('---\nseverity: error\n---\n'),
          old: entry('---\nseverity: error\n---\n', { state: 'other_period' }),
          info: entry('---\nseverity: info\n---\n'),
        },
        w1: {
          y: entry('---\nseverity: decide\n---\n'),
          z: entry('---\nseverity: warn\n---\n', { state: 'refreshed' }),
        },
      },
    };
    const items = glanceItems(read, ['w1', 'w2'], (id) => id.toUpperCase());
    expect(items.map((g) => `${g.childId ?? '.'}:${g.item.namespace}`)).toEqual(['w2:x', 'w1:y', '.:own']);
    expect(items[0]?.childLabel).toBe('W2');
  });
});

describe('R202 the note parameter', () => {
  it('round-trips every target', () => {
    for (const v of ['*', '.', 'aicowork', '@wdg_1', 'aicowork@wdg_1', 'ns@Ngày khởi tạo']) {
      const sel = parseNote(v);
      expect(sel).not.toBeNull();
      expect(serializeNote(sel as NonNullable<typeof sel>)).toBe(v);
    }
    expect(parseNote(null)).toBeNull();
    expect(parseNote('ns@')).toEqual({ scope: 'self', ns: 'ns' });
  });
});

function Where() {
  const loc = useLocation();
  return <output data-testid="where">{loc.search}</output>;
}

function page(search = '') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui: ReactNode = (
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
    </QueryClientProvider>
  );
  return render(ui);
}

async function find(sel: string): Promise<HTMLElement> {
  return waitFor(() => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`no ${sel}`);
    return el as HTMLElement;
  });
}

describe('R202 the dashboard page', () => {
  it('badges the widget, lifts At a glance, and has no inline panel', async () => {
    page();
    const badge = await find('[data-component="WidgetMetadataButton"]');
    expect(badge.getAttribute('data-count')).toBe('2');
    expect(
      [...badge.querySelectorAll('[data-component="MetadataSeverity"]')].map((t) => t.getAttribute('data-severity')),
    ).toEqual(['decide']);
    expect(badge.querySelector('[data-component="WidgetMetadataMore"]')?.textContent).toBe('+1');
    const glance = await find('[data-component="AtAGlance"]');
    expect(
      [...glance.querySelectorAll('[data-component="AtAGlanceItem"]')].map((b) => b.getAttribute('data-severity')),
    ).toEqual(['decide', 'warn']);
    expect(document.querySelector('[data-component="MetadataPanel"]')).toBeNull();
    expect((await find('[data-component="MetadataBar"]')).textContent).toContain('3 entries');
  });

  it('opens the dock beside the grid: Notes → Read → back → Esc', async () => {
    page();
    const cols = () =>
      Number(
        /repeat\((\d)/.exec(
          (document.querySelector('[data-component="DashboardGrid"]') as HTMLElement).style.gridTemplateColumns,
        )?.[1],
      );
    await find('[data-component="DashboardGrid"]');
    const before = cols();
    fireEvent.click(await find('[data-component="WidgetMetadataButton"]'));
    const dock = await find('[data-component="MetadataDock"]');
    expect(document.querySelector('[data-component="MetadataDockRow"]')?.getAttribute('data-docked')).toBe('true');
    // The grid is still on the page, next to the dock — one column narrower while it is open.
    expect(cols()).toBe(Math.max(1, before - 1));
    expect(screen.getByTestId('where').textContent).toBe('?note=%40wdg_4d7b91ce');
    const cards = [...dock.querySelectorAll('[data-component="MetadataCard"]')];
    expect(cards.map((c) => c.getAttribute('data-namespace'))).toEqual(['review', 'notes']);
    expect(cards[0]?.querySelector('[data-component="MetadataCardTitle"]')?.textContent).toBe('Stage mix to decide');
    expect(cards[0]?.querySelector('[data-component="MetadataCardSummary"]')?.textContent).toBe(
      'Negotiation holds most of the open amount.',
    );
    // The human note has no summary: its first line stands in.
    expect(cards[1]?.querySelector('[data-component="MetadataCardSummary"]')?.textContent).toBe(
      'Won deals only — see the query filter.',
    );
    fireEvent.click(cards[0]?.querySelector('[data-component="MetadataCardRead"]') as HTMLElement);
    await waitFor(() => expect(dock.getAttribute('data-view')).toBe('read'));
    expect(screen.getByTestId('where').textContent).toBe('?note=review%40wdg_4d7b91ce');
    expect(dock.querySelector('[data-component="SafeMarkdownTable"] table')).not.toBeNull();
    expect(dock.querySelector('[data-component="MetadataFrontmatter"]')?.textContent).toContain('sales lead');
    fireEvent.click(dock.querySelector('[data-component="MetadataReadBack"]') as HTMLElement);
    await waitFor(() =>
      expect(document.querySelector('[data-component="MetadataDock"]')?.getAttribute('data-view')).toBe('notes'),
    );
    fireEvent.keyDown(document.body, { key: 'Escape' });
    await waitFor(() => expect(document.querySelector('[data-component="MetadataDock"]')).toBeNull());
    expect(screen.getByTestId('where').textContent).toBe('');
    expect(cols()).toBe(before);
  });

  it('opens a note from a link, and All notes from the bar groups the dashboard and its widget', async () => {
    page('?note=overview');
    const dock = await find('[data-component="MetadataDock"][data-view="read"]');
    expect(dock.querySelector('[data-component="MetadataReadTitle"]')?.textContent).toBe('Week in one line');
    fireEvent.click(dock.querySelector('[data-component="MetadataDockClose"]') as HTMLElement);
    await waitFor(() => expect(document.querySelector('[data-component="MetadataDock"]')).toBeNull());
    fireEvent.click(await find('[data-component="MetadataBarOpen"]'));
    const all = await find('[data-component="MetadataDock"]');
    expect(
      [...all.querySelectorAll('[data-component="MetadataGroup"]')].map((g) => g.getAttribute('data-child')),
    ).toEqual(['', 'wdg_4d7b91ce']);
    // From All notes, Read goes back to All notes.
    fireEvent.click(all.querySelectorAll('[data-component="MetadataCardRead"]')[1] as HTMLElement);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('?note=review%40wdg_4d7b91ce'));
    fireEvent.click(document.querySelector('[data-component="MetadataReadBack"]') as HTMLElement);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('?note=*'));
  });

  it('an At a glance card opens its note', async () => {
    page();
    const glance = await find('[data-component="AtAGlance"]');
    fireEvent.click(glance.querySelector('[data-component="AtAGlanceItem"][data-severity="warn"]') as HTMLElement);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('?note=overview'));
    expect((await find('[data-component="MetadataReadTitle"]')).textContent).toBe('Week in one line');
  });
});
