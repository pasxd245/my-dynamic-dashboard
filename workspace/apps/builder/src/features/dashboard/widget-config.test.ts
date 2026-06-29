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
