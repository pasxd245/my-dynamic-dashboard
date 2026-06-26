import { describe, expect, it } from 'vitest';

import { countByGroup, findColIndex, pickWidgetDefaults, sortDesc, sumByGroup, toNum } from './aggregate';

describe('findColIndex', () => {
  const cols = [{ name: 'region_name' }, { name: 'Orders.amount' }, { name: 'Customers.region_id' }];

  it('matches an exact (unqualified) name', () => {
    expect(findColIndex(cols, 'region_name')).toBe(0);
  });

  it('matches a collision-qualified name by its suffix', () => {
    expect(findColIndex(cols, 'amount')).toBe(1);
    expect(findColIndex(cols, 'region_id')).toBe(2);
  });

  it('returns -1 when absent', () => {
    expect(findColIndex(cols, 'missing')).toBe(-1);
  });
});

describe('toNum', () => {
  it('parses numeric strings', () => {
    expect(toNum('499.00')).toBe(499);
  });

  it('treats null / blank / non-numeric as 0 (a LEFT-joined edge row)', () => {
    expect(toNum(null)).toBe(0);
    expect(toNum('')).toBe(0);
    expect(toNum(undefined)).toBe(0);
    expect(toNum('n/a')).toBe(0);
  });
});

describe('sumByGroup', () => {
  // rows: [region_name, amount]
  const rows = [
    ['EMEA', '100'],
    ['APAC', '50'],
    ['EMEA', '25'],
    ['Africa', null], // LEFT-join edge: region with no orders → 0, still present
  ];

  it('sums the value column per group, keeping a zero edge group', () => {
    const out = sumByGroup(rows, 0, 1);
    expect(out).toEqual([
      { label: 'EMEA', value: 125 },
      { label: 'APAC', value: 50 },
      { label: 'Africa', value: 0 },
    ]);
  });
});

describe('countByGroup', () => {
  const rows = [['converted'], ['no_answer'], ['converted'], ['declined']];

  it('counts rows per distinct group value', () => {
    expect(countByGroup(rows, 0)).toEqual([
      { label: 'converted', value: 2 },
      { label: 'no_answer', value: 1 },
      { label: 'declined', value: 1 },
    ]);
  });
});

describe('pickWidgetDefaults', () => {
  it('picks first categorical as dimension, first numeric as measure → sum/bar', () => {
    const cols = [
      { name: 'region_name', dtype: 'string' },
      { name: 'amount', dtype: 'float' },
      { name: 'qty', dtype: 'integer' },
    ];
    expect(pickWidgetDefaults(cols)).toEqual({
      dimensionCol: 'region_name',
      measureCol: 'amount',
      agg: 'sum',
      chartType: 'bar',
    });
  });

  it('falls back to count when there is no numeric column', () => {
    const cols = [
      { name: 'outcome', dtype: 'string' },
      { name: 'agent', dtype: 'string' },
    ];
    expect(pickWidgetDefaults(cols)).toEqual({ dimensionCol: 'outcome', agg: 'count', chartType: 'bar' });
  });
});

describe('sortDesc', () => {
  it('orders by value, largest first, without mutating the input', () => {
    const input = [
      { label: 'a', value: 1 },
      { label: 'b', value: 3 },
      { label: 'c', value: 2 },
    ];
    expect(sortDesc(input).map((d) => d.label)).toEqual(['b', 'c', 'a']);
    expect(input[0].label).toBe('a');
  });
});
