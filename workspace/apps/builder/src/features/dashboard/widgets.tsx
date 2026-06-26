// R100 — the dashboard's chart widgets (recharts v3). Each resolves its saved
// query by name, runs it live (paged fetch-all), rolls the raw rows up
// client-side, and renders inside a `ChartCard` that owns the load/error/empty
// states. Two shapes: a grouped-sum bar and a category-count pie.

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

import { countByGroup, findColIndex, sortDesc, sumByGroup } from './aggregate';
import { ChartCard } from './ChartCard';
import { useChartPalette, useQueryIdByName, useWidgetData } from './hooks';

/** Accessible-name wrapper — gives the SVG chart a `role="img"` + label so a
 *  screen reader announces what it is (the chart is not colour-only meaning). */
function ChartFigure({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div role="img" aria-label={label} style={{ width: '100%', height: '100%' }}>
      {children}
    </div>
  );
}

const numberFmt = new Intl.NumberFormat();
const compactFmt = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

type BarWidgetProps = Readonly<{
  workspaceId: string | undefined;
  /** True while the workspace query-list is still loading. */
  queriesLoading: boolean;
  /** Saved-query name to bind to (seed-stable). */
  queryName: string;
  title: string;
  /** Logical column names (resolved against the effective columns). */
  groupColumn: string;
  valueColumn: string;
  yAxisLabel: string;
  /** The series name (legend + tooltip). */
  seriesName: string;
}>;

/** A bar chart of `sum(valueColumn)` grouped by `groupColumn`, sorted desc. */
export function BarSumWidget({
  workspaceId,
  queriesLoading,
  queryName,
  title,
  groupColumn,
  valueColumn,
  yAxisLabel,
  seriesName,
}: BarWidgetProps) {
  const { t } = useTranslation();
  const palette = useChartPalette();
  const queryId = useQueryIdByName(workspaceId, queryName);
  const data = useWidgetData(queryId);

  const groupIdx = findColIndex(data.columns, groupColumn);
  const valueIdx = findColIndex(data.columns, valueColumn);
  const chartData =
    groupIdx === -1 || valueIdx === -1 ? [] : sortDesc(sumByGroup(data.rows, groupIdx, valueIdx));

  return (
    <ChartCard
      title={title}
      isLoading={queriesLoading || data.isLoading}
      isError={data.isError}
      isMissingQuery={!queriesLoading && !queryId}
      isEmpty={chartData.length === 0}
      onRetry={data.refetch}
    >
      <ChartFigure label={t('dashboard.ariaBar', { title })}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }} accessibilityLayer>
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
              label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', style: { fontSize: 12, textAnchor: 'middle' } }}
            />
            <Tooltip formatter={(v) => numberFmt.format(Number(v))} />
            <Legend />
            <Bar dataKey="value" name={seriesName} fill={palette[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartFigure>
    </ChartCard>
  );
}

type PieWidgetProps = Readonly<{
  workspaceId: string | undefined;
  /** True while the workspace query-list is still loading. */
  queriesLoading: boolean;
  queryName: string;
  title: string;
  groupColumn: string;
}>;

/** A pie chart of row counts per distinct `groupColumn` value. Slice labels
 *  show name + percent (not colour alone) and a legend names every slice. */
export function PieCountWidget({
  workspaceId,
  queriesLoading,
  queryName,
  title,
  groupColumn,
}: PieWidgetProps) {
  const { t } = useTranslation();
  const palette = useChartPalette();
  const queryId = useQueryIdByName(workspaceId, queryName);
  const data = useWidgetData(queryId);

  const groupIdx = findColIndex(data.columns, groupColumn);
  // recharts v3 colours a pie slice from each datum's own `fill` (Cell is
  // deprecated) — map the theme palette onto the data.
  const chartData = (groupIdx === -1 ? [] : sortDesc(countByGroup(data.rows, groupIdx))).map((d, i) => ({
    ...d,
    fill: palette[i % palette.length],
  }));

  return (
    <ChartCard
      title={title}
      isLoading={queriesLoading || data.isLoading}
      isError={data.isError}
      isMissingQuery={!queriesLoading && !queryId}
      isEmpty={chartData.length === 0}
      onRetry={data.refetch}
    >
      <ChartFigure label={t('dashboard.ariaPie', { title })}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart accessibilityLayer>
            <Pie
              data={chartData}
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
      </ChartFigure>
    </ChartCard>
  );
}
