// WorkflowCreatePage (R137) — the workflow builder at
// /data-management/workflows/new. Simpler than the query builder: consolidation
// is a UNION, so there is NO join canvas — just pick sources, add transform
// steps, save. No live preview (the frozen-output model, signed off R136): you
// Save, then Run on the detail page to materialize + view the output.
//
// Editing a saved workflow is a follow-up (needs a PUT endpoint); to change one
// now, recreate it.

import { PageCard, PageContainer, PageHeader } from '@mdd/ui';
import { App, Button, Divider, Input, Select, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { NAME_LENGTHS } from '@/_generated/constants';
import { StepsEditor } from '@/features/data-management/queries/StepsEditor';
import type { Step } from '@/features/data-management/queries/types';
import { useWorkspacesQuery } from '@/features/data-management/workspaces/hooks';
import { ApiErrorThrown } from '../_shared/types';
import { WorkflowSourcePicker } from './WorkflowSourcePicker';
import { useCreateWorkflowMutation, useSourceColumns } from './hooks';

export function WorkflowCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [searchParams] = useSearchParams();

  const workspaces = useWorkspacesQuery();
  const [workspaceId, setWorkspaceId] = useState<string | undefined>(searchParams.get('workspace') ?? undefined);
  const [name, setName] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);

  // Steps author against the FIRST source's columns (the consolidation schema).
  const firstSource = sources[0];
  const { columns, loading: columnsLoading } = useSourceColumns(firstSource);

  const createMutation = useCreateWorkflowMutation();

  const canSave = Boolean(workspaceId) && name.trim().length > 0 && sources.length > 0 && !createMutation.isPending;

  const save = () => {
    if (!workspaceId || !canSave) return;
    createMutation.mutate(
      { workspaceId, body: { name: name.trim(), definition: { sources, steps } } },
      {
        onSuccess: (wf) => {
          message.success(t('workflows.builder.createSuccess', { name: wf.name }));
          navigate(`/data-management/workflows/${wf.id}`, { replace: true });
        },
        onError: (err) => {
          if (err instanceof ApiErrorThrown && err.body.code === 'name_taken') {
            message.error(t('workflows.builder.nameTaken'));
          } else {
            message.error(t('workflows.builder.createFailed'));
          }
        },
      },
    );
  };

  const BREADCRUMB = [
    { label: t('nav.home'), route: '/' },
    { label: t('nav.dataManagement'), route: '/data-management/workspaces' },
    { label: t('nav.workflows'), route: '/data-management/workflows' },
    { label: t('workflows.builder.newTitle') },
  ];

  const actions = (
    <span style={{ display: 'inline-flex', gap: 8 }}>
      <Button onClick={() => navigate('/data-management/workflows')} data-component="WorkflowBuilderCancel">
        {t('common.cancel')}
      </Button>
      <Button
        type="primary"
        onClick={save}
        disabled={!canSave}
        loading={createMutation.isPending}
        data-component="WorkflowBuilderSave"
      >
        {t('workflows.builder.save')}
      </Button>
    </span>
  );

  return (
    <PageContainer fill width="fluid" dataComponent="WorkflowCreatePage">
      <PageHeader
        breadcrumb={BREADCRUMB}
        title={t('workflows.builder.newTitle')}
        subtitle={t('workflows.builder.newSubtitle')}
        actions={actions}
        onNavigate={(r) => navigate(r)}
      />
      <PageCard variant="fill">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 8 }}>
          <div>
            <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>
              {t('workflows.builder.workspaceLabel')}
            </Typography.Text>
            <Select
              value={workspaceId}
              onChange={(v) => {
                setWorkspaceId(v);
                setSources([]);
                setSteps([]);
              }}
              style={{ minWidth: 220 }}
              placeholder={t('workflows.builder.workspacePlaceholder')}
              loading={workspaces.isLoading}
              options={(workspaces.data ?? []).map((w) => ({ value: w.id, label: w.name }))}
              data-component="WorkflowWorkspaceSelect"
            />
          </div>
          <div style={{ flex: '1 1 260px' }}>
            <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>
              {t('workflows.builder.nameLabel')}
            </Typography.Text>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={NAME_LENGTHS.QUERY_MAX}
              placeholder={t('workflows.builder.namePlaceholder')}
              data-component="WorkflowNameInput"
            />
          </div>
        </div>

        <Divider style={{ margin: '12px 0' }} />
        <WorkflowSourcePicker workspaceId={workspaceId} value={sources} onChange={setSources} />

        <Divider style={{ margin: '16px 0 8px' }} />
        <Typography.Text strong>{t('workflows.builder.stepsLabel')}</Typography.Text>
        <Typography.Paragraph type="secondary" style={{ marginTop: 2, marginBottom: 8, fontSize: 12 }}>
          {t('workflows.builder.stepsHint')}
        </Typography.Paragraph>
        {sources.length === 0 ? (
          <Typography.Text type="secondary" data-component="WorkflowStepsNoSource">
            {t('workflows.builder.pickSourceFirst')}
          </Typography.Text>
        ) : columnsLoading ? (
          <Typography.Text type="secondary">{t('common.loading')}</Typography.Text>
        ) : (
          <StepsEditor steps={steps} columns={columns} onChange={setSteps} />
        )}
      </PageCard>
    </PageContainer>
  );
}
