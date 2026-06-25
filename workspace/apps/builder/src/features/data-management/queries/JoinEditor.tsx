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
import { useQueriesQuery } from './hooks';
import { addEligibleRels, graphDatasetIds, isLeafHop } from './joinGraph';
import type { JoinStep, JoinType, QueryRelationship } from './types';

// R75 — the per-hop join types (inner default + left/right/full outer).
const JOIN_TYPES: readonly JoinType[] = ['inner', 'left', 'right', 'full'];

export type JoinEditorProps = Readonly<{
  /** The query's source (LEFT/driving) dataset — the root of the graph. */
  datasetId: string;
  workspaceId: string;
  /** R76 (composition, F1) — the driving source id (a `ds_…` dataset or a
   *  `qr_…` saved Query the query is built ON) + its setter, for the "Build on"
   *  picker. The current query is excluded from the Query options (self-base is
   *  the trivial cycle the Backend guard rejects). */
  baseSourceId: string;
  queryId: string;
  onSetBaseSource: (sourceId: string) => void;
  /** R94 (D6) — the base is mutable only in CREATE mode. On an existing query the PUT is
   *  definition-only (the driving source is fixed at create), so in edit mode the picker is
   *  disabled with a hint rather than silently dropping the change on save. */
  baseEditable: boolean;
  /** R88 — the query's OWN relationships (copy-on-pick snapshots); hops resolve
   *  through these by `queryRelId`, not the governed store. */
  relationships: readonly QueryRelationship[];
  /** The working-copy hops (ordered, topological); empty when single-source. */
  joins: readonly JoinStep[];
  /** Set/clear the FIRST hop in place — picks a GOVERNED rel id (copy-on-pick). */
  onSetJoin: (relationshipId: string | undefined) => void;
  /** Append a hop — picks a GOVERNED rel id (copy-on-pick, R88). */
  onAddJoin: (relationshipId: string) => void;
  /** Remove a LEAF hop by its query-owned rel id (R88 — any leaf, not just last). */
  onRemoveHop: (queryRelId: string) => void;
  /** Set a hop's join type, keyed by its query-owned rel id (R88). */
  onSetHopType: (queryRelId: string, type: JoinType) => void;
}>;

export function JoinEditor({
  datasetId,
  workspaceId,
  baseSourceId,
  baseEditable,
  queryId,
  onSetBaseSource,
  relationships,
  joins,
  onSetJoin,
  onAddJoin,
  onRemoveHop,
  onSetHopType,
}: JoinEditorProps) {
  const { t } = useTranslation();
  const relationshipsQuery = useRelationshipsQuery(workspaceId);
  const rels = useMemo(() => relationshipsQuery.data ?? [], [relationshipsQuery.data]);
  // R88 — the GOVERNED workspace rels are the copy-on-pick LIBRARY (add-eligibility
  // is computed over them). HOP DISPLAY resolves through the query's OWN rels.
  const qrelById = useMemo(() => new Map(relationships.map((r) => [r.id, r])), [relationships]);
  const datasetsQuery = useDatasetsQuery(workspaceId);
  const datasets = useMemo(() => datasetsQuery.data ?? [], [datasetsQuery.data]);
  const dsNameById = useMemo(() => new Map(datasets.map((d) => [d.id, d.name])), [datasets]);
  // R76 — the saved Queries in this workspace are also selectable as the base
  // source (a Query is the same readable-table-source kind as a Dataset). The
  // current query is excluded (a query can't be built on itself).
  const queriesQuery = useQueriesQuery(workspaceId);
  const baseQueries = useMemo(
    () => (queriesQuery.data ?? []).filter((q) => q.id !== queryId),
    [queriesQuery.data, queryId],
  );

  // Works for a governed Relationship (the add library) OR a query-owned rel (a
  // hop's display) — both carry the key pair + cardinality.
  const optionLabel = (r: { leftColumn: string; rightColumn: string; cardinality: Relationship['cardinality'] }) =>
    `${r.leftColumn} ↔ ${r.rightColumn} · ${t(`relationships.cardinality.${r.cardinality}`)}`;
  const dsName = (id: string) => dsNameById.get(id) ?? id;

  // Valid edges that drive FROM a given dataset (the left/driving source).
  const eligibleFrom = (dsId: string) => rels.filter((r) => r.status === 'valid' && r.leftDatasetId === dsId);

  // The datasets already in the graph (source + each hop's right). R74: a hop may
  // extend from ANY of these, not only the last (tail) — so the shape is a tree.
  // R87/R88 — shared with the canvas via joinGraph; hops resolve through the
  // query's OWN rels (qrelById).
  const graphDatasets = useMemo(() => graphDatasetIds(datasetId, joins, qrelById), [datasetId, joins, qrelById]);

  // Every addable edge: valid, drives FROM an in-graph dataset (connected), and
  // its right is NOT yet in the graph (acyclic — keeps the graph a tree).
  const addEligible = useMemo(() => addEligibleRels(rels, graphDatasets), [rels, graphDatasets]);
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
  // R87 — shared with the canvas via joinGraph.
  const isLeaf = (hop: JoinStep) => isLeafHop(hop.queryRelId, joins, qrelById);

  const single = joins.length <= 1; // R72 single-edit affordance
  const firstEligible = eligibleFrom(datasetId);
  const firstNone = firstEligible.length === 0;

  // R75 — the per-hop join-type picker (inner default + left/right/full outer).
  const typeSelect = (hop: JoinStep) => (
    <Select<JoinType>
      value={hop.type}
      onChange={(v) => onSetHopType(hop.queryRelId, v)}
      style={{ flexShrink: 0, width: 160 }}
      aria-label={t('queries.builder.joinTypeLabel')}
      options={JOIN_TYPES.map((jt) => ({ value: jt, label: t(`queries.builder.joinType.${jt}`) }))}
      data-component="BuilderHopType"
    />
  );

  return (
    <div data-component="JoinEditor" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* ── Build on: the driving source — a Dataset or a saved Query (R76) ──── */}
      <Typography.Text strong style={{ fontSize: 12 }} id="builder-base-label">
        {t('queries.builder.baseSourceLabel')}
      </Typography.Text>
      {/* R94 (D6) — editable only in CREATE; on an existing query the base is fixed (the PUT
          is definition-only), so disable + hint rather than silently drop the change on save. */}
      <Tooltip title={baseEditable ? '' : t('queries.builder.baseSourceFixedHint')}>
        <Select
          value={baseSourceId || undefined}
          onChange={(v: string) => onSetBaseSource(v)}
          disabled={!baseEditable}
          style={{ width: '100%' }}
          aria-labelledby="builder-base-label"
          placeholder={t('queries.builder.baseSourcePlaceholder')}
          options={[
            {
              label: t('queries.builder.baseSourceDatasets'),
              options: datasets.map((d) => ({ value: d.id, label: d.name })),
            },
            {
              label: t('queries.builder.baseSourceQueries'),
              options: baseQueries.map((q) => ({ value: q.id, label: q.name })),
            },
          ]}
          data-component="BuilderBaseSource"
        />
      </Tooltip>

      <Typography.Text strong style={{ fontSize: 12 }} id="builder-join-label">
        {t(joins.length >= 2 ? 'queries.builder.joinsLabel' : 'queries.builder.joinLabel')}
      </Typography.Text>

      {single ? (
        // ── Single-edge affordance (R72, unchanged): editable Select + Clear ──
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Select
            value={joins[0] ? (qrelById.get(joins[0].queryRelId)?.originRelationshipId ?? undefined) : undefined}
            onChange={(v) => onSetJoin(v)}
            style={{ flex: 1, minWidth: 0 }}
            aria-labelledby="builder-join-label"
            placeholder={t('queries.builder.joinPlaceholder')}
            disabled={firstNone && joins.length === 0}
            options={firstEligible.map((r) => ({ value: r.id, label: optionLabel(r) }))}
            data-component="BuilderJoinSelect"
          />
          {joins[0] ? typeSelect(joins[0]) : null}
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
            const qrel = qrelById.get(hop.queryRelId);
            const leaf = isLeaf(hop);
            const fromName = qrel ? dsName(qrel.leftSourceId) : '';
            return (
              <div
                key={hop.queryRelId}
                data-component="BuilderHopRow"
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <Typography.Text style={{ flex: 1, minWidth: 0 }}>
                  {fromName ? `${fromName} ` : ''}⋈ {qrel ? optionLabel(qrel) : hop.queryRelId}
                </Typography.Text>
                {typeSelect(hop)}
                {/* Default-size button (matches the header Cancel/Save) so short
                    labels (Bỏ/Lưu) stay a comfortable target (R73 fix). A non-leaf
                    is disabled with a guiding tooltip — removing it would orphan
                    its descendants (R74). */}
                <Tooltip title={leaf ? '' : t('queries.builder.removeJoinBlocked')}>
                  <Button
                    onClick={() => onRemoveHop(hop.queryRelId)}
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
