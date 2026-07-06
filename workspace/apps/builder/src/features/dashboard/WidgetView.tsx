// R101 — generic, config-driven widget renderer. Replaces R100's two hardcoded
// widgets: given a `Widget` (queryId + dimension/measure/agg/chart), it runs the
// query live, rolls the rows up client-side, and draws a bar or pie inside a
// `ChartCard` (which owns loading/error/empty). Same compute→present split as
// R100; the config now comes from the builder instead of hardcoded props.

import { WarningOutlined } from '@ant-design/icons';
import { Spin, Table, Tooltip as AntTooltip, Statistic, theme } from 'antd';
import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';

import { DASHBOARD_MAX_ROWS } from '@/_generated/constants';
import {
  aggregateByGroupSeries,
  aggregateMatrix,
  aggregateScalar,
  applyFilters,
  BLANK_LABEL,
  findColIndex,
  labelOf,
  sortByDimension,
  sortDesc,
  sumTwoMeasures,
  toNum,
  toScatterPoints,
  type ComboDatum,
  type DashboardFilter,
  type Datum,
  type ScatterPoint,
  type WideDatum,
} from './aggregate';

const HeatmapView = lazy(() => import('./HeatmapView'));
const GaugeView = lazy(() => import('./GaugeView'));
import { ChartCard } from './ChartCard';
import { useQueryQuery } from '@/features/data-management/queries/hooks';
import { useChartPalette, useWidgetAggregate, useWidgetData } from './hooks';
import type { AggregateMeasure, AggregateRequest } from '@/features/data-management/queries/types';
import type { Agg, Widget } from './types';

const numberFmt = new Intl.NumberFormat();
const compactFmt = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

// R151/F13 — the dtypes the server `sum` aggregate accepts as a measure; a
// non-numeric measure 422s (`measure_not_numeric`), so the widget takes the
// client roll-up path instead of firing a doomed request.
const NUMERIC_MEASURE_DTYPES = new Set(['integer', 'float']);

/** R151/F13 — can the SERVER aggregate run for this measure? `count` always
 *  can; `sum` needs a numeric measure — a non-numeric one 422s
 *  (`measure_not_numeric`) and the widget silently falls back to the client
 *  roll-up, leaving a doomed 422 in the console. Pre-checking the measure dtype
 *  (from the bound query's resolved columns) lets the widget skip that request.
 *  Conservative: an UNKNOWN dtype (measure absent from `resolvedColumns` — e.g.
 *  a single-source query that resolves columns from its dataset) returns `true`,
 *  preserving the prior attempt-it behaviour, so this only removes
 *  provably-doomed requests. */
export function serverAggregateSupportsMeasure(
  agg: Agg,
  measureCol: string | undefined,
  resolvedColumns: readonly { name: string; dtype: string }[] | undefined,
): boolean {
  if (agg === 'count') return true;
  const dtype = measureCol ? resolvedColumns?.find((c) => c.name === measureCol)?.dtype : undefined;
  return dtype === undefined || NUMERIC_MEASURE_DTYPES.has(dtype);
}

/** role="img" + label so a screen reader announces the chart (not colour-only). */
function ChartFigure({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div role="img" aria-label={label} style={{ width: '100%', height: '100%' }}>
      {children}
    </div>
  );
}

function BarView({ data, valueName, palette }: Readonly<{ data: Datum[]; valueName: string; palette: string[] }>) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }} accessibilityLayer>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          interval={0}
          angle={-30}
          textAnchor="end"
          height={68}
          tickMargin={6}
          tick={{ fontSize: 11 }}
        />
        <YAxis
          width={52}
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => compactFmt.format(v)}
          label={{
            value: valueName,
            angle: -90,
            position: 'insideLeft',
            style: { fontSize: 12, textAnchor: 'middle' },
          }}
        />
        <Tooltip formatter={(v) => numberFmt.format(Number(v))} />
        <Legend />
        <Bar dataKey="value" name={valueName} fill={palette[0]} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function MultiBarView({
  data,
  seriesKeys,
  palette,
}: Readonly<{ data: WideDatum[]; seriesKeys: string[]; palette: string[] }>) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }} accessibilityLayer>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          interval={0}
          angle={-30}
          textAnchor="end"
          height={68}
          tickMargin={6}
          tick={{ fontSize: 11 }}
        />
        <YAxis width={52} tick={{ fontSize: 11 }} tickFormatter={(v: number) => compactFmt.format(v)} />
        <Tooltip formatter={(v) => numberFmt.format(Number(v))} />
        <Legend />
        {seriesKeys.map((k, i) => (
          <Bar key={k} dataKey={k} name={k} fill={palette[i % palette.length]} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function ScatterView({
  data,
  xName,
  yName,
  palette,
}: Readonly<{ data: ScatterPoint[]; xName: string; yName: string; palette: string[] }>) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 8, right: 16, bottom: 16, left: 8 }} accessibilityLayer>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          type="number"
          dataKey="x"
          name={xName}
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => compactFmt.format(v)}
        />
        <YAxis
          type="number"
          dataKey="y"
          name={yName}
          width={52}
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => compactFmt.format(v)}
        />
        <ZAxis range={[40, 40]} />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v) => numberFmt.format(Number(v))} />
        <Scatter data={data} fill={palette[0]} isAnimationActive={false} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function ComboView({
  data,
  name1,
  name2,
  palette,
}: Readonly<{ data: ComboDatum[]; name1: string; name2: string; palette: string[] }>) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }} accessibilityLayer>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          interval={0}
          angle={-30}
          textAnchor="end"
          height={68}
          tickMargin={6}
          tick={{ fontSize: 11 }}
        />
        <YAxis yAxisId="left" width={52} tick={{ fontSize: 11 }} tickFormatter={(v: number) => compactFmt.format(v)} />
        <YAxis
          yAxisId="right"
          orientation="right"
          width={52}
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => compactFmt.format(v)}
        />
        <Tooltip formatter={(v) => numberFmt.format(Number(v))} />
        <Legend />
        <Bar yAxisId="left" dataKey="v1" name={name1} fill={palette[0]} radius={[4, 4, 0, 0]} />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="v2"
          name={name2}
          stroke={palette[1] ?? palette[0]}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function LineView({ data, valueName, palette }: Readonly<{ data: Datum[]; valueName: string; palette: string[] }>) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }} accessibilityLayer>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          interval="preserveStartEnd"
          angle={-30}
          textAnchor="end"
          height={68}
          tickMargin={6}
          tick={{ fontSize: 11 }}
        />
        <YAxis
          width={52}
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => compactFmt.format(v)}
          label={{
            value: valueName,
            angle: -90,
            position: 'insideLeft',
            style: { fontSize: 12, textAnchor: 'middle' },
          }}
        />
        <Tooltip formatter={(v) => numberFmt.format(Number(v))} />
        <Legend />
        <Line
          type="monotone"
          dataKey="value"
          name={valueName}
          stroke={palette[0]}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function StatView({ value, label, fmt }: Readonly<{ value: number; label: string; fmt: Intl.NumberFormat }>) {
  return (
    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
      <Statistic title={label} value={value} formatter={(v) => fmt.format(Number(v))} />
    </div>
  );
}

function TableView({
  columns,
  rows,
}: Readonly<{ columns: readonly { name: string }[]; rows: readonly (readonly (string | null)[])[] }>) {
  const cols = columns.map((c, i) => ({ title: c.name, dataIndex: String(i), key: String(i), ellipsis: true }));
  const dataSource = rows.map((r, ri) => {
    const o: Record<string, string> = { key: String(ri) };
    r.forEach((cell, ci) => {
      o[String(ci)] = cell ?? '';
    });
    return o;
  });
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>
      <Table
        size="small"
        columns={cols}
        dataSource={dataSource}
        pagination={{ pageSize: 8, size: 'small' }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  );
}

function PieView({ data, palette }: Readonly<{ data: Datum[]; palette: string[] }>) {
  const colored = data.map((d, i) => ({ ...d, fill: palette[i % palette.length] }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart accessibilityLayer>
        <Pie
          data={colored}
          dataKey="value"
          nameKey="label"
          innerRadius={48}
          outerRadius={88}
          paddingAngle={1}
          label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
          isAnimationActive={false}
        />
        <Tooltip formatter={(v, name) => [numberFmt.format(Number(v)), String(name)]} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Translate the active R103 dashboard filters to the aggregate wire shape:
 *  the `(blank)` label maps to a `null` value (a NULL/empty cell). */
function toWireFilters(filters: readonly DashboardFilter[]): AggregateRequest['filters'] {
  return filters.map((f) => ({
    column: f.column,
    values: f.values.map((v) => (v === BLANK_LABEL ? null : v)),
  }));
}

/** Roll a widget's data up to chart data per its config. Exported for the
 *  builder's live preview (same path as the rendered widget).
 *
 *  R119 — fetch mode is per chart kind. The AGGREGATING kinds (bar without a
 *  series / pie / line / stat) bind to the SERVER aggregate (`GROUP BY` in
 *  DuckDB over the whole result — correct totals, no row cap), pushing the
 *  active dashboard filters server-side. The rest (multi-series bar, combo,
 *  scatter, heatmap, table, gauge) keep the client roll-up over raw rows. */
export function useWidgetChartData(
  widget: Pick<Widget, 'queryId' | 'chartType' | 'dimensionCol' | 'seriesCol' | 'measureCol' | 'measureCol2' | 'agg'>,
  filters: readonly DashboardFilter[] = [],
) {
  // R119 — which kinds aggregate server-side, and whether the spec can run.
  const isScalar = widget.chartType === 'stat';
  const usesAggregate =
    isScalar ||
    widget.chartType === 'pie' ||
    widget.chartType === 'line' ||
    (widget.chartType === 'bar' && !widget.seriesCol);
  const specValid =
    (widget.agg === 'count' || Boolean(widget.measureCol)) && (isScalar || Boolean(widget.dimensionCol));
  // R127 — a PRE-SHAPED query (one that already aggregates via transform steps)
  // must NOT be re-aggregated: the widget renders its (already-shaped) rows
  // directly. Detected from the bound query's definition (cheap, cached `get`).
  const boundQuery = useQueryQuery(widget.queryId);
  const preShaped = (boundQuery.data?.definition.steps?.length ?? 0) > 0;
  // R151/F13 — the server `sum` aggregate 422s (`measure_not_numeric`) when the
  // measure column ingested as a string (the F1/F2 CRM reality). The widget then
  // silently fell back to the client roll-up and rendered — but the doomed
  // request left a silent 422 in the console. Pre-check the measure dtype from
  // the bound query's resolved columns: when we KNOW it's non-numeric, skip the
  // server aggregate and take the raw-rows client path directly (same rendered
  // result, no 422). Unknown dtype (measure not in resolvedColumns) → keep the
  // prior behaviour (attempt it), so this only removes provably-doomed requests.
  const measureNumericOk = serverAggregateSupportsMeasure(
    widget.agg,
    widget.measureCol,
    boundQuery.data?.resolvedColumns,
  );
  const aggregateEnabled = usesAggregate && specValid && !preShaped && measureNumericOk;
  const directShaped = usesAggregate && specValid && preShaped;

  const measures: AggregateMeasure[] =
    widget.agg === 'count' ? [{ agg: 'count' }] : [{ col: widget.measureCol, agg: 'sum' }];
  const aggBody: AggregateRequest = {
    dimensions: isScalar || !widget.dimensionCol ? [] : [widget.dimensionCol],
    measures,
    filters: toWireFilters(filters),
  };

  // The aggregating widget skips the raw fetch; the rest fetch raw rows.
  const data = useWidgetData(widget.queryId, !aggregateEnabled);
  const agg = useWidgetAggregate(widget.queryId, aggBody, aggregateEnabled);

  const dimIdx = widget.dimensionCol ? findColIndex(data.columns, widget.dimensionCol) : -1;
  const seriesIdx = widget.seriesCol ? findColIndex(data.columns, widget.seriesCol) : -1;
  const measureIdx = widget.measureCol ? findColIndex(data.columns, widget.measureCol) : -1;
  const measure2Idx = widget.measureCol2 ? findColIndex(data.columns, widget.measureCol2) : -1;

  // R103 — client-side filter for the raw-row (non-aggregate) kinds; the
  // aggregate kinds push filters server-side via `aggBody` instead.
  const rows = applyFilters(data.rows, data.columns, filters);

  // gauge stays client-side (a scalar over raw rows); stat is overridden below.
  let statValue: number | null = null;
  if (widget.chartType === 'gauge') {
    statValue = rows.length === 0 ? null : aggregateScalar(rows, measureIdx, widget.agg);
  }

  // R111 — multi-series (grouped bar): a 2-D roll-up by dimension × series.
  const multiSeries =
    widget.chartType === 'bar' && dimIdx !== -1 && seriesIdx !== -1
      ? aggregateByGroupSeries(rows, dimIdx, seriesIdx, measureIdx, widget.agg)
      : null;

  // R112 — combo: two summed measures over the dimension (bar + line).
  const comboData =
    widget.chartType === 'combo' && dimIdx !== -1 && measureIdx !== -1 && measure2Idx !== -1
      ? sumTwoMeasures(rows, dimIdx, measureIdx, measure2Idx)
      : null;

  // R113 — scatter: raw (x, y) points, no aggregation.
  const scatterData =
    widget.chartType === 'scatter' && measureIdx !== -1 && measure2Idx !== -1
      ? toScatterPoints(rows, measureIdx, measure2Idx)
      : null;

  // R114 — heatmap: a 2-D matrix (dimension × series → agg).
  const matrixData =
    widget.chartType === 'heatmap' && dimIdx !== -1 && seriesIdx !== -1
      ? aggregateMatrix(rows, dimIdx, seriesIdx, measureIdx, widget.agg)
      : null;

  // R117 — table: the raw (filtered) rows + columns, no transform.
  const tableData = widget.chartType === 'table' ? { columns: data.columns, rows } : null;

  // R119 — bar(no series)/pie/line/stat read the SERVER aggregate. A grouped
  // result is `[dimension, measure]` rows → Datum (a null dim → `(blank)`),
  // ordered like the client path (line → by dimension/dtype; bar/pie → desc).
  // A scalar is one row; `null` only when the spec can't run (→ empty state).
  let chartData: Datum[] = [];
  if (aggregateEnabled) {
    if (isScalar) {
      statValue = agg.rows.length > 0 ? toNum(agg.rows[0][0]) : null;
    } else {
      const dimDtype = agg.columns[0]?.dtype ?? 'string';
      const datums: Datum[] = agg.rows.map((r) => ({ label: labelOf(r[0]), value: toNum(r[1]) }));
      chartData = widget.chartType === 'line' ? sortByDimension(datums, dimDtype) : sortDesc(datums);
    }
  } else if (directShaped) {
    // R127 — the query already shaped the data: map its rows to chart data
    // DIRECTLY (no re-aggregation). The measure is the named measureCol, else the
    // shaped `count` column, else the last (measure) column.
    const valueIdx = widget.measureCol
      ? measureIdx
      : findColIndex(data.columns, 'count') !== -1
        ? findColIndex(data.columns, 'count')
        : data.columns.length - 1;
    if (isScalar) {
      statValue = rows.length > 0 ? toNum(rows[0][valueIdx]) : null;
    } else if (dimIdx !== -1) {
      const dimDtype = data.columns[dimIdx]?.dtype ?? 'string';
      const datums: Datum[] = rows.map((r) => ({ label: labelOf(r[dimIdx]), value: toNum(r[valueIdx]) }));
      chartData = widget.chartType === 'line' ? sortByDimension(datums, dimDtype) : sortDesc(datums);
    }
  }

  return {
    ...data,
    // The aggregate result is complete (no cap), so its load/error state and a
    // never-capped flag replace the raw fetch's for the aggregating kinds. The
    // bound-query fetch (preShaped detection) also gates loading.
    isLoading: (aggregateEnabled ? agg.isLoading : data.isLoading) || boundQuery.isLoading,
    isError: aggregateEnabled ? agg.isError : data.isError,
    capped: aggregateEnabled ? false : data.capped,
    chartData,
    statValue,
    multiSeries,
    comboData,
    scatterData,
    matrixData,
    tableData,
  };
}

type WidgetViewProps = Readonly<{
  widget: Widget;
  /** Optional per-widget actions (edit/remove) rendered in the card header. */
  extra?: React.ReactNode;
  /** R103 — active dashboard filters; applied to this widget's rows before the
   *  roll-up (skipped for any filter whose column the widget lacks). */
  filters?: readonly DashboardFilter[];
}>;

export function WidgetView({ widget, extra, filters }: WidgetViewProps) {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const palette = useChartPalette();
  const {
    chartData,
    statValue,
    multiSeries,
    comboData,
    scatterData,
    matrixData,
    tableData,
    isLoading,
    isError,
    capped,
    total,
  } = useWidgetChartData(widget, filters);

  const valueName = widget.agg === 'count' ? t('dashboard.builder.countLabel') : (widget.measureCol ?? '');
  // R116 — per-widget number format (presentation). Applied to the headline
  // value displays (stat, gauge); charts keep their compact-axis defaults.
  const fmt = widget.numberFormat === 'compact' ? compactFmt : numberFmt;
  const ariaKey = {
    bar: 'dashboard.ariaBar',
    pie: 'dashboard.ariaPie',
    line: 'dashboard.ariaLine',
    stat: 'dashboard.ariaStat',
    combo: 'dashboard.ariaCombo',
    scatter: 'dashboard.ariaScatter',
    heatmap: 'dashboard.ariaHeatmap',
    gauge: 'dashboard.ariaGauge',
    table: 'dashboard.ariaTable',
  }[widget.chartType];
  // Empty depends on the active render path.
  const computeEmpty = () => {
    if (widget.chartType === 'stat' || widget.chartType === 'gauge') return statValue === null;
    if (multiSeries) return multiSeries.data.length === 0;
    if (comboData) return comboData.length === 0;
    if (scatterData) return scatterData.length === 0;
    if (matrixData) return matrixData.cells.length === 0;
    if (tableData) return tableData.rows.length === 0;
    return chartData.length === 0;
  };
  const isEmpty = computeEmpty();

  // R104 — over-cap signpost: this widget's data is partial (first N of M).
  const capWarning = capped ? (
    <AntTooltip
      title={t('dashboard.cap.tooltip', {
        cap: DASHBOARD_MAX_ROWS.toLocaleString(),
        total: total.toLocaleString(),
      })}
    >
      <WarningOutlined
        style={{ color: token.colorWarning, fontSize: 14 }}
        aria-label={t('dashboard.cap.label', {
          cap: DASHBOARD_MAX_ROWS.toLocaleString(),
          total: total.toLocaleString(),
        })}
        data-component="WidgetCapWarning"
      />
    </AntTooltip>
  ) : undefined;

  return (
    <ChartCard
      title={widget.title}
      isLoading={isLoading}
      isError={isError}
      isMissingQuery={false}
      isEmpty={isEmpty}
      extra={extra}
      warning={capWarning}
    >
      <ChartFigure label={t(ariaKey, { title: widget.title })}>
        {widget.chartType === 'stat' && <StatView value={statValue ?? 0} label={valueName} fmt={fmt} />}
        {widget.chartType === 'combo' && comboData && (
          <ComboView
            data={comboData}
            name1={widget.measureCol ?? ''}
            name2={widget.measureCol2 ?? ''}
            palette={palette}
          />
        )}
        {widget.chartType === 'scatter' && scatterData && (
          <ScatterView
            data={scatterData}
            xName={widget.measureCol ?? ''}
            yName={widget.measureCol2 ?? ''}
            palette={palette}
          />
        )}
        {widget.chartType === 'heatmap' && matrixData && (
          <Suspense fallback={<Spin />}>
            <HeatmapView matrix={matrixData} palette={palette} />
          </Suspense>
        )}
        {widget.chartType === 'gauge' && statValue !== null && (
          <Suspense fallback={<Spin />}>
            <GaugeView
              value={statValue}
              max={widget.target ?? 0}
              label={valueName}
              palette={palette}
              compact={widget.numberFormat === 'compact'}
            />
          </Suspense>
        )}
        {widget.chartType === 'table' && tableData && <TableView columns={tableData.columns} rows={tableData.rows} />}
        {widget.chartType === 'pie' && <PieView data={chartData} palette={palette} />}
        {widget.chartType === 'line' && <LineView data={chartData} valueName={valueName} palette={palette} />}
        {widget.chartType === 'bar' && multiSeries && (
          <MultiBarView data={multiSeries.data} seriesKeys={multiSeries.seriesKeys} palette={palette} />
        )}
        {widget.chartType === 'bar' && !multiSeries && (
          <BarView data={chartData} valueName={valueName} palette={palette} />
        )}
      </ChartFigure>
    </ChartCard>
  );
}
