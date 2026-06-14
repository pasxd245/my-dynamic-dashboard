// QueryBuilderPanel (R72) — the interactive construction surface (presentational).
//
// Two COLLAPSIBLE sections, both open by default: **Build** (join editor +
// active-filter chips + advanced query + row search) and **Preview** (the live
// rows the unsaved definition produces). Both stay visible so the preview is
// live as you edit; on a short screen, collapse Build to give the preview the
// full height (or collapse Preview to focus on building). The preview is a
// bounded SAMPLE — paged (the pagination bar is the "load more"), never all rows.
//
// Per-column filters live in the preview table HEADERS (the dataset-detail
// pattern, via <PagedRowsView renderHeaderExtra>) so the Build section stays
// compact even for wide joined results. State + the Save/Cancel lifecycle live
// in `useQueryBuilder` (the PAGE HEADER drives Save/Cancel). No new model/engine.

import { RightOutlined } from '@ant-design/icons';
import { Button, Input, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ActiveFilterChips } from '@/features/data-management/datasets/filters/ActiveFilterChips';
import { FilterPopover } from '@/features/data-management/datasets/filters/FilterPopover';
import { AdvancedQueryInput } from '@/features/data-management/datasets/advanced-query/AdvancedQueryInput';
import { groupsToText } from '@/features/data-management/datasets/advanced-query/serialize';
import { PagedRowsView } from '../_shared/PagedRowsView';
import { JoinEditor } from './JoinEditor';
import { type QueryBuilderState } from './useQueryBuilder';

export type QueryBuilderPanelProps = Readonly<{ builder: QueryBuilderState }>;

export function QueryBuilderPanel({ builder }: QueryBuilderPanelProps) {
  const { t } = useTranslation();
  const { draft, columns, isJoined } = builder;
  const [buildOpen, setBuildOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(true);

  const activeCount =
    draft.filters.length + draft.advanced.flat().length + (draft.q ? 1 : 0) + builder.joins.length;

  return (
    <div
      data-component="QueryBuilderPanel"
      style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0 }}
    >
      {/* ── Build section ─────────────────────────────────────────────── */}
      <SectionBar
        open={buildOpen}
        onToggle={() => setBuildOpen((o) => !o)}
        title={t('queries.builder.sectionBuild')}
        dataComponent="QueryBuilderBuildHeader"
      >
        {!buildOpen && activeCount > 0 ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('queries.builder.buildActive', { count: activeCount })}
          </Typography.Text>
        ) : null}
      </SectionBar>
      {buildOpen ? (
        <div
          data-component="QueryBuilderControls"
          style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          <JoinEditor
            datasetId={builder.datasetId}
            workspaceId={builder.workspaceId}
            joins={builder.joins}
            onSetJoin={builder.setJoin}
            onAddJoin={builder.addJoin}
            onRemoveLast={builder.removeLastJoin}
          />
          {isJoined ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('queries.builder.combinedColumns')}
            </Typography.Text>
          ) : null}
          <ActiveFilterChips
            filters={draft.filters}
            columns={columns}
            onRemove={builder.removeFilter}
            onClearAll={builder.clearAllFilters}
          />
          {columns.length > 0 ? (
            <AdvancedQueryInput
              columns={columns}
              value={groupsToText(draft.advanced, columns)}
              onApply={builder.setAdvanced}
              onClear={() => builder.setAdvanced([])}
            />
          ) : null}
          <div>
            <Typography.Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              {t('queries.builder.searchLabel')}
            </Typography.Text>
            <Input
              value={draft.q ?? ''}
              onChange={(e) => builder.setQ(e.target.value || null)}
              placeholder={t('queries.builder.searchPlaceholder')}
              allowClear
              data-component="QueryBuilderSearch"
            />
          </div>
        </div>
      ) : null}

      {/* Blocked states — flag-don't-crash; they disable Save in the header. */}
      {builder.relStale ? (
        <div role="alert" data-component="QueryBuilderJoinStale" style={alertStyle()}>
          {t('queries.builder.joinStale')}
        </div>
      ) : null}
      {builder.predStale || builder.invalidCount > 0 ? (
        <div role="alert" data-component="QueryBuilderPredInvalid" style={alertStyle()}>
          {t('queries.builder.predInvalid', { count: Math.max(builder.invalidCount, 1) })}
        </div>
      ) : null}

      {/* ── Preview section ───────────────────────────────────────────── */}
      <SectionBar
        open={previewOpen}
        onToggle={() => setPreviewOpen((o) => !o)}
        title={t('queries.builder.sectionPreview')}
        dataComponent="QueryBuilderPreviewHeader"
      >
        <Typography.Text
          type="secondary"
          style={{ fontSize: 12 }}
          role="status"
          data-component="QueryBuilderPreviewStatus"
        >
          {builder.previewFetching
            ? t('queries.builder.previewLoading')
            : t('queries.builder.previewCount', { count: builder.previewTotal })}
        </Typography.Text>
        {builder.dirty ? <Tag color="warning">{t('queries.builder.unsaved')}</Tag> : null}
        <Button
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            if (!previewOpen) setPreviewOpen(true);
            builder.flushPreview();
          }}
          loading={builder.previewFetching}
          data-component="QueryBuilderPreviewButton"
        >
          {t('queries.builder.preview')}
        </Button>
      </SectionBar>
      {previewOpen ? (
        <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <PagedRowsView
            columns={columns}
            rows={builder.previewRows}
            loading={builder.previewFetching}
            total={builder.previewTotal}
            page={builder.page}
            pageSize={builder.pageSize}
            onPageChange={builder.onPageChange}
            renderHeaderExtra={(col, colIndex) => (
              <FilterPopover
                column={col}
                colIndex={colIndex}
                existing={draft.filters.find((p) => p.col === colIndex)}
                onApply={builder.applyFilter}
                onClear={() => builder.removeFilter(colIndex)}
              />
            )}
            emptyState={
              <>
                <Typography.Title level={5} style={{ marginTop: 0 }}>
                  {t('queries.builder.previewEmptyTitle')}
                </Typography.Title>
                <Typography.Text type="secondary">{t('queries.builder.previewEmptyHint')}</Typography.Text>
              </>
            }
          />
        </div>
      ) : null}
    </div>
  );
}

/** A collapsible section bar: a chevron+title toggle on the left, free-form
 *  aside content (counts / actions) on the right. The toggle is its own button
 *  so interactive aside content (e.g. the refresh button) isn't nested in it. */
function SectionBar({
  open,
  onToggle,
  title,
  dataComponent,
  children,
}: Readonly<{
  open: boolean;
  onToggle: () => void;
  title: string;
  dataComponent: string;
  children?: React.ReactNode;
}>) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flex: '0 0 auto',
        borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
        paddingBottom: 6,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        data-component={dataComponent}
        style={{
          appearance: 'none',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--ant-color-text, #000)',
        }}
      >
        <RightOutlined rotate={open ? 90 : 0} style={{ fontSize: 11, transition: 'transform .2s' }} />
        {title}
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginInlineStart: 'auto' }}>{children}</div>
    </div>
  );
}

function alertStyle(): React.CSSProperties {
  return {
    padding: '8px 12px',
    background: 'var(--ant-color-error-bg, #fff2f0)',
    border: '1px solid var(--ant-color-error-border, #ffccc7)',
    borderRadius: 6,
    color: 'var(--ant-color-error, #ff4d4f)',
    fontSize: 13,
    flex: '0 0 auto',
  };
}
