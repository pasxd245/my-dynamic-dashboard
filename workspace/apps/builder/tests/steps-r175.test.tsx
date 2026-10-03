// R175 — the steps the weekly-report dogfood pulled in (conditional column, date
// part, date difference), the list editors that let an API-saved definition
// round-trip through the builder without losing measures or predicates, and the
// dashboard's percent display.

import { AntdConfig } from '@mdd/ui';
import { App } from 'antd';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Column } from '@/features/data-management/datasets/types';
import { formatTableCell } from '@/features/dashboard/WidgetView';
import { StepsEditor } from '@/features/data-management/queries/StepsEditor';
import { blankStep, caseDtype, stepOutput } from '@/features/data-management/queries/steps';
import type { CaseStep, Step } from '@/features/data-management/queries/types';

const COLS: Column[] = [
  { name: 'status', dtype: 'string' },
  { name: 'value', dtype: 'float' },
  { name: 'created', dtype: 'datetime' },
  { name: 'cutoff', dtype: 'datetime' },
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

describe('R175 step column-threading', () => {
  it('date_part and date_diff append an integer column', () => {
    expect(stepOutput(blankStep('date_part', COLS), COLS).at(-1)).toEqual({ name: 'year', dtype: 'integer' });
    const diff = blankStep('date_diff', COLS);
    expect(diff).toMatchObject({ kind: 'date_diff', start: 'created', end: 'cutoff', unit: 'month' });
    expect(stepOutput(diff, COLS).at(-1)).toEqual({ name: 'months_between', dtype: 'integer' });
  });

  it('case unifies its dtype like the backend: ints → integer, a fraction widens to float', () => {
    const flag = blankStep('case', COLS) as CaseStep;
    expect(caseDtype(flag, COLS)).toBe('integer');
    expect(caseDtype({ ...flag, otherwise: { kind: 'const', value: 0.5 } }, COLS)).toBe('float');
    expect(caseDtype({ ...flag, otherwise: { kind: 'col', col: 'value' } }, COLS)).toBe('float');
  });

  it('case with text beside a number has no dtype (the backend would 422)', () => {
    const mixed: CaseStep = {
      kind: 'case',
      name: 'x',
      branches: [{ when: [{ col: 'status', op: 'equals', val: 'a' }], then: { kind: 'const', value: 'yes' } }],
      otherwise: { kind: 'const', value: 0 },
    };
    expect(caseDtype(mixed, COLS)).toBeNull();
    expect(stepOutput(mixed, COLS).at(-1)).toEqual({ name: 'x', dtype: 'string' });
  });
});

describe('R175 StepsEditor', () => {
  it('renders a conditional-column card and adds a condition row', () => {
    const onChange = renderEditor([blankStep('case', COLS)]);
    expect(screen.getByText(/1\. Conditional column/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Add a condition row/ }));
    const next = onChange.mock.calls.at(-1)?.[0][0] as CaseStep;
    expect(next.branches).toHaveLength(2);
  });

  it('names a text/number mix on the card instead of letting save 422', () => {
    renderEditor([
      {
        kind: 'case',
        name: 'x',
        branches: [{ when: [{ col: 'status', op: 'equals', val: 'a' }], then: { kind: 'const', value: 'yes' } }],
        otherwise: { kind: 'const', value: 0 },
      },
    ]);
    expect(screen.getByRole('alert')).toHaveTextContent(/mix text and numbers/);
  });

  it('a filter keeps EVERY predicate: editing the second leaves the first intact', () => {
    const onChange = renderEditor([
      {
        kind: 'filter',
        predicates: [
          { col: 'status', op: 'equals', val: 'Thành công' },
          { col: 'value', op: 'gt', val: 5 },
        ],
      },
    ]);
    fireEvent.change(screen.getByDisplayValue('5'), { target: { value: '7' } });
    expect(onChange).toHaveBeenCalledWith([
      {
        kind: 'filter',
        predicates: [
          { col: 'status', op: 'equals', val: 'Thành công' },
          { col: 'value', op: 'gt', val: 7 },
        ],
      },
    ]);
  });

  it('an aggregate keeps EVERY measure and can add one', () => {
    const agg: Step = {
      kind: 'aggregate',
      dimensions: ['status'],
      measures: [{ agg: 'count' }, { agg: 'sum', col: 'value' }],
    };
    const onChange = renderEditor([agg]);
    expect(screen.getAllByText(/^and$/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Add a measure/ }));
    const next = onChange.mock.calls.at(-1)?.[0][0];
    expect(next.measures).toHaveLength(3);
    expect(next.measures.slice(0, 2)).toEqual(agg.measures);
  });

  it('renders the date-part and date-difference cards', () => {
    renderEditor([blankStep('date_part', COLS), blankStep('date_diff', COLS)]);
    expect(screen.getByText(/1\. Part of a date/)).toBeInTheDocument();
    expect(screen.getByText(/2\. Time between dates/)).toBeInTheDocument();
  });
});

describe('R175 dashboard table cells', () => {
  it('formats by dtype — integers grouped, ratios as percent on a percent widget', () => {
    expect(formatTableCell('3926', 'integer', false)).toBe(new Intl.NumberFormat().format(3926));
    expect(formatTableCell('0.07945736434108527', 'float', true)).toBe(
      new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 }).format(0.07945736434108527),
    );
    expect(formatTableCell('0.07945736434108527', 'float', false)).toBe(
      new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(0.07945736434108527),
    );
    expect(formatTableCell('2026-09-01', 'date', false)).toBe('2026-09-01');
    expect(formatTableCell(null, 'float', true)).toBe('');
  });
});

describe('R175 ratio columns', () => {
  it('a float column is a ratio only when every value lies in [-1, 1]', async () => {
    const { isRatioColumn } = await import('@/features/dashboard/WidgetView');
    const rows = [
      ['0.05', '6608670.14', null],
      ['0.12', '5873613.71', null],
    ];
    expect(isRatioColumn(rows, 0)).toBe(true);
    expect(isRatioColumn(rows, 1)).toBe(false);
    expect(isRatioColumn(rows, 2)).toBe(false);
  });
});
