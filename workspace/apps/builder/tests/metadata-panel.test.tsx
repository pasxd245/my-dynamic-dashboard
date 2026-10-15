// R180 — read-only metadata. The panel shows every namespace's entry with the
// server's stamps (author, when), an AI badge for `source: ai`, a stale flag
// when the noun's definition moved, the frontmatter as a key/value table and
// the body as safe markdown — and nothing that edits.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AntdConfig } from '@mdd/ui';
import { AppLayout } from '@/components/AppLayout';
import { DatasetDetailPage } from '@/features/data-management/datasets/DatasetDetailPage';
import { splitFrontmatter } from '@/features/metadata/frontmatter';
import { MetadataEntryView, MetadataPanel } from '@/features/metadata/MetadataPanel';
import { MOCK_DATASET } from '@/mocks/fixtures';

function withProviders(ui: React.ReactNode, path = '/') {
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

describe('R180 splitFrontmatter', () => {
  it('splits a leading --- block into pairs and leaves the body', () => {
    const { pairs, body } = splitFrontmatter('---\nsource: export\nn: 3\n---\n\n# T\n\nbody');
    expect(pairs).toEqual([
      ['source', 'export'],
      ['n', '3'],
    ]);
    expect(body).toBe('# T\n\nbody');
  });
  it('does not interpret anything else: no fence → no pairs; an unclosed fence is body', () => {
    expect(splitFrontmatter('# T').pairs).toEqual([]);
    expect(splitFrontmatter('---\na: 1\n# T').pairs).toEqual([]);
  });
});

describe('R180 MetadataEntryView', () => {
  it('shows the AI badge, the stale flag, the author and the frontmatter table', () => {
    const { container } = withProviders(
      <MetadataEntryView
        namespace="aicowork"
        entry={{
          md: '---\nsource: export\n---\n\nSome **text**',
          source: 'ai',
          author: 'agent',
          writtenAt: '2026-10-15T08:00:00Z',
          definitionVersion: 'abc',
          stale: true,
        }}
      />,
    );
    expect(container.querySelector('[data-component="MetadataAiBadge"]')).not.toBeNull();
    expect(container.querySelector('[data-component="MetadataStale"]')).not.toBeNull();
    expect(screen.getByText(/agent ·/)).toBeInTheDocument();
    const table = container.querySelector('[data-component="MetadataFrontmatter"]');
    expect(table?.textContent).toContain('source');
    expect(table?.textContent).toContain('export');
    expect(container.querySelector('strong')?.textContent).toBe('text');
    // Nothing to edit.
    expect(container.querySelector('textarea, input, button')).toBeNull();
  });

  it('shows no AI badge for a human entry', () => {
    const { container } = withProviders(
      <MetadataEntryView
        namespace="notes"
        entry={{ md: 'hi', source: 'human', author: 'analyst', writtenAt: '2026-10-14T09:30:00Z', definitionVersion: 'x', stale: false }}
      />,
    );
    expect(container.querySelector('[data-component="MetadataAiBadge"]')).toBeNull();
    expect(container.querySelector('[data-component="MetadataStale"]')).toBeNull();
  });
});

describe('R180 MetadataPanel', () => {
  it('renders nothing for a noun with no entries', async () => {
    const { container } = withProviders(<MetadataPanel kind="query" nounId="qr_00000000" />);
    await new Promise((r) => setTimeout(r, 50));
    expect(container.querySelector('[data-component="MetadataPanel"]')).toBeNull();
  });

  it('shows the dataset page panel with the dataset entry and the column child', async () => {
    const { container } = withProviders(
      <AppLayout>
        <Routes>
          <Route path="/data-management/datasets/:id" element={<DatasetDetailPage />} />
        </Routes>
      </AppLayout>,
      `/data-management/datasets/${MOCK_DATASET.id}`,
    );
    await waitFor(() => expect(container.querySelector('[data-component="MetadataPanel"]')).not.toBeNull());
    await waitFor(() => expect(container.querySelectorAll('[data-component="MetadataEntry"]').length).toBe(2));
    expect(container.querySelector('[data-component="MetadataChild"]')?.getAttribute('data-child')).toBe('won_at');
    expect(screen.getByText('What this is')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-component="MetadataAiBadge"]').length).toBe(2);
    expect(container.querySelectorAll('[data-component="MetadataStale"]').length).toBe(1);
    // The panel has no edit control.
    expect(container.querySelector('[data-component="MetadataPanel"] textarea')).toBeNull();
  });
});
