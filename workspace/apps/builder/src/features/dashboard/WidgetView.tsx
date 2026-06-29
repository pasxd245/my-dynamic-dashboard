// R101 — generic, config-driven widget renderer. Replaces R100's two hardcoded
// widgets: given a `Widget` (queryId + dimension/measure/agg/chart), it runs the
// query live, rolls the rows up client-side, and draws a bar or pie inside a
// `ChartCard` (which owns loading/error/empty). Same compute→present split as
// R100; the config now comes from the builder instead of hardcoded props.

import { WarningOutlined } from '@ant-design/icons';
import { Tooltip as AntTooltip, Statistic, theme } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { DASHBOARD_MAX_ROWS } from '@/_generated/constants';
import {
  aggregateScalar,
  applyFilters,
  countByGroup,
  findColIndex,
  sortByDimension,
  sortDesc,
  sumByGroup,
  type DashboardFilter,
  type Datum,
} from './aggregate';
import { ChartCard } from './ChartCard';
import { useChartPalette, useWidgetData } from './hooks';
import type { Widget } from './types';

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

function StatView({ value, label }: Readonly<{ value: number; label: string }>) {
  return (
    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
      <Statistic title={label} value={value} formatter={(v) => numberFmt.format(Number(v))} />
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

/** Roll a widget's live rows up to chart data per its config. Exported for the
 *  builder's live preview (same path as the rendered widget). */
export function useWidgetChartData(
  widget: Pick<Widget, 'queryId' | 'chartType' | 'dimensionCol' | 'measureCol' | 'agg'>,
  filters: readonly DashboardFilter[] = [],
) {
  const data = useWidgetData(widget.queryId);
  const dimIdx = widget.dimensionCol ? findColIndex(data.columns, widget.dimensionCol) : -1;
  const measureIdx = widget.measureCol ? findColIndex(data.columns, widget.measureCol) : -1;

  // R103 — apply the active dashboard filters to the rows BEFORE the roll-up
  // (client-side; filters whose column this widget lacks are skipped).
  const rows = applyFilters(data.rows, data.columns, filters);

  // R110 — a `stat` (KPI) widget has no dimension: one scalar over all rows.
  // `null` when there are no rows (→ ChartCard empty state); a value of 0 over
  // ≥1 row is a legitimate KPI ("0 deals"), not empty.
  let statValue: number | null = null;
  if (widget.chartType === 'stat') {
    statValue = rows.length === 0 ? null : aggregateScalar(rows, measureIdx, widget.agg);
  }

  let chartData: Datum[] = [];
  if (dimIdx !== -1 && widget.chartType !== 'stat') {
    let raw: Datum[] = [];
    if (widget.agg === 'sum' && measureIdx !== -1) {
      raw = sumByGroup(rows, dimIdx, measureIdx);
    } else if (widget.agg === 'count') {
      raw = countByGroup(rows, dimIdx);
    }
    // R109 — a line/time chart orders by the dimension (the x-axis); bar/pie
    // order by value (largest first). The dimension's dtype drives chronological
    // vs lexical ordering for line.
    chartData =
      widget.chartType === 'line'
        ? sortByDimension(raw, data.columns[dimIdx]?.dtype ?? 'string')
        : sortDesc(raw);
  }
  return { ...data, chartData, statValue };
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
  const { chartData, statValue, isLoading, isError, capped, total } = useWidgetChartData(widget, filters);

  const valueName = widget.agg === 'count' ? t('dashboard.builder.countLabel') : (widget.measureCol ?? '');
  const ariaKey = {
    bar: 'dashboard.ariaBar',
    pie: 'dashboard.ariaPie',
    line: 'dashboard.ariaLine',
    stat: 'dashboard.ariaStat',
  }[widget.chartType];
  // R110 — a stat is empty only when there's nothing to aggregate (statValue
  // null); a charted widget is empty when the roll-up yields no data.
  const isEmpty = widget.chartType === 'stat' ? statValue === null : chartData.length === 0;

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
        {widget.chartType === 'stat' && <StatView value={statValue ?? 0} label={valueName} />}
        {widget.chartType === 'pie' && <PieView data={chartData} palette={palette} />}
        {widget.chartType === 'line' && <LineView data={chartData} valueName={valueName} palette={palette} />}
        {widget.chartType === 'bar' && <BarView data={chartData} valueName={valueName} palette={palette} />}
      </ChartFigure>
    </ChartCard>
  );
}
