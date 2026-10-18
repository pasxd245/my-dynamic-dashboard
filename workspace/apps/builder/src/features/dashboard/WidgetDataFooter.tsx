// R197 (item 3.8) — under a widget: which data it shows. "Data: refreshed
// <when> · run #N" from the read's `dataVersions` (R196): the latest
// `refreshedAt` of the datasets read and, for a published dataset, its run
// number. Reads the datasets through the same cache as the dataset page.

import { useQueries } from '@tanstack/react-query';
import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';

import { datasetsApi } from '@/api/datasetsApi';
import type { Dataset } from '@/features/data-management/datasets/types';

function when(iso: string, lang: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' });
}

/** The footer text for these datasets, or null when there is nothing to say. */
export function dataFooterParts(datasets: readonly Dataset[]): { refreshedAt: string; run?: number } | null {
  if (datasets.length === 0) return null;
  const refreshedAt = datasets
    .map((d) => d.refreshedAt ?? d.createdAt)
    .sort()
    .at(-1) as string;
  const runs = datasets.map((d) => d.lineage?.runNumber).filter((n): n is number => typeof n === 'number');
  return { refreshedAt, ...(runs.length > 0 ? { run: Math.max(...runs) } : {}) };
}

export function WidgetDataFooter({ versions }: Readonly<{ versions?: Readonly<Record<string, number>> }>) {
  const { t, i18n } = useTranslation();
  const ids = Object.keys(versions ?? {}).sort();
  const results = useQueries({
    queries: ids.map((id) => ({
      // The dataset page's key (`useDatasetQuery`), so one fetch serves both.
      queryKey: ['datasets', { id }] as const,
      queryFn: () => datasetsApi.get(id),
      staleTime: 60_000,
      retry: false,
    })),
  });
  // Only a dataset at the version the widget READ speaks for its numbers: a
  // newer one in the cache (refreshed since) would claim a later refresh (R197 P2).
  const parts = dataFooterParts(
    results.map((r) => r.data).filter((d): d is Dataset => d !== undefined && d.dataVersion === versions?.[d.id]),
  );
  if (!parts) return null;
  const text =
    t('dashboard.dataFooter', { when: when(parts.refreshedAt, i18n.language) }) +
    (parts.run !== undefined ? ` · ${t('dashboard.dataFooterRun', { n: parts.run })}` : '');
  return (
    <Typography.Text
      type="secondary"
      style={{ fontSize: 11, display: 'block', marginTop: 6 }}
      data-component="WidgetDataFooter"
    >
      {text}
    </Typography.Text>
  );
}
