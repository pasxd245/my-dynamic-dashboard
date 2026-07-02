// WorkflowForm (R139) — the shared builder body: name + sources + transform steps.
// Extracted from WorkflowCreatePage so the detail-page EDIT mode reuses the exact
// same authoring surface (DRY — no drift between create + edit). Consolidation is a
// union, so there is no join canvas; steps author against the first source's columns.
// Workspace selection is NOT here (create-only context; edit keeps the workspace).

import { Divider, Input, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

import { NAME_LENGTHS } from '@/_generated/constants';
import { StepsEditor } from '@/features/data-management/queries/StepsEditor';
import type { Step } from '@/features/data-management/queries/types';
import { WorkflowSourcePicker } from './WorkflowSourcePicker';
import { useSourceColumns } from './hooks';

type WorkflowFormProps = Readonly<{
  workspaceId: string | undefined;
  name: string;
  sources: string[];
  steps: Step[];
  onNameChange: (name: string) => void;
  onSourcesChange: (sources: string[]) => void;
  onStepsChange: (steps: Step[]) => void;
  /** Exclude one workflow id from the source options (a workflow can't source itself). */
  excludeWorkflowId?: string;
}>;

export function WorkflowForm({
  workspaceId,
  name,
  sources,
  steps,
  onNameChange,
  onSourcesChange,
  onStepsChange,
  excludeWorkflowId,
}: WorkflowFormProps) {
  const { t } = useTranslation();
  // Steps author against the FIRST source's columns (the consolidation schema).
  const { columns, loading: columnsLoading } = useSourceColumns(sources[0]);

  return (
    <div data-component="WorkflowForm">
      <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>
        {t('workflows.builder.nameLabel')}
      </Typography.Text>
      <Input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        maxLength={NAME_LENGTHS.QUERY_MAX}
        placeholder={t('workflows.builder.namePlaceholder')}
        style={{ maxWidth: 420 }}
        data-component="WorkflowNameInput"
      />

      <Divider style={{ margin: '16px 0' }} />
      <WorkflowSourcePicker
        workspaceId={workspaceId}
        value={sources}
        onChange={onSourcesChange}
        excludeWorkflowId={excludeWorkflowId}
      />

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
        <StepsEditor steps={steps} columns={columns} onChange={onStepsChange} />
      )}
    </div>
  );
}
