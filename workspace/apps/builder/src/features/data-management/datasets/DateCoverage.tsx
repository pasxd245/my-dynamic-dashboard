// R178 — date coverage: what period each `date` / `datetime` column of a
// dataset covers (earliest, latest, share of blank rows), profiled by the
// server at commit and at every refresh and carried on `Column.coverage`.
// Read-only. Rendered as a strip under the dataset's metadata, and as a
// secondary line per column in the Properties drawer — the same formatting,
// one helper.

import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';

import type { Column, ColumnCoverage } from './types';

/** `2026-03-01 → 2026-05-14 · 25% blank`; an all-blank column reads `all blank`.
 *  A `datetime` value drops its seconds (`2026-02-28 14:02`). */
export function formatCoverage(
  cov: ColumnCoverage,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const blank = Math.round(cov.blankShare * 100);
  if (cov.min === undefined || cov.max === undefined) return t('datasets.detail.coverage.allBlank');
  const range = t('datasets.detail.coverage.range', { min: shortIso(cov.min), max: shortIso(cov.max) });
  return blank === 0 ? range : `${range} · ${t('datasets.detail.coverage.blank', { share: blank })}`;
}

function shortIso(v: string): string {
  // `YYYY-MM-DDTHH:MM:SS` → `YYYY-MM-DD HH:MM`; a plain date is returned as is.
  return v.length > 16 && v[10] === 'T' ? `${v.slice(0, 10)} ${v.slice(11, 16)}` : v;
}

export function temporalColumns(columns: readonly Column[]): readonly (Column & { coverage: ColumnCoverage })[] {
  return columns.filter((c): c is Column & { coverage: ColumnCoverage } => c.coverage !== undefined);
}

/** The strip: one line per profiled column. Renders nothing when no column
 *  carries coverage (a dataset committed before R178, until its next refresh). */
export function DateCoverageStrip({ columns }: Readonly<{ columns: readonly Column[] }>) {
  const { t } = useTranslation();
  const cols = temporalColumns(columns);
  if (cols.length === 0) return null;
  return (
    <div
      data-component="DatasetDateCoverage"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        gap: '4px 16px',
        padding: '8px 16px',
        border: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
        borderRadius: 6,
        marginBottom: 16,
      }}
    >
      <Typography.Text
        type="secondary"
        style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}
      >
        {t('datasets.detail.coverage.title')}
      </Typography.Text>
      {cols.map((c) => (
        <span key={c.name} data-component="DatasetDateCoverageItem" data-column={c.name} style={{ fontSize: 12 }}>
          <Typography.Text strong>{c.name}</Typography.Text>
          <Typography.Text type="secondary"> {formatCoverage(c.coverage, t)}</Typography.Text>
        </span>
      ))}
    </div>
  );
}
