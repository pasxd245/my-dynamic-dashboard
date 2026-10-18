// R192 (item 3.6a) — publish a workflow's frozen output as a dataset.
//
// `PublishButton` sits beside [Re-run]: [Publish] the first time (a small modal
// asks for the dataset's name), [Re-publish] after (a confirm says what will be
// replaced and lists the columns that changed). It is disabled — with the reason
// as its tooltip — whenever the server would refuse (`409 not_publishable`), so
// the refusal is known before the click. `PublishedLine` names the dataset the
// workflow published and says when the workflow has moved on since.

import { CloudUploadOutlined } from '@ant-design/icons';
import { Alert, App, Button, Input, Modal, Tooltip, Typography } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { ApiErrorThrown } from '../_shared/types';
import { useDatasetQuery } from '../datasets/hooks';
import type { Column } from '../datasets/types';
import { usePublishWorkflowMutation } from './hooks';
import type { NotPublishableReason, Workflow } from './types';

/** Why publishing would be refused now, or null. `unstamped` is the client's
 *  name for a run before R187 (the server answers `never_run`); `up_to_date`
 *  means this run is already the published one (the server would answer 200
 *  and change nothing). */
export type PublishBlock = NotPublishableReason | 'unstamped' | 'up_to_date';

export function publishBlock(workflow: Workflow): PublishBlock | null {
  if (!workflow.materializedAt) return 'never_run';
  if (!workflow.run) return 'unstamped';
  if (workflow.staleSources?.length) return 'stale';
  const target = workflow.published?.datasetId;
  if (target && workflow.run.sources.some((s) => s.dataVersions && target in s.dataVersions)) return 'reads_itself';
  if (workflow.published && workflow.published.runId === workflow.run.id) return 'up_to_date';
  return null;
}

export type ColumnDiff = {
  added: string[];
  removed: string[];
  retyped: { name: string; from: string; to: string }[];
};

/** The columns a re-publish would change on the dataset, by name. */
export function columnDiff(output: readonly Column[], dataset: readonly Column[]): ColumnDiff {
  const before = new Map(dataset.map((c) => [c.name, c.dtype]));
  const after = new Map(output.map((c) => [c.name, c.dtype]));
  return {
    added: output.filter((c) => !before.has(c.name)).map((c) => c.name),
    removed: dataset.filter((c) => !after.has(c.name)).map((c) => c.name),
    retyped: output
      .filter((c) => before.has(c.name) && before.get(c.name) !== c.dtype)
      .map((c) => ({ name: c.name, from: String(before.get(c.name)), to: c.dtype })),
  };
}

function isDiffEmpty(d: ColumnDiff): boolean {
  return d.added.length === 0 && d.removed.length === 0 && d.retyped.length === 0;
}

export function PublishButton({ workflow }: Readonly<{ workflow: Workflow }>) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const mutation = usePublishWorkflowMutation();
  const published = workflow.published;
  const block = publishBlock(workflow);

  const [nameOpen, setNameOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [name, setName] = useState('');
  const [nameTaken, setNameTaken] = useState(false);
  const target = useDatasetQuery(confirmOpen ? published?.datasetId : undefined);

  const onError = (err: Error) => {
    if (err instanceof ApiErrorThrown && err.body.code === 'name_taken') {
      setNameTaken(true);
      return;
    }
    const reason = err instanceof ApiErrorThrown && err.body.code === 'not_publishable' ? err.body.reason : undefined;
    message.error(reason ? t(`workflows.publish.block_${reason}`) : t('workflows.publish.failed'));
    setNameOpen(false);
    setConfirmOpen(false);
    // The page judged the workflow publishable from data the server just
    // contradicted (e.g. a source refreshed meanwhile): reload it, so the
    // button shows the real state and its reason.
    queryClient.invalidateQueries({ queryKey: ['workflow', workflow.id] });
  };

  const publish = (body: { name?: string }) =>
    mutation.mutate(
      { id: workflow.id, ...body },
      {
        onSuccess: ({ dataset, created }) => {
          message.success(
            t(created ? 'workflows.publish.created' : 'workflows.publish.updated', {
              name: dataset.name,
              version: dataset.dataVersion,
            }),
          );
          setNameOpen(false);
          setConfirmOpen(false);
        },
        onError,
      },
    );

  const open = () => {
    if (published) {
      setConfirmOpen(true);
    } else {
      setName(workflow.name);
      setNameTaken(false);
      setNameOpen(true);
    }
  };

  const trimmed = name.trim();
  const diff =
    target.data && workflow.resolvedColumns ? columnDiff(workflow.resolvedColumns, target.data.columns) : null;

  const button = (
    <Button
      icon={<CloudUploadOutlined />}
      onClick={open}
      disabled={block !== null}
      loading={mutation.isPending}
      data-component="WorkflowPublish"
      data-block={block ?? undefined}
    >
      {published ? t('workflows.publish.republish') : t('workflows.publish.publish')}
    </Button>
  );

  return (
    <>
      {block ? (
        <Tooltip title={t(`workflows.publish.block_${block}`)} trigger={['hover', 'focus']}>
          {/* a disabled button swallows hover and focus — the span carries the
              tooltip and is focusable, so keyboard users can read the reason */}
          <span style={{ display: 'inline-block' }} tabIndex={0} aria-label={t(`workflows.publish.block_${block}`)}>
            {button}
          </span>
        </Tooltip>
      ) : (
        button
      )}

      <Modal
        open={nameOpen}
        title={t('workflows.publish.nameTitle')}
        okText={t('workflows.publish.publish')}
        onOk={() => publish({ name: trimmed })}
        okButtonProps={{ disabled: trimmed.length === 0 || trimmed.length > 120, loading: mutation.isPending }}
        onCancel={() => !mutation.isPending && setNameOpen(false)}
        destroyOnHidden
      >
        <div data-component="WorkflowPublishName">
          <Typography.Paragraph type="secondary">{t('workflows.publish.nameHint')}</Typography.Paragraph>
          <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>
            {t('workflows.publish.nameLabel')}
          </Typography.Text>
          <Input
            value={name}
            maxLength={120}
            onChange={(e) => {
              setName(e.target.value);
              setNameTaken(false);
            }}
            status={nameTaken ? 'error' : undefined}
            aria-label={t('workflows.publish.nameLabel')}
          />
          {nameTaken ? (
            <Typography.Text type="danger" data-component="WorkflowPublishNameTaken">
              {t('workflows.publish.nameTaken')}
            </Typography.Text>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={confirmOpen}
        title={t('workflows.publish.confirmTitle')}
        okText={t('workflows.publish.republish')}
        onOk={() => publish({})}
        // Wait for the dataset's columns, so the column changes are never skipped.
        okButtonProps={{ loading: mutation.isPending, disabled: !target.data && !target.isError }}
        onCancel={() => !mutation.isPending && setConfirmOpen(false)}
        destroyOnHidden
      >
        {published && workflow.run ? (
          <div data-component="WorkflowRepublishConfirm">
            <Typography.Paragraph>
              {t('workflows.publish.confirmBody', {
                name: published.datasetName,
                version: published.dataVersion,
                from: published.runNumber,
                to: workflow.run.number,
              })}
            </Typography.Paragraph>
            {diff && !isDiffEmpty(diff) ? (
              <Alert
                type="warning"
                showIcon
                data-component="WorkflowRepublishColumns"
                title={t('workflows.publish.columnsChanged')}
                description={
                  <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                    {diff.added.map((c) => (
                      <li key={`a-${c}`}>{t('workflows.publish.columnAdded', { name: c })}</li>
                    ))}
                    {diff.removed.map((c) => (
                      <li key={`r-${c}`}>{t('workflows.publish.columnRemoved', { name: c })}</li>
                    ))}
                    {diff.retyped.map((c) => (
                      <li key={`t-${c.name}`}>
                        {t('workflows.publish.columnRetyped', {
                          name: c.name,
                          from: t(`workflows.publish.dtype.${c.from}`),
                          to: t(`workflows.publish.dtype.${c.to}`),
                        })}
                      </li>
                    ))}
                  </ul>
                }
              />
            ) : null}
            {target.isError ? (
              <Typography.Text type="warning" data-component="WorkflowRepublishColumnsUnknown">
                {t('workflows.publish.columnsUnknown')}
              </Typography.Text>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}

/** The dataset this workflow published, and whether the workflow moved on. */
export function PublishedLine({ workflow }: Readonly<{ workflow: Workflow }>) {
  const { t } = useTranslation();
  const published = workflow.published;
  if (!published) return null;
  const note = !workflow.run
    ? t('workflows.publish.editedSince')
    : workflow.run.id !== published.runId
      ? t('workflows.publish.rerunSince', { name: published.datasetName })
      : null;
  return (
    <div data-component="WorkflowPublished" style={{ marginBottom: 12, flex: '0 0 auto' }}>
      <Typography.Text type="secondary">
        {t('workflows.publish.publishedAs')}{' '}
        <Link to={`/data-management/datasets/${published.datasetId}`}>{published.datasetName}</Link>
        {' · '}
        {t('workflows.publish.publishedMeta', { version: published.dataVersion, run: published.runNumber })}
      </Typography.Text>
      {note ? (
        <Typography.Text type="warning" style={{ display: 'block' }} data-component="WorkflowPublishedNote">
          {note}
        </Typography.Text>
      ) : null}
    </div>
  );
}
