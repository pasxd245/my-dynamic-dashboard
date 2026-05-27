// Active-filter chip row (R40).
//
// Renders one removable `<Tag closable>` per active filter, plus a
// "Clear all" link. Hidden when `filters` is empty.
//
// Chip text reuses `formatCell` (R36) for value display so numerics
// get thousand separators, dates get locale formatting, etc.

import { Tag, Typography } from 'antd';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';

import { formatCell } from '@/lib/formatCell';
import type { Column } from '../types';
import type { FilterPredicate, FilterSet } from './types';

export type ActiveFilterChipsProps = Readonly<{
  filters: FilterSet;
  columns: readonly Column[];
  onRemove: (colIndex: number) => void;
  onClearAll: () => void;
}>;

export function formatChipText(
  p: FilterPredicate,
  columns: readonly Column[],
  locale: string,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  const col = columns[p.col];
  const name = col?.name ?? `col_${p.col}`;
  const opLabel = t(`datasets.filters.op.${p.op}`);

  if ('val' in p) {
    const formatted = formatCell(String(p.val), p.dtype, locale);
    return `${name} ${opLabel} ${formatted.text}`;
  }
  if ('min' in p) {
    const lo = formatCell(String(p.min), p.dtype, locale).text;
    const hi = formatCell(String(p.max), p.dtype, locale).text;
    return `${name} ${opLabel} ${lo} — ${hi}`;
  }
  // No-operand op
  return `${name} ${opLabel}`;
}

export function ActiveFilterChips({
  filters,
  columns,
  onRemove,
  onClearAll,
}: ActiveFilterChipsProps) {
  const { t } = useTranslation();
  const locale = i18n.language;

  if (filters.length === 0) return null;

  return (
    <div
      data-component="ActiveFilterChips"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        padding: '8px 12px',
        background: 'var(--ant-color-fill-quaternary, #fafafa)',
        border: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
        borderRadius: 6,
        marginBottom: 12,
      }}
    >
      <Typography.Text
        type="secondary"
        style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}
      >
        {t('datasets.filters.chipsLabel')}
      </Typography.Text>
      {filters.map((p) => {
        const text = formatChipText(p, columns, locale, t);
        return (
          <Tag
            key={p.col}
            color="processing"
            closable
            onClose={(e) => {
              e.preventDefault();
              onRemove(p.col);
            }}
            data-component="ActiveFilterChip"
            data-column-index={p.col}
            // inline-flex keeps the close icon as a sibling outside the
            // truncating span — overflow: hidden on the Tag would clip it.
            style={{
              margin: 0,
              maxWidth: 220,
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <span
              title={text}
              style={{
                // min-width: 0 lets the flex item shrink for text-overflow.
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {text}
            </span>
          </Tag>
        );
      })}
      <Typography.Link
        onClick={onClearAll}
        style={{ marginInlineStart: 'auto', fontSize: 12 }}
        data-component="ActiveFilterClearAll"
      >
        {t('datasets.filters.clearAll')}
      </Typography.Link>
    </div>
  );
}
