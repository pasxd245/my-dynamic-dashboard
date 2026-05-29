// Advanced-query component + MSW-integration tests (R51 F2).
// Maps to advanced-query.md § Acceptance criteria 8–11 and
// "MSW handler returns the expected predicate set for a fixture query".

import { AntdConfig } from '@mdd/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AppLayout } from '@/components/AppLayout';
import { DatasetDetailPage } from '@/features/data-management/datasets/DatasetDetailPage';
import { MOCK_DATASET } from '@/mocks/fixtures';
import type { PredicateGroups } from '@/features/data-management/datasets/advanced-query/types';

const DS_ID = MOCK_DATASET.id;

function renderApp(initialPath: string) {
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

function aqPath(groups: PredicateGroups): string {
  return `/data-management/datasets/${DS_ID}?aq=${encodeURIComponent(JSON.stringify(groups))}`;
}

const WON: PredicateGroups = [[{ col: 3, dtype: 'string', op: 'equals', val: 'won' }]];
const WON_OR_LOST: PredicateGroups = [
  [{ col: 3, dtype: 'string', op: 'equals', val: 'won' }],
  [{ col: 3, dtype: 'string', op: 'equals', val: 'lost' }],
];

function advancedInput(): HTMLInputElement {
  return screen.getByLabelText('Advanced query') as HTMLInputElement;
}

describe('AdvancedQueryInput — states (criteria 8–11)', () => {
  it('C8: empty state shows the grammar hint and no error', async () => {
    renderApp(`/data-management/datasets/${DS_ID}`);
    await screen.findByText('D-0001');
    expect(screen.getByText('Type key:value predicates joined by AND / OR.')).toBeInTheDocument();
    expect(screen.queryByText(/Position \d+:/)).not.toBeInTheDocument();
    expect(advancedInput().value).toBe('');
  });

  it('C9 + MSW: deep-link aq=stage:won filters to the won subset, repopulates canonical text, shows readback', async () => {
    renderApp(aqPath(WON));
    // MSW handler returns the expected predicate set: only won rows.
    expect(await screen.findByText('D-0001')).toBeInTheDocument(); // won
    expect(await screen.findByText('D-0005')).toBeInTheDocument(); // won
    expect(await screen.findByText('D-0007')).toBeInTheDocument(); // won
    await waitFor(() => expect(screen.queryByText('D-0002')).not.toBeInTheDocument()); // open
    // Canonical text repopulated from the URL aq (not raw user text).
    expect(advancedInput().value).toBe('stage:won');
    // Readback summary present (1 group · 1 predicate) and persists.
    expect(screen.getByText(/1 group/)).toBeInTheDocument();
    // Matched counter: 3 won rows of 8.
    expect(screen.getByText(/Matched 3 \/ 8/)).toBeInTheDocument();
  });

  it('MSW: OR across the same column returns the union (the chip row cannot express this)', async () => {
    renderApp(aqPath(WON_OR_LOST));
    expect(await screen.findByText('D-0001')).toBeInTheDocument(); // won
    expect(await screen.findByText('D-0006')).toBeInTheDocument(); // lost
    await waitFor(() => expect(screen.queryByText('D-0002')).not.toBeInTheDocument()); // open excluded
    expect(screen.getByText(/Matched 4 \/ 8/)).toBeInTheDocument();
    expect(advancedInput().value).toBe('stage:won OR stage:lost');
  });

  it('C9: typing a valid query + Enter applies it', async () => {
    renderApp(`/data-management/datasets/${DS_ID}`);
    await screen.findByText('D-0001');
    const input = advancedInput();
    fireEvent.change(input, { target: { value: 'stage:lost' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(await screen.findByText('D-0006')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('D-0001')).not.toBeInTheDocument());
    expect(screen.getByText(/Matched 1 \/ 8/)).toBeInTheDocument();
  });

  it('C10: typing an invalid query shows the error and does NOT change the rows', async () => {
    renderApp(`/data-management/datasets/${DS_ID}`);
    await screen.findByText('D-0001');
    const input = advancedInput();
    fireEvent.change(input, { target: { value: 'nope:x' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // Error message rendered with a 1-based position.
    expect(await screen.findByText(/Unknown column/)).toBeInTheDocument();
    expect(screen.getByText(/Position 1:/)).toBeInTheDocument();
    // Rows unchanged — the query was not applied.
    expect(screen.getByText('D-0001')).toBeInTheDocument();
    expect(screen.getByText('D-0002')).toBeInTheDocument();
    expect(screen.getByText(/Matched 8 \/ 8/)).toBeInTheDocument();
  });

  it('C11: clearing the input removes the advanced query and restores all rows', async () => {
    renderApp(aqPath(WON));
    expect(await screen.findByText('D-0001')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('D-0002')).not.toBeInTheDocument());
    const input = advancedInput();
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // All rows back; the open row reappears.
    expect(await screen.findByText('D-0002')).toBeInTheDocument();
    expect(screen.getByText(/Matched 8 \/ 8/)).toBeInTheDocument();
  });
});

describe('R53 ui-design fix — label + explicit Clear', () => {
  it('renders a visible "Advanced query" label distinguishing it from the search box', async () => {
    const { container } = renderApp(`/data-management/datasets/${DS_ID}`);
    await screen.findByText('D-0001');
    // Visible label (not just the input's aria-label).
    expect(container.querySelector('[data-component="AdvancedQueryLabel"]')).toHaveTextContent(
      'Advanced query',
    );
  });

  it('hides the explicit Clear until a query is active', async () => {
    const { container } = renderApp(`/data-management/datasets/${DS_ID}`);
    await screen.findByText('D-0001');
    expect(container.querySelector('[data-component="AdvancedQueryClear"]')).toBeNull();
  });

  it('readback uses correct singular/plural — no literal "(s)"', async () => {
    const { container } = renderApp(aqPath(WON)); // 1 group, 1 predicate
    await screen.findByText('D-0001');
    const summary = container.querySelector('[data-component="AdvancedQuerySummary"]');
    expect(summary).toHaveTextContent('1 group · 1 predicate');
    expect(summary?.textContent).not.toContain('(s)');
  });

  it('readback pluralizes for multiple groups/predicates', async () => {
    const { container } = renderApp(aqPath(WON_OR_LOST)); // 2 groups, 2 predicates
    await screen.findByText('D-0001');
    const summary = container.querySelector('[data-component="AdvancedQuerySummary"]');
    expect(summary).toHaveTextContent('2 groups · 2 predicates');
  });

  it('the explicit Clear control is discoverable and removes ?aq=', async () => {
    const { container } = renderApp(aqPath(WON));
    expect(await screen.findByText('D-0001')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('D-0002')).not.toBeInTheDocument());
    const clear = container.querySelector('[data-component="AdvancedQueryClear"]') as HTMLElement;
    expect(clear).not.toBeNull();
    // R54: clear is now an always-visible in-field × icon (aria-label), not a text link.
    expect(clear).toHaveAttribute('aria-label', 'Clear');
    fireEvent.click(clear);
    // aq removed → all rows restored.
    expect(await screen.findByText('D-0002')).toBeInTheDocument();
    expect(screen.getByText(/Matched 8 \/ 8/)).toBeInTheDocument();
  });
});

describe('R54 discoverability + low-effort clear', () => {
  it('C18 + C19: the ? help popover opens and lists operators + this dataset columns', async () => {
    renderApp(`/data-management/datasets/${DS_ID}`);
    await screen.findByText('D-0001');
    // Query the trigger by data-component, not aria-label: the label
    // ("Help") is generic enough to collide, and it doubles as the
    // hover-tooltip text.
    const helpTrigger = document.querySelector('[data-component="AdvancedQueryHelpTrigger"]');
    if (!helpTrigger) throw new Error('AdvancedQueryHelpTrigger not found');
    fireEvent.click(helpTrigger);
    await screen.findByText('Columns'); // help section label (portaled popover)
    const popover = document.querySelector('[data-component="AdvancedQueryHelpContent"]') as HTMLElement;
    expect(popover).not.toBeNull();
    // Columns of THIS dataset, rendered from Dataset.columns.
    const cols = popover.querySelector('[data-component="AdvancedQueryHelpColumns"]') as HTMLElement;
    expect(cols.textContent).toContain('deal_id');
    expect(cols.textContent).toContain('stage');
    // Operator labels, rendered from the live vocabulary.
    expect(popover.textContent).toContain('contains'); // string ~
  });

  it('C20: an always-visible in-field × is shown whenever a query is active', async () => {
    const { container } = renderApp(aqPath(WON));
    await screen.findByText('D-0001');
    const clear = container.querySelector('[data-component="AdvancedQueryClear"]');
    expect(clear).not.toBeNull();
    expect(clear).toHaveAttribute('aria-label', 'Clear');
  });

  it('C21: Esc clears the query when the field is focused', async () => {
    renderApp(aqPath(WON));
    expect(await screen.findByText('D-0001')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('D-0002')).not.toBeInTheDocument());
    fireEvent.keyDown(advancedInput(), { key: 'Escape' });
    expect(await screen.findByText('D-0002')).toBeInTheDocument(); // all rows restored
    expect(screen.getByText(/Matched 8 \/ 8/)).toBeInTheDocument();
  });
});

describe('Integration — chip + advanced + ?q= three-way composition (criterion 17)', () => {
  it('all three surfaces active simultaneously intersect to the right rows, no thrash', async () => {
    // chip: amount > 10000 → {D-0001, D-0003, D-0005, D-0007}
    // aq:   stage:won OR stage:lost → {D-0001, D-0005, D-0006, D-0007}
    // q:    "24500" (D-0005's amount cell) → {D-0005}
    // intersection → D-0005 only.
    const path =
      `/data-management/datasets/${DS_ID}` +
      `?f1_op=gt&f1_val=10000&q=24500&aq=${encodeURIComponent(JSON.stringify(WON_OR_LOST))}`;
    renderApp(path);

    expect(await screen.findByText('D-0005')).toBeInTheDocument();
    // Rows excluded by one or more predicates are absent.
    await waitFor(() => expect(screen.queryByText('D-0001')).not.toBeInTheDocument()); // fails q
    expect(screen.queryByText('D-0007')).not.toBeInTheDocument(); // fails q
    expect(screen.queryByText('D-0002')).not.toBeInTheDocument(); // fails chip + aq
    expect(screen.getByText(/Matched 1 \/ 8/)).toBeInTheDocument();

    // All three surfaces render independently (no surface silently "wins").
    expect(advancedInput().value).toBe('stage:won OR stage:lost'); // advanced box
    expect(screen.getByDisplayValue('24500')).toBeInTheDocument(); // ?q= search box
    expect(screen.getByText(/10,000/)).toBeInTheDocument(); // chip row (amount > 10,000)
  });
});
