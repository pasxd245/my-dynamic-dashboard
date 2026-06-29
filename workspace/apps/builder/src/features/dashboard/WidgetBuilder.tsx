// R101 F1 — the formula-free widget builder. Pick a saved Query, then choose
// dimension / measure / aggregation / chart (defaulted from the query's column
// dtypes, adjustable via dropdowns) with a LIVE preview. No formulas — every
// choice is a labelled select. This is the surface F1 exists to validate before
// the Widget contract shape freezes.

import { Alert, Col, Collapse, Form, Input, Modal, Row, Segmented, Select, theme, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isNumeric, pickWidgetDefaults } from './aggregate';
import { useQueriesQuery } from '@/features/data-management/queries/hooks';
import { useWidgetData } from './hooks';
import type { Agg, ChartType, Widget, WidgetSpan } from './types';
import { WidgetView } from './WidgetView';

export type Draft = {
  queryId?: string;
  title: string;
  chartType: ChartType;
  dimensionCol?: string;
  /** R111 — optional second grouping ("split by") for a multi-series bar. */
  seriesCol?: string;
  measureCol?: string;
  /** R112 — combo only: the second (line) measure. */
  measureCol2?: string;
  agg: Agg;
  /** Width carried through the builder; arranged on the dashboard (default 1). */
  span: WidgetSpan;
};

const EMPTY: Draft = { title: '', chartType: 'bar', agg: 'sum', span: 1 };

/** Combo (bar+line) and scatter (x/y) both carry two measures. */
function twoMeasures(draft: Pick<Draft, 'chartType'>): boolean {
  return draft.chartType === 'combo' || draft.chartType === 'scatter';
}

/** A draft → the persisted widget shape (`Omit<Widget,'id'>`): the single source
 *  for both the submit payload and the read-only JSON view. `measureCol` is
 *  dropped for `count` (meaningless there); unset fields drop out under
 *  JSON.stringify. R108. */
export function draftToConfig(draft: Draft): Omit<Widget, 'id'> {
  return {
    queryId: draft.queryId as string,
    title: draft.title.trim(),
    chartType: draft.chartType,
    // R110 — a `stat` widget omits the dimension (no grouping).
    ...(draft.chartType === 'stat' ? {} : { dimensionCol: draft.dimensionCol }),
    // R111 — `seriesCol` only on a multi-series bar; dropped otherwise.
    ...(draft.chartType === 'bar' && draft.seriesCol ? { seriesCol: draft.seriesCol } : {}),
    // measureCol: a sum's measure, combo's bar, or scatter's X. measureCol2:
    // combo's line / scatter's Y (R112/R113).
    ...(draft.agg === 'sum' || twoMeasures(draft) ? { measureCol: draft.measureCol } : {}),
    ...(twoMeasures(draft) ? { measureCol2: draft.measureCol2 } : {}),
    agg: draft.agg,
    span: draft.span,
  };
}

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
  const { token } = theme.useToken();
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

  // `stat` (KPI) and `scatter` (x/y) have no grouping dimension.
  const needsDimension = draft.chartType !== 'stat' && draft.chartType !== 'scatter';
  // Combo (bar+line) and scatter (x/y) both use two measures.
  const isTwoMeasures = twoMeasures(draft);
  const showMeasure1 = draft.agg === 'sum' || isTwoMeasures;
  const showAgg = !isTwoMeasures;

  // Measure-validity per chart kind: two-measure charts need both; a sum needs
  // its one measure; a count needs none.
  let measureOk = draft.agg === 'count' || Boolean(draft.measureCol);
  if (isTwoMeasures) measureOk = Boolean(draft.measureCol) && Boolean(draft.measureCol2);

  let measure1Label = t('dashboard.builder.measure');
  if (draft.chartType === 'scatter') measure1Label = t('dashboard.builder.measureX');
  else if (draft.chartType === 'combo') measure1Label = t('dashboard.builder.measureBar');
  const measure2Label =
    draft.chartType === 'scatter' ? t('dashboard.builder.measureY') : t('dashboard.builder.measureLine');

  const canSubmit =
    Boolean(draft.queryId) &&
    (!needsDimension || Boolean(draft.dimensionCol)) &&
    draft.title.trim().length > 0 &&
    measureOk;

  const previewReady = Boolean(draft.queryId) && (!needsDimension || Boolean(draft.dimensionCol));
  // Build the preview from the SAME draftToConfig the submit uses (so preview ==
  // saved shape), with a fallback title; the field conditionals live there.
  const previewWidget: Widget | null = previewReady
    ? { id: 'preview', ...draftToConfig({ ...draft, title: draft.title.trim() || t('dashboard.builder.previewTitle') }) }
    : null;

  // R108 — read-only transparency view: the persisted widget shape as live
  // working-copy JSON. Same `draftToConfig` the submit sends; the structured
  // form above stays the editor, this only mirrors it.
  const configJson = JSON.stringify(draftToConfig(draft), null, 2);

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(draftToConfig(draft));
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

            {needsDimension ? (
              <Form.Item label={t('dashboard.builder.dimension')} required>
                <Select
                  value={draft.dimensionCol}
                  options={colOptions}
                  disabled={!draft.queryId}
                  onChange={(dimensionCol) => setDraft((p) => ({ ...p, dimensionCol }))}
                  data-component="WidgetBuilderDimension"
                />
              </Form.Item>
            ) : null}

            {draft.chartType === 'bar' ? (
              <Form.Item label={t('dashboard.builder.series')} help={t('dashboard.builder.seriesHelp')}>
                <Select
                  allowClear
                  value={draft.seriesCol}
                  options={colOptions}
                  disabled={!draft.queryId}
                  placeholder={t('dashboard.builder.seriesPlaceholder')}
                  onChange={(seriesCol) => setDraft((p) => ({ ...p, seriesCol }))}
                  data-component="WidgetBuilderSeries"
                />
              </Form.Item>
            ) : null}

            {/* Combo + scatter define their own measures; the agg select is hidden. */}
            {showAgg ? (
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
            ) : null}

            {showMeasure1 ? (
              <Form.Item label={measure1Label} required>
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

            {isTwoMeasures ? (
              <Form.Item label={measure2Label} required>
                <Select
                  value={draft.measureCol2}
                  options={numericOptions}
                  disabled={!draft.queryId}
                  placeholder={t('dashboard.builder.measurePlaceholder')}
                  notFoundContent={t('dashboard.builder.noNumeric')}
                  onChange={(measureCol2) => setDraft((p) => ({ ...p, measureCol2 }))}
                  data-component="WidgetBuilderMeasure2"
                />
              </Form.Item>
            ) : null}

            <Form.Item label={t('dashboard.builder.chart')}>
              <Select<ChartType>
                value={draft.chartType}
                onChange={(chartType) => setDraft((p) => ({ ...p, chartType }))}
                options={[
                  { value: 'bar', label: t('dashboard.builder.chartBar') },
                  { value: 'line', label: t('dashboard.builder.chartLine') },
                  { value: 'pie', label: t('dashboard.builder.chartPie') },
                  { value: 'combo', label: t('dashboard.builder.chartCombo') },
                  { value: 'scatter', label: t('dashboard.builder.chartScatter') },
                  { value: 'stat', label: t('dashboard.builder.chartStat') },
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

          <Collapse
            ghost
            size="small"
            style={{ marginTop: 16 }}
            items={[
              {
                key: 'json',
                label: t('dashboard.builder.viewJson'),
                children: (
                  <>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {t('dashboard.builder.jsonHint')}
                    </Typography.Text>
                    <Typography.Paragraph
                      copyable={{
                        text: configJson,
                        tooltips: [t('dashboard.builder.jsonCopy'), t('dashboard.builder.jsonCopied')],
                      }}
                      style={{ marginTop: 8, marginBottom: 0 }}
                    >
                      <pre
                        data-component="WidgetConfigJson"
                        style={{
                          margin: 0,
                          padding: 12,
                          background: token.colorFillQuaternary,
                          borderRadius: token.borderRadius,
                          fontSize: 12,
                          overflowX: 'auto',
                        }}
                      >
                        {configJson}
                      </pre>
                    </Typography.Paragraph>
                  </>
                ),
              },
            ]}
          />
        </Col>
      </Row>
    </Modal>
  );
}
