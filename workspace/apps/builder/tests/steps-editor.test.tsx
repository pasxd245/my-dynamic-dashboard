// R125 — the transform-steps authoring UI: the pure column-threading (steps.ts)
// + the StepsEditor wiring. The shaped-preview round-trip is the human's
// in-browser feel-review (DFCFBI F1); here we cover the FE logic deterministically.

import { AntdConfig } from '@mdd/ui';
import { App } from 'antd';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Column } from '@/features/data-management/datasets/types';
import { StepsEditor } from '@/features/data-management/queries/StepsEditor';
import {
  blankStep,
  grainAt,
  groupColumnPool,
  stepOutput,
  threadColumns,
} from '@/features/data-management/queries/steps';
import type { GroupColumnStep, Step } from '@/features/data-management/queries/types';

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

  it('R141: sort preserves the column space; select re-binds (project + rename + reorder)', () => {
    const sort: Step = { kind: 'sort', keys: [{ col: 'region' }, { col: 'amount', descending: true }] };
    expect(stepOutput(sort, COLS)).toEqual(COLS);
    const select: Step = { kind: 'select', cols: [{ col: 'amount', name: 'total' }, { col: 'region' }] };
    expect(stepOutput(select, COLS)).toEqual([
      { name: 'total', dtype: 'integer' },
      { name: 'region', dtype: 'string' },
    ]);
  });

  it('R141: blankStep defaults — sort takes the first column, select keeps everything', () => {
    expect(blankStep('sort', COLS)).toEqual({ kind: 'sort', keys: [{ col: 'region', descending: false }] });
    expect(blankStep('select', COLS)).toEqual({
      kind: 'select',
      cols: [{ col: 'region' }, { col: 'amount' }],
    });
  });

  it('R144: date_bucket appends a date column; blankStep picks the first temporal column', () => {
    const withDate: Column[] = [...COLS, { name: 'called_at', dtype: 'datetime' }];
    const bucket: Step = { kind: 'date_bucket', col: 'called_at', granularity: 'week', name: 'week' };
    expect(stepOutput(bucket, withDate)).toEqual([...withDate, { name: 'week', dtype: 'date' }]);
    expect(blankStep('date_bucket', withDate)).toEqual({
      kind: 'date_bucket',
      col: 'called_at',
      granularity: 'week',
      name: 'bucket',
    });
    // no temporal column → the col defaults empty (BE rejects on save anyway)
    expect(blankStep('date_bucket', COLS)).toMatchObject({ col: '' });
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

  it('R144: renders a date-bucket card; the name input fires onChange', () => {
    const withDate: Column[] = [...COLS, { name: 'called_at', dtype: 'datetime' }];
    const onChange = vi.fn();
    render(
      <AntdConfig>
        <App>
          <StepsEditor steps={[blankStep('date_bucket', withDate)]} columns={withDate} onChange={onChange} />
        </App>
      </AntdConfig>,
    );
    expect(screen.getByText(/1\. Date bucket/)).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue('bucket'), { target: { value: 'week' } });
    expect(onChange).toHaveBeenCalledWith([
      { kind: 'date_bucket', col: 'called_at', granularity: 'week', name: 'week' },
    ]);
  });

  it('R141: renders sort + select cards; a select rename fires onChange with `name`', () => {
    const onChange = renderEditor([blankStep('sort', COLS), blankStep('select', COLS)]);
    expect(screen.getByText(/1\. Sort/)).toBeInTheDocument();
    expect(screen.getByText(/2\. Select columns/)).toBeInTheDocument();
    const [firstRename] = screen.getAllByPlaceholderText('Rename (optional)');
    fireEvent.change(firstRename, { target: { value: 'area' } });
    expect(onChange).toHaveBeenCalledWith([
      blankStep('sort', COLS),
      { kind: 'select', cols: [{ col: 'region', name: 'area' }, { col: 'amount' }] },
    ]);
  });
});

// R162 — the within-group column ("Group value"). The round's central claim is
// that POSITION, not a parameter, decides pooled vs average-of-groups, and that
// the GRAIN LINE makes that legible. These pin both: the column threading, and
// that the sentence actually changes when the card moves past an aggregate.
const AGENT_COLS: Column[] = [
  { name: 'agent', dtype: 'string' },
  { name: 'team', dtype: 'string' },
  { name: 'rate', dtype: 'float' },
];

const AGG_BY_AGENT: Step = {
  kind: 'aggregate',
  dimensions: ['agent', 'team'],
  measures: [{ col: 'rate', agg: 'avg' }],
};

describe('R162 within-group column (steps.ts)', () => {
  it('appends one column and does NOT reshape — the non-collapsing half of the family', () => {
    const step: Step = { kind: 'group_column', name: 'team_rate', agg: 'avg', col: 'rate', by: ['team'] };
    expect(stepOutput(step, AGENT_COLS)).toEqual([...AGENT_COLS, { name: 'team_rate', dtype: 'float' }]);
  });

  it('output dtype mirrors the collapsing measure rules exactly', () => {
    const dtypeOf = (agg: GroupColumnStep['agg'], col?: string) =>
      stepOutput({ kind: 'group_column', name: 'x', agg, col, by: ['team'] }, AGENT_COLS).at(-1)?.dtype;
    expect(dtypeOf('avg', 'rate')).toBe('float');
    expect(dtypeOf('count')).toBe('integer');
    expect(dtypeOf('count_distinct', 'agent')).toBe('integer');
    expect(dtypeOf('sum', 'rate')).toBe('float'); // keeps the source dtype
  });

  it('grainAt: null before any aggregate, the dimensions after one', () => {
    const before: Step[] = [{ kind: 'group_column', name: 'g', agg: 'avg', col: 'rate', by: ['team'] }, AGG_BY_AGENT];
    expect(grainAt(before, 0)).toBeNull(); // the group column runs over SOURCE rows → pooled
    const after: Step[] = [AGG_BY_AGENT, { kind: 'group_column', name: 'g', agg: 'avg', col: 'rate', by: ['team'] }];
    expect(grainAt(after, 1)).toEqual(['agent', 'team']); // → average of already-grouped values
  });

  it('grainAt carries dimension names through a later `select` rename/projection', () => {
    const steps: Step[] = [
      AGG_BY_AGENT,
      { kind: 'select', cols: [{ col: 'agent', name: 'who' }, { col: 'rate' }] },
      { kind: 'group_column', name: 'g', agg: 'avg', col: 'rate', by: ['who'] },
    ];
    // `team` was projected away, `agent` renamed — the sentence must name what the user can see.
    expect(grainAt(steps, 2)).toEqual(['who']);
  });

  it('groupColumnPool applies the same dtype gates as a collapsing measure', () => {
    expect(groupColumnPool('avg', AGENT_COLS).map((c) => c.name)).toEqual(['rate']);
    expect(groupColumnPool('count_distinct', AGENT_COLS).map((c) => c.name)).toEqual(['agent', 'team', 'rate']);
  });

  it('blankStep defaults to "average of the first numeric, within the first categorical"', () => {
    expect(blankStep('group_column', AGENT_COLS)).toEqual({
      kind: 'group_column',
      name: 'group_value',
      agg: 'avg',
      col: 'rate',
      by: ['agent'],
    });
  });
});

describe('R162 within-group column (StepsEditor)', () => {
  const renderAgents = (steps: Step[], onChange = vi.fn()) => {
    render(
      <AntdConfig>
        <App>
          <StepsEditor steps={steps} columns={AGENT_COLS} onChange={onChange} />
        </App>
      </AntdConfig>,
    );
    return onChange;
  };

  it('renders the card under its business-words label — never "window" or "partition"', () => {
    renderAgents([blankStep('group_column', AGENT_COLS)]);
    expect(screen.getByText(/1\. Group value/)).toBeInTheDocument();
    expect(screen.queryByText(/window|partition/i)).not.toBeInTheDocument();
  });

  it('declares a visible label AND an accessible name for every control', () => {
    renderAgents([blankStep('group_column', AGENT_COLS)]);
    for (const name of ['Measure', 'Within each', 'New column name']) {
      expect(screen.getByText(name)).toBeInTheDocument();
      expect(screen.getByLabelText(name)).toBeInTheDocument();
    }
  });

  // THE round's primary risk, made a test: the same card in two positions must
  // say two different things, so the user can tell which reading they got.
  it('the grain line names SOURCE rows before an aggregate and the GROUPED grain after it', () => {
    const group: Step = { kind: 'group_column', name: 'team_rate', agg: 'avg', col: 'rate', by: ['team'] };
    const { unmount } = render(
      <AntdConfig>
        <App>
          <StepsEditor steps={[group, AGG_BY_AGENT]} columns={AGENT_COLS} onChange={vi.fn()} />
        </App>
      </AntdConfig>,
    );
    expect(screen.getByText(/one row of your source data/)).toBeInTheDocument();
    unmount();

    renderAgents([AGG_BY_AGENT, group]);
    expect(screen.getByText(/one agent × team/)).toBeInTheDocument();
    expect(screen.queryByText(/one row of your source data/)).not.toBeInTheDocument();
  });

  it('the grain line is a polite live region — moving the card announces the new reading', () => {
    renderAgents([AGG_BY_AGENT, blankStep('group_column', AGENT_COLS)]);
    const grain = screen.getByRole('status');
    expect(grain).toHaveAttribute('aria-live', 'polite');
    expect(grain).toHaveTextContent(/one agent × team/);
  });

  it('switching to `count` drops the column picker; switching back re-picks an eligible one', () => {
    const onChange = renderAgents([blankStep('group_column', AGENT_COLS)]);
    fireEvent.mouseDown(screen.getByLabelText('Measure'));
    fireEvent.click(screen.getByText('Count rows'));
    expect(onChange).toHaveBeenCalledWith([
      { kind: 'group_column', name: 'group_value', agg: 'count', col: undefined, by: ['agent'] },
    ]);
  });
});
