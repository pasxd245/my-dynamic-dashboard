// R176 — the predicate row's atom-only operators: `in` / `not_in` take a value
// list (a tags select) and the comparison ops take another column as operand.
// The chip vocabulary (`OPS_BY_DTYPE`) is unchanged — list ops never become chips.

import { AntdConfig } from '@mdd/ui';
import { App } from 'antd';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Column } from '@/features/data-management/datasets/types';
import { OPS_BY_DTYPE } from '@/features/data-management/datasets/filters/types';
import { predicateOps, StepsEditor } from '@/features/data-management/queries/StepsEditor';
import type { FilterStep, Step } from '@/features/data-management/queries/types';

const COLS: Column[] = [
  { name: 'status', dtype: 'string' },
  { name: 'amount', dtype: 'float' },
  { name: 'valid_from', dtype: 'date' },
  { name: 'expires', dtype: 'date' },
  { name: 'start_at', dtype: 'datetime' },
  { name: 'vip', dtype: 'boolean' },
];

function renderEditor(steps: Step[]) {
  const onChange = vi.fn();
  const { container } = render(
    <AntdConfig>
      <App>
        <StepsEditor steps={steps} columns={COLS} onChange={onChange} />
      </App>
    </AntdConfig>,
  );
  return { onChange, container };
}

const lastFilter = (onChange: ReturnType<typeof vi.fn>) => onChange.mock.calls.at(-1)?.[0][0] as FilterStep;

describe('R176 predicateOps', () => {
  it('adds in / not_in to every non-boolean dtype and leaves the chip vocabulary alone', () => {
    expect(predicateOps('string')).toEqual([...OPS_BY_DTYPE.string, 'in', 'not_in']);
    expect(predicateOps('date')).toContain('in');
    expect(predicateOps('float')).toContain('not_in');
    expect(predicateOps('boolean')).not.toContain('in');
    for (const ops of Object.values(OPS_BY_DTYPE)) expect(ops).not.toContain('in');
  });
});

describe('R176 PredicateList', () => {
  it('an `in` row renders a tag select and typing a value appends to vals', () => {
    const { onChange, container } = renderEditor([
      { kind: 'filter', predicates: [{ col: 'status', op: 'in', vals: ['Thành công'] }] },
    ]);
    const tags = container.querySelector('[data-component="PredicateValues"]') as HTMLElement;
    expect(tags).not.toBeNull();
    expect(within(tags).getByText('Thành công')).toBeInTheDocument();
    const input = within(tags).getByRole('combobox');
    fireEvent.change(input, { target: { value: 'Hủy' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(lastFilter(onChange).predicates[0]).toMatchObject({ op: 'in', vals: ['Thành công', 'Hủy'] });
  });

  it('numeric list values are written as numbers', () => {
    const { onChange, container } = renderEditor([
      { kind: 'filter', predicates: [{ col: 'amount', op: 'not_in', vals: [] }] },
    ]);
    const input = within(container.querySelector('[data-component="PredicateValues"]') as HTMLElement).getByRole(
      'combobox',
    );
    fireEvent.change(input, { target: { value: '250' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(lastFilter(onChange).predicates[0].vals).toEqual([250]);
  });

  it('a comparison row offers a Value/Column switch; Column mode writes refCol and drops val', () => {
    const { onChange } = renderEditor([
      { kind: 'filter', predicates: [{ col: 'expires', op: 'gte', val: '2026-01-01' }] },
    ]);
    const kind = screen.getByRole('combobox', { name: 'Compare with' });
    fireEvent.mouseDown(kind);
    fireEvent.click(screen.getByTitle('Column'));
    const pred = lastFilter(onChange).predicates[0];
    // first same-family column that is not the row's own column
    expect(pred).toMatchObject({ col: 'expires', op: 'gte', refCol: 'valid_from' });
    expect(pred.val).toBeUndefined();
  });

  it('Column mode lists only same-family columns (date ↔ datetime), never the column itself', () => {
    const { container } = renderEditor([
      { kind: 'filter', predicates: [{ col: 'expires', op: 'gte', refCol: 'valid_from' }] },
    ]);
    const ref = container.querySelector('[data-component="PredicateRefCol"]') as HTMLElement;
    expect(ref).not.toBeNull();
    fireEvent.mouseDown(within(ref).getByRole('combobox'));
    const titles = Array.from(document.querySelectorAll('.ant-select-item-option')).map((o) => o.getAttribute('title'));
    expect(titles).toEqual(['valid_from', 'start_at']);
  });

  it('list ops and no-value ops show no Value/Column switch', () => {
    renderEditor([
      {
        kind: 'filter',
        predicates: [
          { col: 'status', op: 'in', vals: ['a'] },
          { col: 'amount', op: 'is_null' },
        ],
      },
    ]);
    expect(screen.queryByRole('combobox', { name: 'Compare with' })).toBeNull();
  });
});
