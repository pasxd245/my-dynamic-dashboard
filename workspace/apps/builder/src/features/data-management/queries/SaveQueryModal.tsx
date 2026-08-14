// SaveQueryModal (R69) — names + persists the current dataset-detail
// predicate state as a Query. Opened from the gated [+ Save as Query] action
// on the dataset detail page. Predicate capture happens in the parent (it
// owns the live filters/advanced/q); this modal only collects the name and
// shows a read-only summary of what's being captured.
//
// R166 — the product's SECOND create verb, [Duplicate], routes through this
// same modal (queries.md § Duplicate): one create rhythm, never a parallel
// name-capture. Duplicate differs in exactly two presentational ways, both
// optional props here: it names its object in the TITLE (`Duplicate {{name}}`
// — the third display context, settled at the R166 D gate) and it SELECTS the
// pre-filled `{{name}} (copy)` so accepting it is one keystroke and renaming
// needs no clearing gesture.

import { Alert, Input, Modal, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import type { InputRef } from 'antd';
import { useTranslation } from 'react-i18next';

import { NAME_LENGTHS } from '@/_generated/constants';
import { ApiErrorThrown } from '@/features/data-management/_shared/types';

export type SaveQueryModalProps = Readonly<{
  open: boolean;
  /** R166 — the modal title. Omitted = "Save filters as Query" (the R69 verb);
   *  Duplicate passes `Duplicate {{name}}`, which names the object it acts on. */
  title?: string;
  /** Pre-filled name suggestion (derived from the active predicates). */
  suggestedName: string;
  /** R166 — select the pre-filled name on open (Duplicate: `{{name}} (copy)` is a
   *  ready-to-accept default, so overtyping it must not need a clearing gesture). */
  selectNameOnOpen?: boolean;
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
  title,
  suggestedName,
  selectNameOnOpen = false,
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
  const nameRef = useRef<InputRef>(null);

  // Re-seed the suggestion each time the modal (re)opens.
  useEffect(() => {
    if (!open) return;
    setName(suggestedName);
    // R166 — `autoFocus` alone puts the caret at the end; Duplicate wants the
    // default SELECTED. Deferred a tick so it runs after AntD's own mount focus.
    if (selectNameOnOpen) {
      const id = window.setTimeout(() => nameRef.current?.select(), 0);
      return () => window.clearTimeout(id);
    }
  }, [open, suggestedName, selectNameOnOpen]);

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
      title={title ?? t('queries.save.title')}
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
            ref={nameRef}
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
