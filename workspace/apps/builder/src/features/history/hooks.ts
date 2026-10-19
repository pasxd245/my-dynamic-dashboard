import { useQuery } from '@tanstack/react-query';

import { historyApi } from '@/api/historyApi';
import type { HistoryKind, HistoryList, HistoryVersion } from './types';

/** The prefix every history read is cached under; a noun's update mutation
 *  invalidates it (a save — manual or a restore — writes a row). */
export const HISTORY_QUERY_KEY = ['definition-history'] as const;

export function historyKey(kind: HistoryKind, id: string | undefined) {
  return [...HISTORY_QUERY_KEY, kind, id] as const;
}

/** R200 — a noun's history list. `enabled` lets a closed drawer skip the read. */
export function useHistoryQuery(kind: HistoryKind, id: string | undefined, enabled = true) {
  return useQuery<HistoryList>({
    queryKey: historyKey(kind, id),
    queryFn: () => historyApi.list(kind, id as string),
    enabled: Boolean(id) && enabled,
    retry: false,
  });
}

/** R200 — one past definition of the clicked row (the JSON view reads it). */
export function useHistoryVersionQuery(kind: HistoryKind, id: string, version: string | null, seq?: number) {
  return useQuery<HistoryVersion>({
    queryKey: [...historyKey(kind, id), version, seq] as const,
    queryFn: () => historyApi.version(kind, id, version as string, seq),
    enabled: Boolean(version),
    retry: false,
  });
}
