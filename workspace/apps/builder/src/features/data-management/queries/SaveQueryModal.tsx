// SaveQueryModal (R69) — names + persists the current dataset-detail
// predicate state as a Query. Opened from the gated [+ Save as Query] action
// on the dataset detail page. Predicate capture happens in the parent (it
// owns the live filters/advanced/q); this modal only collects the name and
// shows a read-only summary of what's being captured.

import { Alert, Input, Modal, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { NAME_LENGTHS } from '@/_generated/constants';
import { ApiErrorThrown } from '@/features/data-management/_shared/types';

export type SaveQueryModalProps = Readonly<{
  open: boolean;
  /** Pre-filled name suggestion (derived from the active predicates). */
  suggestedName: string;
  sourceDatasetName: string;
  workspaceName: string | undefined;
  /** Counts for the "Captures" summary line. */
  filterCount: number;
  advancedCount: number;
  hasSearch: boolean;
  isPending: boolean;
  error: Error | null;
  onSubmit: (name: string) => void;
  onClose: () => void;
}>;

export function SaveQueryModal({
  open,
  suggestedName,
  sourceDatasetName,
  workspaceName,
  filterCount,
  advancedCount,
  hasSearch,
  isPending,
  error,
  onSubmit,
  onClose,
}: SaveQueryModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(suggestedName);

  // Re-seed the suggestion each time the modal (re)opens.
  useEffect(() => {
    if (open) setName(suggestedName);
  }, [open, suggestedName]);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && !isPending;
  const nameTaken = error instanceof ApiErrorThrown && error.body.code === 'name_taken';

  const capturesParts: string[] = [];
  if (filterCount > 0) capturesParts.push(t('queries.save.captureFilters', { count: filterCount }));
  if (advancedCount > 0) capturesParts.push(t('queries.save.captureAdvanced', { count: advancedCount }));
  if (hasSearch) capturesParts.push(t('queries.save.captureSearch'));

  return (
    <Modal
      open={open}
      title={t('queries.save.title')}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      onOk={() => canSave && onSubmit(trimmed)}
      okButtonProps={{ disabled: !canSave }}
      onCancel={onClose}
      confirmLoading={isPending}
      data-component="SaveQueryModal"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
        <div>
          <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>
            {t('queries.save.nameLabel')}
          </Typography.Text>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value ?? '')}
            onPressEnter={() => canSave && onSubmit(trimmed)}
            maxLength={NAME_LENGTHS.QUERY_MAX}
            showCount
            autoFocus
            status={nameTaken ? 'error' : undefined}
            placeholder={t('queries.save.namePlaceholder')}
            data-component="SaveQueryNameInput"
          />
          {nameTaken ? (
            <Typography.Text type="danger" style={{ fontSize: 12 }} data-component="SaveQueryNameTaken">
              {t('queries.save.nameTaken')}
            </Typography.Text>
          ) : null}
        </div>

        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {t('queries.save.source', {
            dataset: sourceDatasetName,
            workspace: workspaceName ?? '—',
          })}
        </Typography.Text>
        {capturesParts.length > 0 ? (
          <Typography.Text type="secondary" style={{ fontSize: 13 }} data-component="SaveQueryCaptures">
            {t('queries.save.captures', { parts: capturesParts.join(' · ') })}
          </Typography.Text>
        ) : null}

        {error && !nameTaken ? (
          <Alert
            type="error"
            showIcon
            title={t('queries.save.failed')}
            description={error.message}
            data-component="SaveQueryError"
          />
        ) : null}
      </div>
    </Modal>
  );
}
