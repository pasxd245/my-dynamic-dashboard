// R114 — the first ECharts-rendered widget (a heatmap), proving the
// `WidgetView` lib-agnostic seam (R101): recharts and ECharts renderers coexist,
// chosen by `chartType`. This module is **lazy-loaded** (default export, behind
// React.lazy in WidgetView), so the ~1 MB echarts bundle stays OUT of the base
// chunk and only loads when a heatmap actually renders.

import * as echarts from 'echarts';
import { useEffect, useRef } from 'react';

import type { Matrix } from './aggregate';

const numberFmt = new Intl.NumberFormat();

/** Render a 2-D matrix as an ECharts heatmap. Self-contained: inits on a div
 *  ref, re-renders on data/palette change, resizes with its container, and
 *  disposes on unmount. */
export default function HeatmapView({ matrix, palette }: Readonly<{ matrix: Matrix; palette: string[] }>) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const chart = echarts.init(el);
    const max = matrix.cells.reduce((m, c) => Math.max(m, c[2]), 0);
    chart.setOption({
      tooltip: { position: 'top', valueFormatter: (v: number) => numberFmt.format(Number(v)) },
      grid: { left: 70, right: 16, top: 12, bottom: 64, containLabel: true },
      xAxis: { type: 'category', data: matrix.xs, axisLabel: { rotate: 30, fontSize: 11 } },
      yAxis: { type: 'category', data: matrix.ys, axisLabel: { fontSize: 11 } },
      visualMap: {
        min: 0,
        max: max || 1,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        itemHeight: 80,
        inRange: { color: [palette[1] ?? '#e6f4ff', palette[0]] },
      },
      series: [{ type: 'heatmap', data: matrix.cells, emphasis: { itemStyle: { shadowBlur: 6 } } }],
    });
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.dispose();
    };
  }, [matrix, palette]);

  return <div ref={ref} style={{ width: '100%', height: '100%' }} data-component="HeatmapView" />;
}
