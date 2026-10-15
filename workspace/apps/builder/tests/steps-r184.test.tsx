// R184 — the `compute` step (closed function catalog, v1: trim): column threading,
// the fresh-card default, the card itself (only text columns offered, the hint
// says what trim does) and the MSW preview appending the cleaned column.

import { AntdConfig } from '@mdd/ui';
import { App } from 'antd';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { queriesApi } from '@/api/queriesApi';
import type { Column } from '@/features/data-management/datasets/types';
import { StepsEditor } from '@/features/data-management/queries/StepsEditor';
import { STEP_MENU, blankStep, stepOutput } from '@/features/data-management/queries/steps';
import type { ComputeStep, PreviewQueryRequest, Step } from '@/features/data-management/queries/types';
import { MOCK_DATASET } from '@/mocks/fixtures';

const COLS: Column[] = [
  { name: 'value', dtype: 'float' },
  { name: 'agent', dtype: 'string' },
  { name: 'created', dtype: 'datetime' },
];

function renderEditor(steps: Step[]) {
  const onChange = vi.fn();
  render(
    <AntdConfig>
      <App>
        <StepsEditor steps={steps} columns={COLS} onChange={onChange} />
      </App>
    </AntdConfig>,
  );
  return onChange;
}

describe('R184 compute step', () => {
  it('a fresh card trims the first text column into <col>_clean and appends a string', () => {
    const step = blankStep('compute', COLS) as ComputeStep;
    expect(step).toEqual({ kind: 'compute', fn: 'trim', col: 'agent', name: 'agent_clean' });
    const out = stepOutput(step, COLS);
    // The source column is kept; the cleaned one is appended.
    expect(out.map((c) => c.name)).toEqual(['value', 'agent', 'created', 'agent_clean']);
    expect(out.at(-1)).toEqual({ name: 'agent_clean', dtype: 'string' });
  });

  it('is offered in the add-column group of the menu', () => {
    const group = STEP_MENU.find((g) => g.group === 'addColumn');
    expect(group?.items.some((i) => i.kind === 'compute')).toBe(true);
  });

  it('the card names the function and explains what trim does', () => {
    renderEditor([{ kind: 'compute', fn: 'trim', col: 'agent', name: 'agent_clean' }]);
    expect(screen.getByText(/Clean text/)).toBeInTheDocument();
    expect(screen.getByText('Trim spaces')).toBeInTheDocument();
    expect(screen.getByText(/"Ly" and "Ly " count as one/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('agent_clean')).toBeInTheDocument();
  });

  it('the MSW preview appends the trimmed column and keeps the source', async () => {
    const req: PreviewQueryRequest = {
      sourceId: MOCK_DATASET.id,
      definition: {
        q: null,
        filters: [],
        advanced: [],
        steps: [{ kind: 'compute', fn: 'trim', col: 'stage', name: 'stage_clean' }],
      },
    };
    const res = await queriesApi.preview(MOCK_DATASET.workspaceId, req, 1, 25);
    const names = res.resolvedColumns?.map((c) => c.name) ?? [];
    expect(names.at(-1)).toBe('stage_clean');
    expect(names).toContain('stage');
    const si = names.indexOf('stage');
    for (const row of res.rows) expect(row.at(-1)).toBe(row[si]);
  });
});
