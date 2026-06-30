// R115 — a second ECharts-rendered widget (a gauge), hardening the lib-agnostic
// seam with a different chart family (recharts has no gauge). Lazy-loaded
// (default export, behind React.lazy in WidgetView) so echarts stays out of the
// base bundle — and shares the same echarts chunk as HeatmapView.

import * as echarts from 'echarts';
import { useEffect, useRef } from 'react';

const numberFmt = new Intl.NumberFormat();

/** Render a scalar value as an ECharts gauge against `max` (the target). */
export default function GaugeView({
  value,
  max,
  label,
  palette,
}: Readonly<{ value: number; max: number; label: string; palette: string[] }>) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const chart = echarts.init(el);
    chart.setOption({
      series: [
        {
          type: 'gauge',
          min: 0,
          max: max > 0 ? max : value || 1,
          progress: { show: true, width: 14, itemStyle: { color: palette[0] } },
          axisLine: { lineStyle: { width: 14 } },
          axisLabel: { formatter: (v: number) => numberFmt.format(v), fontSize: 9 },
          pointer: { show: true },
          detail: {
            valueAnimation: true,
            formatter: (v: number) => numberFmt.format(v),
            fontSize: 22,
            offsetCenter: [0, '40%'],
          },
          title: { offsetCenter: [0, '72%'], fontSize: 12 },
          data: [{ value, name: label }],
        },
      ],
    });
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.dispose();
    };
  }, [value, max, label, palette]);

  return <div ref={ref} style={{ width: '100%', height: '100%' }} data-component="GaugeView" />;
}
