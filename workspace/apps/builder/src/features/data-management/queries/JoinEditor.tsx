// JoinEditor (R72) → chain editor (R73) — the in-place, EDITABLE join control
// for the query construction surface.
//
// R72 edited a SINGLE edge in place. R73 generalizes it to an ordered, LINEAR
// chain: `joins[0]` extends from the query's source dataset, each subsequent hop
// from the previous hop's RIGHT (tail) dataset. A length-≤1 chain keeps R72's
// exact single-edit affordance (an editable <Select> + Clear) so the single-join
// case — and its tests — are unchanged; a multi-hop chain renders its hops as
// read rows with a [Remove] on the LAST hop (the only removable position in a
// linear path) and a "[+ Add a join]" that offers only edges driving from the
// chain's tail (and never revisiting a dataset already in the chain). When the
// tail has no eligible edge, the add control is disabled with a guiding tooltip —
// no dead-end empty <Select> (multi-join.md § Behaviour). Scope (R73 J-1′): a
// strict linear path; the free-form source-graph canvas is R74.

import { Button, Select, Tooltip, Typography } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useRelationshipsQuery } from '@/features/data-management/relationships/hooks';
import type { Relationship } from '@/features/data-management/relationships/types';
import type { JoinStep } from './types';

export type JoinEditorProps = Readonly<{
  /** The query's source (LEFT/driving) dataset — the start of the chain. */
  datasetId: string;
  workspaceId: string;
  /** The working-copy chain (ordered hops); empty when single-source. */
  joins: readonly JoinStep[];
  /** Set/clear the FIRST hop in place (the R72 single-edge affordance). */
  onSetJoin: (relationshipId: string | undefined) => void;
  /** Append a hop extending from the chain's current tail dataset. */
  onAddJoin: (relationshipId: string) => void;
  /** Remove the last hop (the only removable position in a linear chain). */
  onRemoveLast: () => void;
}>;

export function JoinEditor({ datasetId, workspaceId, joins, onSetJoin, onAddJoin, onRemoveLast }: JoinEditorProps) {
  const { t } = useTranslation();
  const relationshipsQuery = useRelationshipsQuery(workspaceId);
  const rels = useMemo(() => relationshipsQuery.data ?? [], [relationshipsQuery.data]);
  const relById = useMemo(() => new Map(rels.map((r) => [r.id, r])), [rels]);

  const optionLabel = (r: Relationship) =>
    `${r.leftColumn} ↔ ${r.rightColumn} · ${t(`relationships.cardinality.${r.cardinality}`)}`;

  // Valid edges that drive FROM a given dataset (the left/driving source).
  const eligibleFrom = (dsId: string) => rels.filter((r) => r.status === 'valid' && r.leftDatasetId === dsId);

  // The datasets already in the chain (source + each hop's right) — the tail is
  // the last; we never revisit a dataset, keeping the path linear + acyclic.
  const chainDatasets = useMemo(() => {
    const ids = [datasetId];
    for (const hop of joins) {
      const right = relById.get(hop.relationshipId)?.rightDatasetId;
      if (right) ids.push(right);
    }
    return ids;
  }, [datasetId, joins, relById]);
  const tail = chainDatasets[chainDatasets.length - 1];

  const addEligible = useMemo(
    () => eligibleFrom(tail).filter((r) => !chainDatasets.includes(r.rightDatasetId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rels, tail, chainDatasets],
  );

  const single = joins.length <= 1; // R72 single-edit affordance
  const firstEligible = eligibleFrom(datasetId);
  const firstNone = firstEligible.length === 0;

  return (
    <div data-component="JoinEditor" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Typography.Text strong style={{ fontSize: 12 }} id="builder-join-label">
        {t(joins.length >= 2 ? 'queries.builder.joinsLabel' : 'queries.builder.joinLabel')}
      </Typography.Text>

      {single ? (
        // ── Single-edge affordance (R72, unchanged): editable Select + Clear ──
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Select
            value={joins[0]?.relationshipId}
            onChange={(v) => onSetJoin(v)}
            style={{ flex: 1, minWidth: 0 }}
            aria-labelledby="builder-join-label"
            placeholder={t('queries.builder.joinPlaceholder')}
            disabled={firstNone && joins.length === 0}
            options={firstEligible.map((r) => ({ value: r.id, label: optionLabel(r) }))}
            data-component="BuilderJoinSelect"
          />
          {joins[0] ? (
            <Button onClick={() => onSetJoin(undefined)} data-component="BuilderClearJoin">
              {t('queries.builder.clearJoin')}
            </Button>
          ) : null}
        </div>
      ) : (
        // ── Multi-hop chain: hops as read rows, [Remove] on the last ──────────
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {joins.map((hop, i) => {
            const r = relById.get(hop.relationshipId);
            const isLast = i === joins.length - 1;
            return (
              <div
                key={hop.relationshipId}
                data-component="BuilderHopRow"
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <Typography.Text style={{ flex: 1, minWidth: 0 }}>
                  ⋈ {r ? optionLabel(r) : hop.relationshipId}
                </Typography.Text>
                {isLast ? (
                  <Button size="small" onClick={onRemoveLast} data-component="BuilderRemoveHop">
                    {t('queries.builder.removeJoin')}
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add a hop, extending from the tail (R73) — shown once a chain exists ── */}
      {joins.length >= 1 ? (
        addEligible.length > 0 ? (
          <Select
            value={undefined}
            onChange={(v?: string) => v && onAddJoin(v)}
            style={{ minWidth: 0 }}
            placeholder={t('queries.builder.addJoin')}
            aria-label={t('queries.builder.addJoin')}
            options={addEligible.map((r) => ({ value: r.id, label: optionLabel(r) }))}
            data-component="BuilderAddJoin"
          />
        ) : (
          <Tooltip title={t('queries.builder.addJoinNone')}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }} data-component="BuilderAddJoinNone">
              {t('queries.builder.addJoinNone')}
            </Typography.Text>
          </Tooltip>
        )
      ) : null}

      {firstNone && joins.length === 0 ? (
        <Typography.Text type="secondary" style={{ fontSize: 12 }} data-component="BuilderJoinNone">
          {t('queries.builder.joinNone')}
        </Typography.Text>
      ) : null}
    </div>
  );
}
