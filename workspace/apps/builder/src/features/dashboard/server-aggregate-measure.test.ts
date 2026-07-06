import { describe, expect, it } from 'vitest';

import { serverAggregateSupportsMeasure } from './WidgetView';

// R151/F13 — the server `sum` aggregate 422s (`measure_not_numeric`) on a
// non-numeric measure, and the widget then silently falls back to the client
// roll-up, leaving a doomed 422 in the console. This gate skips that request
// when the measure dtype is KNOWN non-numeric (from the query's resolvedColumns).
const COLS = [
  { name: 'region_name', dtype: 'string' },
  { name: 'amount', dtype: 'integer' },
  { name: 'rate', dtype: 'float' },
];

describe('serverAggregateSupportsMeasure (F13)', () => {
  it('count always runs server-side (no measure)', () => {
    expect(serverAggregateSupportsMeasure('count', undefined, COLS)).toBe(true);
  });

  it('sum over a numeric measure runs server-side', () => {
    expect(serverAggregateSupportsMeasure('sum', 'amount', COLS)).toBe(true);
    expect(serverAggregateSupportsMeasure('sum', 'rate', COLS)).toBe(true);
  });

  it('sum over a KNOWN non-numeric measure is skipped (would 422 → client roll-up)', () => {
    expect(serverAggregateSupportsMeasure('sum', 'region_name', COLS)).toBe(false);
  });

  it('sum over an UNKNOWN measure dtype is allowed (conservative; no regression)', () => {
    // Measure absent from resolvedColumns (e.g. a single-source query) or no
    // resolved columns at all → attempt it, exactly as before the fix.
    expect(serverAggregateSupportsMeasure('sum', 'not_here', COLS)).toBe(true);
    expect(serverAggregateSupportsMeasure('sum', 'amount', undefined)).toBe(true);
  });
});
