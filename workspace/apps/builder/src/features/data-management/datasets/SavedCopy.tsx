// R193 (item 3.6b) — saved (frozen) copies.
//
// `SaveCopyModal` freezes the dataset under a label (default today's date) into
// its workspace's read-only saved workspace. `FrozenCopyBand` sits on a copy's
// page and says what it froze, at which version, when — and that it is not the
// current numbers.

import { Alert, App, Button, Input, Modal, Typography } from 'antd';
import i18n from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { useSaveCopiesMutation } from '@/features/data-management/workspaces/hooks';
import { ApiErrorThrown } from '../_shared/types';
import { useDatasetQuery } from './hooks';
import type { Dataset } from './types';

export const SAVE_LABEL_MAX = 40;

function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function SaveCopyModal({
  dataset,
  open,
  onClose,
}: Readonly<{ dataset: Dataset; open: boolean; onClose: () => void }>) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const mutation = useSaveCopiesMutation();
  const [label, setLabel] = useState(today);
  const trimmed = label.trim();

  const save = () =>
    mutation.mutate(
      { workspaceId: dataset.workspaceId, label: trimmed, datasetIds: [dataset.id] },
      {
        onSuccess: ({ datasets }) => {
          const copy = datasets[0];
          message.success({
            content: (
              <span data-component="SaveCopyToast">
                {t('datasets.savedCopy.saved', { name: copy.name })}{' '}
                <Button type="link" size="small" onClick={() => navigate(`/data-management/datasets/${copy.id}`)}>
                  {t('datasets.savedCopy.openCopy')}
                </Button>
              </span>
            ),
          });
          onClose();
        },
        onError: (err) => {
          const ro = err instanceof ApiErrorThrown && err.body.code === 'read_only_workspace';
          message.error(ro ? t('datasets.savedCopy.readOnly') : t('datasets.savedCopy.failed'));
        },
      },
    );

  return (
    <Modal
      open={open}
      title={t('datasets.savedCopy.title')}
      okText={t('datasets.savedCopy.save')}
      onOk={save}
      okButtonProps={{ disabled: trimmed.length === 0, loading: mutation.isPending }}
      onCancel={() => !mutation.isPending && onClose()}
      destroyOnHidden
    >
      <div data-component="SaveCopyModal">
        <Typography.Paragraph type="secondary">
          {t('datasets.savedCopy.hint', { name: dataset.name })}
        </Typography.Paragraph>
        <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>
          {t('datasets.savedCopy.labelLabel')}
        </Typography.Text>
        <Input
          value={label}
          maxLength={SAVE_LABEL_MAX}
          onChange={(e) => setLabel(e.target.value)}
          aria-label={t('datasets.savedCopy.labelLabel')}
        />
        <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>
          {t('datasets.savedCopy.labelHint', { name: `${dataset.name} @${trimmed || '…'}` })}
        </Typography.Text>
      </div>
    </Modal>
  );
}

/** The band on a saved copy: what it froze, at which version, when; not current. */
export function FrozenCopyBand({ dataset }: Readonly<{ dataset: Dataset }>) {
  const { t } = useTranslation();
  const from = dataset.savedFrom;
  const original = useDatasetQuery(from?.datasetId);
  if (!from) return null;
  const gone = original.error instanceof ApiErrorThrown && original.error.status === 404;
  const fmt = (iso: string) => new Date(iso).toLocaleString(i18n.language);
  const base = {
    name: from.datasetName,
    version: from.dataVersion,
    rowsAt: fmt(from.refreshedAt),
    savedAt: fmt(from.savedAt),
    label: from.label,
  };
  const text = dataset.lineage
    ? t('datasets.savedCopy.bandPublished', { ...base, run: dataset.lineage.runNumber })
    : t('datasets.savedCopy.band', base);
  return (
    <Alert
      type="info"
      showIcon
      data-component="FrozenCopyBand"
      style={{ marginBottom: 12 }}
      title={text}
      description={
        gone ? (
          <Typography.Text type="secondary">{t('datasets.savedCopy.originalGone')}</Typography.Text>
        ) : (
          <Link to={`/data-management/datasets/${from.datasetId}`}>{t('datasets.savedCopy.openOriginal')}</Link>
        )
      }
    />
  );
}
