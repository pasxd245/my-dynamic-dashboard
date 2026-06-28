// R101 — generic, config-driven widget renderer. Replaces R100's two hardcoded
// widgets: given a `Widget` (queryId + dimension/measure/agg/chart), it runs the
// query live, rolls the rows up client-side, and draws a bar or pie inside a
// `ChartCard` (which owns loading/error/empty). Same compute→present split as
// R100; the config now comes from the builder instead of hardcoded props.

import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  applyFilters,
  countByGroup,
  findColIndex,
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
  widget: Pick<Widget, 'queryId' | 'dimensionCol' | 'measureCol' | 'agg'>,
  filters: readonly DashboardFilter[] = [],
) {
  const data = useWidgetData(widget.queryId);
  const dimIdx = findColIndex(data.columns, widget.dimensionCol);
  const measureIdx = widget.measureCol ? findColIndex(data.columns, widget.measureCol) : -1;

  // R103 — apply the active dashboard filters to the rows BEFORE the roll-up
  // (client-side; filters whose column this widget lacks are skipped).
  const rows = applyFilters(data.rows, data.columns, filters);

  let chartData: Datum[] = [];
  if (dimIdx !== -1) {
    if (widget.agg === 'sum' && measureIdx !== -1) {
      chartData = sortDesc(sumByGroup(rows, dimIdx, measureIdx));
    } else if (widget.agg === 'count') {
      chartData = sortDesc(countByGroup(rows, dimIdx));
    }
  }
  return { ...data, chartData };
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
  const palette = useChartPalette();
  const { chartData, isLoading, isError } = useWidgetChartData(widget, filters);

  const valueName = widget.agg === 'count' ? t('dashboard.builder.countLabel') : (widget.measureCol ?? '');
  const ariaKey = widget.chartType === 'pie' ? 'dashboard.ariaPie' : 'dashboard.ariaBar';

  return (
    <ChartCard
      title={widget.title}
      isLoading={isLoading}
      isError={isError}
      isMissingQuery={false}
      isEmpty={chartData.length === 0}
      extra={extra}
    >
      <ChartFigure label={t(ariaKey, { title: widget.title })}>
        {widget.chartType === 'pie' ? (
          <PieView data={chartData} palette={palette} />
        ) : (
          <BarView data={chartData} valueName={valueName} palette={palette} />
        )}
      </ChartFigure>
    </ChartCard>
  );
}
