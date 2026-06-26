import { describe, expect, it } from 'vitest';

import { slugify } from './slug';

describe('slugify', () => {
  it('dash-cases a multi-word name', () => {
    expect(slugify('Weekly Report')).toBe('weekly-report');
    expect(slugify('a b c')).toBe('a-b-c');
  });

  it('strips diacritics (e.g. Vietnamese)', () => {
    expect(slugify('Báo cáo tuần')).toBe('bao-cao-tuan');
  });

  it('collapses non-alphanumeric runs and trims edge dashes', () => {
    expect(slugify('  Q3 — Sales!! ')).toBe('q3-sales');
    expect(slugify('___under_scores___')).toBe('under-scores');
  });

  it('returns empty string for punctuation-only input', () => {
    expect(slugify('!!!')).toBe('');
  });
});
