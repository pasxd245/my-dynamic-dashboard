// R182 — export a table widget's numbers. The request carries what the widget
// shows: its query, the active dashboard filters, its totals spec and its
// percent format; the server writes every row of the same post-step, filtered
// relation the table (and its footer) reads.

import { queriesApi } from '@/api/queriesApi';
import type { AggregateFilter, ExportRequest, ParamContext } from '@/features/data-management/queries/types';
import { BLANK_LABEL } from './aggregate';
import type { DashboardFilter } from './aggregate';
import type { Widget } from './types';

export function exportRequest(
  widget: Widget,
  filters: readonly DashboardFilter[],
  format: 'csv' | 'xlsx',
  ctx?: ParamContext,
  // R199 — the viewer's shared selections (the saved ones the server applies);
  // the Filters sheet tells them from the widget's own (D7).
  shared: readonly AggregateFilter[] = [],
): ExportRequest {
  return {
    // R195 — the file is read under the same parameter values as the widget.
    ...(ctx ?? {}),
    format,
    filters: [
      ...filters.map((f) => ({ column: f.column, values: f.values.map((v) => (v === BLANK_LABEL ? null : v)) })),
      ...shared,
    ],
    ...(widget.totals && Object.keys(widget.totals).length > 0 ? { totals: widget.totals } : {}),
    ...(widget.numberFormat === 'percent' ? { percent: true } : {}),
    title: widget.title,
  };
}

/** Fetch the file and hand it to the browser as a download. */
export async function downloadWidgetExport(
  widget: Widget,
  filters: readonly DashboardFilter[],
  format: 'csv' | 'xlsx',
  ctx?: ParamContext,
  shared: readonly AggregateFilter[] = [],
): Promise<string> {
  if (!widget.queryId) throw new Error('a note has nothing to export');
  const { blob, filename } = await queriesApi.exportFile(
    widget.queryId,
    exportRequest(widget, filters, format, ctx, shared),
  );
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return filename;
}
