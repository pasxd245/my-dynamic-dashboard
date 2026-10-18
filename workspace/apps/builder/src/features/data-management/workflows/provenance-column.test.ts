import { describe, expect, it } from 'vitest';

import { withProvenanceColumn } from './hooks';

// R191 — the steps editor offers the column a multi-source run appends
// (`Source.Query`, R186 W-3), named by the backend's collision rule.
describe('withProvenanceColumn', () => {
  const cols = [
    { name: 'agent', dtype: 'string' as const },
    { name: 'calls', dtype: 'integer' as const },
  ];

  it('adds nothing for one source', () => {
    expect(withProvenanceColumn(cols, 1)).toEqual(cols);
  });

  it('appends Source.Query (string) for two or more sources', () => {
    expect(withProvenanceColumn(cols, 2).at(-1)).toEqual({ name: 'Source.Query', dtype: 'string' });
  });

  it('suffixes off a collision like the backend (Source.Query1, Source.Query2…)', () => {
    const taken = [
      ...cols,
      { name: 'Source.Query', dtype: 'string' as const },
      { name: 'Source.Query1', dtype: 'string' as const },
    ];
    expect(withProvenanceColumn(taken, 3).at(-1)?.name).toBe('Source.Query2');
  });
});

describe('withProvenanceColumn — R191 QA edges', () => {
  it('takes the bare name when only a suffixed one is taken (backend: first free of Source.Query, 1, 2…)', () => {
    const cols = [{ name: 'Source.Query1', dtype: 'string' as const }];
    expect(withProvenanceColumn(cols, 2).at(-1)?.name).toBe('Source.Query');
  });

  it('does not mutate the input and adds nothing for zero sources', () => {
    const cols = [{ name: 'Source.Query', dtype: 'string' as const }];
    expect(withProvenanceColumn(cols, 0)).toEqual(cols);
    withProvenanceColumn(cols, 2);
    expect(cols).toHaveLength(1);
  });
});
