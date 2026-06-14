// R69 Saved Query tests (MSW). Default handlers in src/mocks/handlers.ts
// cover the happy paths; per-test `server.use(...)` overrides supply the
// empty-list and stale-run cases.

import { AntdConfig } from '@mdd/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { http, HttpResponse } from 'msw';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AppLayout } from '@/components/AppLayout';
import { DatasetDetailPage } from '@/features/data-management/datasets/DatasetDetailPage';
import { QueriesPage } from '@/features/data-management/queries/QueriesPage';
import { QueryDetailPage } from '@/features/data-management/queries/QueryDetailPage';
import { MOCK_DATASET, MOCK_JOINED_QUERY, MOCK_QUERY } from '@/mocks/fixtures';
import { server } from '@/mocks/server';

const QR_ID = MOCK_QUERY.id;
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
                <Route path="/data-management/queries" element={<QueriesPage />} />
                <Route path="/data-management/queries/:id" element={<QueryDetailPage />} />
              </Routes>
            </AppLayout>
          </MemoryRouter>
        </App>
      </AntdConfig>
    </QueryClientProvider>,
  );
}

describe('Queries catalog', () => {
  it('lists a saved query with its name and source dataset', async () => {
    renderApp('/data-management/queries');
    expect(await screen.findByText(MOCK_QUERY.name)).toBeInTheDocument();
    // Source-dataset link renders the dataset's name (resolved from datasets list).
    expect(await screen.findByText(MOCK_DATASET.name)).toBeInTheDocument();
  });

  it('shows the empty state when the workspace has no saved queries', async () => {
    server.use(
      http.get('*/workspaces/:id/queries', () => HttpResponse.json([])),
    );
    renderApp('/data-management/queries');
    expect(await screen.findByText('No saved queries yet')).toBeInTheDocument();
  });
});

describe('QueryDetailPage (query mode)', () => {
  it('reopens a query: predicate summary, matched counter, and reused row table', async () => {
    renderApp(`/data-management/queries/${QR_ID}`);
    // Live re-run of (stage=won AND amount>1000) over MOCK_ROWS → 3 rows.
    // (The name appears in both breadcrumb + title, so key readiness off the
    // unique matched counter instead.)
    expect(await screen.findByText(/Matched 3 \/ 8/)).toBeInTheDocument();
    // The query name renders (in the title at minimum).
    expect(screen.getAllByText(MOCK_QUERY.name).length).toBeGreaterThan(0);
    // The read-only predicate summary shows the saved chip filter.
    const summaryEl = document.querySelector('[data-component="QueryPredicateSummary"]');
    expect(summaryEl).not.toBeNull();
    expect(within(summaryEl as HTMLElement).getByText(/stage/)).toBeInTheDocument();
    // The shared PagedRowsView renders the matched rows.
    expect(screen.getByText('D-0001')).toBeInTheDocument();
  });

  it('renders the stale state on 409 query_stale', async () => {
    server.use(
      http.get('*/queries/:id/rows', () => HttpResponse.json({ code: 'query_stale' }, { status: 409 })),
    );
    renderApp(`/data-management/queries/${QR_ID}`);
    expect(await screen.findByText('This query needs attention')).toBeInTheDocument();
    expect(document.querySelector('[data-component="QueryDetailStale"]')).not.toBeNull();
  });
});

describe('Save as Query (from the dataset detail page)', () => {
  it('disables the action when no predicate is active', async () => {
    renderApp(`/data-management/datasets/${DS_ID}`);
    const action = (await screen.findByText('Save filters as Query')).closest('button');
    expect(action).toBeDisabled();
  });

  it('saves the active predicate state and navigates to the new query', async () => {
    // Return MOCK_QUERY from create so the post-save navigate lands on a
    // handled /queries/:id (full save → navigate → reopen → run round-trip).
    server.use(
      http.post('*/workspaces/:id/queries', () => HttpResponse.json(MOCK_QUERY, { status: 201 })),
    );
    // A per-column filter is active → the action is enabled.
    renderApp(`/data-management/datasets/${DS_ID}?f3_op=equals&f3_val=won`);
    const action = (await screen.findByText('Save filters as Query')).closest('button') as HTMLButtonElement;
    await waitFor(() => expect(action).not.toBeDisabled());
    fireEvent.click(action);
    // Modal opens; submit with the suggested name.
    expect(await screen.findByText('Save filters as Query', { selector: '.ant-modal-title' })).toBeInTheDocument();
    const okBtn = document.querySelector('.ant-modal-footer .ant-btn-primary') as HTMLButtonElement;
    fireEvent.click(okBtn);
    // Lands on the query-mode detail of the saved query.
    expect(await screen.findByText(/Matched 3 \/ 8/)).toBeInTheDocument();
  });
});

describe('Join execution (R71)', () => {
  const JOIN_ID = MOCK_JOINED_QUERY.id;

  it('reopens a joined query: read-only join summary + joined rows via the reused table', async () => {
    renderApp(`/data-management/queries/${JOIN_ID}`);
    // Joined run → MOCK_JOINED_ROWS (total 2); the joined-aware counter omits "/ Y".
    expect(await screen.findByText(/Matched 2 rows/)).toBeInTheDocument();
    // The read-only join summary renders the governed edge's key pair (the
    // relationship fetch resolves independently of the rows — poll for it).
    const keyPair = await screen.findByText(/deal_id ↔ account_id/);
    expect(keyPair.closest('[data-component="QueryJoinSummary"]')).not.toBeNull();
    // The reused <PagedRowsView> shows a cell from the RIGHT (joined-in) source.
    expect(screen.getByText('Acme')).toBeInTheDocument();
  });

  it('blocks the join on 409 relationship_stale (join-unavailable state, not a crash)', async () => {
    server.use(
      http.get('*/queries/:id/rows', () => HttpResponse.json({ code: 'relationship_stale' }, { status: 409 })),
    );
    renderApp(`/data-management/queries/${JOIN_ID}`);
    expect(await screen.findByText('This join is unavailable')).toBeInTheDocument();
    expect(document.querySelector('[data-component="QueryDetailJoinUnavailable"]')).not.toBeNull();
  });

  it('creates a joined query from the dataset detail page and lands on its detail', async () => {
    server.use(
      http.post('*/workspaces/:id/queries', () => HttpResponse.json(MOCK_JOINED_QUERY, { status: 201 })),
    );
    renderApp(`/data-management/datasets/${DS_ID}`);
    // R72: the join affordance moved into the "Actions ▾" dropdown. Open it,
    // then click the "Join with related dataset" item (enabled — MOCK_DATASET
    // has a valid relationship).
    const actions = (await screen.findByText('Actions')).closest('button') as HTMLButtonElement;
    fireEvent.click(actions);
    const joinItem = await screen.findByText('Join with related dataset');
    fireEvent.click(joinItem);
    // Modal opens; the relationship Select is pre-seeded with the first valid edge.
    expect(await screen.findByText('Join with a related dataset', { selector: '.ant-modal-title' })).toBeInTheDocument();
    const nameInput = document.querySelector('[data-component="JoinQueryNameInput"]') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Deals × Accounts' } });
    const okBtn = document.querySelector('.ant-modal-footer .ant-btn-primary') as HTMLButtonElement;
    await waitFor(() => expect(okBtn).not.toBeDisabled());
    fireEvent.click(okBtn);
    // Round-trip: lands on the joined query's detail (joined-aware counter).
    expect(await screen.findByText(/Matched 2 rows/)).toBeInTheDocument();
  });

  it('disables the join affordance when the dataset has no valid relationships', async () => {
    server.use(http.get('*/workspaces/:id/relationships', () => HttpResponse.json([])));
    renderApp(`/data-management/datasets/${DS_ID}`);
    const actions = (await screen.findByText('Actions')).closest('button') as HTMLButtonElement;
    fireEvent.click(actions);
    // The join item renders disabled (no valid relationship to join on).
    const joinItem = (await screen.findByText('Join with related dataset')).closest('.ant-dropdown-menu-item');
    await waitFor(() => expect(joinItem).toHaveClass('ant-dropdown-menu-item-disabled'));
  });
});

describe('Query construction (R72 — editable builder)', () => {
  const JOIN_ID = MOCK_JOINED_QUERY.id;

  function clickEdit() {
    const editBtn = document.querySelector('[data-component="QueryDetailEdit"]') as HTMLButtonElement;
    fireEvent.click(editBtn);
  }

  it('enters edit mode and live-previews the joined definition (single view)', async () => {
    renderApp(`/data-management/queries/${JOIN_ID}`);
    expect(await screen.findByText(/Matched 2 rows/)).toBeInTheDocument();
    clickEdit();
    // Controls + live preview render together (no tabs); the join editor shows,
    // the status reports the live count, and joined rows are visible at once.
    expect(document.querySelector('[data-component="QueryBuilderPanel"]')).not.toBeNull();
    expect(document.querySelector('[data-component="JoinEditor"]')).not.toBeNull();
    expect(await screen.findByText(/Preview · 2 rows/)).toBeInTheDocument();
    expect(await screen.findByText('Acme')).toBeInTheDocument();
  });

  it('edits the definition, previews, and saves from the header — returning to the read-only view', async () => {
    renderApp(`/data-management/queries/${JOIN_ID}`);
    expect(await screen.findByText(/Matched 2 rows/)).toBeInTheDocument();
    clickEdit();
    // Save now lives in the page header; disabled until the copy differs.
    const searchInput = (await screen.findByPlaceholderText('Match any cell…')) as HTMLInputElement;
    const saveBtn = document.querySelector('[data-component="QueryBuilderSave"]') as HTMLButtonElement;
    expect(saveBtn).toBeDisabled();
    // Type a row search → the definition is now dirty; preview re-runs.
    fireEvent.change(searchInput, { target: { value: 'D-0001' } });
    await waitFor(() => expect(saveBtn).not.toBeDisabled());
    fireEvent.click(saveBtn);
    // PUT round-trips; the builder closes and the read-only [Edit] reappears.
    await waitFor(() => expect(document.querySelector('[data-component="QueryDetailEdit"]')).not.toBeNull());
    expect(document.querySelector('[data-component="QueryBuilderPanel"]')).toBeNull();
  });

  it('blocks save with the join-unavailable state when the previewed edge is stale', async () => {
    server.use(
      http.post('*/workspaces/:id/queries/preview', () =>
        HttpResponse.json({ code: 'relationship_stale' }, { status: 409 }),
      ),
    );
    renderApp(`/data-management/queries/${JOIN_ID}`);
    expect(await screen.findByText(/Matched 2 rows/)).toBeInTheDocument();
    clickEdit();
    expect(await screen.findByText(/This join is unavailable/)).toBeInTheDocument();
    expect(document.querySelector('[data-component="QueryBuilderJoinStale"]')).not.toBeNull();
    const saveBtn = document.querySelector('[data-component="QueryBuilderSave"]') as HTMLButtonElement;
    expect(saveBtn).toBeDisabled();
  });

  it('cancels out of edit mode with no changes, restoring the read-only view', async () => {
    renderApp(`/data-management/queries/${JOIN_ID}`);
    expect(await screen.findByText(/Matched 2 rows/)).toBeInTheDocument();
    clickEdit();
    await screen.findByPlaceholderText('Match any cell…');
    // Cancel now lives in the page header.
    const cancelBtn = document.querySelector('[data-component="QueryBuilderCancel"]') as HTMLButtonElement;
    fireEvent.click(cancelBtn);
    await waitFor(() => expect(document.querySelector('[data-component="QueryDetailEdit"]')).not.toBeNull());
    expect(document.querySelector('[data-component="QueryBuilderPanel"]')).toBeNull();
  });

  // AC #5 (client-side, flag-don't-crash): a filter on a RIGHT-source column,
  // then clearing the join, leaves the atom dangling out of the (now smaller)
  // effective space → the builder flags it and disables Save. No server help.
  it('flags a dangling predicate after the join is cleared and blocks save', async () => {
    renderApp(`/data-management/queries/${JOIN_ID}`);
    expect(await screen.findByText(/Matched 2 rows/)).toBeInTheDocument();
    clickEdit();
    await screen.findByPlaceholderText('Match any cell…');
    // Per-column filters live in the preview table headers (render once the
    // joined preview loads): 7 (deals) + 3 (accounts) = 10. Index 9 = last col.
    await waitFor(() => expect(document.querySelectorAll('[data-component="FilterTrigger"]').length).toBe(10));
    const triggers = document.querySelectorAll('[data-component="FilterTrigger"]');
    fireEvent.click(triggers[9]);
    await waitFor(() => expect(document.querySelector('[data-component="FilterPopoverContent"]')).not.toBeNull());
    const valueEl = document.querySelector('[data-component="FilterValueInput"]') as HTMLElement;
    const valueInput = (valueEl.tagName === 'INPUT' ? valueEl : valueEl.querySelector('input')) as HTMLInputElement;
    fireEvent.change(valueInput, { target: { value: 'gold' } });
    const applyBtn = document.querySelector('[data-component="FilterApplyButton"]') as HTMLButtonElement;
    await waitFor(() => expect(applyBtn).not.toBeDisabled());
    fireEvent.click(applyBtn);
    // Now clear the join → effective space shrinks to 7; the col-9 atom dangles.
    const clearJoin = document.querySelector('[data-component="BuilderClearJoin"]') as HTMLButtonElement;
    fireEvent.click(clearJoin);
    expect(await screen.findByText(/references a column that isn't in these results/)).toBeInTheDocument();
    expect(document.querySelector('[data-component="QueryBuilderPredInvalid"]')).not.toBeNull();
    const saveBtn = document.querySelector('[data-component="QueryBuilderSave"]') as HTMLButtonElement;
    expect(saveBtn).toBeDisabled();
  });
});

describe('Multi-join chain (R73 linear) + join graph (R74 tree)', () => {
  const JOIN_ID = MOCK_JOINED_QUERY.id;

  function clickEdit() {
    fireEvent.click(document.querySelector('[data-component="QueryDetailEdit"]') as HTMLButtonElement);
  }

  // Open an AntD <Select> by data-component (the root `.ant-select` div) and
  // click the dropdown option whose text matches.
  async function pickFromSelect(dataComponent: string, optionMatch: RegExp) {
    const root = document.querySelector(`[data-component="${dataComponent}"]`) as HTMLElement;
    fireEvent.mouseDown(root);
    const option = await screen.findByText(optionMatch, { selector: '.ant-select-item-option-content,.ant-select-item-option-content *' });
    fireEvent.click(option);
  }

  // Enter edit on the single-join query, then append the 2nd hop (Accounts ⋈
  // Owners), extending from the chain's tail. Shared by the cases below.
  async function addSecondHop() {
    renderApp(`/data-management/queries/${JOIN_ID}`);
    expect(await screen.findByText(/Matched 2 rows/)).toBeInTheDocument();
    clickEdit();
    // The single-edge affordance + the "[+ Add a join]" extending from the tail.
    expect(await screen.findByText('Preview · 2 rows')).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector('[data-component="BuilderAddJoin"]')).not.toBeNull());
    await pickFromSelect('BuilderAddJoin', /tier ↔ tier/);
  }

  // Click the last ENABLED [Remove] — a leaf hop (R74: a non-leaf's Remove is
  // disabled, so querySelector's first match may be a dead control).
  function clickLeafRemove() {
    const btns = Array.from(
      document.querySelectorAll('[data-component="BuilderRemoveHop"]'),
    ) as HTMLButtonElement[];
    const enabled = btns.filter((b) => !b.disabled);
    const leaf = enabled[enabled.length - 1];
    if (leaf) fireEvent.click(leaf);
  }

  it('extends the chain with a second hop and previews the three-dataset result', async () => {
    await addSecondHop();
    // The preview now runs Deals ⋈ Accounts ⋈ Owners: an Owners-source cell shows,
    // and the effective space is 7 + 3 + 3 = 13 per-column filter triggers.
    expect(await screen.findByText('Dana Lee')).toBeInTheDocument();
    expect(screen.getByText('Acme')).toBeInTheDocument(); // mid (Accounts) source still present
    await waitFor(() => expect(document.querySelectorAll('[data-component="FilterTrigger"]').length).toBe(13));
    // The two hops render as chain rows; the last carries [Remove].
    expect(document.querySelectorAll('[data-component="BuilderHopRow"]').length).toBe(2);
    expect(document.querySelector('[data-component="BuilderRemoveHop"]')).not.toBeNull();
  });

  it('saves a two-hop chain from the header, returning to the read-only view', async () => {
    await addSecondHop();
    const saveBtn = document.querySelector('[data-component="QueryBuilderSave"]') as HTMLButtonElement;
    // Adding the hop makes the copy dirty + the chain previews clean → Save enables.
    await waitFor(() => expect(saveBtn).not.toBeDisabled());
    fireEvent.click(saveBtn);
    // The ad-hoc chain PUT round-trips; the builder closes, read-only [Edit] back.
    await waitFor(() => expect(document.querySelector('[data-component="QueryDetailEdit"]')).not.toBeNull());
    expect(document.querySelector('[data-component="QueryBuilderPanel"]')).toBeNull();
  });

  it('removes the last hop, collapsing the chain back to a single join', async () => {
    await addSecondHop();
    expect(await screen.findByText('Dana Lee')).toBeInTheDocument();
    clickLeafRemove();
    // Back to the single-edge affordance; the Owners-source cell is gone, the
    // Accounts-source cell remains (Deals ⋈ Accounts).
    await waitFor(() => expect(document.querySelector('[data-component="BuilderJoinSelect"]')).not.toBeNull());
    await waitFor(() => expect(screen.queryByText('Dana Lee')).toBeNull());
    expect(screen.getByText('Acme')).toBeInTheDocument();
  });

  // F2 confirmation (client-side, flag-don't-crash over the chain): a filter on
  // an OWNERS-source column, then removing that hop, leaves the atom dangling
  // out of the (now smaller) effective space → the builder flags it and disables
  // Save. The chain analog of R72's join-clear AC — no server round-trip.
  it('flags a dangling predicate after a hop is removed and blocks save', async () => {
    await addSecondHop();
    // 3-dataset chain → 13 per-column filter triggers; index 11 = owner_name (Owners).
    await waitFor(() => expect(document.querySelectorAll('[data-component="FilterTrigger"]').length).toBe(13));
    fireEvent.click(document.querySelectorAll('[data-component="FilterTrigger"]')[11]);
    await waitFor(() => expect(document.querySelector('[data-component="FilterPopoverContent"]')).not.toBeNull());
    const valueEl = document.querySelector('[data-component="FilterValueInput"]') as HTMLElement;
    const valueInput = (valueEl.tagName === 'INPUT' ? valueEl : valueEl.querySelector('input')) as HTMLInputElement;
    fireEvent.change(valueInput, { target: { value: 'Dana Lee' } });
    const applyBtn = document.querySelector('[data-component="FilterApplyButton"]') as HTMLButtonElement;
    await waitFor(() => expect(applyBtn).not.toBeDisabled());
    fireEvent.click(applyBtn);
    // Remove the Owners hop → effective space shrinks to 10; the col-11 atom dangles.
    clickLeafRemove();
    expect(await screen.findByText(/references a column that isn't in these results/)).toBeInTheDocument();
    expect(document.querySelector('[data-component="QueryBuilderPredInvalid"]')).not.toBeNull();
    const saveBtn = document.querySelector('[data-component="QueryBuilderSave"]') as HTMLButtonElement;
    expect(saveBtn).toBeDisabled();
  });

  // ── R74: the join graph (tree) — branch from a NON-TAIL source ───────────
  //
  // Build the linear chain Deals ⋈ Accounts ⋈ Owners (tail = Owners), then add a
  // third hop that extends from ACCOUNTS (the non-tail) → Accounts ⋈ tiers. Under
  // R73 the tail (Owners) had no eligible edge, so add was dead; R74 offers a
  // left-source <Select> ("Join from") over the in-graph sources that can branch
  // (Accounts → tiers, Owners → regions), and a hop can attach to Accounts.
  async function addBranchFromAccounts() {
    await addSecondHop(); // Deals ⋈ Accounts ⋈ Owners
    await waitFor(() => expect(document.querySelectorAll('[data-component="BuilderHopRow"]').length).toBe(2));
    // Two in-graph sources can be extended (Accounts, Owners) → the left-source
    // <Select> appears (it is hidden when only one source is eligible).
    await waitFor(() => expect(document.querySelector('[data-component="BuilderAddJoinSource"]')).not.toBeNull());
    await pickFromSelect('BuilderAddJoinSource', /accounts/); // branch from the NON-tail
    await pickFromSelect('BuilderAddJoin', /account_id ↔ acct/); // Accounts → tiers
  }

  it('branches a third hop from a non-tail source via the left-source select', async () => {
    await addBranchFromAccounts();
    // Three hops now render: Deals⋈Accounts, Accounts⋈Owners, Accounts⋈tiers — a
    // tree (Accounts drives two hops), not a path.
    await waitFor(() => expect(document.querySelectorAll('[data-component="BuilderHopRow"]').length).toBe(3));
  });

  it('enables [Remove] only on leaf hops (a non-leaf is disabled)', async () => {
    await addBranchFromAccounts();
    await waitFor(() => expect(document.querySelectorAll('[data-component="BuilderHopRow"]').length).toBe(3));
    const removes = Array.from(
      document.querySelectorAll('[data-component="BuilderRemoveHop"]'),
    ) as HTMLButtonElement[];
    // Deals⋈Accounts is a non-leaf (Accounts is the parent of two hops) → disabled;
    // the two Accounts-branch leaves (Owners, tiers) are removable.
    expect(removes.length).toBe(3);
    expect(removes.filter((b) => b.disabled).length).toBe(1);
    expect(removes.filter((b) => !b.disabled).length).toBe(2);
    // Removing a leaf collapses the tree back to two hops.
    clickLeafRemove();
    await waitFor(() => expect(document.querySelectorAll('[data-component="BuilderHopRow"]').length).toBe(2));
  });

  // ── R75: per-hop join type (inner → left / right / full outer) ───────────
  it('sets a hop to a left outer join via the type select, enabling Save', async () => {
    renderApp(`/data-management/queries/${JOIN_ID}`);
    expect(await screen.findByText(/Matched 2 rows/)).toBeInTheDocument();
    clickEdit();
    // The single-edge affordance carries a join-type select (default inner).
    await waitFor(() => expect(document.querySelector('[data-component="BuilderHopType"]')).not.toBeNull());
    // Pick a LEFT outer join → the working copy is dirty, the chain previews clean,
    // so Save enables. (inner → left changes which rows the join keeps.)
    await pickFromSelect('BuilderHopType', /Left \(keep left\)/);
    const saveBtn = document.querySelector('[data-component="QueryBuilderSave"]') as HTMLButtonElement;
    await waitFor(() => expect(saveBtn).not.toBeDisabled());
    fireEvent.click(saveBtn);
    await waitFor(() => expect(document.querySelector('[data-component="QueryDetailEdit"]')).not.toBeNull());
  });
});
