import { describe, expect, it } from 'vitest';

import {
  applyFilters,
  countByGroup,
  distinctValues,
  findColIndex,
  pickWidgetDefaults,
  sortDesc,
  sumByGroup,
  sortByDimension,
  aggregateScalar,
  aggregateByGroupSeries,
  sumTwoMeasures,
  toScatterPoints,
  aggregateMatrix,
  toNum,
} from './aggregate';

// R114 — heatmap: a 2-D matrix (x × y → agg), the densest crosstab.
describe('aggregateMatrix', () => {
  const rows = [
    ['Mon', 'AM', '2'],
    ['Mon', 'PM', '5'],
    ['Tue', 'AM', '1'],
    ['Mon', 'AM', '3'], // same cell → sums with the first Mon/AM
  ];
  it('builds sorted x/y axes and [xi, yi, value] cells (sum)', () => {
    const { xs, ys, cells } = aggregateMatrix(rows, 0, 1, 2, 'sum');
    expect(xs).toEqual(['Mon', 'Tue']);
    expect(ys).toEqual(['AM', 'PM']);
    // Mon/AM = 2+3 = 5
    expect(cells).toContainEqual([0, 0, 5]);
    expect(cells).toContainEqual([0, 1, 5]); // Mon/PM
    expect(cells).toContainEqual([1, 0, 1]); // Tue/AM
  });
  it('counts cells for count agg', () => {
    const { cells } = aggregateMatrix(rows, 0, 1, -1, 'count');
    expect(cells).toContainEqual([0, 0, 2]); // two Mon/AM rows
  });
});

// R113 — scatter: raw (x,y) points, NO aggregation (one point per row).
describe('toScatterPoints', () => {
  it('maps each row to an (x,y) point without rolling up', () => {
    const rows = [
      ['a', '1', '2'],
      ['b', '3', '4'],
      ['c', '', '5'], // blank x → 0
    ];
    expect(toScatterPoints(rows, 1, 2)).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
      { x: 0, y: 5 },
    ]);
  });
});

// R112 — combo: two summed measures per dimension, ordered by the primary.
describe('sumTwoMeasures', () => {
  it('sums both measures per dimension, ordered by v1 desc', () => {
    const rows = [
      ['A', '3', '100'],
      ['B', '9', '50'],
      ['A', '7', '20'],
    ];
    expect(sumTwoMeasures(rows, 0, 1, 2)).toEqual([
      { label: 'A', v1: 10, v2: 120 },
      { label: 'B', v1: 9, v2: 50 },
    ]);
  });
});

// R111 — multi-series 2-D roll-up (client-side pivot: long rows → wide series).
describe('aggregateByGroupSeries', () => {
  const rows = [
    ['Q1', 'East', '10'],
    ['Q1', 'West', '5'],
    ['Q2', 'East', '7'],
  ];
  it('pivots dimension × series into wide rows with sorted series keys', () => {
    const { data, seriesKeys } = aggregateByGroupSeries(rows, 0, 1, 2, 'sum');
    expect(seriesKeys).toEqual(['East', 'West']);
    expect(data).toEqual([
      { label: 'Q1', East: 10, West: 5 },
      { label: 'Q2', East: 7, West: 0 }, // missing Q2×West cell → 0
    ]);
  });
  it('counts rows per dimension × series for count agg', () => {
    const { data } = aggregateByGroupSeries(rows, 0, 1, -1, 'count');
    expect(data[0]).toEqual({ label: 'Q1', East: 1, West: 1 });
  });
});

// (R116 numberFormat is covered in widget-config.test.ts — pure presentation.)

// R110 — KPI scalar over all rows.
describe('aggregateScalar', () => {
  const rows = [
    ['Alice', '10'],
    ['Bob', '20'],
    ['Carol', ''],
  ];
  it('sums a measure column (blank → 0)', () => {
    expect(aggregateScalar(rows, 1, 'sum')).toBe(30);
  });
  it('counts rows regardless of measure', () => {
    expect(aggregateScalar(rows, -1, 'count')).toBe(3);
  });
  it('sum with no measure column is 0', () => {
    expect(aggregateScalar(rows, -1, 'sum')).toBe(0);
  });
});

// R109 — line/time-series ordering: by the dimension (x-axis), not by value.
describe('sortByDimension', () => {
  it('orders a date dimension chronologically (not by value)', () => {
    const data = [
      { label: '2026-03-01', value: 5 },
      { label: '2026-01-01', value: 99 },
      { label: '2026-02-01', value: 1 },
    ];
    expect(sortByDimension(data, 'date').map((d) => d.label)).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
  });

  it('orders a non-temporal dimension lexically', () => {
    const data = [
      { label: 'Charlie', value: 1 },
      { label: 'Alice', value: 9 },
      { label: 'Bob', value: 5 },
    ];
    expect(sortByDimension(data, 'string').map((d) => d.label)).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('falls back to lexical order for unparseable date cells', () => {
    const data = [
      { label: 'zzz', value: 1 },
      { label: 'aaa', value: 2 },
    ];
    expect(sortByDimension(data, 'datetime').map((d) => d.label)).toEqual(['aaa', 'zzz']);
  });
});

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

describe('distinctValues (R103)', () => {
  // rows: [region, outcome]
  const rows = [
    ['EMEA', 'won'],
    ['APAC', 'lost'],
    ['EMEA', 'won'],
    [null, 'won'],
  ];

  it('returns sorted distinct labels, blanks as (blank)', () => {
    expect(distinctValues(rows, 0)).toEqual(['(blank)', 'APAC', 'EMEA']);
    expect(distinctValues(rows, 1)).toEqual(['lost', 'won']);
  });
});

describe('applyFilters (R103)', () => {
  const columns = [{ name: 'region' }, { name: 'outcome' }];
  const rows = [
    ['EMEA', 'won'],
    ['APAC', 'lost'],
    ['EMEA', 'lost'],
    [null, 'won'],
  ];

  it('keeps rows matching a one-of filter', () => {
    expect(applyFilters(rows, columns, [{ column: 'region', values: ['EMEA'] }])).toEqual([
      ['EMEA', 'won'],
      ['EMEA', 'lost'],
    ]);
  });

  it('ANDs multiple filters', () => {
    expect(
      applyFilters(rows, columns, [
        { column: 'region', values: ['EMEA'] },
        { column: 'outcome', values: ['won'] },
      ]),
    ).toEqual([['EMEA', 'won']]);
  });

  it('matches (blank) for null cells', () => {
    expect(applyFilters(rows, columns, [{ column: 'region', values: ['(blank)'] }])).toEqual([[null, 'won']]);
  });

  it('skips a filter whose column is absent (widget unaffected)', () => {
    expect(applyFilters(rows, columns, [{ column: 'missing', values: ['x'] }])).toBe(rows);
  });

  it('skips a half-built filter with no values', () => {
    expect(applyFilters(rows, columns, [{ column: 'region', values: [] }])).toBe(rows);
  });
});
