// QueryBuilderPanel (R72) — the interactive construction surface (presentational).
//
// R86 — two top-level VIEW TABS over the SAME working copy: the **Form** tab
// (the editable hop list + filters + the live preview; the keyboard/SR-complete
// equivalent and the assistive-tech default) and the **Canvas** tab (the
// read-only source-graph + a status chip; no preview table). The tab bar is an
// AntD <Tabs> (real tablist/tab a11y); each view's content renders BELOW the bar
// (the `.builder-tabs` content-holder is hidden) so the existing flex layout is
// preserved and the preview scrolls inside the card, not the whole page.
// Switching swaps the rendering only — no edit lost, no model forked (canvas.md
// J-1). State + the Save/Cancel lifecycle live in `useQueryBuilder`.

import { EyeOutlined, RightOutlined, WarningOutlined } from '@ant-design/icons';
import { XCircleIcon } from '@phosphor-icons/react';
import { Button, Input, Tabs, Tag, Typography } from 'antd';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ActiveFilterChips } from '@/features/data-management/datasets/filters/ActiveFilterChips';
import { FilterPopover } from '@/features/data-management/datasets/filters/FilterPopover';
import { AdvancedQueryInput } from '@/features/data-management/datasets/advanced-query/AdvancedQueryInput';
import { groupsToText } from '@/features/data-management/datasets/advanced-query/serialize';
import { PagedRowsView } from '../_shared/PagedRowsView';
import { JoinEditor } from './JoinEditor';
import { QueryCanvas } from './QueryCanvas';
import { StepsEditor } from './StepsEditor';
import { type QueryBuilderState } from './useQueryBuilder';

type BuilderTab = 'form' | 'canvas';

export type QueryBuilderPanelProps = Readonly<{ builder: QueryBuilderState }>;

export function QueryBuilderPanel({ builder }: QueryBuilderPanelProps) {
  const { t } = useTranslation();
  const [buildOpen, setBuildOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(true);
  // R86 — active view tab is local rendering state (the switch is lossless);
  // Form is the default and the assistive-tech equivalent.
  const [activeTab, setActiveTab] = useState<BuilderTab>('form');

  // The Canvas tab's status chip mirrors the preview gate (which runs off the
  // working copy regardless of the visible tab) and links back to the Form
  // preview — so a Canvas-tab user still sees the row count / why Save is blocked.
  const canvasStatus = canvasStatusOf(builder, t);
  const goToFormPreview = () => {
    setActiveTab('form');
    setPreviewOpen(true);
    builder.flushPreview();
  };

  return (
    <div
      data-component="QueryBuilderPanel"
      style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0 }}
    >
      {/* R86 — the [Form] [Canvas] tab bar. Content renders below (the empty
          content-holder is hidden via `.builder-tabs`), so the flex chain to the
          preview is unchanged and the switch is a cheap conditional render. */}
      <Tabs
        className="builder-tabs"
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as BuilderTab)}
        aria-label={t('queries.builder.viewToggleLabel')}
        data-component="QueryBuilderTabs"
        style={{ flex: '0 0 auto' }}
        items={[
          { key: 'form', label: t('queries.builder.tabForm') },
          { key: 'canvas', label: t('queries.builder.tabCanvas') },
        ]}
      />

      {activeTab === 'canvas' ? (
        <CanvasTab builder={builder} status={canvasStatus} onGoToForm={goToFormPreview} />
      ) : (
        <FormTab
          builder={builder}
          buildOpen={buildOpen}
          setBuildOpen={setBuildOpen}
          previewOpen={previewOpen}
          setPreviewOpen={setPreviewOpen}
        />
      )}
    </div>
  );
}

/** The Form tab — the editable hop-list builder + filters + the live preview. */
function FormTab({
  builder,
  buildOpen,
  setBuildOpen,
  previewOpen,
  setPreviewOpen,
}: Readonly<{
  builder: QueryBuilderState;
  buildOpen: boolean;
  setBuildOpen: React.Dispatch<React.SetStateAction<boolean>>;
  previewOpen: boolean;
  setPreviewOpen: React.Dispatch<React.SetStateAction<boolean>>;
}>) {
  const { t } = useTranslation();
  const { draft, columns, isJoined } = builder;
  // R125 — the Transform (steps) section state.
  const [stepsOpen, setStepsOpen] = useState(true);
  // When the query shapes (has steps), the preview rows are the SHAPED result, so
  // the table uses the post-step result columns + the per-column source filter
  // popover (a source-index filter) no longer applies.
  const shaping = (draft.steps?.length ?? 0) > 0;
  const previewColumns = shaping ? builder.resultColumns : columns;
  const activeCount = draft.filters.length + draft.advanced.flat().length + (draft.q ? 1 : 0) + builder.joins.length;

  return (
    <>
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
            baseSourceId={builder.baseSourceId}
            baseEditable={builder.isCreate}
            queryId={builder.queryId}
            onSetBaseSource={builder.setBaseSource}
            relationships={builder.queryRels}
            joins={builder.joins}
            onSetJoin={builder.setJoin}
            onAddJoin={builder.addJoin}
            onRemoveHop={builder.removeJoin}
            onSetHopType={builder.setHopType}
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
              // Empty → null so the definition omits the search (and a controlled
              // input never renders a literal "null").
              onChange={(e) => builder.setQ(e.target.value || null)}
              // Own Escape deterministically; AntD `allowClear` is dropped because
              // its Escape/clear path emits a stray "null" value on real browsers
              // (same fix as the dataset-detail row search). The only clear paths
              // are this Esc and the in-field × below.
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  builder.setQ(null);
                }
              }}
              placeholder={t('queries.builder.searchPlaceholder')}
              data-component="QueryBuilderSearch"
              suffix={
                draft.q ? (
                  <XCircleIcon
                    size={16}
                    weight="fill"
                    role="button"
                    aria-label={t('queries.builder.searchClear')}
                    data-component="QueryBuilderSearchClear"
                    className="aq-icon-btn"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => builder.setQ(null)}
                  />
                ) : (
                  <span />
                )
              }
            />
          </div>
        </div>
      ) : null}

      <TransformSection builder={builder} open={stepsOpen} setOpen={setStepsOpen} />

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
            columns={previewColumns}
            rows={builder.previewRows}
            loading={builder.previewFetching}
            total={builder.previewTotal}
            page={builder.page}
            pageSize={builder.pageSize}
            onPageChange={builder.onPageChange}
            // R96: the preview is a peek — flow (no inner scroll); the page
            // scrolls and the pager sits at the natural end.
            scrollMode="flow"
            // R125 — the per-column source filter applies to the SOURCE rows (by
            // index); once the query shapes (steps), the preview is the shaped
            // result, so the popover no longer maps — drop it (post-step filtering
            // is a `filter` step).
            renderHeaderExtra={
              shaping
                ? undefined
                : (col, colIndex) => (
                    <FilterPopover
                      column={col}
                      colIndex={colIndex}
                      existing={draft.filters.find((p) => p.col === colIndex)}
                      onApply={builder.applyFilter}
                      onClear={() => builder.removeFilter(colIndex)}
                    />
                  )
            }
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
    </>
  );
}

/** The Canvas tab — the source-graph editor + a status chip (no preview table).
 *  R87 makes it an EDITOR (pick-pair draw-edge / delete-leaf) over the one
 *  working copy; the Form tab stays the keyboard/SR-complete equivalent. */
function CanvasTab({
  builder,
  status,
  onGoToForm,
}: Readonly<{ builder: QueryBuilderState; status: CanvasStatus; onGoToForm: () => void }>) {
  // R93 (F2) — the preview chip is a uniform text+icon button, passed INTO the canvas so
  // all three top-right toolbar actions (Add › Preview › Help) sit on one line. The parent
  // still owns it (the preview gate lives here); the canvas only places it.
  const statusChip = (
    <Button
      type="text"
      size="small"
      data-component="QueryCanvasStatusChip"
      data-stale={status.stale ? 'true' : 'false'}
      aria-label={status.aria}
      icon={status.stale ? <WarningOutlined /> : <EyeOutlined />}
      onClick={onGoToForm}
      style={status.stale ? { color: 'var(--ant-color-warning, #faad14)' } : undefined}
    >
      {status.label} ↗
    </Button>
  );
  return (
    <div
      data-component="QueryBuilderCanvasTab"
      style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: '1 1 auto', minHeight: 0 }}
    >
      {/* The canvas pane owns its (viewport-relative) height; this wrapper just
          fills the tab area and scrolls if the pane exceeds it (R97 Item 1). */}
      <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'auto' }}>
        <QueryCanvas
          datasetId={builder.datasetId}
          baseSourceId={builder.baseSourceId}
          workspaceId={builder.workspaceId}
          relationships={builder.queryRels}
          joins={builder.joins}
          onAddJoin={builder.addJoin}
          onDefineJoin={builder.defineJoin}
          onRemoveJoin={builder.removeJoin}
          onPromoteRel={builder.promoteRel}
          onResyncRel={builder.resyncRel}
          promoteState={builder.promoteState}
          statusChip={statusChip}
        />
      </div>
    </div>
  );
}

/** R125 — the Transform (steps) section: the ordered-shaping editor for
 *  single-source queries, or a note that steps are single-source-only (the
 *  joined/composed column-fork is deferred). Collapsible like Build/Preview. */
function TransformSection({
  builder,
  open,
  setOpen,
}: Readonly<{ builder: QueryBuilderState; open: boolean; setOpen: React.Dispatch<React.SetStateAction<boolean>> }>) {
  const { t } = useTranslation();
  const steps = builder.draft.steps ?? [];
  return (
    <>
      <SectionBar
        open={open}
        onToggle={() => setOpen((o) => !o)}
        title={t('queries.builder.steps.section')}
        dataComponent="QueryBuilderStepsHeader"
      >
        {!open && steps.length > 0 ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('queries.builder.buildActive', { count: steps.length })}
          </Typography.Text>
        ) : null}
      </SectionBar>
      {open ? (
        <div data-component="QueryBuilderSteps" style={{ flex: '0 0 auto' }}>
          {builder.canUseSteps ? (
            <StepsEditor steps={steps} columns={builder.columns} onChange={builder.setSteps} />
          ) : (
            <Typography.Text type="secondary" style={{ fontSize: 12 }} data-component="QueryBuilderStepsJoinedNote">
              {t('queries.builder.steps.joinedNote')}
            </Typography.Text>
          )}
        </div>
      ) : null}
    </>
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

/** R86 — the Canvas-tab status chip's state, derived from the same preview gate
 *  the Form preview reads. Valid → "N rows"; blocked (stale / invalid predicate)
 *  → "Unavailable" (text + ⚠ icon, never colour alone); fetching → "Previewing…". */
type CanvasStatus = Readonly<{ label: string; stale: boolean; aria: string }>;
function canvasStatusOf(builder: QueryBuilderState, t: TFunction): CanvasStatus {
  if (builder.previewFetching) {
    const loading = t('queries.builder.previewLoading');
    return { label: loading, stale: false, aria: loading };
  }
  if (builder.relStale || builder.predStale || builder.invalidCount > 0) {
    return {
      label: t('queries.builder.canvasStatusUnavailable'),
      stale: true,
      aria: t('queries.builder.canvasStatusAriaUnavailable'),
    };
  }
  return {
    label: t('queries.builder.canvasStatusRows', { count: builder.previewTotal }),
    stale: false,
    aria: t('queries.builder.canvasStatusAria', { count: builder.previewTotal }),
  };
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
