// JoinEditor (R72) — the in-place, EDITABLE join control for the query
// construction surface.
//
// R71's JoinSummary was read-only; this is its editable twin. It REUSES the
// same valid-relationships `<Select>` shape as JoinWithRelatedModal (the
// create surface), now MUTATING a working-copy definition rather than creating
// a query. Scope (R72 J-1′): a SINGLE edge, and only edges whose LEFT/driving
// dataset is the query's source — swapping the driving table would change the
// Query's `datasetId` (not its definition), which is out of this round's
// definition-only edit. Clearing the join reverts to a single-source query.

import { Button, Select, Typography } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useRelationshipsQuery } from '@/features/data-management/relationships/hooks';

export type JoinEditorProps = Readonly<{
  /** The query's source (LEFT/driving) dataset. Join options are edges that
   *  keep this as the left source, so editing stays definition-only. */
  datasetId: string;
  workspaceId: string;
  /** The current join edge id (from the working-copy definition), or undefined
   *  when the working copy is single-source. */
  value: string | undefined;
  /** Set the join to an edge id, or clear it (undefined → single-source). */
  onChange: (relationshipId: string | undefined) => void;
}>;

export function JoinEditor({ datasetId, workspaceId, value, onChange }: JoinEditorProps) {
  const { t } = useTranslation();
  const relationshipsQuery = useRelationshipsQuery(workspaceId);

  // Valid edges that drive FROM this dataset (left source). A stale edge can't
  // be joined (the BE blocks it), so it isn't offered — same rule as the
  // create modal, narrowed to left-only to keep `datasetId` stable.
  const joinable = useMemo(
    () => (relationshipsQuery.data ?? []).filter((r) => r.status === 'valid' && r.leftDatasetId === datasetId),
    [relationshipsQuery.data, datasetId],
  );

  const optionLabel = (r: (typeof joinable)[number]) =>
    `${r.leftColumn} ↔ ${r.rightColumn} · ${t(`relationships.cardinality.${r.cardinality}`)}`;

  const hasNone = joinable.length === 0;

  return (
    <div data-component="JoinEditor" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Typography.Text strong style={{ fontSize: 12 }} id="builder-join-label">
        {t('queries.builder.joinLabel')}
      </Typography.Text>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Select
          value={value}
          onChange={(v) => onChange(v)}
          style={{ flex: 1, minWidth: 0 }}
          aria-labelledby="builder-join-label"
          placeholder={t('queries.builder.joinPlaceholder')}
          disabled={hasNone && !value}
          options={joinable.map((r) => ({ value: r.id, label: optionLabel(r) }))}
          data-component="BuilderJoinSelect"
        />
        {value ? (
          <Button onClick={() => onChange(undefined)} data-component="BuilderClearJoin">
            {t('queries.builder.clearJoin')}
          </Button>
        ) : null}
      </div>
      {hasNone && !value ? (
        <Typography.Text type="secondary" style={{ fontSize: 12 }} data-component="BuilderJoinNone">
          {t('queries.builder.joinNone')}
        </Typography.Text>
      ) : null}
    </div>
  );
}
