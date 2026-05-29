// useAdvancedQueryState (R51) — URL `?aq=` ↔ DNF glue.
//
// Peer to `useFiltersState`. The URL is the source of truth; the
// in-memory groups + canonical text are derived. Apply/clear reset
// `?page=` to 1 (a changed predicate set makes the old page
// meaningless) and use `replace: true` (one history entry per
// keystroke would be noise — same policy as `?q=` and chip Apply).

import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { Column } from '../types';
import { groupsFromParam, groupsToParam, groupsToText } from './serialize';
import type { PredicateGroups } from './types';

export function useAdvancedQueryState(columns: readonly Column[]) {
  const [searchParams, setSearchParams] = useSearchParams();

  const groups: PredicateGroups = useMemo(
    () => groupsFromParam(searchParams.get('aq'), columns),
    [searchParams, columns],
  );

  // Canonical text for repopulating the input from the URL (not the
  // raw user text — the URL carries the parsed JSON).
  const text = useMemo(() => groupsToText(groups, columns), [groups, columns]);

  const applyAdvanced = (next: PredicateGroups) => {
    const params = new URLSearchParams(searchParams);
    const aq = groupsToParam(next);
    if (aq) {
      params.set('aq', aq);
    } else {
      params.delete('aq');
    }
    params.delete('page');
    setSearchParams(params, { replace: true });
  };

  const clearAdvanced = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('aq');
    params.delete('page');
    setSearchParams(params, { replace: true });
  };

  return { groups, text, applyAdvanced, clearAdvanced };
}
