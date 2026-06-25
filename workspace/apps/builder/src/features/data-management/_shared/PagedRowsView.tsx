// PagedRowsView (R69) — the shared paged-rows body.
//
// Extracted from DatasetDetailPage's inline `DataTableBody` when a SECOND
// consumer arrived (the query-mode detail page — saved-query.md). Per the
// build-first boundary rule, this is the named two-consumer extraction
// declared in dataset-detail.md § Surfaces.
//
// Home note (build-time correction of the design's "@mdd/ui" guess): this
// primitive depends on the builder-domain `@/lib/formatCell` + the dataset
// `Column`/`Dtype` types, so it lives in `data-management/_shared/` (the
// lowest common ancestor of its two consumers — datasets/ and queries/)
// rather than @mdd/ui, which is dependency-free. Recorded in Round_69 Do.
//
// It owns: the loading skeleton, the scroll-container table (sticky header,
// dtype-aware cells), and the pagination bar. It is URL-agnostic — the parent
// owns page/q/filter state and supplies `onPageChange`, an optional per-column
// header extra (e.g. the dataset's FilterPopover), and the `emptyState` to
// render when `total === 0` (so each consumer keeps its own empty copy +
// recovery affordances).

import { Pagination, Skeleton, Tag, Typography } from 'antd';
import i18n from 'i18next';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { PAGE_SIZES } from '@/_generated/constants';
import { formatCell } from '@/lib/formatCell';
import type { Column } from '@/features/data-management/datasets/types';

// R72: the options come from the centralized PAGE_SIZES (values.yaml →
// generated constants), so adding a size is a one-line change there.
const DEFAULT_PAGE_SIZES = PAGE_SIZES.map(String);

function DtypeBadge({ dtype }: { dtype: Column['dtype'] }) {
  const { t } = useTranslation();
  return (
    <Tag
      style={{ marginInlineStart: 6, fontSize: 10, padding: '0 6px', lineHeight: '16px' }}
      data-component="DtypeBadge"
      data-dtype={dtype}
    >
      {t(`datasets.detail.dtype.${dtype}`)}
    </Tag>
  );
}

export type PagedRowsViewProps = Readonly<{
  columns: readonly Column[];
  /** Current page of rows (row-major, stringified cells). `undefined` while
   *  the first page is still loading. */
  rows: readonly (readonly (string | null)[])[] | undefined;
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
  pageSizeOptions?: readonly string[];
  /** Per-column header decoration (e.g. the dataset's FilterPopover).
   *  Omitted → a read-only header (the query-mode view). */
  renderHeaderExtra?: (col: Column, colIndex: number) => ReactNode;
  /** Rendered when `total === 0`. The parent supplies the message + any
   *  recovery affordances (clear-search / clear-filters / re-save). */
  emptyState?: ReactNode;
  /**
   * R96 — how the rows scroll:
   * - `"contained"` (default) — the table body owns an inner `overflow:auto`
   *   scroll (`flex:1 1 auto`), so the sticky `<th>` and the bottom pager stay
   *   pinned. For **view tables** inside a `PageContainer fill="bounded"` card.
   * - `"flow"` — the table flows at natural height (no inner scroll); the page
   *   scrolls and the pager sits at the natural end. For the **builder
   *   preview** (a quick peek — "scroll to the end").
   */
  scrollMode?: 'contained' | 'flow';
}>;

export function PagedRowsView({
  columns,
  rows,
  loading,
  total,
  page,
  pageSize,
  onPageChange,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  renderHeaderExtra,
  emptyState,
  scrollMode = 'contained',
}: PagedRowsViewProps) {
  const contained = scrollMode === 'contained';
  const locale = i18n.language;

  // First paint of a page (no rows yet) → skeleton.
  if (loading && !rows) {
    return (
      <div style={{ flex: '1 1 auto', minHeight: 0 }} data-component="PagedRowsLoading">
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    );
  }

  if (total === 0) {
    return (
      <div
        data-component="PagedRowsEmpty"
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          textAlign: 'center',
        }}
      >
        {emptyState ?? (
          <Typography.Text type="secondary" data-component="PagedRowsEmptyDefault">
            —
          </Typography.Text>
        )}
      </div>
    );
  }

  return (
    <>
      <div
        data-component="PagedRowsTable"
        data-scroll-mode={scrollMode}
        style={{
          // "contained": own inner scroll (sticky header + pinned pager pin
          // against this box). "flow": natural height — the page scrolls.
          ...(contained ? { flex: '1 1 auto', minHeight: 0, overflow: 'auto' } : {}),
          border: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
          borderRadius: 6,
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
          <thead>
            <tr>
              {columns.map((col, ci) => (
                <th
                  key={col.name}
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    // Solid #fafafa, not var(--ant-color-fill-quaternary) —
                    // AntD's fill-* tokens are rgba(0,0,0,0.02) and would let
                    // scrolled rows show through the sticky header.
                    background: '#fafafa',
                    boxShadow: 'inset 0 -1px 0 var(--ant-color-border-secondary, #f0f0f0)',
                    whiteSpace: 'nowrap',
                    color: 'var(--ant-color-text-secondary, #595959)',
                    fontWeight: 600,
                    position: 'sticky',
                    top: 0,
                    zIndex: 2,
                  }}
                  data-component="PagedRowsHeaderCell"
                  data-column={col.name}
                >
                  {col.name}
                  <DtypeBadge dtype={col.dtype} />
                  {renderHeaderExtra?.(col, ci)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((row, ri) => (
              <tr key={ri} data-component="PagedRowsBodyRow" className="dataset-rows-body-row">
                {columns.map((col, ci) => {
                  const cell = formatCell(row[ci] ?? null, col.dtype, locale);
                  return (
                    <td
                      key={col.name}
                      style={{
                        padding: '8px 12px',
                        borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
                        maxWidth: 240,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        textAlign: cell.isNumeric ? 'right' : 'left',
                        color: cell.isNull ? 'var(--ant-color-text-tertiary, #8c8c8c)' : undefined,
                        fontVariantNumeric: cell.isNumeric ? 'tabular-nums' : undefined,
                      }}
                      title={cell.isNull ? undefined : cell.text}
                      data-component="PagedRowsBodyCell"
                      data-null={cell.isNull || undefined}
                    >
                      {cell.isNull ? '—' : cell.text}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        style={{
          flex: '0 0 auto',
          marginTop: 16,
          paddingTop: 16,
          borderTop: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
        }}
        className="dataset-rows-pagination-bar"
        data-component="PagedRowsPagination"
      >
        <Pagination
          current={page}
          pageSize={pageSize}
          total={total}
          pageSizeOptions={[...pageSizeOptions]}
          showSizeChanger
          showQuickJumper
          onChange={onPageChange}
        />
      </div>
    </>
  );
}
