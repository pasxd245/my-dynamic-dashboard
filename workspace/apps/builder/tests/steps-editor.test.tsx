// R125 — the transform-steps authoring UI: the pure column-threading (steps.ts)
// + the StepsEditor wiring. The shaped-preview round-trip is the human's
// in-browser feel-review (DFCFBI F1); here we cover the FE logic deterministically.

import { AntdConfig } from '@mdd/ui';
import { App } from 'antd';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Column } from '@/features/data-management/datasets/types';
import { StepsEditor } from '@/features/data-management/queries/StepsEditor';
import { blankStep, stepOutput, threadColumns } from '@/features/data-management/queries/steps';
import type { Step } from '@/features/data-management/queries/types';

const COLS: Column[] = [
  { name: 'region', dtype: 'string' },
  { name: 'amount', dtype: 'integer' },
];

describe('R125 step column-threading (steps.ts)', () => {
  it('aggregate reshapes to dimensions + measures', () => {
    const step: Step = { kind: 'aggregate', dimensions: ['region'], measures: [{ col: 'amount', agg: 'sum' }] };
    expect(stepOutput(step, COLS)).toEqual([
      { name: 'region', dtype: 'string' },
      { name: 'amount', dtype: 'integer' },
    ]);
  });

  it('count measure → an integer `count` column', () => {
    const step: Step = { kind: 'aggregate', dimensions: ['region'], measures: [{ agg: 'count' }] };
    expect(stepOutput(step, COLS)).toEqual([
      { name: 'region', dtype: 'string' },
      { name: 'count', dtype: 'integer' },
    ]);
  });

  it('derive appends a float column; top_n/filter preserve', () => {
    const derive: Step = {
      kind: 'derive',
      name: 'doubled',
      left: 'amount',
      op: '*',
      right: { kind: 'const', value: 2 },
    };
    expect(stepOutput(derive, COLS).at(-1)).toEqual({ name: 'doubled', dtype: 'float' });
    const top: Step = { kind: 'top_n', col: 'amount', n: 5, descending: true };
    expect(stepOutput(top, COLS)).toEqual(COLS);
  });

  it('threads the column space through a chain (entering each step + final)', () => {
    const steps: Step[] = [
      { kind: 'aggregate', dimensions: ['region'], measures: [{ col: 'amount', agg: 'sum' }] },
      { kind: 'top_n', col: 'amount', n: 1, descending: true },
    ];
    const { entering, final } = threadColumns(COLS, steps);
    expect(entering[0]).toEqual(COLS); // aggregate sees the base
    expect(entering[1].map((c) => c.name)).toEqual(['region', 'amount']); // top_n sees the aggregate output
    expect(final.map((c) => c.name)).toEqual(['region', 'amount']);
  });

  it('blankStep defaults aggregate from the columns (first categorical / numeric)', () => {
    const step = blankStep('aggregate', COLS);
    expect(step).toMatchObject({
      kind: 'aggregate',
      dimensions: ['region'],
      measures: [{ col: 'amount', agg: 'sum' }],
    });
  });
});

function renderEditor(steps: Step[], onChange = vi.fn()) {
  render(
    <AntdConfig>
      <App>
        <StepsEditor steps={steps} columns={COLS} onChange={onChange} />
      </App>
    </AntdConfig>,
  );
  return onChange;
}

describe('R125 StepsEditor', () => {
  it('renders a step card with its kind label', () => {
    renderEditor([blankStep('derive', COLS)]);
    expect(screen.getByText(/Computed column/)).toBeInTheDocument();
  });

  it('removes a step → onChange with the shorter list', () => {
    const onChange = renderEditor([blankStep('aggregate', COLS)]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove step' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
