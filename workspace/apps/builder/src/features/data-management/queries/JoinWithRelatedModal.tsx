// JoinWithRelatedModal (R71) — the MINIMAL create surface for join execution.
//
// Opened from the [Join with related dataset] action on the dataset detail
// page. Lists the dataset's VALID relationships (the governed edges that
// involve it), lets the user pick one + name it, and persists a joined Query
// (definition.join referencing the rel_). This is intentionally minimal — a
// single Select + a name field; the rich interactive multi-source builder
// (visual cross-source predicate construction, multiple joins) is R72.

import { Alert, Input, Modal, Select, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { NAME_LENGTHS } from '@/_generated/constants';
import { ApiErrorThrown } from '@/features/data-management/_shared/types';
import { useRelationshipsQuery } from '@/features/data-management/relationships/hooks';
import { useCreateQueryMutation } from './hooks';

export type JoinWithRelatedModalProps = Readonly<{
  open: boolean;
  datasetId: string;
  datasetName: string;
  workspaceId: string;
  onClose: () => void;
}>;

export function JoinWithRelatedModal({
  open,
  datasetId,
  datasetName,
  workspaceId,
  onClose,
}: JoinWithRelatedModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const relationshipsQuery = useRelationshipsQuery(open ? workspaceId : undefined);
  const createMutation = useCreateQueryMutation();

  // Valid edges that involve this dataset (either side). A stale edge can't be
  // joined (the BE would block it), so it isn't offered.
  const joinable = useMemo(
    () =>
      (relationshipsQuery.data ?? []).filter(
        (r) => r.status === 'valid' && (r.leftDatasetId === datasetId || r.rightDatasetId === datasetId),
      ),
    [relationshipsQuery.data, datasetId],
  );

  const [relId, setRelId] = useState<string | undefined>(undefined);
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) {
      createMutation.reset();
      setRelId(joinable[0]?.id);
      setName('');
    }
    // Only re-seed when the modal (re)opens or the joinable set first resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, joinable.length]);

  const selected = joinable.find((r) => r.id === relId);
  const trimmed = name.trim();
  const canSave = Boolean(selected) && trimmed.length > 0 && !createMutation.isPending;
  const nameTaken = createMutation.error instanceof ApiErrorThrown && createMutation.error.body.code === 'name_taken';

  const optionLabel = (r: (typeof joinable)[number]) =>
    `${r.leftColumn} ↔ ${r.rightColumn} · ${t(`relationships.cardinality.${r.cardinality}`)}`;

  const submit = () => {
    if (!selected || !canSave) return;
    createMutation.mutate(
      {
        workspaceId,
        body: {
          name: trimmed,
          // The LEFT dataset of the edge is the join's driving source.
          datasetId: selected.leftDatasetId,
          definition: { q: null, filters: [], advanced: [], join: { relationshipId: selected.id, type: 'inner' } },
        },
      },
      {
        onSuccess: (created) => {
          onClose();
          navigate(`/data-management/queries/${created.id}`);
        },
      },
    );
  };

  return (
    <Modal
      open={open}
      title={t('queries.join.title')}
      okText={t('queries.join.action')}
      cancelText={t('common.cancel')}
      onOk={submit}
      okButtonProps={{ disabled: !canSave }}
      onCancel={onClose}
      confirmLoading={createMutation.isPending}
      data-component="JoinWithRelatedModal"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {t('queries.join.intro', { dataset: datasetName })}
        </Typography.Text>

        <div>
          <Typography.Text strong style={{ display: 'block', marginBottom: 4 }} id="join-rel-label">
            {t('queries.join.relationshipLabel')}
          </Typography.Text>
          <Select
            value={relId}
            onChange={setRelId}
            style={{ width: '100%' }}
            aria-labelledby="join-rel-label"
            placeholder={t('queries.join.relationshipPlaceholder')}
            options={joinable.map((r) => ({ value: r.id, label: optionLabel(r) }))}
            data-component="JoinRelationshipSelect"
          />
        </div>

        <div>
          <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>
            {t('queries.join.nameLabel')}
          </Typography.Text>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value ?? '')}
            onPressEnter={submit}
            maxLength={NAME_LENGTHS.QUERY_MAX}
            showCount
            status={nameTaken ? 'error' : undefined}
            placeholder={t('queries.join.namePlaceholder')}
            data-component="JoinQueryNameInput"
          />
          {nameTaken ? (
            <Typography.Text type="danger" style={{ fontSize: 12 }} data-component="JoinQueryNameTaken">
              {t('queries.save.nameTaken')}
            </Typography.Text>
          ) : null}
        </div>

        {createMutation.error && !nameTaken ? (
          <Alert
            type="error"
            showIcon
            title={t('queries.join.failed')}
            description={createMutation.error.message}
            data-component="JoinQueryError"
          />
        ) : null}
      </div>
    </Modal>
  );
}
