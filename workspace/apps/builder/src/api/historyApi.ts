// R200 (item 4.4) — the definition history is READ here. Nothing writes through
// it: a restore is the noun's own PUT (queriesApi / dashboardsApi / workflowsApi).

import { appConfig } from '../config';
import { ApiErrorThrown, isApiError } from '@/features/data-management/_shared/types';
import type { HistoryKind, HistoryList, HistoryVersion } from '@/features/history/types';

const API_BASE_URL = appConfig.apiBaseUrl();

export const HISTORY_ROUTE: Record<HistoryKind, string> = {
  query: 'queries',
  dashboard: 'dashboards',
  workflow: 'workflows',
};

async function read<T>(url: string): Promise<T> {
  const resp = await fetch(url);
  if (!resp.ok) {
    const body: unknown = await resp.json().catch(() => null);
    if (isApiError(body)) throw new ApiErrorThrown(resp.status, body);
    throw new Error(`history: ${resp.status}`);
  }
  return (await resp.json()) as T;
}

export const historyApi = {
  /** GET /{kinds}/{id}/history — every saved definition, newest first. 404. */
  list(kind: HistoryKind, id: string): Promise<HistoryList> {
    return read<HistoryList>(`${API_BASE_URL}/${HISTORY_ROUTE[kind]}/${id}/history`);
  },
  /** GET /{kinds}/{id}/history/{version}[?seq=] — one past definition, read-only.
   *  `seq` names the clicked row (a version can occur more than once), so its
   *  own time — and a query's `sourceChangedSince` — are answered. 404. */
  version(kind: HistoryKind, id: string, version: string, seq?: number): Promise<HistoryVersion> {
    const qs = seq === undefined ? '' : `?seq=${seq}`;
    return read<HistoryVersion>(`${API_BASE_URL}/${HISTORY_ROUTE[kind]}/${id}/history/${version}${qs}`);
  },
};
