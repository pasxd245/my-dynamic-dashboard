// R183 — relationship self-check: the edge measured against its data, shown
// read-only with flags (never a block); the join modal warns before a hop
// that will multiply rows.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AntdConfig } from '@mdd/ui';
import { AppLayout } from '@/components/AppLayout';
import { JoinWithRelatedModal } from '@/features/data-management/queries/JoinWithRelatedModal';
import { RelationshipCheckView, checkFlags } from '@/features/data-management/relationships/RelationshipCheckDrawer';
import { WorkspaceRelationshipsPage } from '@/features/data-management/relationships/WorkspaceRelationshipsPage';
import { MOCK_DATASET, MOCK_RELATIONSHIP_CHECK, MOCK_WORKSPACE } from '@/mocks/fixtures';

function wrap(ui: React.ReactNode, path = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AntdConfig>
        <App>
          <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
        </App>
      </AntdConfig>
    </QueryClientProvider>,
  );
}

describe('R183 checkFlags', () => {
  it('names each finding and is empty when the data matches the declaration', () => {
    expect(checkFlags(MOCK_RELATIONSHIP_CHECK)).toEqual(['cardinality', 'multipliesLeft', 'rightUnmatched']);
    expect(
      checkFlags({
        ...MOCK_RELATIONSHIP_CHECK,
        rightUnmatchedRows: 0,
        rightMaxPerKey: 1,
        observedCardinality: 'one_to_one',
        cardinalityMatches: true,
        multipliesLeft: false,
      }),
    ).toEqual([]);
  });
});

describe('R183 RelationshipCheckView', () => {
  it('shows coverage per side, observed vs declared, and the multiplication warning', () => {
    const { container } = wrap(<RelationshipCheckView check={MOCK_RELATIONSHIP_CHECK} leftName="Deals" rightName="Accounts" />);
    expect(container.querySelector('[data-component="RelationshipCheck"]')?.getAttribute('data-flags')).toBe('cardinality multipliesLeft rightUnmatched');
    expect(container.querySelectorAll('[data-component="RelationshipCheckSide"]').length).toBe(2);
    expect(screen.getByText(/differs from the declaration/)).toBeInTheDocument();
    expect(container.querySelectorAll('[data-component="RelationshipCheckMultiplies"]').length).toBe(1);
    expect(screen.getByText(/4 of 5 rows have a partner · 1 without/)).toBeInTheDocument();
  });
});

describe('R183 relationships page', () => {
  it('opens the check drawer from a Check button and shows the measurement', async () => {
    const { container } = wrap(
      <AppLayout>
        <Routes>
          <Route path="/data-management/workspaces/:id/relationships" element={<WorkspaceRelationshipsPage />} />
        </Routes>
      </AppLayout>,
      `/data-management/workspaces/${MOCK_WORKSPACE.id}/relationships`,
    );
    const buttons = await screen.findAllByRole('button', { name: /check/i });
    const enabled = buttons.find((b) => !(b as HTMLButtonElement).disabled) as HTMLButtonElement;
    fireEvent.click(enabled);
    await waitFor(() => expect(document.body.querySelector('[data-component="RelationshipCheck"]')).not.toBeNull());
    expect(document.body.querySelector('[data-component="RelationshipCheckDrawer"]')).not.toBeNull();
    expect(container).toBeDefined();
  });
});

describe('R183 join modal warning', () => {
  it('warns when the hop from this dataset multiplies rows', async () => {
    wrap(
      <JoinWithRelatedModal open workspaceId={MOCK_WORKSPACE.id} datasetId={MOCK_DATASET.id} datasetName={MOCK_DATASET.name} onClose={() => {}} />,
    );
    await waitFor(() => expect(document.body.querySelector('[data-component="JoinMultipliesWarning"]')).not.toBeNull(), { timeout: 4000 });
  });
});
