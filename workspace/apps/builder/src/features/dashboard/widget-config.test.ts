import { describe, expect, it } from 'vitest';

import { draftToConfig, type Draft } from './WidgetBuilder';

// R108 — the read-only "View as JSON" panel renders JSON.stringify(draftToConfig(draft)).
// These pin the persisted shape it mirrors (and that `submit()` sends).

const sumDraft: Draft = {
  queryId: 'qr_12345678',
  title: '  Revenue by region  ',
  chartType: 'bar',
  dimensionCol: 'region',
  measureCol: 'amount',
  agg: 'sum',
  span: 2,
};

describe('draftToConfig', () => {
  it('maps a sum draft to the persisted widget shape (id-less, title trimmed)', () => {
    expect(draftToConfig(sumDraft)).toEqual({
      queryId: 'qr_12345678',
      title: 'Revenue by region',
      chartType: 'bar',
      dimensionCol: 'region',
      measureCol: 'amount',
      agg: 'sum',
      span: 2,
    });
  });

  it('drops dimensionCol for a stat (KPI) widget — no grouping', () => {
    const config = draftToConfig({ ...sumDraft, chartType: 'stat' });
    expect('dimensionCol' in config).toBe(false);
    expect(config.chartType).toBe('stat');
    expect(config.measureCol).toBe('amount'); // a sum stat still totals a measure
  });

  it('keeps a gauge target (a literal config number) and drops the dimension', () => {
    const config = draftToConfig({ ...sumDraft, chartType: 'gauge', target: 1000 });
    expect(config.chartType).toBe('gauge');
    expect(config.target).toBe(1000);
    expect('dimensionCol' in config).toBe(false);
  });

  it('omits target when unset, even on a gauge', () => {
    const config = draftToConfig({ ...sumDraft, chartType: 'gauge' });
    expect('target' in config).toBe(false);
  });

  it('a table omits dimension + measure (raw rows; just query + title)', () => {
    const config = draftToConfig({ ...sumDraft, chartType: 'table' });
    expect(config.chartType).toBe('table');
    expect('dimensionCol' in config).toBe(false);
    expect('measureCol' in config).toBe(false);
  });

  it('carries numberFormat when set, omits the plain default', () => {
    expect(draftToConfig({ ...sumDraft, numberFormat: 'compact' }).numberFormat).toBe('compact');
    expect('numberFormat' in draftToConfig(sumDraft)).toBe(false);
  });

  it('drops measureCol for a count aggregation (meaningless there)', () => {
    const config = draftToConfig({ ...sumDraft, agg: 'count' });
    expect('measureCol' in config).toBe(false);
    expect(config.agg).toBe('count');
  });

  it('omits unset fields under JSON.stringify (the panel shows only what is set)', () => {
    const partial: Draft = { title: '', chartType: 'bar', agg: 'sum', span: 1 };
    const json = JSON.stringify(draftToConfig(partial));
    // queryId / dimensionCol unset → undefined values drop out of the JSON.
    expect(json).not.toContain('queryId');
    expect(json).not.toContain('dimensionCol');
    expect(JSON.parse(json)).toMatchObject({ chartType: 'bar', agg: 'sum', span: 1, title: '' });
  });
});

// R177 — `rows` (grid height) travels through the config only when it is not
// the default, so a widget edited without touching its height saves back
// byte-for-byte (pre-R177 dashboards stay unchanged on the wire).
describe('draftToConfig — R177 rows', () => {
  it('omits rows when absent or 1 (the default)', () => {
    expect('rows' in draftToConfig(sumDraft)).toBe(false);
    expect('rows' in draftToConfig({ ...sumDraft, rows: 1 })).toBe(false);
  });

  it('carries rows 2 and 3 through unchanged, next to span', () => {
    expect(draftToConfig({ ...sumDraft, rows: 2 })).toMatchObject({ span: 2, rows: 2 });
    expect(draftToConfig({ ...sumDraft, rows: 3 }).rows).toBe(3);
  });
});
