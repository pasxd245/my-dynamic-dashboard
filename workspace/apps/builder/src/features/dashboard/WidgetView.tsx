// R101 — generic, config-driven widget renderer. Replaces R100's two hardcoded
// widgets: given a `Widget` (queryId + dimension/measure/agg/chart), it runs the
// query live, rolls the rows up client-side, and draws a bar or pie inside a
// `ChartCard` (which owns loading/error/empty). Same compute→present split as
// R100; the config now comes from the builder instead of hardcoded props.

import { WarningOutlined } from '@ant-design/icons';
import { Spin, Tooltip as AntTooltip, Statistic, theme } from 'antd';
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
  countByGroup,
  findColIndex,
  sortByDimension,
  sortDesc,
  sumByGroup,
  sumTwoMeasures,
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
import { useChartPalette, useWidgetData } from './hooks';
import type { ChartType, Widget } from './types';

const numberFmt = new Intl.NumberFormat();
const compactFmt = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

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
        <XAxis dataKey="label" interval={0} angle={-30} textAnchor="end" height={68} tickMargin={6} tick={{ fontSize: 11 }} />
        <YAxis
          width={52}
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => compactFmt.format(v)}
          label={{ value: valueName, angle: -90, position: 'insideLeft', style: { fontSize: 12, textAnchor: 'middle' } }}
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
        <XAxis dataKey="label" interval={0} angle={-30} textAnchor="end" height={68} tickMargin={6} tick={{ fontSize: 11 }} />
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
        <XAxis type="number" dataKey="x" name={xName} tick={{ fontSize: 11 }} tickFormatter={(v: number) => compactFmt.format(v)} />
        <YAxis type="number" dataKey="y" name={yName} width={52} tick={{ fontSize: 11 }} tickFormatter={(v: number) => compactFmt.format(v)} />
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
        <XAxis dataKey="label" interval={0} angle={-30} textAnchor="end" height={68} tickMargin={6} tick={{ fontSize: 11 }} />
        <YAxis yAxisId="left" width={52} tick={{ fontSize: 11 }} tickFormatter={(v: number) => compactFmt.format(v)} />
        <YAxis yAxisId="right" orientation="right" width={52} tick={{ fontSize: 11 }} tickFormatter={(v: number) => compactFmt.format(v)} />
        <Tooltip formatter={(v) => numberFmt.format(Number(v))} />
        <Legend />
        <Bar yAxisId="left" dataKey="v1" name={name1} fill={palette[0]} radius={[4, 4, 0, 0]} />
        <Line yAxisId="right" type="monotone" dataKey="v2" name={name2} stroke={palette[1] ?? palette[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function LineView({ data, valueName, palette }: Readonly<{ data: Datum[]; valueName: string; palette: string[] }>) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }} accessibilityLayer>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" interval="preserveStartEnd" angle={-30} textAnchor="end" height={68} tickMargin={6} tick={{ fontSize: 11 }} />
        <YAxis
          width={52}
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => compactFmt.format(v)}
          label={{ value: valueName, angle: -90, position: 'insideLeft', style: { fontSize: 12, textAnchor: 'middle' } }}
        />
        <Tooltip formatter={(v) => numberFmt.format(Number(v))} />
        <Legend />
        <Line type="monotone" dataKey="value" name={valueName} stroke={palette[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
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

/** Single-series roll-up for bar/line/pie: aggregate by the dimension, then
 *  order (line → by dimension/dtype; bar/pie → by value desc). */
function singleSeriesData(
  rows: readonly (readonly (string | null)[])[],
  dimIdx: number,
  measureIdx: number,
  agg: 'sum' | 'count',
  chartType: ChartType,
  dtype: string,
): Datum[] {
  let raw: Datum[] = [];
  if (agg === 'sum' && measureIdx !== -1) raw = sumByGroup(rows, dimIdx, measureIdx);
  else if (agg === 'count') raw = countByGroup(rows, dimIdx);
  return chartType === 'line' ? sortByDimension(raw, dtype) : sortDesc(raw);
}

/** Roll a widget's live rows up to chart data per its config. Exported for the
 *  builder's live preview (same path as the rendered widget). */
export function useWidgetChartData(
  widget: Pick<Widget, 'queryId' | 'chartType' | 'dimensionCol' | 'seriesCol' | 'measureCol' | 'measureCol2' | 'agg'>,
  filters: readonly DashboardFilter[] = [],
) {
  const data = useWidgetData(widget.queryId);
  const dimIdx = widget.dimensionCol ? findColIndex(data.columns, widget.dimensionCol) : -1;
  const seriesIdx = widget.seriesCol ? findColIndex(data.columns, widget.seriesCol) : -1;
  const measureIdx = widget.measureCol ? findColIndex(data.columns, widget.measureCol) : -1;
  const measure2Idx = widget.measureCol2 ? findColIndex(data.columns, widget.measureCol2) : -1;

  // R103 — apply the active dashboard filters to the rows BEFORE the roll-up
  // (client-side; filters whose column this widget lacks are skipped).
  const rows = applyFilters(data.rows, data.columns, filters);

  // R110 — a `stat` (KPI) widget has no dimension: one scalar over all rows.
  // `null` when there are no rows (→ ChartCard empty state); a value of 0 over
  // ≥1 row is a legitimate KPI ("0 deals"), not empty.
  // stat + gauge both reduce to one scalar over all rows (null = nothing to show).
  let statValue: number | null = null;
  if (widget.chartType === 'stat' || widget.chartType === 'gauge') {
    statValue = rows.length === 0 ? null : aggregateScalar(rows, measureIdx, widget.agg);
  }

  // R111 — multi-series (grouped bar): a 2-D roll-up by dimension × series.
  // Only for `bar` with a `seriesCol`; null otherwise (→ single-series path).
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

  const isSpecial =
    widget.chartType === 'stat' ||
    widget.chartType === 'gauge' ||
    widget.chartType === 'combo' ||
    widget.chartType === 'scatter' ||
    widget.chartType === 'heatmap';
  const singleSeries = dimIdx !== -1 && !isSpecial && !multiSeries;
  const chartData: Datum[] = singleSeries
    ? singleSeriesData(rows, dimIdx, measureIdx, widget.agg, widget.chartType, data.columns[dimIdx]?.dtype ?? 'string')
    : [];
  return { ...data, chartData, statValue, multiSeries, comboData, scatterData, matrixData };
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
  const { chartData, statValue, multiSeries, comboData, scatterData, matrixData, isLoading, isError, capped, total } =
    useWidgetChartData(widget, filters);

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
  }[widget.chartType];
  // Empty depends on the active render path.
  const computeEmpty = () => {
    if (widget.chartType === 'stat' || widget.chartType === 'gauge') return statValue === null;
    if (multiSeries) return multiSeries.data.length === 0;
    if (comboData) return comboData.length === 0;
    if (scatterData) return scatterData.length === 0;
    if (matrixData) return matrixData.cells.length === 0;
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
        aria-label={t('dashboard.cap.label', { cap: DASHBOARD_MAX_ROWS.toLocaleString(), total: total.toLocaleString() })}
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
          <ComboView data={comboData} name1={widget.measureCol ?? ''} name2={widget.measureCol2 ?? ''} palette={palette} />
        )}
        {widget.chartType === 'scatter' && scatterData && (
          <ScatterView data={scatterData} xName={widget.measureCol ?? ''} yName={widget.measureCol2 ?? ''} palette={palette} />
        )}
        {widget.chartType === 'heatmap' && matrixData && (
          <Suspense fallback={<Spin />}>
            <HeatmapView matrix={matrixData} palette={palette} />
          </Suspense>
        )}
        {widget.chartType === 'gauge' && statValue !== null && (
          <Suspense fallback={<Spin />}>
            <GaugeView value={statValue} max={widget.target ?? 0} label={valueName} palette={palette} compact={widget.numberFormat === 'compact'} />
          </Suspense>
        )}
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
