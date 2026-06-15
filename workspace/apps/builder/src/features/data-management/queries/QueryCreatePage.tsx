// QueryCreatePage (R77) — "Build on this query": the builder in CREATE mode.
//
// Reached only via the "Build on this query" verb on a Query detail
// (/data-management/queries/new?base=qr_…). It is NOT the deferred standalone
// "New query" surface — the base is REQUIRED (preset from `?base=`), there is no
// empty source picker. It REUSES the shipped builder: the same `useQueryBuilder`
// (now in create mode), the same `<QueryBuilderPanel>`, and the same
// `SaveQueryModal` name-capture as "Save filters as Query" — so create logic is
// not duplicated. Save POSTs `{ name, datasetId, sourceId, definition }` (the
// composition create gap R76 left open) and navigates to the new query's detail.

import { ArrowLeftOutlined, WarningOutlined } from '@ant-design/icons';
import { PageCard, PageHeader } from '@mdd/ui';
import { Alert, Button, Skeleton, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { ApiErrorThrown } from '../_shared/types';
import { QueryBuilderPanel } from './QueryBuilderPanel';
import { SaveQueryModal } from './SaveQueryModal';
import { useQueryBuilder } from './useQueryBuilder';
import { useQueryQuery } from './hooks';

function isNotFound(err: unknown): boolean {
  return err instanceof ApiErrorThrown && err.body.code === 'not_found';
}

export function QueryCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const baseId = searchParams.get('base') ?? undefined;

  const baseQuery = useQueryQuery(baseId);
  const base = baseQuery.data;
  const [nameOpen, setNameOpen] = useState(false);

  // Create mode: the preset base is the source Query (a `qr_`); it supplies the
  // workspace, the legacy `datasetId`, and its own id as the driving `sourceId`.
  const builder = useQueryBuilder({
    createBase: base
      ? { workspaceId: base.workspaceId, datasetId: base.datasetId, sourceId: base.id }
      : undefined,
    datasetColumns: [],
    active: Boolean(base),
    onDone: () => navigate(base ? `/data-management/queries/${base.id}` : '/data-management/queries'),
    onCreated: (created) => navigate(`/data-management/queries/${created.id}`),
  });

  const BREADCRUMB = [
    { label: t('nav.home'), route: '/' },
    { label: t('nav.dataManagement'), route: '/data-management/workspaces' },
    { label: t('nav.queries'), route: '/data-management/queries' },
    { label: base?.name ?? t('queries.create.loadingTitle') },
  ];

  // ─── Base not found (deleted / bad ?base=) ─────────────────────────
  if (!baseId || isNotFound(baseQuery.error)) {
    return (
      <>
        <PageHeader
          breadcrumb={[...BREADCRUMB.slice(0, 3), { label: '?' }]}
          title={t('queries.create.notFoundTitle')}
          onNavigate={(r) => navigate(r)}
        />
        <PageCard>
          <div data-component="QueryCreateNotFound" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <WarningOutlined style={{ fontSize: 36, color: 'var(--ant-color-warning, #faad14)', marginBottom: 12 }} />
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              {t('queries.create.notFoundTitle')}
            </Typography.Title>
            <Typography.Text type="secondary">{t('queries.create.notFoundHint')}</Typography.Text>
            <div style={{ marginTop: 20 }}>
              <Button
                type="primary"
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/data-management/queries')}
              >
                {t('queries.create.back')}
              </Button>
            </div>
          </div>
        </PageCard>
      </>
    );
  }

  // ─── Loading the base ──────────────────────────────────────────────
  if (!base) {
    return (
      <>
        <PageHeader breadcrumb={BREADCRUMB} title={t('queries.create.loadingTitle')} onNavigate={(r) => navigate(r)} />
        <PageCard>
          <Skeleton active paragraph={{ rows: 8 }} data-component="QueryCreateLoading" />
        </PageCard>
      </>
    );
  }

  const title = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      {t('queries.create.title', { name: base.name })}
    </span>
  );

  const actions = (
    <span style={{ display: 'inline-flex', gap: 8 }}>
      <Button onClick={builder.cancel} data-component="QueryCreateCancel">
        {t('common.cancel')}
      </Button>
      <Button
        type="primary"
        onClick={() => setNameOpen(true)}
        disabled={!builder.canSave}
        loading={builder.isSaving}
        data-component="QueryCreateSave"
      >
        {t('queries.create.save')}
      </Button>
    </span>
  );

  return (
    <div
      data-component="QueryCreatePage"
      style={{ height: 'calc(100vh - 88px)', display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <PageHeader
        breadcrumb={BREADCRUMB}
        title={title}
        subtitle={t('queries.create.subtitle')}
        actions={actions}
        onNavigate={(r) => navigate(r)}
      />
      <PageCard variant="fill">
        <div style={{ flex: '0 0 auto', marginBottom: 8 }}>
          <Typography.Text type="secondary">
            {t('queries.create.buildingOn')}{' '}
            <Typography.Link
              onClick={() => navigate(`/data-management/queries/${base.id}`)}
              data-component="QueryCreateBaseLink"
            >
              {base.name} ↗
            </Typography.Link>
          </Typography.Text>
        </div>
        {/* The preset base (transitively) loops or can't run — flag, don't crash;
            Save stays disabled (the preview is blocked → !canSave). */}
        {builder.compositionCycle ? (
          <Alert
            type="warning"
            showIcon
            role="alert"
            data-component="QueryCreateBaseUnavailable"
            style={{ marginBottom: 12 }}
            message={t('queries.create.baseUnavailableTitle')}
            description={
              <span>
                {t('queries.create.baseUnavailableHint')}{' '}
                <Typography.Link onClick={() => navigate(`/data-management/queries/${base.id}`)}>
                  {t('queries.create.openBase')} ↗
                </Typography.Link>
              </span>
            }
          />
        ) : null}
        <QueryBuilderPanel builder={builder} />
      </PageCard>

      <SaveQueryModal
        open={nameOpen}
        suggestedName=""
        sourceDatasetName={base.name}
        workspaceName={undefined}
        filterCount={builder.draft.filters.length}
        advancedCount={builder.draft.advanced.flat().length}
        hasSearch={Boolean(builder.draft.q)}
        isPending={builder.isSaving}
        error={builder.createError}
        onSubmit={(name) => builder.createWithName(name)}
        onClose={() => setNameOpen(false)}
      />
    </div>
  );
}
