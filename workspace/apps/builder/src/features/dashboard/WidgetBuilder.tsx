// R101 F1 — the formula-free widget builder. Pick a saved Query, then choose
// dimension / measure / aggregation / chart (defaulted from the query's column
// dtypes, adjustable via dropdowns) with a LIVE preview. No formulas — every
// choice is a labelled select. This is the surface F1 exists to validate before
// the Widget contract shape freezes.

import { Alert, Col, Form, Input, Modal, Row, Segmented, Select, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isNumeric, pickWidgetDefaults } from './aggregate';
import { useQueriesQuery } from '@/features/data-management/queries/hooks';
import { useWidgetData } from './hooks';
import type { Agg, ChartType, Widget, WidgetSpan } from './types';
import { WidgetView } from './WidgetView';

type Draft = {
  queryId?: string;
  title: string;
  chartType: ChartType;
  dimensionCol?: string;
  measureCol?: string;
  agg: Agg;
  /** Width carried through the builder; arranged on the dashboard (default 1). */
  span: WidgetSpan;
};

const EMPTY: Draft = { title: '', chartType: 'bar', agg: 'sum', span: 1 };

type WidgetBuilderProps = Readonly<{
  open: boolean;
  workspaceId: string | undefined;
  /** Present → edit that widget; absent → create. */
  initial?: Widget;
  onSubmit: (widget: Omit<Widget, 'id'>) => void;
  onCancel: () => void;
}>;

export function WidgetBuilder({ open, workspaceId, initial, onSubmit, onCancel }: WidgetBuilderProps) {
  const { t } = useTranslation();
  // The query list is scoped to the DASHBOARD's workspace (a dashboard is
  // workspace-scoped, so a widget can only bind a query from that same project —
  // no per-widget workspace picker).
  const queries = useQueriesQuery(workspaceId);
  const [draft, setDraft] = useState<Draft>(EMPTY);

  // Reset the draft each time the modal opens (seed from `initial`).
  useEffect(() => {
    if (!open) return;
    setDraft(initial ? { ...initial } : EMPTY);
  }, [open, initial]);

  const data = useWidgetData(draft.queryId);
  const columns = data.columns;

  // Auto-default dimension/measure/agg/chart once the picked query's columns
  // load — unless the current dimension is already valid (edit mode / manual).
  useEffect(() => {
    if (!draft.queryId || columns.length === 0) return;
    const dimValid = draft.dimensionCol && columns.some((c) => c.name === draft.dimensionCol);
    if (dimValid) return;
    const d = pickWidgetDefaults(columns);
    setDraft((prev) => ({ ...prev, ...d }));
  }, [draft.queryId, draft.dimensionCol, columns]);

  const colOptions = useMemo(() => columns.map((c) => ({ value: c.name, label: c.name })), [columns]);
  const numericOptions = useMemo(
    () => columns.filter(isNumeric).map((c) => ({ value: c.name, label: c.name })),
    [columns],
  );
  const queryOptions = useMemo(
    () => (queries.data ?? []).map((q) => ({ value: q.id, label: q.name })),
    [queries.data],
  );

  const canSubmit =
    Boolean(draft.queryId) &&
    Boolean(draft.dimensionCol) &&
    draft.title.trim().length > 0 &&
    (draft.agg === 'count' || Boolean(draft.measureCol));

  const previewWidget: Widget | null =
    draft.queryId && draft.dimensionCol
      ? {
          id: 'preview',
          queryId: draft.queryId,
          title: draft.title.trim() || t('dashboard.builder.previewTitle'),
          chartType: draft.chartType,
          dimensionCol: draft.dimensionCol,
          measureCol: draft.agg === 'sum' ? draft.measureCol : undefined,
          agg: draft.agg,
          span: draft.span,
        }
      : null;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      queryId: draft.queryId as string,
      title: draft.title.trim(),
      chartType: draft.chartType,
      dimensionCol: draft.dimensionCol as string,
      measureCol: draft.agg === 'sum' ? draft.measureCol : undefined,
      agg: draft.agg,
      span: draft.span,
    });
  };

  return (
    <Modal
      open={open}
      title={initial ? t('dashboard.builder.editTitle') : t('dashboard.builder.addTitle')}
      width={860}
      onOk={submit}
      okButtonProps={{ disabled: !canSubmit }}
      okText={initial ? t('common.ok') : t('dashboard.builder.add')}
      onCancel={onCancel}
      destroyOnHidden
      data-component="WidgetBuilder"
    >
      <Row gutter={20}>
        <Col xs={24} md={10}>
          <Form layout="vertical">
            <Form.Item label={t('dashboard.builder.query')} required>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder={t('dashboard.builder.queryPlaceholder')}
                value={draft.queryId}
                options={queryOptions}
                loading={queries.isLoading}
                onChange={(queryId) => setDraft((p) => ({ ...p, queryId, dimensionCol: undefined }))}
                data-component="WidgetBuilderQuery"
              />
            </Form.Item>

            <Form.Item label={t('dashboard.builder.title')} required>
              <Input
                value={draft.title}
                maxLength={120}
                placeholder={t('dashboard.builder.titlePlaceholder')}
                onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
              />
            </Form.Item>

            <Form.Item label={t('dashboard.builder.dimension')} required>
              <Select
                value={draft.dimensionCol}
                options={colOptions}
                disabled={!draft.queryId}
                onChange={(dimensionCol) => setDraft((p) => ({ ...p, dimensionCol }))}
                data-component="WidgetBuilderDimension"
              />
            </Form.Item>

            <Form.Item label={t('dashboard.builder.agg')}>
              <Select<Agg>
                value={draft.agg}
                onChange={(agg) => setDraft((p) => ({ ...p, agg }))}
                options={[
                  { value: 'sum', label: t('dashboard.builder.aggSum') },
                  { value: 'count', label: t('dashboard.builder.aggCount') },
                ]}
              />
            </Form.Item>

            {draft.agg === 'sum' ? (
              <Form.Item label={t('dashboard.builder.measure')} required>
                <Select
                  value={draft.measureCol}
                  options={numericOptions}
                  disabled={!draft.queryId}
                  placeholder={t('dashboard.builder.measurePlaceholder')}
                  notFoundContent={t('dashboard.builder.noNumeric')}
                  onChange={(measureCol) => setDraft((p) => ({ ...p, measureCol }))}
                  data-component="WidgetBuilderMeasure"
                />
              </Form.Item>
            ) : null}

            <Form.Item label={t('dashboard.builder.chart')}>
              <Select<ChartType>
                value={draft.chartType}
                onChange={(chartType) => setDraft((p) => ({ ...p, chartType }))}
                options={[
                  { value: 'bar', label: t('dashboard.builder.chartBar') },
                  { value: 'pie', label: t('dashboard.builder.chartPie') },
                ]}
              />
            </Form.Item>

            <Form.Item label={t('dashboard.builder.width')} help={t('dashboard.builder.widthHelp')}>
              <Segmented<WidgetSpan>
                value={draft.span}
                onChange={(span) => setDraft((p) => ({ ...p, span }))}
                options={[
                  { label: '1', value: 1 },
                  { label: '2', value: 2 },
                  { label: '3', value: 3 },
                ]}
                data-component="WidgetBuilderWidth"
              />
            </Form.Item>
          </Form>
        </Col>

        <Col xs={24} md={14}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('dashboard.builder.preview')}
          </Typography.Text>
          <div style={{ marginTop: 8 }}>
            {previewWidget ? (
              <WidgetView widget={previewWidget} />
            ) : (
              <Alert type="info" showIcon message={t('dashboard.builder.previewHint')} />
            )}
          </div>
        </Col>
      </Row>
    </Modal>
  );
}
