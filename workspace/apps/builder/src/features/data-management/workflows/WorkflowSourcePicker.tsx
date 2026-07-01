// WorkflowSourcePicker (R137) — the multi-source selector for the workflow
// builder. A workflow CONSOLIDATES ≥1 source; unlike the query builder's single
// base, this is a multi-select of the workspace's saved queries AND other
// workflows' outputs (output-as-source). Selection order = consolidation order
// (UNION). No join graph — consolidation is a union, not a join.

import { Select, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

import { useQueriesQuery } from '@/features/data-management/queries/hooks';
import { useWorkflowsQuery } from './hooks';

type WorkflowSourcePickerProps = Readonly<{
  workspaceId: string | undefined;
  value: readonly string[];
  onChange: (sources: string[]) => void;
  /** Exclude one workflow id from the options (a workflow can't source itself). */
  excludeWorkflowId?: string;
}>;

export function WorkflowSourcePicker({ workspaceId, value, onChange, excludeWorkflowId }: WorkflowSourcePickerProps) {
  const { t } = useTranslation();
  const queries = useQueriesQuery(workspaceId);
  const workflows = useWorkflowsQuery(workspaceId);

  const queryOptions = (queries.data ?? []).map((q) => ({ label: q.name, value: q.id }));
  const workflowOptions = (workflows.data ?? [])
    .filter((w) => w.id !== excludeWorkflowId)
    .map((w) => ({ label: w.name, value: w.id }));

  const options = [
    { label: t('workflows.builder.sourceGroupQueries'), options: queryOptions },
    ...(workflowOptions.length > 0
      ? [{ label: t('workflows.builder.sourceGroupWorkflows'), options: workflowOptions }]
      : []),
  ];

  return (
    <div data-component="WorkflowSourcePicker">
      <Typography.Text strong>{t('workflows.builder.sourcesLabel')}</Typography.Text>
      <Typography.Paragraph type="secondary" style={{ marginTop: 2, marginBottom: 8, fontSize: 12 }}>
        {t('workflows.builder.sourcesHint')}
      </Typography.Paragraph>
      <Select
        mode="multiple"
        value={[...value]}
        onChange={onChange}
        options={options}
        loading={queries.isLoading || workflows.isLoading}
        disabled={!workspaceId}
        placeholder={t('workflows.builder.sourcesPlaceholder')}
        style={{ width: '100%' }}
        optionFilterProp="label"
        data-component="WorkflowSourceSelect"
      />
    </div>
  );
}
