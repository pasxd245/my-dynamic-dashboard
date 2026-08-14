// R69 Saved Query tests (MSW). Default handlers in src/mocks/handlers.ts
// cover the happy paths; per-test `server.use(...)` overrides supply the
// empty-list and stale-run cases.

import { AntdConfig } from '@mdd/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { http, HttpResponse } from 'msw';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppLayout } from '@/components/AppLayout';
import { DatasetDetailPage } from '@/features/data-management/datasets/DatasetDetailPage';
import { QueriesPage } from '@/features/data-management/queries/QueriesPage';
import { QueryDetailPage } from '@/features/data-management/queries/QueryDetailPage';
import {
  MOCK_DATASET,
  MOCK_DATASET_2,
  MOCK_DATASET_3,
  MOCK_JOINED_QUERY,
  MOCK_QUERY,
  MOCK_RELATIONSHIP,
  MOCK_STALE_RELATIONSHIP,
} from '@/mocks/fixtures';
import { server } from '@/mocks/server';

const QR_ID = MOCK_QUERY.id;
const DS_ID = MOCK_DATASET.id;

// React Flow needs ResizeObserver + element dimensions to measure nodes; only once
// both endpoints of an edge are measured does it render the edge (its EdgeLabelRenderer
// toolbar). happy-dom provides neither, and a no-op ResizeObserver never fires — so the
// mock must INVOKE its callback so nodes get measured. Scoped install/restore keeps the
// rest of the suite on happy-dom defaults.
function installReactFlowEnv(): () => void {
  const origGBCR = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'getBoundingClientRect');
  const origRO = globalThis.ResizeObserver;
  const origDM = (globalThis as Record<string, unknown>).DOMMatrixReadOnly;
  class RO {
    cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb;
    }
    observe(target: Element) {
      this.cb([{ target, contentRect: { width: 400, height: 300 } } as ResizeObserverEntry], this);
    }
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = RO as unknown as typeof ResizeObserver;
  (globalThis as Record<string, unknown>).DOMMatrixReadOnly = class {
    m22 = 1;
  };
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ x: 0, y: 0, top: 0, left: 0, right: 400, bottom: 300, width: 400, height: 300, toJSON() {} }),
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 400 });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 300 });
  return () => {
    globalThis.ResizeObserver = origRO;
    (globalThis as Record<string, unknown>).DOMMatrixReadOnly = origDM;
    if (origGBCR) Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', origGBCR);
    delete (HTMLElement.prototype as unknown as { offsetWidth?: number }).offsetWidth;
    delete (HTMLElement.prototype as unknown as { offsetHeight?: number }).offsetHeight;
  };
}

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
    server.use(http.get('*/workspaces/:id/queries', () => HttpResponse.json([])));
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
    server.use(http.get('*/queries/:id/rows', () => HttpResponse.json({ code: 'query_stale' }, { status: 409 })));
    renderApp(`/data-management/queries/${QR_ID}`);
    expect(await screen.findByText('This query needs attention')).toBeInTheDocument();
    expect(document.querySelector('[data-component="QueryDetailStale"]')).not.toBeNull();
  });

  it('R165 W-8: an unrunnable STEP gets the step reason, not the re-save-the-dataset one', async () => {
    // Before R165 this returned `query_stale` and the page told the user to re-save
    // from the source dataset — where there is nothing to fix. The steps are the
    // problem, so the panel says so.
    server.use(http.get('*/queries/:id/rows', () => HttpResponse.json({ code: 'step_invalid' }, { status: 409 })));
    renderApp(`/data-management/queries/${QR_ID}`);
    expect(await screen.findByText('This query needs attention')).toBeInTheDocument();
    expect(screen.getByText(/transform steps can.t run on the columns/)).toBeInTheDocument();
    expect(screen.queryByText(/Re-save it from the dataset/)).not.toBeInTheDocument();
  });

  it('R144: a single-source STEPPED query renders the POST-step columns (resolvedColumns)', async () => {
    // A query with steps returns SHAPED rows; the detail table must take its
    // headers from `resolvedColumns` (post-step), not the source dataset's
    // pre-step columns — else an appended column (date_bucket/derive) is invisible.
    const stepped = {
      ...MOCK_QUERY,
      definition: {
        ...MOCK_QUERY.definition,
        steps: [{ kind: 'date_bucket', col: 'created_at', granularity: 'week', name: 'call_week' }],
      },
      resolvedColumns: [
        { name: 'stage', dtype: 'string' },
        { name: 'call_week', dtype: 'date' },
      ],
    };
    server.use(
      http.get('*/queries/:id', () => HttpResponse.json(stepped)),
      http.get('*/queries/:id/rows', () =>
        HttpResponse.json({ rows: [['won', '2026-06-29']], page: 1, pageSize: 25, total: 1 }),
      ),
    );
    renderApp(`/data-management/queries/${QR_ID}`);
    // The appended bucket column's header + cell both render (the `date` cell
    // is locale-formatted by formatCell — en: MM/DD/YYYY).
    expect(await screen.findByText('call_week')).toBeInTheDocument();
    expect(screen.getByText('06/29/2026')).toBeInTheDocument();
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
    server.use(http.post('*/workspaces/:id/queries', () => HttpResponse.json(MOCK_QUERY, { status: 201 })));
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
    server.use(http.post('*/workspaces/:id/queries', () => HttpResponse.json(MOCK_JOINED_QUERY, { status: 201 })));
    renderApp(`/data-management/datasets/${DS_ID}`);
    // R72: the join affordance moved into the "Actions ▾" dropdown. Open it,
    // then click the "Join with related dataset" item (enabled — MOCK_DATASET
    // has a valid relationship).
    const actions = (await screen.findByText('Actions')).closest('button') as HTMLButtonElement;
    fireEvent.click(actions);
    const joinItem = await screen.findByText('Join with related dataset');
    fireEvent.click(joinItem);
    // Modal opens; the relationship Select is pre-seeded with the first valid edge.
    expect(
      await screen.findByText('Join with a related dataset', { selector: '.ant-modal-title' }),
    ).toBeInTheDocument();
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

  it('R165 W-8: a refused STEP blocks Save with the STEP sentence and never claims a filter', async () => {
    // T5's state: the step card already names the column and both ways out, so the
    // panel points at it. What it must NOT do is what it used to — announce
    // "1 filter references a column…" on a query whose filter count is zero.
    server.use(
      http.post('*/workspaces/:id/queries/preview', () =>
        HttpResponse.json({ code: 'step_invalid' }, { status: 409 }),
      ),
    );
    renderApp(`/data-management/queries/${QR_ID}`);
    await waitFor(() => expect(screen.getAllByText(MOCK_QUERY.name).length).toBeGreaterThan(0));
    clickEdit();
    expect(await screen.findByText(/A step can.t run on the columns available where it sits/)).toBeInTheDocument();
    expect(document.querySelector('[data-component="QueryBuilderStepInvalid"]')).not.toBeNull();
    expect(document.querySelector('[data-component="QueryBuilderPredInvalid"]')).toBeNull();
    const stepSave = document.querySelector('[data-component="QueryBuilderSave"]') as HTMLButtonElement;
    expect(stepSave).toBeDisabled();
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
    const option = await screen.findByText(optionMatch, {
      selector: '.ant-select-item-option-content,.ant-select-item-option-content *',
    });
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
    const btns = Array.from(document.querySelectorAll('[data-component="BuilderRemoveHop"]')) as HTMLButtonElement[];
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
    const removes = Array.from(document.querySelectorAll('[data-component="BuilderRemoveHop"]')) as HTMLButtonElement[];
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

  // Regression: the READ-ONLY join summary must reflect the saved join type, not a
  // hardcoded "inner" (a left join was mislabelled "⋈ inner ⋈" in the view).
  it('labels the read-only join summary with the saved join type', async () => {
    server.use(
      http.get(`*/queries/${JOIN_ID}`, () =>
        HttpResponse.json({
          ...MOCK_JOINED_QUERY,
          definition: {
            ...MOCK_JOINED_QUERY.definition,
            joins: (MOCK_JOINED_QUERY.definition.joins ?? []).map((h) => ({ ...h, type: 'left' })),
          },
        }),
      ),
    );
    renderApp(`/data-management/queries/${JOIN_ID}`);
    await waitFor(() => expect(document.querySelector('[data-component="QueryJoinSummary"]')).not.toBeNull());
    const summary = document.querySelector('[data-component="QueryJoinSummary"]') as HTMLElement;
    expect(summary.textContent).toContain('⋈ left ⋈');
    expect(summary.textContent).not.toContain('⋈ inner ⋈');
  });
});

// R166 withdrew every surface that offered `query⋈query`; R167 narrowed the wire so
// the shape is refused structurally (`sourceId` / `rightSourceId` are `^ds_…`). What
// survives here is the REGRESSION GUARD: the builder's source picker must stay
// datasets-only and ungrouped. The composed-detail tests went with the fixtures they
// needed — a mock that keeps serving a withdrawn shape lets the FE pass tests for a
// surface the product no longer has (the MSW contract anchor caught exactly that).
describe('Composition withdrawn (R166 surfaces, R167 wire)', () => {
  const JOIN_ID = MOCK_JOINED_QUERY.id;

  function clickEdit() {
    fireEvent.click(document.querySelector('[data-component="QueryDetailEdit"]') as HTMLButtonElement);
  }

  // R94 (D6) — the base-source picker is disabled: the PUT is definition-only, so a
  // query's driving source is fixed at create. R166 — it is also DATASETS-ONLY and FLAT:
  // the "Saved queries" group is withdrawn (entry point #1 of noun-model D5), and with
  // one group left the "Datasets" heading would label a list that can hold nothing else.
  // This assertion is the withdrawal's regression guard on the builder side.
  it('renders the base-source picker disabled, datasets-only and ungrouped (R166 withdrawal)', async () => {
    renderApp(`/data-management/queries/${JOIN_ID}`);
    expect(await screen.findByText(/Matched 2 rows/)).toBeInTheDocument();
    clickEdit();
    const base = (await waitFor(() => {
      const el = document.querySelector('[data-component="BuilderBaseSource"]');
      expect(el).not.toBeNull();
      return el;
    })) as HTMLElement;
    expect(base.className).toContain('ant-select-disabled');
    fireEvent.mouseDown(base);
    // Neither group heading renders — not "Saved queries" (withdrawn) and not
    // "Datasets" (a group of one is chrome, not structure).
    expect(document.querySelector('.ant-select-item-group')).toBeNull();
  });

});

// R166 — Duplicate replaces "Build on this query". Composition is withdrawn from
// every surface (the create page, its route, the canvas + builder source groups);
// what lands instead is a verb on the detail header that copies a Query's whole
// definition into a NEW Query over the SAME sources. It routes through the shipped
// SaveQueryModal + useCreateQueryMutation, so there is one create rhythm, not two.
describe('Duplicate (R166 — the variant verb that replaced composition)', () => {
  function clickDuplicate() {
    fireEvent.click(document.querySelector('[data-component="QueryDetailDuplicate"]') as HTMLButtonElement);
  }

  // THE invariant the spec names, asserted directly: the copy is IDENTICAL. Same
  // `sourceId` (a sibling, never a child — never the base's own `qr_`) and a deep-equal
  // definition, `qrel_` ids included (they are query-local; re-minting would have
  // destroyed exactly this property).
  it('POSTs the base’s own sourceId + a deep-equal definition, then navigates to the copy', async () => {
    let posted: { name?: string; sourceId?: string; definition?: unknown } | null = null;
    server.use(
      http.post('*/workspaces/:id/queries', async ({ request }) => {
        posted = (await request.json()) as typeof posted;
        return HttpResponse.json(
          {
            id: 'qr_copy0001',
            workspaceId: MOCK_QUERY.workspaceId,
            sourceId: posted?.sourceId,
            name: posted?.name,
            definition: posted?.definition,
            createdAt: new Date().toISOString(),
          },
          { status: 201 },
        );
      }),
    );
    renderApp(`/data-management/queries/${QR_ID}`);
    await waitFor(() => expect(document.querySelector('[data-component="QueryDetailDuplicate"]')).not.toBeNull());
    clickDuplicate();

    // The modal names the OBJECT, not the bare verb (the third display context) and
    // pre-fills a ready-to-accept default.
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(`Duplicate ${MOCK_QUERY.name}`)).toBeInTheDocument();
    const nameInput = document.querySelector('[data-component="SaveQueryNameInput"]') as HTMLInputElement;
    expect(nameInput.value).toBe(`${MOCK_QUERY.name} (copy)`);

    fireEvent.click(within(dialog).getByText('Save'));
    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted!.sourceId).toBe(MOCK_QUERY.sourceId); // a SIBLING, not a child
    expect(posted!.definition).toEqual(MOCK_QUERY.definition); // deep-equal, entire
    expect(posted!.name).toBe(`${MOCK_QUERY.name} (copy)`);
    // The navigation is the significant event — the user is now on a different query.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  // Duplicating the same query twice offers `(copy)` both times, so the second ALWAYS
  // collides. Accepted at the D gate (human, 2026-08-13) on the condition that it is a
  // recoverable annoyance: the modal's existing inline field error, and the user renames.
  it('renders a colliding name as the modal’s inline error and stays open to recover', async () => {
    server.use(
      http.post('*/workspaces/:id/queries', () => HttpResponse.json({ code: 'name_taken' }, { status: 409 })),
    );
    renderApp(`/data-management/queries/${QR_ID}`);
    await waitFor(() => expect(document.querySelector('[data-component="QueryDetailDuplicate"]')).not.toBeNull());
    clickDuplicate();
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByText('Save'));
    await waitFor(() => expect(document.querySelector('[data-component="SaveQueryNameTaken"]')).not.toBeNull());
    // Recoverable: the modal is still up with the name still editable.
    expect(screen.queryByRole('dialog')).not.toBeNull();
    expect((document.querySelector('[data-component="SaveQueryNameInput"]') as HTMLInputElement).disabled).toBe(false);
  });

  // R166 I-gate (T1) — the walk corrected the order the D gate's ASCII had drawn:
  // [Edit] [Duplicate] [Delete], by descending use with the destructive verb last and
  // furthest away, because distance is what protects Delete from a mis-click. Locked
  // here because the defect's cause was a picture in a doc, and a picture regresses
  // quietly.
  it('orders the header [Edit] [Duplicate] [Delete] — by use, destructive last', async () => {
    renderApp(`/data-management/queries/${QR_ID}`);
    await waitFor(() => expect(document.querySelector('[data-component="QueryDetailDuplicate"]')).not.toBeNull());
    const order = [...document.querySelectorAll('[data-component^="QueryDetail"]')]
      .map((el) => el.getAttribute('data-component'))
      .filter((c) => ['QueryDetailEdit', 'QueryDetailDuplicate', 'QueryDetailDelete'].includes(c as string));
    expect(order).toEqual(['QueryDetailEdit', 'QueryDetailDuplicate', 'QueryDetailDelete']);
  });

  // The verb is on the RUNNABLE detail header only — repair the source before making a
  // variant of something that can't run (the stale header keeps only Delete).
  it('is absent from the stale (unrunnable) header', async () => {
    server.use(http.get('*/queries/:id/rows', () => HttpResponse.json({ code: 'query_stale' }, { status: 409 })));
    renderApp(`/data-management/queries/${QR_ID}`);
    await waitFor(() => expect(document.querySelector('[data-component="QueryDetailStale"]')).not.toBeNull());
    expect(document.querySelector('[data-component="QueryDetailDuplicate"]')).toBeNull();
  });

  // The withdrawal, asserted where a user last reached for it (R160's dogfood opened
  // the program by clicking exactly this).
  it('no longer offers "Build on this query" anywhere on the detail', async () => {
    renderApp(`/data-management/queries/${QR_ID}`);
    await waitFor(() => expect(document.querySelector('[data-component="QueryDetailDuplicate"]')).not.toBeNull());
    expect(document.querySelector('[data-component="QueryDetailBuildOn"]')).toBeNull();
    expect(screen.queryByText('Build on this query')).toBeNull();
  });
});

// R85 (canvas theme — Phase A). The read-only source-graph VIEW: a [List]/[Canvas]
// toggle in the builder's Build section swaps the editable hop list for a node-link
// render of the SAME working-copy `joins` tree (nodes = sources, edges = hops).
// Zero editing, zero model/contract/BE change — pure visualization (canvas.md J-5).
describe('Query canvas view (R85 — Phase A, read-only source-graph)', () => {
  const JOIN_ID = MOCK_JOINED_QUERY.id;

  // The canvas renders via React Flow (R89) — install the measurement env so edges
  // render (the read-only view still asserts edge labels).
  let restoreRf: () => void;
  beforeAll(() => {
    restoreRf = installReactFlowEnv();
  });
  afterAll(() => restoreRf());

  function clickEdit() {
    fireEvent.click(document.querySelector('[data-component="QueryDetailEdit"]') as HTMLButtonElement);
  }

  async function pickFromSelect(dataComponent: string, optionMatch: RegExp) {
    const root = document.querySelector(`[data-component="${dataComponent}"]`) as HTMLElement;
    fireEvent.mouseDown(root);
    const option = await screen.findByText(optionMatch, {
      selector: '.ant-select-item-option-content,.ant-select-item-option-content *',
    });
    fireEvent.click(option);
  }

  // R86 — switch the top-level [Form]/[Canvas] view tabs (an AntD <Tabs> bar).
  function switchTab(tab: 'form' | 'canvas') {
    fireEvent.click(screen.getByRole('tab', { name: tab === 'canvas' ? 'Canvas' : 'Form' }));
  }

  // Build Deals ⋈ Accounts ⋈ Owners, then branch Accounts ⋈ tiers — a STAR
  // (Accounts drives two hops), not a linear path (the R74 topology).
  async function buildStar() {
    renderApp(`/data-management/queries/${JOIN_ID}`);
    expect(await screen.findByText(/Matched 2 rows/)).toBeInTheDocument();
    clickEdit();
    await waitFor(() => expect(document.querySelector('[data-component="BuilderAddJoin"]')).not.toBeNull());
    await pickFromSelect('BuilderAddJoin', /tier ↔ tier/); // hop 2: Accounts ⋈ Owners
    await waitFor(() => expect(document.querySelectorAll('[data-component="BuilderHopRow"]').length).toBe(2));
    await waitFor(() => expect(document.querySelector('[data-component="BuilderAddJoinSource"]')).not.toBeNull());
    await pickFromSelect('BuilderAddJoinSource', /accounts/); // branch from the NON-tail
    await pickFromSelect('BuilderAddJoin', /account_id ↔ acct/); // hop 3: Accounts ⋈ tiers
    await waitFor(() => expect(document.querySelectorAll('[data-component="BuilderHopRow"]').length).toBe(3));
  }

  it('renders the joins tree faithfully as a node-link star (nodes, labelled edges, driving marker)', async () => {
    await buildStar();
    switchTab('canvas');
    // The list editor unmounts; the canvas renders.
    await waitFor(() => expect(document.querySelector('[data-component="QueryCanvas"]')).not.toBeNull());
    expect(document.querySelector('[data-component="JoinEditor"]')).toBeNull();
    // Four nodes (Deals + Accounts + Owners + tiers) and three edges — a star,
    // not a path (Accounts drives two of the edges).
    const nodes = document.querySelectorAll('[data-component="CanvasNode"]');
    const edges = document.querySelectorAll('[data-component="CanvasEdge"]');
    expect(nodes.length).toBe(4);
    expect(edges.length).toBe(3);
    // The driving node is marked in TEXT (not colour alone) and names the source.
    const driving = document.querySelector('[data-component="CanvasNode"][data-driving="true"]') as HTMLElement;
    expect(driving).not.toBeNull();
    expect(driving.textContent).toContain(MOCK_DATASET.name);
    expect(driving.textContent).toContain('driving');
    // R97 Item 2 — at rest each edge is a compact cardinality badge; the key-pair
    // lives in the expanded info-box. Click each edge (by its stable id), confirm
    // it became the selected one, then read its pad — collecting all three pairs.
    const edgeIds = Array.from(edges).map((e) => e.getAttribute('data-edge'));
    const seenPairs = new Set<string>();
    for (const id of edgeIds) {
      fireEvent.click(document.querySelector(`[data-component="CanvasEdge"][data-edge="${id}"]`) as HTMLElement);
      const pad = (await waitFor(() => {
        const sel = document.querySelector('[data-component="CanvasEdge"][data-selected="true"]');
        expect(sel?.getAttribute('data-edge')).toBe(id);
        const p = sel?.parentElement?.querySelector('[data-component="CanvasEdgePad"]');
        expect(p).not.toBeNull();
        return p as HTMLElement;
      })) as HTMLElement;
      for (const pair of ['deal_id ↔ account_id', 'tier ↔ tier', 'account_id ↔ acct']) {
        if (pad.textContent?.includes(pair)) seenPairs.add(pair);
      }
    }
    expect(seenPairs).toEqual(new Set(['deal_id ↔ account_id', 'tier ↔ tier', 'account_id ↔ acct']));
  });

  it('the view toggle is lossless — Canvas reads the edited working copy, List returns unchanged', async () => {
    // Add a 2nd hop (the working copy is now a 2-hop chain, dirty vs. saved).
    renderApp(`/data-management/queries/${JOIN_ID}`);
    expect(await screen.findByText(/Matched 2 rows/)).toBeInTheDocument();
    clickEdit();
    await waitFor(() => expect(document.querySelector('[data-component="BuilderAddJoin"]')).not.toBeNull());
    await pickFromSelect('BuilderAddJoin', /tier ↔ tier/);
    await waitFor(() => expect(document.querySelectorAll('[data-component="BuilderHopRow"]').length).toBe(2));
    // Toggle to Canvas → it renders the EDITED copy (3 nodes: Deals/Accounts/Owners).
    switchTab('canvas');
    await waitFor(() => expect(document.querySelectorAll('[data-component="CanvasNode"]').length).toBe(3));
    // Toggle back to List → no edit lost (the 2 hop rows return; preview intact).
    switchTab('form');
    await waitFor(() => expect(document.querySelectorAll('[data-component="BuilderHopRow"]').length).toBe(2));
    expect(document.querySelector('[data-component="QueryCanvas"]')).toBeNull();
  });

  it('flags a stale edge on the canvas (alert, not a crash) — a query-owned rel whose key column drifted', async () => {
    // R88 — the query OWNS a relationship whose left key column no longer exists
    // on its dataset (`legacy_code`); the canvas computes staleness from the
    // current dataset columns (no governed `status` field anymore).
    server.use(
      http.get(`*/queries/${JOIN_ID}`, () =>
        HttpResponse.json({
          ...MOCK_JOINED_QUERY,
          definition: {
            ...MOCK_JOINED_QUERY.definition,
            relationships: [
              {
                id: 'qrel_57a1e000',
                leftSourceId: MOCK_STALE_RELATIONSHIP.leftDatasetId,
                leftColumn: MOCK_STALE_RELATIONSHIP.leftColumn,
                rightSourceId: MOCK_STALE_RELATIONSHIP.rightDatasetId,
                rightColumn: MOCK_STALE_RELATIONSHIP.rightColumn,
                cardinality: MOCK_STALE_RELATIONSHIP.cardinality,
                originRelationshipId: MOCK_STALE_RELATIONSHIP.id,
              },
            ],
            joins: [{ queryRelId: 'qrel_57a1e000', type: 'inner' }],
          },
        }),
      ),
    );
    renderApp(`/data-management/queries/${JOIN_ID}`);
    expect(await screen.findByText(/Matched 2 rows/)).toBeInTheDocument();
    clickEdit();
    switchTab('canvas');
    await waitFor(() => expect(document.querySelector('[data-component="QueryCanvas"]')).not.toBeNull());
    // The stale edge renders a text alert naming the missing column — flag-don't-crash.
    const alert = (await waitFor(() => {
      const el = document.querySelector('[data-component="CanvasEdgeStale"]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    })) as HTMLElement;
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.textContent).toContain(MOCK_STALE_RELATIONSHIP.leftColumn);
  });

  // R86 — the Canvas tab carries NO preview table; a status chip mirrors the
  // preview gate (row count) and navigates back to the Form preview.
  it('shows a status chip with the row count on the Canvas tab and navigates back to Form', async () => {
    renderApp(`/data-management/queries/${JOIN_ID}`);
    expect(await screen.findByText(/Matched 2 rows/)).toBeInTheDocument();
    clickEdit();
    await screen.findByText('Preview · 2 rows'); // the Form preview settled (total 2)
    switchTab('canvas');
    const chip = (await waitFor(() => {
      const el = document.querySelector('[data-component="QueryCanvasStatusChip"]') as HTMLButtonElement;
      expect(el).not.toBeNull();
      return el;
    })) as HTMLButtonElement;
    await waitFor(() => expect(chip.textContent).toContain('2 rows'));
    expect(chip.getAttribute('data-stale')).toBe('false');
    // No preview table on the Canvas tab (it lives on Form).
    expect(document.querySelector('[data-component="QueryBuilderPreviewHeader"]')).toBeNull();
    // Clicking the chip returns to the Form tab (editor + preview reappear).
    fireEvent.click(chip);
    await waitFor(() => expect(document.querySelector('[data-component="JoinEditor"]')).not.toBeNull());
    expect(document.querySelector('[data-component="QueryCanvas"]')).toBeNull();
    expect(document.querySelector('[data-component="QueryBuilderPreviewHeader"]')).not.toBeNull();
  });

  // R86 — the Save gate reads preview validity, which runs regardless of the
  // visible tab; so a blocked preview keeps Save disabled even on the Canvas tab,
  // and the chip surfaces WHY (unavailable) without a visible preview table.
  it('keeps Save gated on the Canvas tab when the preview is blocked (chip shows unavailable)', async () => {
    server.use(
      http.post('*/workspaces/:id/queries/preview', () =>
        HttpResponse.json({ code: 'relationship_stale' }, { status: 409 }),
      ),
    );
    renderApp(`/data-management/queries/${JOIN_ID}`);
    expect(await screen.findByText(/Matched 2 rows/)).toBeInTheDocument();
    clickEdit();
    // On Form: the blocked-state alert shows and Save is disabled.
    expect(await screen.findByText(/This join is unavailable/)).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector('[data-component="QueryBuilderSave"]')).toBeDisabled());
    // Switch to Canvas → the chip reflects the blocked gate; Save stays disabled.
    switchTab('canvas');
    const chip = (await waitFor(() => {
      const el = document.querySelector('[data-component="QueryCanvasStatusChip"]') as HTMLButtonElement;
      expect(el).not.toBeNull();
      return el;
    })) as HTMLButtonElement;
    await waitFor(() => expect(chip.getAttribute('data-stale')).toBe('true'));
    expect(chip.textContent).toContain('Unavailable');
    expect(document.querySelector('[data-component="QueryBuilderSave"]')).toBeDisabled();
  });
});

// R89 (canvas theme — free-form, React Flow). The Canvas tab is a React Flow
// EDITOR: drag a column handle → another column handle (resolveConnect) routes to
// copy-on-pick (governed match) or free-form define (no match, the gesture that
// CREATES). Any query-owned rel can be PROMOTED up to the governed ER; a copied rel
// that drifted from its origin shows a divergence WARN + opt-in re-sync. The drag
// gesture itself is human-verified at the F1 review (happy-dom can't fire a React
// Flow connect); these tests cover the routing (resolveConnect, separate file), the
// rendered graph, and the edge toolbar + free-form staging + promote + divergence —
// everything reachable without a literal drag.
describe('Query canvas EDITING (R89 — free-form, React Flow)', () => {
  const JOIN_ID = MOCK_JOINED_QUERY.id;
  const DEALS = MOCK_DATASET.id;
  const ACCOUNTS = MOCK_DATASET_2.id;
  const OWNERS = MOCK_DATASET_3.id;

  let restoreRf: () => void;
  beforeAll(() => {
    restoreRf = installReactFlowEnv();
  });
  afterAll(() => restoreRf());

  function clickEdit() {
    fireEvent.click(document.querySelector('[data-component="QueryDetailEdit"]') as HTMLButtonElement);
  }
  function switchTab(tab: 'form' | 'canvas') {
    fireEvent.click(screen.getByRole('tab', { name: tab === 'canvas' ? 'Canvas' : 'Form' }));
  }
  async function pickFromSelect(dataComponent: string, optionMatch: RegExp) {
    const root = document.querySelector(`[data-component="${dataComponent}"]`) as HTMLElement;
    fireEvent.mouseDown(root);
    const option = await screen.findByText(optionMatch, {
      selector: '.ant-select-item-option-content,.ant-select-item-option-content *',
    });
    fireEvent.click(option);
  }

  // A query whose definition is supplied inline (so a test can load a 2-hop tree or a
  // diverged copy without driving the drag gesture).
  function serveQuery(definition: (typeof MOCK_JOINED_QUERY)['definition']) {
    server.use(http.get(`*/queries/${JOIN_ID}`, () => HttpResponse.json({ ...MOCK_JOINED_QUERY, definition })));
  }

  // Enter edit on the 1-hop joined query (Deals ⋈ Accounts) and land on the Canvas
  // editor tab: 2 nodes + 1 edge (the copied governed rel), the editing toolbar present.
  async function openCanvasEditor() {
    renderApp(`/data-management/queries/${JOIN_ID}`);
    expect(await screen.findByText(/Matched 2 rows/)).toBeInTheDocument();
    clickEdit();
    await screen.findByText('Preview · 2 rows'); // the Form preview settled
    switchTab('canvas');
    await waitFor(() => expect(document.querySelector('[data-component="QueryCanvas"]')).not.toBeNull());
    await waitFor(() => expect(document.querySelectorAll('[data-component="CanvasNode"]').length).toBe(2));
  }

  // R90 — the edge's action toolbar is a bpmn-style context pad revealed by SELECTING
  // the edge (clicking its label pill); at rest the canvas shows only the compact label.
  // So a test must select the edge before its Promote / Re-sync / [×] buttons exist.
  async function selectEdge(edgeId?: string) {
    const sel = edgeId ? `[data-component="CanvasEdge"][data-edge="${edgeId}"]` : '[data-component="CanvasEdge"]';
    const pill = (await waitFor(() => {
      const el = document.querySelector(sel) as HTMLElement;
      expect(el).not.toBeNull();
      return el;
    })) as HTMLElement;
    fireEvent.click(pill);
    return pill;
  }

  it('renders the join tree as React Flow nodes + a labelled, governed edge', async () => {
    await openCanvasEditor();
    expect(document.querySelector('[data-component="JoinEditor"]')).toBeNull();
    const driving = document.querySelector('[data-component="CanvasNode"][data-driving="true"]') as HTMLElement;
    expect(driving.textContent).toContain(MOCK_DATASET.name);
    expect(driving.textContent).toContain('driving');
    const edge = (await waitFor(() => {
      const el = document.querySelector('[data-component="CanvasEdge"]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    })) as HTMLElement;
    // The copied rel reads as a GOVERNED edge (it carries an originRelationshipId).
    expect(edge.getAttribute('data-free')).toBe('false');
    // R97 Item 2 — at rest the edge is a compact cardinality badge; the key-pair
    // now lives in the expanded info-box (click to select/expand).
    fireEvent.click(edge);
    const pad = (await waitFor(() => {
      const el = document.querySelector('[data-component="CanvasEdgePad"]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    })) as HTMLElement;
    expect(pad.textContent).toContain('deal_id ↔ account_id');
  });

  it('stages ANY not-in-graph dataset for free-form — even one no governed rel reaches', async () => {
    // Only the Deals↔Accounts edge is governed → nothing drives onward from the graph.
    // R87 would DISABLE add-source here; R89 free-form offers every not-in-graph dataset.
    server.use(http.get('*/workspaces/:id/relationships', () => HttpResponse.json([MOCK_RELATIONSHIP])));
    await openCanvasEditor();
    const addBtn = document.querySelector('[data-component="CanvasAddSource"]') as HTMLButtonElement;
    expect(addBtn).not.toBeDisabled(); // free-form: still addable
    fireEvent.click(addBtn);
    // owners is offered for a free-form join even though no governed rel reaches it
    // from {Deals, Accounts}; staging it adds a dashed, not-yet-joined node.
    await pickFromSelect('CanvasAddSourceSelect', new RegExp(MOCK_DATASET_3.name));
    await waitFor(() =>
      expect(document.querySelector('[data-component="CanvasNode"][data-staged="true"]')).not.toBeNull(),
    );
    expect(document.querySelectorAll('[data-component="CanvasEdge"]').length).toBe(1); // no hop yet (drag commits it)
  });

  it('disables [+ Add a source] only when every source is already on the canvas', async () => {
    // Workspace has just Deals + Accounts and NO other saved query → after the 1-hop
    // join, nothing (dataset OR query) is left to add. R92 — the stage list spans both
    // datasets and saved queries, so an empty queries list is mocked to leave nothing.
    server.use(
      http.get('*/datasets', () => HttpResponse.json([MOCK_DATASET, MOCK_DATASET_2])),
      http.get('*/workspaces/:id/queries', () => HttpResponse.json([])),
      http.get('*/workspaces/:id/relationships', () => HttpResponse.json([MOCK_RELATIONSHIP])),
    );
    await openCanvasEditor();
    expect(document.querySelector('[data-component="CanvasAddSource"]') as HTMLButtonElement).toBeDisabled();
  });

  it('deletes a leaf edge via its [×] → removeJoin (collapsing to the lone driving node)', async () => {
    await openCanvasEditor();
    await selectEdge(); // reveal the context pad
    const del = (await waitFor(() => {
      const el = document.querySelector('[data-component="CanvasEdgeDelete"]') as HTMLButtonElement;
      expect(el).not.toBeNull();
      return el;
    })) as HTMLButtonElement;
    expect(del.getAttribute('data-leaf')).toBe('true');
    fireEvent.click(del);
    await waitFor(() => expect(document.querySelectorAll('[data-component="CanvasEdge"]').length).toBe(0));
    expect(document.querySelectorAll('[data-component="CanvasNode"]').length).toBe(1);
  });

  it("disables a non-leaf edge's [×] with the removeJoinBlocked reason (2-hop tree)", async () => {
    serveQuery({
      ...MOCK_JOINED_QUERY.definition,
      relationships: [
        {
          id: 'qrel_a1b2c3d4',
          leftSourceId: DEALS,
          leftColumn: 'deal_id',
          rightSourceId: ACCOUNTS,
          rightColumn: 'account_id',
          cardinality: 'one_to_many',
          originRelationshipId: 'rel_a1b2c3d4',
        },
        {
          id: 'qrel_b2c3d4e5',
          leftSourceId: ACCOUNTS,
          leftColumn: 'tier',
          rightSourceId: OWNERS,
          rightColumn: 'tier',
          cardinality: 'one_to_many',
          originRelationshipId: 'rel_b2c3d4e5',
        },
      ],
      joins: [
        { queryRelId: 'qrel_a1b2c3d4', type: 'inner' },
        { queryRelId: 'qrel_b2c3d4e5', type: 'inner' },
      ],
    });
    renderApp(`/data-management/queries/${JOIN_ID}`);
    expect(await screen.findByText(/Matched 2 rows/)).toBeInTheDocument();
    clickEdit();
    switchTab('canvas');
    await waitFor(() => expect(document.querySelectorAll('[data-component="CanvasEdge"]').length).toBe(2));
    // Deals⋈Accounts is a NON-leaf (Accounts drives the 2nd hop) → select it: its [×]
    // is disabled with data-leaf=false (the context pad shows only the selected edge).
    await selectEdge('qrel_a1b2c3d4');
    const nonLeafDel = (await waitFor(() => {
      const el = document.querySelector('[data-component="CanvasEdgeDelete"]') as HTMLButtonElement;
      expect(el).not.toBeNull();
      return el;
    })) as HTMLButtonElement;
    expect(nonLeafDel.getAttribute('data-leaf')).toBe('false');
    expect(nonLeafDel).toBeDisabled();
    // The leaf hop (Accounts⋈Owners) is removable — select it: enabled, data-leaf=true.
    await selectEdge('qrel_b2c3d4e5');
    const leafDel = (await waitFor(() => {
      const el = document.querySelector('[data-component="CanvasEdgeDelete"][data-leaf="true"]') as HTMLButtonElement;
      expect(el).not.toBeNull();
      return el;
    })) as HTMLButtonElement;
    expect(leafDel).not.toBeDisabled();
  });

  it('promotes a query-owned rel up to the governed ER via POST /relationships', async () => {
    let posted: Record<string, unknown> | null = null;
    server.use(
      http.post('*/workspaces/:id/relationships', async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { ...MOCK_RELATIONSHIP, id: 'rel_promoted', ...posted, status: 'valid' },
          { status: 201 },
        );
      }),
    );
    await openCanvasEditor();
    await selectEdge(); // reveal the context pad
    const promote = (await waitFor(() => {
      const el = document.querySelector('[data-component="CanvasPromote"]') as HTMLButtonElement;
      expect(el).not.toBeNull();
      return el;
    })) as HTMLButtonElement;
    fireEvent.click(promote);
    // Success surfaces the message; the POST carried the query-owned rel's join fields.
    expect(await screen.findByText('Relationship promoted to the workspace.')).toBeInTheDocument();
    expect(posted).toMatchObject({ leftColumn: 'deal_id', rightColumn: 'account_id' });
  });

  it("warns when a copied rel diverged from its origin, and re-syncs on the user's opt-in", async () => {
    // The query's snapshot says one_to_one; the governed origin (default handler) is
    // one_to_many → a 'changed' divergence. Warn-only — the query still runs.
    serveQuery({
      ...MOCK_JOINED_QUERY.definition,
      relationships: [
        {
          id: 'qrel_a1b2c3d4',
          leftSourceId: DEALS,
          leftColumn: 'deal_id',
          rightSourceId: ACCOUNTS,
          rightColumn: 'account_id',
          cardinality: 'one_to_one',
          originRelationshipId: 'rel_a1b2c3d4',
        },
      ],
      joins: [{ queryRelId: 'qrel_a1b2c3d4', type: 'inner' }],
    });
    renderApp(`/data-management/queries/${JOIN_ID}`);
    expect(await screen.findByText(/Matched 2 rows/)).toBeInTheDocument();
    clickEdit();
    switchTab('canvas');
    const diverged = (await waitFor(() => {
      const el = document.querySelector('[data-component="CanvasEdgeDiverged"]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    })) as HTMLElement;
    expect(diverged.getAttribute('data-divergence')).toBe('changed');
    // Opt-in re-sync re-copies the governed fields → divergence clears (warn gone).
    // Re-sync lives in the edge context pad (R90) → select the edge first.
    await selectEdge();
    fireEvent.click(
      await waitFor(() => {
        const el = document.querySelector('[data-component="CanvasResync"]') as HTMLButtonElement;
        expect(el).not.toBeNull();
        return el;
      }),
    );
    await waitFor(() => expect(document.querySelector('[data-component="CanvasEdgeDiverged"]')).toBeNull());
  });
});
