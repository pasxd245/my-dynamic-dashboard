// R100 — the widget shell. Owns the per-widget STATES (loading / error / empty
// / missing-query) so every widget renders all of them, not just the happy
// path (the Credibility affordance the Design gate folded into R100's criteria).
// The chart itself is the `children`, shown only in the loaded-with-data state.

import { ReloadOutlined, WarningOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Skeleton, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { WidgetRows } from './types';

/** The one-row body height. Fixed so all four states (and the chart) occupy
 *  the same box — the grid doesn't reflow as widgets resolve. */
export const ROW_HEIGHT = 300;

/** R177 — what a taller widget must also cover to line up with the widgets
 *  stacked beside it: the grid's gap (16, `DashboardDetailPage`) plus one
 *  card's chrome — header (56) + body padding (12 top, 24 bottom) + border
 *  (1), measured at the visual gate. A `rows: 2` widget is then exactly as
 *  tall as two `rows: 1` widgets (393 + 16 + 393 = 802). */
const GRID_GUTTER = 16;
const CARD_CHROME = 56 + 12 + 24 + 1;
export const ROW_GAP = GRID_GUTTER + CARD_CHROME;

/** R177 — body height for a widget `rows` tall (absent → 1): one row is
 *  `ROW_HEIGHT`; each extra row adds a row plus the gap it would have sat in. */
export function bodyHeight(rows: WidgetRows | undefined): number {
  const n = rows ?? 1;
  return ROW_HEIGHT * n + ROW_GAP * (n - 1);
}

type ChartCardProps = Readonly<{
  title: string;
  isLoading: boolean;
  isError: boolean;
  /** The saved query this widget binds to was not found (seed not loaded). */
  isMissingQuery: boolean;
  /** Loaded successfully but the query returned no rows to chart. */
  isEmpty: boolean;
  onRetry?: () => void;
  /** Header-right slot — per-widget actions (edit / remove). */
  extra?: ReactNode;
  /** R104 — optional inline affordance next to the title (the over-cap
   *  "partial data" warning). */
  warning?: ReactNode;
  /** R177 — grid height in widget-rows (1–3); absent → 1. */
  rows?: WidgetRows;
  children: ReactNode;
}>;

function Centered({ height, children }: Readonly<{ height: number; children: ReactNode }>) {
  return (
    <div
      style={{
        height,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  );
}

export function ChartCard({
  title,
  isLoading,
  isError,
  isMissingQuery,
  isEmpty,
  onRetry,
  extra,
  warning,
  rows,
  children,
}: ChartCardProps) {
  const { t } = useTranslation();
  const height = bodyHeight(rows);

  let body: ReactNode;
  if (isLoading) {
    body = (
      <div style={{ height }}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  } else if (isMissingQuery) {
    body = (
      <Centered height={height}>
        <Typography.Text strong>{t('dashboard.state.missingQuery')}</Typography.Text>
        <Typography.Text type="secondary">{t('dashboard.state.missingQueryHint')}</Typography.Text>
      </Centered>
    );
  } else if (isError) {
    body = (
      <Centered height={height}>
        <WarningOutlined style={{ fontSize: 28, color: 'var(--ant-color-warning, #faad14)' }} />
        <Typography.Text strong>{t('dashboard.state.error')}</Typography.Text>
        <Typography.Text type="secondary">{t('dashboard.state.errorHint')}</Typography.Text>
        {onRetry ? (
          <Button size="small" icon={<ReloadOutlined />} onClick={onRetry} style={{ marginTop: 4 }}>
            {t('dashboard.state.retry')}
          </Button>
        ) : null}
      </Centered>
    );
  } else if (isEmpty) {
    body = (
      <Centered height={height}>
        <Empty description={t('dashboard.state.empty')} />
      </Centered>
    );
  } else {
    body = <div style={{ height }}>{children}</div>;
  }

  return (
    <Card
      title={
        warning ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {title}
            {warning}
          </span>
        ) : (
          title
        )
      }
      extra={extra}
      variant="outlined"
      data-component="DashboardChartCard"
      data-rows={rows ?? 1}
      styles={{ body: { paddingTop: 12 } }}
    >
      {body}
    </Card>
  );
}
