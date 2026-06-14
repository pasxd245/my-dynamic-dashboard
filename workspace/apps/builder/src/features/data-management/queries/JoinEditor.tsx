// JoinEditor (R72) → chain editor (R73) → join-graph editor (R74) — the in-place,
// EDITABLE join control for the query construction surface.
//
// R72 edited a SINGLE edge in place. R73 generalized it to an ordered, LINEAR
// chain (each hop extends from the previous hop's RIGHT — tail — dataset). R74
// relaxes the topology to a connected acyclic TREE: a hop may extend from ANY
// dataset already in the graph (not just the tail), so one dataset can be joined
// to two or more others (a star). The model is unchanged — `joins: JoinStep[]`
// already carries a tree because each hop names its own left via its relationship.
//
// A length-≤1 chain keeps R72's exact single-edit affordance (an editable
// <Select> + Clear). A multi-hop graph renders its hops as read rows; each LEAF
// hop (one whose right dataset is no other hop's left) carries an enabled
// [Remove] — removing a non-leaf would orphan its descendants, so it is disabled
// with a guiding tooltip. The "[+ Add a join]" affordance offers every edge that
// drives from an in-graph dataset to a not-yet-joined one; when 2+ distinct
// sources can be extended, a LEFT-SOURCE <Select> ("Join from") gates the choice
// (multi-join.md § Behaviour, R74). Scope (R74 J-1′): a tree, edited as a hop
// list; the free-form node-graph canvas is R75.

import { Button, Select, Tooltip, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDatasetsQuery } from '@/features/data-management/datasets/hooks';
import { useRelationshipsQuery } from '@/features/data-management/relationships/hooks';
import type { Relationship } from '@/features/data-management/relationships/types';
import type { JoinStep } from './types';

export type JoinEditorProps = Readonly<{
  /** The query's source (LEFT/driving) dataset — the root of the graph. */
  datasetId: string;
  workspaceId: string;
  /** The working-copy hops (ordered, topological); empty when single-source. */
  joins: readonly JoinStep[];
  /** Set/clear the FIRST hop in place (the R72 single-edge affordance). */
  onSetJoin: (relationshipId: string | undefined) => void;
  /** Append a hop extending from any in-graph dataset (R74). */
  onAddJoin: (relationshipId: string) => void;
  /** Remove a LEAF hop by its relationship id (R74 — any leaf, not just last). */
  onRemoveHop: (relationshipId: string) => void;
}>;

export function JoinEditor({ datasetId, workspaceId, joins, onSetJoin, onAddJoin, onRemoveHop }: JoinEditorProps) {
  const { t } = useTranslation();
  const relationshipsQuery = useRelationshipsQuery(workspaceId);
  const rels = useMemo(() => relationshipsQuery.data ?? [], [relationshipsQuery.data]);
  const relById = useMemo(() => new Map(rels.map((r) => [r.id, r])), [rels]);
  const datasetsQuery = useDatasetsQuery(workspaceId);
  const dsNameById = useMemo(
    () => new Map((datasetsQuery.data ?? []).map((d) => [d.id, d.name])),
    [datasetsQuery.data],
  );

  const optionLabel = (r: Relationship) =>
    `${r.leftColumn} ↔ ${r.rightColumn} · ${t(`relationships.cardinality.${r.cardinality}`)}`;
  const dsName = (id: string) => dsNameById.get(id) ?? id;

  // Valid edges that drive FROM a given dataset (the left/driving source).
  const eligibleFrom = (dsId: string) => rels.filter((r) => r.status === 'valid' && r.leftDatasetId === dsId);

  // The datasets already in the graph (source + each hop's right). R74: a hop may
  // extend from ANY of these, not only the last (tail) — so the shape is a tree.
  const graphDatasets = useMemo(() => {
    const ids = [datasetId];
    for (const hop of joins) {
      const right = relById.get(hop.relationshipId)?.rightDatasetId;
      if (right) ids.push(right);
    }
    return ids;
  }, [datasetId, joins, relById]);

  // Every addable edge: valid, drives FROM an in-graph dataset (connected), and
  // its right is NOT yet in the graph (acyclic — keeps the graph a tree).
  const addEligible = useMemo(
    () => rels.filter((r) => r.status === 'valid' && graphDatasets.includes(r.leftDatasetId) && !graphDatasets.includes(r.rightDatasetId)),
    [rels, graphDatasets],
  );
  // The distinct in-graph sources that can be extended (the left-source choices).
  const addSources = useMemo(
    () => graphDatasets.filter((id) => addEligible.some((r) => r.leftDatasetId === id)),
    [graphDatasets, addEligible],
  );
  // When only one source can be extended, gate on it implicitly; with 2+, the
  // user picks the left source first (the R74 branch choice).
  const [pickedSource, setPickedSource] = useState<string | undefined>();
  const activeSource = addSources.length === 1 ? addSources[0] : pickedSource;
  const addFromActive = activeSource ? addEligible.filter((r) => r.leftDatasetId === activeSource) : [];

  // A hop is a LEAF when its right dataset is no other hop's left (R74). Only
  // leaves are removable — removing a non-leaf would orphan its descendants.
  const leftDatasetIdsInUse = useMemo(() => {
    const set = new Set<string>();
    for (const hop of joins) {
      const r = relById.get(hop.relationshipId);
      if (r) set.add(r.leftDatasetId);
    }
    return set;
  }, [joins, relById]);
  const isLeaf = (hop: JoinStep) => {
    const right = relById.get(hop.relationshipId)?.rightDatasetId;
    return right ? !leftDatasetIdsInUse.has(right) : true;
  };

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
        // ── Multi-hop graph: hops as read rows, [Remove] on each leaf ──────────
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {joins.map((hop) => {
            const r = relById.get(hop.relationshipId);
            const leaf = isLeaf(hop);
            const fromName = r ? dsName(r.leftDatasetId) : '';
            return (
              <div
                key={hop.relationshipId}
                data-component="BuilderHopRow"
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <Typography.Text style={{ flex: 1, minWidth: 0 }}>
                  {fromName ? `${fromName} ` : ''}⋈ {r ? optionLabel(r) : hop.relationshipId}
                </Typography.Text>
                {/* Default-size button (matches the header Cancel/Save) so short
                    labels (Bỏ/Lưu) stay a comfortable target (R73 fix). A non-leaf
                    is disabled with a guiding tooltip — removing it would orphan
                    its descendants (R74). */}
                <Tooltip title={leaf ? '' : t('queries.builder.removeJoinBlocked')}>
                  <Button
                    onClick={() => onRemoveHop(hop.relationshipId)}
                    disabled={!leaf}
                    data-component="BuilderRemoveHop"
                    style={{ flexShrink: 0 }}
                  >
                    {t('queries.builder.removeJoin')}
                  </Button>
                </Tooltip>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add a hop, extending from any in-graph source (R74) ─────────────── */}
      {joins.length >= 1 ? (
        addEligible.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {addSources.length >= 2 ? (
              // The left-source choice: which in-graph dataset to branch from.
              <Select
                value={activeSource}
                onChange={(v?: string) => setPickedSource(v)}
                style={{ flex: '0 0 40%', minWidth: 0 }}
                aria-label={t('queries.builder.addJoinSource')}
                placeholder={t('queries.builder.addJoinSourcePlaceholder')}
                options={addSources.map((id) => ({ value: id, label: dsName(id) }))}
                data-component="BuilderAddJoinSource"
              />
            ) : null}
            <Select
              value={undefined}
              onChange={(v?: string) => v && onAddJoin(v)}
              disabled={addFromActive.length === 0}
              style={{ flex: 1, minWidth: 0 }}
              placeholder={t('queries.builder.addJoin')}
              aria-label={t('queries.builder.addJoin')}
              options={addFromActive.map((r) => ({ value: r.id, label: optionLabel(r) }))}
              data-component="BuilderAddJoin"
            />
          </div>
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
