// URL ↔ FilterSet state hook (R40).
//
// The URL is the source of truth; the hook is just glue.
// Filter changes reset `?page=` to 1 (same trigger as `?q=` change
// and `page_size` change — matches R37 design § URL state).

import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { Column } from '../types';
import {
  parseFiltersFromSearchParams,
  serializeFiltersToSearchParams,
} from './serialize';
import type { FilterPredicate, FilterSet } from './types';

export function useFiltersState(columns: readonly Column[]) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Re-parse on every render — cheap (≤ 12 columns, one regex per key).
  // The memo guards downstream `useMemo` keys + the TanStack cache key
  // from spurious change on identity-only URL updates.
  const filters: FilterSet = useMemo(
    () => parseFiltersFromSearchParams(searchParams, columns),
    [searchParams, columns],
  );

  const applyFilter = (predicate: FilterPredicate) => {
    const next = new URLSearchParams(searchParams);
    const withoutTarget = filters.filter((p) => p.col !== predicate.col);
    serializeFiltersToSearchParams(next, [...withoutTarget, predicate]);
    next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const removeFilter = (colIndex: number) => {
    const next = new URLSearchParams(searchParams);
    const without = filters.filter((p) => p.col !== colIndex);
    serializeFiltersToSearchParams(next, without);
    next.delete('page');
    // History entry — chip × is a deliberate action; back re-applies.
    setSearchParams(next);
  };

  const clearAll = () => {
    const next = new URLSearchParams(searchParams);
    serializeFiltersToSearchParams(next, []);
    next.delete('page');
    setSearchParams(next, { replace: true });
  };

  return { filters, applyFilter, removeFilter, clearAll };
}
