// R100 — the widget shell. Owns the per-widget STATES (loading / error / empty
// / missing-query) so every widget renders all of them, not just the happy
// path (the Credibility affordance the Design gate folded into R100's criteria).
// The chart itself is the `children`, shown only in the loaded-with-data state.

import { ReloadOutlined, WarningOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Skeleton, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/** Fixed body height so all four states (and the chart) occupy the same box —
 *  the grid doesn't reflow as widgets resolve. */
const BODY_HEIGHT = 300;

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
  children: ReactNode;
}>;

function Centered({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div
      style={{
        height: BODY_HEIGHT,
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

export function ChartCard({ title, isLoading, isError, isMissingQuery, isEmpty, onRetry, extra, children }: ChartCardProps) {
  const { t } = useTranslation();

  let body: ReactNode;
  if (isLoading) {
    body = (
      <div style={{ height: BODY_HEIGHT }}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  } else if (isMissingQuery) {
    body = (
      <Centered>
        <Typography.Text strong>{t('dashboard.state.missingQuery')}</Typography.Text>
        <Typography.Text type="secondary">{t('dashboard.state.missingQueryHint')}</Typography.Text>
      </Centered>
    );
  } else if (isError) {
    body = (
      <Centered>
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
      <Centered>
        <Empty description={t('dashboard.state.empty')} />
      </Centered>
    );
  } else {
    body = <div style={{ height: BODY_HEIGHT }}>{children}</div>;
  }

  return (
    <Card
      title={title}
      extra={extra}
      variant="outlined"
      data-component="DashboardChartCard"
      styles={{ body: { paddingTop: 12 } }}
    >
      {body}
    </Card>
  );
}
