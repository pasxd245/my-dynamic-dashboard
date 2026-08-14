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
  defaultWindowName,
  grainAt,
  groupColumnIssues,
  groupColumnPool,
  narrowedBy,
  nullCountOf,
  stepOutput,
  threadColumns,
  windowColumnIssues,
  windowOpAvailable,
} from '@/features/data-management/queries/steps';
import type { GroupColumnStep, Step, WindowColumnStep, WindowOp } from '@/features/data-management/queries/types';

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

  it('R165: a blank derive pairs the last numeric column, not a literal', () => {
    // The month-over-month shape (`count − prev_count`) is what this step is
    // reached for once a window column exists, so it is the default.
    const withPrev: Column[] = [...COLS, { name: 'prev_amount', dtype: 'integer' }];
    expect(blankStep('derive', withPrev)).toEqual({
      kind: 'derive',
      name: 'new_column',
      left: 'amount',
      op: '-',
      right: { kind: 'col', col: 'prev_amount' },
    });
    // Only one numeric column → nothing to compare against, so the literal stands.
    expect(blankStep('derive', COLS)).toMatchObject({ right: { kind: 'const', value: 0 } });
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

  it('R165 walk T2: the advisory stops asking once a derive consumes the column, and returns when it is deleted', () => {
    const withDate: Column[] = [{ name: 'agent', dtype: 'string' }, { name: 'month', dtype: 'date' }];
    const win: Step = {
      kind: 'window_column',
      op: 'prior_period',
      name: 'prev_count',
      col: 'count',
      by: ['agent'],
      orderBy: [{ col: 'month' }],
      unit: 'month',
    };
    const der: Step = { kind: 'derive', name: 'vs_prev', left: 'count', op: '-', right: { kind: 'col', col: 'prev_count' } };
    const cols: Column[] = [...withDate, { name: 'count', dtype: 'integer' }];

    // The chain is COMPLETE → the description stays, the instruction is gone.
    const { unmount } = render(
      <AntdConfig>
        <App>
          <StepsEditor steps={[win, der]} columns={cols} onChange={vi.fn()} />
        </App>
      </AntdConfig>,
    );
    expect(screen.getByText(/holds the previous period/)).toBeInTheDocument();
    expect(screen.queryByText(/To compare, add/)).not.toBeInTheDocument();
    unmount();

    // Delete the derive card (T2's exact gesture) → the instruction comes back.
    render(
      <AntdConfig>
        <App>
          <StepsEditor steps={[win]} columns={cols} onChange={vi.fn()} />
        </App>
      </AntdConfig>,
    );
    expect(screen.getByText(/To compare, add/)).toBeInTheDocument();
  });

  it('R165: the derive operand-kind toggle carries a label', () => {
    // Unlabelled, it read as a fourth value picker; the walk found it "hard to
    // recognize" and concluded the step could only subtract a fixed number.
    renderEditor([blankStep('derive', COLS)]);
    expect(screen.getByText('Second value')).toBeInTheDocument();
  });

  it('R171: the operand-kind toggle is a two-button radio group, and switching swaps the operand', () => {
    // R165 fixed the label (findable); the control still did not read as
    // PRESSABLE — a white Segmented thumb on a white card leaves only the
    // UNSELECTED half shaded. Radio.Group optionType="button" boxes both.
    // What a test can check is the wiring and the shape; whether it now READS
    // as a switch is the acceptance walk's question (T4), not this file's.
    // Two numeric columns, so a blank derive starts on `col` and the switch to
    // `Number` is a real change (with only one, it already starts on `const`).
    const cols: Column[] = [...COLS, { name: 'prev_amount', dtype: 'integer' }];
    const onChange = vi.fn();
    render(
      <AntdConfig>
        <App>
          <StepsEditor steps={[blankStep('derive', cols)]} columns={cols} onChange={onChange} />
        </App>
      </AntdConfig>,
    );
    const group = document.querySelector('[data-component="DeriveOperandKind"]')!;
    expect(group.querySelectorAll('.ant-radio-button-wrapper')).toHaveLength(2);

    fireEvent.click(screen.getByRole('radio', { name: 'Number' }));
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ right: { kind: 'const', value: 0 } })]);
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

// R163 F2 — the two card states R162 deliberately deferred. They exist because
// the REORDER gesture is the affordance: the move always happens, so its invalid
// outcome has to be visible AT the card. Both mirror a backend guard
// (`unknown_column` / `column_exists`) rather than inventing a second vocabulary.
describe('R163 within-group column — orphaned + collision card states', () => {
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

  it('groupColumnIssues: flags a missing measure column and a missing group column', () => {
    const step: GroupColumnStep = { kind: 'group_column', name: 'g', agg: 'avg', col: 'rate', by: ['team'] };
    expect(groupColumnIssues(step, AGENT_COLS)).toEqual({ orphaned: [], collision: false });
    // the column space AFTER an aggregate that kept neither `rate` nor `team`
    const narrowed: Column[] = [{ name: 'agent', dtype: 'string' }];
    expect(groupColumnIssues(step, narrowed).orphaned).toEqual(['rate', 'team']);
  });

  it('groupColumnIssues: `count` has no measure column to orphan', () => {
    const step: GroupColumnStep = { kind: 'group_column', name: 'g', agg: 'count', by: ['team'] };
    expect(groupColumnIssues(step, [{ name: 'team', dtype: 'string' }]).orphaned).toEqual([]);
  });

  it('groupColumnIssues: the output name colliding with a current column is `column_exists`', () => {
    const step: GroupColumnStep = { kind: 'group_column', name: 'rate', agg: 'count', by: ['team'] };
    expect(groupColumnIssues(step, AGENT_COLS).collision).toBe(true);
  });

  // The move past an aggregate is the gesture that creates this state.
  it('a card moved above an aggregate that drops its column renders an alert NAMING the column', () => {
    const agg: Step = { kind: 'aggregate', dimensions: ['agent'], measures: [{ agg: 'count' }] };
    const group: Step = { kind: 'group_column', name: 'team_rate', agg: 'avg', col: 'rate', by: ['team'] };
    renderAgents([agg, group]); // after the aggregate, neither `rate` nor `team` exists
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/rate, team/);
    expect(alert).toHaveTextContent(/Move this card back down/);
  });

  it('no alert while every reference resolves at the position', () => {
    renderAgents([blankStep('group_column', AGENT_COLS)]);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('a colliding output name is an INLINE field error tied to the input, not a page alert', () => {
    const step: Step = { kind: 'group_column', name: 'rate', agg: 'count', by: ['team'] };
    renderAgents([step]);
    const input = screen.getByLabelText('New column name');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const errorId = input.getAttribute('aria-errormessage');
    expect(errorId).toBeTruthy();
    expect(document.getElementById(errorId as string)).toHaveTextContent(/already a column here/);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

// R164 — the ORDERED-WINDOW family. The round's two claims under test here are
// (a) the operations are authorable in business words, with the MENU doing the
// naming, and (b) the two mitigations R163's evidence pulled in: the grain line
// now names row-NARROWING steps (a mis-placed `filter` was silent while making
// every rate read 100.0%), and `prior_period` says out loud that it is half of a
// comparison. The engine lands at R165 — these pin the surface, not the SQL.
const MONTH_COLS: Column[] = [
  { name: 'agent', dtype: 'string' },
  { name: 'month', dtype: 'date' },
  { name: 'calls', dtype: 'integer' },
];

describe('R164 ordered-window family (steps.ts)', () => {
  it('appends exactly one column and never reshapes — same shape as the R162 half', () => {
    const step: Step = {
      kind: 'window_column',
      op: 'running_total',
      name: 'calls_running',
      col: 'calls',
      by: ['agent'],
      orderBy: [{ col: 'month' }],
    };
    expect(stepOutput(step, MONTH_COLS)).toEqual([...MONTH_COLS, { name: 'calls_running', dtype: 'integer' }]);
  });

  it('a share is a RATIO (float) and a rank is an ORDINAL (integer); the others carry the source dtype', () => {
    const dtypeOf = (op: WindowOp) =>
      stepOutput(
        { kind: 'window_column', op, name: 'x', col: 'calls', by: [], orderBy: [{ col: 'month' }] },
        MONTH_COLS,
      ).at(-1)?.dtype;
    expect(dtypeOf('pct_of_total')).toBe('float');
    expect(dtypeOf('rank')).toBe('integer');
    expect(dtypeOf('running_total')).toBe('integer');
    expect(dtypeOf('prior_period')).toBe('integer');
  });

  it('offer-nothing (D4): prior_period is unavailable without a date column, rank needs only an order key', () => {
    const noDate: Column[] = [
      { name: 'agent', dtype: 'string' },
      { name: 'calls', dtype: 'integer' },
    ];
    expect(windowOpAvailable('prior_period', noDate)).toBe(false);
    expect(windowOpAvailable('prior_period', MONTH_COLS)).toBe(true);
    expect(windowOpAvailable('rank', noDate)).toBe(true);
    // nothing numeric → no share and no running total to offer
    const noNumeric: Column[] = [{ name: 'agent', dtype: 'string' }];
    expect(windowOpAvailable('pct_of_total', noNumeric)).toBe(false);
    expect(windowOpAvailable('running_total', noNumeric)).toBe(false);
  });

  it('default names describe the OPERATION, so a blank card never starts with a name that lies', () => {
    expect(defaultWindowName('pct_of_total', 'calls')).toBe('calls_share');
    expect(defaultWindowName('running_total', 'calls')).toBe('calls_running');
    expect(defaultWindowName('prior_period', 'calls')).toBe('prev_calls');
    expect(defaultWindowName('rank', 'calls')).toBe('rank');
  });

  it('pct_of_total OMITS orderBy (the op rejects it) while the ordered ops default one', () => {
    expect(blankStep('window_column', MONTH_COLS, 'pct_of_total')).not.toHaveProperty('orderBy');
    // the defaults reach for the SHAPE the op wants: a number to accumulate,
    // a time axis to walk along — not merely the first eligible column.
    expect(blankStep('window_column', MONTH_COLS, 'running_total')).toMatchObject({
      col: 'calls',
      orderBy: [{ col: 'month', descending: false }],
    });
    // prior_period orders by the PERIOD axis, so only a temporal column qualifies
    expect(blankStep('window_column', MONTH_COLS, 'prior_period')).toMatchObject({
      col: 'calls',
      orderBy: [{ col: 'month', descending: false }],
      unit: 'month',
      name: 'prev_calls',
    });
  });

  it('windowColumnIssues: a move can orphan the value column, the order key, OR a group column', () => {
    const step: WindowColumnStep = {
      kind: 'window_column',
      op: 'running_total',
      name: 'r',
      col: 'calls',
      by: ['agent'],
      orderBy: [{ col: 'month' }],
    };
    expect(windowColumnIssues(step, MONTH_COLS)).toEqual({ orphaned: [], collision: false });
    expect(windowColumnIssues(step, [{ name: 'agent', dtype: 'string' }]).orphaned).toEqual(['calls', 'month']);
    expect(windowColumnIssues({ ...step, name: 'calls' }, MONTH_COLS).collision).toBe(true);
  });
});

// The R163 trap, in a test: a `filter` above a within-group card collapses the
// denominator (every rate reads 100.0%) and the sentence used to say nothing.
describe('R164 the grain line learns that filters narrow groups', () => {
  const AGG: Step = { kind: 'aggregate', dimensions: ['agent'], measures: [{ agg: 'count' }] };
  const FILTER: Step = { kind: 'filter', predicates: [{ col: 'status', op: 'equals', val: 'ANSWERED' }] };

  it('narrowedBy: names the filtered columns above the position', () => {
    expect(narrowedBy([FILTER, AGG], 0)).toEqual([]);
    expect(narrowedBy([FILTER, AGG], 1)).toEqual(['status']);
  });

  it('narrowedBy: a top_n narrows rows too, and a collapsing aggregate RE-FORMS the groups', () => {
    const TOP: Step = { kind: 'top_n', col: 'calls', n: 5, descending: true };
    expect(narrowedBy([TOP], 1)).toEqual(['calls']);
    // a filter BEFORE the aggregate is covered by the grain sentence itself;
    // only what narrows AFTER it changes the groups this card sums over.
    expect(narrowedBy([FILTER, AGG, TOP], 3)).toEqual(['calls']);
  });

  it('R165 walk T3 (W-6): a filter on a GRAIN dimension survives the aggregate', () => {
    const AGG2: Step = { kind: 'aggregate', dimensions: ['agent', 'outcome'], measures: [{ agg: 'count' }] };
    const FILT_DIM: Step = { kind: 'filter', predicates: [{ col: 'outcome', op: 'equals', val: 'connected' }] };
    // Filter AFTER the aggregate — reported since R164.
    expect(narrowedBy([AGG2, FILT_DIM], 2)).toEqual(['outcome']);
    // Filter MOVED ABOVE it ([↑], T3's gesture). The results are byte-identical on
    // real data — every share still 100% — so the clause must NOT disappear.
    expect(narrowedBy([FILT_DIM, AGG2], 2)).toEqual(['outcome']);
    // A filter on a NON-dimension still clears at the aggregate: R164's rule intact.
    expect(narrowedBy([FILTER, AGG2], 2)).toEqual([]);
  });

  it('the rendered sentence names the filter — the 100%-rate case, made legible', () => {
    render(
      <AntdConfig>
        <App>
          <StepsEditor
            steps={[AGG, FILTER, { kind: 'group_column', name: 'g', agg: 'count', by: ['agent'] }]}
            columns={[...AGENT_COLS, { name: 'status', dtype: 'string' }]}
            onChange={vi.fn()}
          />
        </App>
      </AntdConfig>,
    );
    const grain = screen.getByText(/Each row here is one agent/);
    expect(grain).toHaveTextContent(/filtered by .status./);
    expect(grain).toHaveAttribute('role', 'status');
  });

  it('R165 walk T3 (W-6): the RENDERED sentence keeps the clause after the filter moves above the aggregate', () => {
    // T3's exact chain and its exact gesture, asserted on the surface rather than on
    // `narrowedBy` — the predicate being right is not the same as the card saying so.
    const AGG2: Step = { kind: 'aggregate', dimensions: ['agent', 'outcome'], measures: [{ agg: 'count' }] };
    const FILT_DIM: Step = { kind: 'filter', predicates: [{ col: 'outcome', op: 'equals', val: 'connected' }] };
    const GROUP: Step = { kind: 'group_column', name: 'agent_total', agg: 'sum', col: 'count', by: ['agent'] };
    render(
      <AntdConfig>
        <App>
          <StepsEditor
            steps={[FILT_DIM, AGG2, GROUP]}
            columns={[...AGENT_COLS, { name: 'outcome', dtype: 'string' }]}
            onChange={vi.fn()}
          />
        </App>
      </AntdConfig>,
    );
    expect(screen.getByText(/Each row here is one agent/)).toHaveTextContent(/filtered by .outcome./);
  });
});

describe('R164 ordered-window family (StepsEditor)', () => {
  const renderMonths = (steps: Step[], onChange = vi.fn()) => {
    render(
      <AntdConfig>
        <App>
          <StepsEditor steps={steps} columns={MONTH_COLS} onChange={onChange} />
        </App>
      </AntdConfig>,
    );
    return onChange;
  };

  it('the card is titled by its OPERATION, and no engine word reaches the surface', () => {
    renderMonths([blankStep('window_column', MONTH_COLS, 'prior_period')]);
    expect(screen.getByText(/1\. Previous period's value/)).toBeInTheDocument();
    expect(screen.queryByText(/window|partition|frame|window_column/i)).not.toBeInTheDocument();
  });

  it('declares a visible label AND an accessible name for every control', () => {
    renderMonths([blankStep('window_column', MONTH_COLS, 'prior_period')]);
    for (const name of ['What', 'Value', 'In order of', 'Within each', 'New column name']) {
      expect(screen.getByText(name)).toBeInTheDocument();
      expect(screen.getByLabelText(name)).toBeInTheDocument();
    }
  });

  it('shows only the fields the chosen op TAKES — a share has no order key', () => {
    renderMonths([blankStep('window_column', MONTH_COLS, 'pct_of_total')]);
    expect(screen.getByText('Value')).toBeInTheDocument();
    expect(screen.queryByText('In order of')).not.toBeInTheDocument();
    // and `rank` has no value column
    render(
      <AntdConfig>
        <App>
          <StepsEditor
            steps={[blankStep('window_column', MONTH_COLS, 'rank')]}
            columns={MONTH_COLS}
            onChange={vi.fn()}
          />
        </App>
      </AntdConfig>,
    );
    expect(screen.getAllByText('In order of').length).toBeGreaterThan(0);
  });

  it('an empty group is a NAMED state ("Across everything"), never a blank field', () => {
    renderMonths([{ kind: 'window_column', op: 'pct_of_total', name: 'calls_share', col: 'calls', by: [] }]);
    expect(screen.getByText('Across everything')).toBeInTheDocument();
  });

  it('prior_period says it is HALF a comparison, and names the next step in the menu’s own words', () => {
    renderMonths([blankStep('window_column', MONTH_COLS, 'prior_period')]);
    const hint = screen.getByText(/To compare, add a/);
    expect(hint).toHaveTextContent(/Computed column/);
    expect(hint).toHaveTextContent(/calls − prev_calls/);
    expect(hint).toHaveAttribute('role', 'status');
    // advisory, never an error — nothing is wrong
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('the other three ops carry no such hint — only the one whose output is a component of the answer', () => {
    renderMonths([blankStep('window_column', MONTH_COLS, 'running_total')]);
    expect(screen.queryByText(/To compare, add a/)).not.toBeInTheDocument();
  });

  it('a move that orphans the order key renders the alert naming it', () => {
    const agg: Step = { kind: 'aggregate', dimensions: ['agent'], measures: [{ agg: 'count' }] };
    const win: Step = {
      kind: 'window_column',
      op: 'running_total',
      name: 'r',
      col: 'calls',
      by: ['agent'],
      orderBy: [{ col: 'month' }],
    };
    renderMonths([agg, win]); // after the aggregate neither `calls` nor `month` exists
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/calls, month/);
  });
});

// R165 F2 — the one card state F1 deferred with a reason. BLANK MEANS TWO THINGS
// ("there was no previous period" vs "the previous value was itself empty") and
// only the first must not read as a data problem. The count needs real result
// rows, which is exactly why it could not ship at F1.
describe('R165 prior_period gap count', () => {
  const RESULT = {
    columns: [
      { name: 'month', dtype: 'date' as const },
      { name: 'prev_calls', dtype: 'integer' as const },
    ],
    rows: [
      ['2025-01-01', null],
      ['2025-02-01', '10'],
      ['2025-04-01', null],
    ],
  };

  it('nullCountOf: counts the blanks in the named output column', () => {
    expect(nullCountOf('prev_calls', RESULT)).toEqual({ count: 2, partial: false });
  });

  it('nullCountOf: returns null when the column is not in the result — no count we cannot stand behind', () => {
    expect(nullCountOf('gone', RESULT)).toBeNull();
    expect(nullCountOf('prev_calls', undefined)).toBeNull();
  });

  it('R165 walk T2: flags the count as PAGE-scoped when the rows are one page of a bigger result', () => {
    // The walk's own chain: 25 rows held, 96 in the result — the blanks visible here
    // are not all the blanks, and the sentence has to say so.
    expect(nullCountOf('prev_calls', { ...RESULT, total: 96 })).toEqual({ count: 2, partial: true });
    // Whole result in hand → the plain wording is the honest one.
    expect(nullCountOf('prev_calls', { ...RESULT, total: RESULT.rows.length })).toEqual({
      count: 2,
      partial: false,
    });
  });

  it('the card names the count and the axis, appended to the advisory line', () => {
    render(
      <AntdConfig>
        <App>
          <StepsEditor
            steps={[blankStep('window_column', MONTH_COLS, 'prior_period')]}
            columns={MONTH_COLS}
            result={RESULT}
            onChange={vi.fn()}
          />
        </App>
      </AntdConfig>,
    );
    const hint = screen.getByText(/To compare, add a/);
    expect(hint).toHaveTextContent(/2 rows have no previous .month./);
  });

  it('no gaps → no clause (silence is the right answer when nothing is missing)', () => {
    render(
      <AntdConfig>
        <App>
          <StepsEditor
            steps={[blankStep('window_column', MONTH_COLS, 'prior_period')]}
            columns={MONTH_COLS}
            result={{ ...RESULT, rows: [['2025-02-01', '10']] }}
            onChange={vi.fn()}
          />
        </App>
      </AntdConfig>,
    );
    expect(screen.queryByText(/rows have no previous/)).not.toBeInTheDocument();
  });
});
