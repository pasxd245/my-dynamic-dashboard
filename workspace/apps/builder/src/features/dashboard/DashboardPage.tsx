// DashboardPage (R100) — the static multi-widget Sales dashboard at /dashboard.
//
// A fixed 2–3 widget grid over the R99-seeded Sales scenario. Each widget binds
// to a SAVED QUERY (by name) and runs it LIVE — proving the
// Query → aggregate → visualize path end-to-end. FE-only: no new backend, no
// persisted dashboard entity (config is the static array below). The headline
// value (a report that survives new data + drift) lands when the dashboard
// definition persists + re-runs on upload — a later round.

import { PageContainer, PageHeader } from '@mdd/ui';
import { Card, Col, Row, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useQueriesQuery } from '@/features/data-management/queries/hooks';
import { useSeedWorkspace } from './hooks';
import { BarSumWidget, PieCountWidget } from './widgets';

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const seed = useSeedWorkspace();
  // The widgets each resolve their query from this same (cached) list; the page
  // reads its loading flag to gate the per-widget missing-query state.
  const queries = useQueriesQuery(seed.id);
  const queriesLoading = seed.isLoading || queries.isLoading;

  const breadcrumb = [{ label: t('nav.home'), route: '/' }, { label: t('nav.dashboard') }];

  // Seed workspace absent (fresh DB / not seeded) — a page-level setup state
  // rather than three "missing query" widgets.
  const seedMissing = !seed.isLoading && !seed.isError && !seed.id;

  return (
    <PageContainer width="data" dataComponent="DashboardPage">
      <PageHeader
        breadcrumb={breadcrumb}
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
        onNavigate={(r) => navigate(r)}
      />
      {seedMissing ? (
        <Card data-component="DashboardSetup">
          <div style={{ padding: '32px 24px', textAlign: 'center' }}>
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              {t('dashboard.setupTitle')}
            </Typography.Title>
            <Typography.Text type="secondary">{t('dashboard.setupHint')}</Typography.Text>
          </div>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={8}>
            <BarSumWidget
              workspaceId={seed.id}
              queriesLoading={queriesLoading}
              queryName="Revenue by region"
              title={t('dashboard.widget.revenueByRegion')}
              groupColumn="region_name"
              valueColumn="amount"
              xAxisLabel={t('dashboard.axis.region')}
              yAxisLabel={t('dashboard.axis.revenue')}
              seriesName={t('dashboard.axis.revenue')}
            />
          </Col>
          <Col xs={24} lg={8}>
            <BarSumWidget
              workspaceId={seed.id}
              queriesLoading={queriesLoading}
              queryName="Orders by product"
              title={t('dashboard.widget.revenueByProduct')}
              groupColumn="product_name"
              valueColumn="amount"
              xAxisLabel={t('dashboard.axis.product')}
              yAxisLabel={t('dashboard.axis.revenue')}
              seriesName={t('dashboard.axis.revenue')}
            />
          </Col>
          <Col xs={24} lg={8}>
            <PieCountWidget
              workspaceId={seed.id}
              queriesLoading={queriesLoading}
              queryName="Telesale calls"
              title={t('dashboard.widget.telesaleOutcomes')}
              groupColumn="outcome"
            />
          </Col>
        </Row>
      )}
    </PageContainer>
  );
}
