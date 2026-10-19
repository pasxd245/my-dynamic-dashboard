import { CheckCircleOutlined, CloseCircleOutlined, InboxOutlined } from '@ant-design/icons';
import { Alert, App, Button, Modal, Radio, Space, Spin, Table, Tag, Typography, Upload, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PackErrorThrown } from '@/api/definitionsApi';
import type { Workspace } from '../types';
import { useApplyPackMutation, useImportPlanMutation } from './hooks';
import {
  PACK_MAX_BYTES,
  canImport,
  columnDifference,
  nothingToImport,
  readPackText,
  writeCount,
  type PackFileRead,
} from './plan';
import type { ImportPlan, OnConflict, PackColumn, PackError, PlanAction, PlanDataset, PlanItem } from './types';

/** R201 (4.8) — "Import definitions…": choose a pack file, read the server's
 *  dry-run plan (re-run on every conflict-choice change), then import the whole
 *  pack in one click. Design: _shared/definition-pack.md § Layout. */

const ACTION_COLOR: Record<PlanAction, string | undefined> = {
  create: 'success',
  replace: 'warning',
  unchanged: undefined,
  skip: undefined,
  conflict: 'error',
  invalid: 'error',
};

type PackInvalid = Extract<PackError, { code: 'pack_invalid' }>;

type ChosenFile = { name: string; read: PackFileRead };

const colText = (c: PackColumn) => `${c.name} (${c.dtype})`;

/** One readable line for a dataset whose columns differ: where they first part. */
function columnsDifferText(ds: PlanDataset, t: (k: string, o?: Record<string, unknown>) => string): string {
  const d = columnDifference(ds.columns?.expected ?? [], ds.columns?.found ?? []);
  if (!d) return t('workspaces.pack.columnsDiffer.changed', { n: '?', expected: '?', found: '?' });
  if (d.expected && d.found) {
    return t('workspaces.pack.columnsDiffer.changed', {
      n: d.position,
      expected: colText(d.expected),
      found: colText(d.found),
    });
  }
  if (d.expected) return t('workspaces.pack.columnsDiffer.missing', { n: d.position, expected: colText(d.expected) });
  return t('workspaces.pack.columnsDiffer.extra', { n: d.position, found: colText(d.found as PackColumn) });
}

function DatasetLine({ ds }: Readonly<{ ds: PlanDataset }>) {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  if (ds.status === 'found') {
    return (
      <li data-component="PackDatasetLine" data-status="found">
        <CheckCircleOutlined style={{ color: token.colorSuccess }} aria-hidden="true" /> {ds.name}{' '}
        <Typography.Text type="secondary">{t('workspaces.pack.datasetFound')}</Typography.Text>
      </li>
    );
  }
  return (
    <li data-component="PackDatasetLine" data-status={ds.status}>
      <CloseCircleOutlined style={{ color: token.colorError }} aria-hidden="true" /> {ds.name} —{' '}
      {ds.status === 'missing' ? (
        <Typography.Text type="danger">{t('workspaces.pack.datasetMissing')}</Typography.Text>
      ) : (
        <Typography.Text type="danger">{columnsDifferText(ds, t)}</Typography.Text>
      )}
    </li>
  );
}

function PackInvalidAlert({ err }: Readonly<{ err: PackInvalid }>) {
  const { t } = useTranslation();
  const kindName = (k?: string) => (k ? t(`workspaces.pack.kind.${k}`) : '');
  let lines: string[];
  if (err.reason === 'version') {
    lines = [
      t('workspaces.pack.invalid.version', {
        found: err.packVersion ?? '?',
        supported: (err.supported ?? [1]).join(', '),
      }),
    ];
  } else if (err.reason === 'too_large') {
    lines = [t('workspaces.pack.invalid.tooLarge', { mb: PACK_MAX_BYTES / (1024 * 1024) })];
  } else if (err.reason === 'cycle') {
    lines = [t('workspaces.pack.invalid.cycle', { names: err.problems.map((p) => p.name).join(', ') })];
  } else if (err.reason === 'duplicate') {
    lines = err.problems.map((p) =>
      p.ref
        ? t('workspaces.pack.invalid.duplicateSlug', { slug: p.ref })
        : t('workspaces.pack.invalid.duplicate', { kind: kindName(p.kind), name: p.name ?? '' }),
    );
  } else {
    lines = err.problems.map((p) =>
      t('workspaces.pack.invalid.reference', {
        kind: kindName(p.kind),
        name: p.name ?? '',
        refKind: kindName(p.refKind).toLowerCase(),
        ref: p.ref ?? '',
      }),
    );
  }
  return (
    <Alert
      type="error"
      showIcon
      title={t('workspaces.pack.invalid.title')}
      description={
        <ul style={{ paddingInlineStart: 20, marginBottom: 0 }}>
          {lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      }
      data-component="PackInvalidAlert"
      data-reason={err.reason}
    />
  );
}

function PlanView({ plan }: Readonly<{ plan: ImportPlan }>) {
  const { t } = useTranslation();
  const summary = (['create', 'replace', 'unchanged', 'skip', 'conflict', 'invalid'] as const)
    .filter((a) => plan.counts[a] > 0)
    .map((a) => t(`workspaces.pack.count.${a}`, { count: plan.counts[a] }))
    .join(' · ');
  const columns: ColumnsType<PlanItem> = [
    {
      title: t('workspaces.pack.col.kind'),
      dataIndex: 'kind',
      width: 110,
      render: (k: string) => t(`workspaces.pack.kind.${k}`),
    },
    { title: t('workspaces.pack.col.name'), dataIndex: 'name' },
    {
      title: t('workspaces.pack.col.action'),
      dataIndex: 'action',
      width: 140,
      render: (a: PlanAction) => (
        <Tag color={ACTION_COLOR[a]} data-component="PlanActionTag" data-action={a}>
          {t(`workspaces.pack.action.${a}`)}
        </Tag>
      ),
    },
    {
      title: t('workspaces.pack.col.why'),
      key: 'why',
      render: (_: unknown, item: PlanItem) =>
        item.reason ? (
          <Typography.Text type="secondary">
            {t(`workspaces.pack.reason.${item.reason}`, { detail: item.detail ?? '' })}
          </Typography.Text>
        ) : null,
    },
  ];
  return (
    <div data-component="PackPlan" data-ok={plan.ok}>
      {plan.datasets.length > 0 ? (
        <>
          <Typography.Text strong>{t('workspaces.pack.datasetsNeeded')}</Typography.Text>
          <ul data-component="PackDatasets" style={{ listStyle: 'none', paddingInlineStart: 4, margin: '4px 0 12px' }}>
            {plan.datasets.map((ds) => (
              <DatasetLine key={ds.name} ds={ds} />
            ))}
          </ul>
        </>
      ) : null}
      <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }} data-component="PackPlanSummary">
        {summary || t('workspaces.pack.emptyPack')}
      </Typography.Paragraph>
      {plan.items.length > 0 ? (
        <Table<PlanItem>
          size="small"
          rowKey={(r) => `${r.kind}:${r.name}`}
          columns={columns}
          dataSource={plan.items}
          pagination={false}
          scroll={{ y: 280 }}
          onRow={(r) =>
            ({
              'data-component': 'PlanRow',
              'data-kind': r.kind,
              'data-name': r.name,
            }) as React.HTMLAttributes<HTMLElement>
          }
        />
      ) : null}
    </div>
  );
}

export type ImportDefinitionsModalProps = Readonly<{
  /** The target workspace (a main one — the card hides the action on a saved one). */
  workspace: Workspace | null;
  onClose: () => void;
}>;

export function ImportDefinitionsModal({ workspace, onClose }: ImportDefinitionsModalProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const planMutation = useImportPlanMutation();
  const applyMutation = useApplyPackMutation();
  const [file, setFile] = useState<ChosenFile | null>(null);
  const [onConflict, setOnConflict] = useState<OnConflict>('refuse');
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [refusedOnApply, setRefusedOnApply] = useState(false);
  const [packInvalid, setPackInvalid] = useState<PackInvalid | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setOnConflict('refuse');
    setPlan(null);
    setRefusedOnApply(false);
    setPackInvalid(null);
    setRequestError(null);
    planMutation.reset();
    applyMutation.reset();
  };

  const close = () => {
    if (applyMutation.isPending) return;
    reset();
    onClose();
  };

  const showError = (err: Error) => {
    if (err instanceof PackErrorThrown && err.body.code === 'pack_invalid') {
      setPackInvalid(err.body);
      setPlan(null);
      return;
    }
    if (err instanceof PackErrorThrown && err.body.code === 'pack_refused') {
      setPlan(err.body.plan);
      setRefusedOnApply(true);
      return;
    }
    setRequestError(err.message);
  };

  const check = (read: PackFileRead, choice: OnConflict) => {
    if (!workspace || !read.ok) return;
    setPlan(null);
    setPackInvalid(null);
    setRequestError(null);
    setRefusedOnApply(false);
    planMutation.mutate(
      { workspaceId: workspace.id, pack: read.pack, onConflict: choice },
      { onSuccess: (p) => setPlan(p), onError: showError },
    );
  };

  const onFile = async (f: File) => {
    const read =
      f.size > PACK_MAX_BYTES ? ({ ok: false, reason: 'too_large' } as const) : readPackText(await f.text(), f.size);
    setFile({ name: f.name, read });
    if (read.ok) check(read, onConflict);
    else {
      setPlan(null);
      setPackInvalid(null);
      setRequestError(null);
    }
  };

  const onChoice = (choice: OnConflict) => {
    setOnConflict(choice);
    if (file?.read.ok) check(file.read, choice);
  };

  const apply = () => {
    if (!workspace || !file?.read.ok || !plan) return;
    setRefusedOnApply(false);
    setRequestError(null);
    applyMutation.mutate(
      { workspaceId: workspace.id, pack: file.read.pack, onConflict },
      {
        onSuccess: (applied) => {
          message.success(
            t('workspaces.pack.imported', {
              name: workspace.name,
              // Not `replace` — an i18next option name, which would swallow the values.
              created: applied.counts.create,
              replaced: applied.counts.replace,
              unchanged: applied.counts.unchanged,
            }),
          );
          reset();
          onClose();
        },
        onError: showError,
      },
    );
  };

  const writes = plan ? writeCount(plan) : 0;
  const busy = planMutation.isPending || applyMutation.isPending;

  const footer = [
    <Button key="cancel" onClick={close} disabled={applyMutation.isPending}>
      {t('common.cancel')}
    </Button>,
  ];
  if (plan && !nothingToImport(plan)) {
    footer.push(
      <Button
        key="import"
        type="primary"
        onClick={apply}
        loading={applyMutation.isPending}
        disabled={!canImport(plan) || planMutation.isPending}
        data-component="PackImportButton"
      >
        {t('workspaces.pack.importN', { count: writes })}
      </Button>,
    );
  }

  return (
    <Modal
      open={workspace !== null}
      title={t('workspaces.pack.importTitle', { name: workspace?.name ?? '' })}
      onCancel={close}
      footer={footer}
      width={760}
      destroyOnHidden
      maskClosable={!busy}
      data-component="ImportDefinitionsModal"
    >
      <Typography.Paragraph type="secondary">{t('workspaces.pack.importIntro')}</Typography.Paragraph>
      <Upload.Dragger
        accept=".json,application/json"
        multiple={false}
        showUploadList={false}
        disabled={applyMutation.isPending}
        beforeUpload={(f) => {
          void onFile(f);
          return false;
        }}
        data-component="PackDropZone"
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">{t('workspaces.pack.dropHint')}</p>
      </Upload.Dragger>
      {file ? (
        <Typography.Paragraph type="secondary" style={{ marginTop: 8 }} data-component="PackFileLine">
          {file.read.ok
            ? t('workspaces.pack.fileLine', {
                file: file.name,
                workspace: file.read.workspace ?? '—',
                date: (file.read.exportedAt ?? '').slice(0, 10) || '—',
              })
            : file.name}
        </Typography.Paragraph>
      ) : null}
      {file && !file.read.ok ? (
        <Alert
          type="error"
          showIcon
          title={
            file.read.reason === 'too_large'
              ? t('workspaces.pack.fileTooLarge', { mb: PACK_MAX_BYTES / (1024 * 1024) })
              : t('workspaces.pack.notAPack')
          }
          data-component="PackFileError"
          style={{ marginBottom: 12 }}
        />
      ) : null}
      <Space orientation="vertical" size={2} style={{ width: '100%', margin: '8px 0 12px' }}>
        <Space wrap>
          <Typography.Text>{t('workspaces.pack.conflictLabel')}</Typography.Text>
          <Radio.Group
            value={onConflict}
            onChange={(e) => onChoice(e.target.value as OnConflict)}
            disabled={applyMutation.isPending}
            data-component="PackConflictChoice"
          >
            <Radio value="refuse">{t('workspaces.pack.conflict.refuse')}</Radio>
            <Radio value="replace">{t('workspaces.pack.conflict.replace')}</Radio>
            <Radio value="skip">{t('workspaces.pack.conflict.skip')}</Radio>
          </Radio.Group>
        </Space>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('workspaces.pack.conflictHelp')}
        </Typography.Text>
      </Space>
      {refusedOnApply ? (
        <Alert
          type="warning"
          showIcon
          title={t('workspaces.pack.changedSinceCheck')}
          data-component="PackRefusedOnApply"
          style={{ marginBottom: 12 }}
        />
      ) : null}
      {packInvalid ? <PackInvalidAlert err={packInvalid} /> : null}
      {requestError ? (
        <Alert
          type="error"
          showIcon
          title={t('workspaces.pack.requestFailed')}
          description={requestError}
          data-component="PackRequestError"
        />
      ) : null}
      {planMutation.isPending ? (
        <div style={{ textAlign: 'center', padding: 24 }} data-component="PackChecking">
          <Spin />
          <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
            {t('workspaces.pack.checking')}
          </Typography.Paragraph>
        </div>
      ) : null}
      {plan && !planMutation.isPending ? <PlanView plan={plan} /> : null}
      {plan && !planMutation.isPending && nothingToImport(plan) ? (
        <Alert
          type="info"
          showIcon
          title={t('workspaces.pack.nothingToImport')}
          data-component="PackNothingToImport"
          style={{ marginTop: 12 }}
        />
      ) : null}
      {plan && !planMutation.isPending && plan.ok && plan.counts.replace > 0 ? (
        <Alert
          type="warning"
          showIcon
          title={t('workspaces.pack.replaceWarning')}
          data-component="PackReplaceWarning"
          style={{ marginTop: 12 }}
        />
      ) : null}
      {plan && !planMutation.isPending && !plan.ok ? (
        <Alert
          type="error"
          showIcon
          title={t('workspaces.pack.blocked')}
          data-component="PackBlocked"
          style={{ marginTop: 12 }}
        />
      ) : null}
    </Modal>
  );
}
