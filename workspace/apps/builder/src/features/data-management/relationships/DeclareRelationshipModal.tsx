// DeclareRelationshipModal (R70) — declare a governed edge between two of the
// workspace's datasets. Pick left dataset/column ↔ right dataset/column +
// cardinality; a live compatibility line gates the Declare action. The server
// re-validates independently — the client check is advisory.

import { CheckCircleFilled, WarningFilled } from '@ant-design/icons';
import { Alert, Modal, Segmented, Select, Typography, theme } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiErrorThrown } from '@/features/data-management/_shared/types';
import type { Column, Dataset, Dtype } from '@/features/data-management/datasets/types';
import type { Cardinality, CreateRelationshipRequest } from './types';

/** J-4 — join-compatible iff equal dtypes, with integer/float numeric pair. */
export function dtypeCompatible(a: Dtype, b: Dtype): boolean {
  if (a === b) return true;
  const numeric = (d: Dtype) => d === 'integer' || d === 'float';
  return numeric(a) && numeric(b);
}

const CARDINALITIES: readonly Cardinality[] = ['one_to_one', 'one_to_many', 'many_to_many'];

export type DeclareRelationshipModalProps = Readonly<{
  open: boolean;
  /** The workspace's datasets (with columns) — the two sides to connect. */
  datasets: readonly Dataset[];
  isPending: boolean;
  error: Error | null;
  onSubmit: (body: CreateRelationshipRequest) => void;
  onClose: () => void;
}>;

function columnsOf(datasets: readonly Dataset[], id: string | undefined): readonly Column[] {
  return datasets.find((d) => d.id === id)?.columns ?? [];
}

export function DeclareRelationshipModal({
  open,
  datasets,
  isPending,
  error,
  onSubmit,
  onClose,
}: DeclareRelationshipModalProps) {
  const { t } = useTranslation();
  const { token } = theme.useToken();

  const [leftDatasetId, setLeftDatasetId] = useState<string | undefined>();
  const [leftColumn, setLeftColumn] = useState<string | undefined>();
  const [rightDatasetId, setRightDatasetId] = useState<string | undefined>();
  const [rightColumn, setRightColumn] = useState<string | undefined>();
  const [cardinality, setCardinality] = useState<Cardinality>('one_to_many');

  // Reset each time the modal (re)opens.
  useEffect(() => {
    if (open) {
      setLeftDatasetId(undefined);
      setLeftColumn(undefined);
      setRightDatasetId(undefined);
      setRightColumn(undefined);
      setCardinality('one_to_many');
    }
  }, [open]);

  const leftCols = useMemo(() => columnsOf(datasets, leftDatasetId), [datasets, leftDatasetId]);
  const rightCols = useMemo(() => columnsOf(datasets, rightDatasetId), [datasets, rightDatasetId]);
  const leftDtype = leftCols.find((c) => c.name === leftColumn)?.dtype;
  const rightDtype = rightCols.find((c) => c.name === rightColumn)?.dtype;

  const bothChosen = Boolean(leftDatasetId && leftColumn && rightDatasetId && rightColumn);
  const sameDataset = Boolean(leftDatasetId && leftDatasetId === rightDatasetId);
  const compatible =
    bothChosen && !sameDataset && !!leftDtype && !!rightDtype && dtypeCompatible(leftDtype, rightDtype);

  let checkLine: { ok: boolean; text: string } | null = null;
  if (sameDataset) {
    checkLine = { ok: false, text: t('relationships.declare.sameDataset') };
  } else if (bothChosen && leftDtype && rightDtype) {
    checkLine = compatible
      ? { ok: true, text: t('relationships.declare.compatible', { left: leftDtype, right: rightDtype }) }
      : { ok: false, text: t('relationships.declare.incompatible', { left: leftDtype, right: rightDtype }) };
  }

  const canDeclare = compatible && !isPending;
  const duplicate = error instanceof ApiErrorThrown && error.body.code === 'relationship_exists';

  const datasetOptions = datasets.map((d) => ({ value: d.id, label: d.name }));
  const colOptions = (cols: readonly Column[]) =>
    cols.map((c) => ({ value: c.name, label: `${c.name} (${c.dtype})` }));

  const submit = () => {
    if (!canDeclare || !leftDatasetId || !leftColumn || !rightDatasetId || !rightColumn) return;
    onSubmit({ leftDatasetId, leftColumn, rightDatasetId, rightColumn, cardinality });
  };

  return (
    <Modal
      open={open}
      title={t('relationships.declare.title')}
      okText={t('relationships.declare.ok')}
      cancelText={t('common.cancel')}
      onOk={submit}
      okButtonProps={{ disabled: !canDeclare }}
      onCancel={onClose}
      confirmLoading={isPending}
      destroyOnHidden
      data-component="DeclareRelationshipModal"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
        <FieldRow label={t('relationships.declare.leftDataset')}>
          <Select
            value={leftDatasetId}
            onChange={(v) => {
              setLeftDatasetId(v);
              setLeftColumn(undefined);
            }}
            options={datasetOptions}
            placeholder={t('relationships.declare.pickDataset')}
            style={{ width: '100%' }}
            data-component="DeclareLeftDataset"
          />
        </FieldRow>
        <FieldRow label={t('relationships.declare.leftColumn')}>
          <Select
            value={leftColumn}
            onChange={setLeftColumn}
            options={colOptions(leftCols)}
            disabled={!leftDatasetId}
            placeholder={t('relationships.declare.pickColumn')}
            style={{ width: '100%' }}
            data-component="DeclareLeftColumn"
          />
        </FieldRow>
        <FieldRow label={t('relationships.declare.rightDataset')}>
          <Select
            value={rightDatasetId}
            onChange={(v) => {
              setRightDatasetId(v);
              setRightColumn(undefined);
            }}
            options={datasetOptions}
            placeholder={t('relationships.declare.pickDataset')}
            style={{ width: '100%' }}
            data-component="DeclareRightDataset"
          />
        </FieldRow>
        <FieldRow label={t('relationships.declare.rightColumn')}>
          <Select
            value={rightColumn}
            onChange={setRightColumn}
            options={colOptions(rightCols)}
            disabled={!rightDatasetId}
            placeholder={t('relationships.declare.pickColumn')}
            style={{ width: '100%' }}
            data-component="DeclareRightColumn"
          />
        </FieldRow>
        <FieldRow label={t('relationships.declare.cardinality')}>
          <Segmented
            value={cardinality}
            onChange={(v) => setCardinality(v as Cardinality)}
            options={CARDINALITIES.map((c) => ({
              value: c,
              label: t(`relationships.cardinality.${c}`),
            }))}
            data-component="DeclareCardinality"
          />
        </FieldRow>

        {checkLine ? (
          <div
            role="status"
            aria-live="polite"
            data-component="DeclareCompatibility"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: checkLine.ok ? token.colorSuccess : token.colorWarning,
            }}
          >
            {checkLine.ok ? <CheckCircleFilled /> : <WarningFilled />}
            <Typography.Text style={{ color: 'inherit' }}>{checkLine.text}</Typography.Text>
          </div>
        ) : null}

        {duplicate ? (
          <Typography.Text type="danger" data-component="DeclareDuplicate">
            {t('relationships.declare.duplicate')}
          </Typography.Text>
        ) : null}
        {error && !duplicate ? (
          <Alert
            type="error"
            showIcon
            title={t('relationships.declare.failed')}
            description={error.message}
            data-component="DeclareError"
          />
        ) : null}
      </div>
    </Modal>
  );
}

function FieldRow({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div>
      <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>
        {label}
      </Typography.Text>
      {children}
    </div>
  );
}
