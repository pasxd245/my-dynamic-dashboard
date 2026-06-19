// QueryCanvas (R85 Phase A → R87 Phase B) — the source-graph VIEW + EDITOR of a
// Query's `definition.joins` tree, a view/edit mode of the builder (canvas.md).
//
// It is NOT a new model, route, or noun: it renders exactly the `joins[]` the
// hop-list (`JoinEditor`) edits and edits the SAME working copy via the SAME
// ops. Nodes = the driving `sourceId` + each hop's right dataset; edges = the
// `JoinStep`s, labelled with the key pair + advisory cardinality. The render is
// a hand-rolled SVG (edges) + AntD-styled DOM node cards (R85 Design-gate
// decision — no graph-lib peer dep), positioned by a small deterministic
// depth/row tree-layout with per-node heights (columns make nodes taller).
//
// R87 editing (Phase B — pick-pair, zero-dep). When `onAddJoin`/`onRemoveJoin`
// are supplied the canvas becomes an EDITOR at hop-list parity:
//  • [+ Add a source] stages a not-yet-joined dataset (FE-only; it enters
//    `joins[]` only when a column link is drawn). Disabled with the list's
//    `addJoinNone` tooltip when no eligible relationship remains.
//  • Connect at COLUMN granularity — click a source column → a target column on
//    the staged node (or pick from the <Select> of eligible governed pairs, the
//    keyboard/SR equivalent). This PICKS the existing governed `rel_` whose key
//    pair matches → addJoin. A pair with no governed `rel_` does NOT declare one
//    — it guides to Relationships (schema-authoring, OUT of R87).
//  • A LEAF edge carries a [×] delete → removeJoin; a non-leaf's [×] is disabled
//    with the shipped `removeJoinBlocked` text tooltip (the same leaf rule).
// All eligibility/leaf rules come from joinGraph (shared with the list — no
// fork). The Form tab stays the keyboard/SR-complete equivalent + AT default.

import { Alert, Button, Select, Tag, Tooltip, Typography } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { useDatasetsQuery } from '@/features/data-management/datasets/hooks';
import { useRelationshipsQuery } from '@/features/data-management/relationships/hooks';
import { useQueriesQuery } from './hooks';
import { addEligibleRels, graphDatasetIds, isLeafHop } from './joinGraph';
import type { JoinStep, QueryRelationship } from './types';

// Bounded-small trees (2–4 nodes, canvas.md J-2) → fixed-width node boxes with
// generous inter-column gaps for the edge + its text label.
const NODE_W = 172;
const NODE_MIN_H = 60;
const COL_ROW_H = 22; // a clickable column row inside an (editable) node card
const COLS_TOP = 4; // gap between a node's header and its column list
const COL_GAP = 200;
const ROW_GAP = 28;
const PAD = 8;
// The edge label wraps within the gap (never spills onto a node card).
const EDGE_LABEL_W = COL_GAP - 24;

export type QueryCanvasProps = Readonly<{
  /** The driving (root) DATASET id — `ds_…`. Empty when the base is a composed
   *  `qr_…` (no single root dataset on the wire); then `baseSourceId` is used. */
  datasetId: string;
  /** The driving source id (`ds_…` or `qr_…`) — the root node's identity. */
  baseSourceId: string;
  workspaceId: string;
  /** R88 — the query's OWN relationships (copy-on-pick snapshots); edges resolve
   *  through these by `queryRelId`, not the governed store. */
  relationships: readonly QueryRelationship[];
  /** The working-copy hops (ordered, topological) — the same array the list edits. */
  joins: readonly JoinStep[];
  /** R87 — supplied iff the canvas is an EDITOR (Phase B). Bind to the SAME
   *  `useQueryBuilder` ops the hop list uses; omit for a read-only canvas. `onAddJoin`
   *  takes the picked GOVERNED rel id (copy-on-pick); `onRemoveJoin` takes the
   *  hop's query-owned rel id. */
  onAddJoin?: (relationshipId: string) => void;
  onRemoveJoin?: (queryRelId: string) => void;
}>;

type LaidOutNode = Readonly<{ id: string; col: number; left: number; top: number; height: number }>;
type PickedColumn = Readonly<{ nodeId: string; column: string }>;

/** A small deterministic tree layout: BFS depth from the root = column; nodes
 *  stack by insertion order within a column, spaced by their own heights (so a
 *  taller, column-listing node doesn't overlap its neighbour). Bounded-small, so
 *  a generic graph engine is overkill (R85 Design-gate decision). A `staged`
 *  node (R87, not yet in `joins[]`) is placed in a fresh rightmost column. */
function layout(
  nodeIds: readonly string[],
  parentOf: Map<string, string>,
  heightOf: (id: string) => number,
  staged: string | null,
): { nodes: LaidOutNode[]; width: number; height: number } {
  const depthOf = (id: string): number => {
    let depth = 0;
    let cur = id;
    const seen = new Set<string>();
    let next = parentOf.get(cur);
    while (next !== undefined && !seen.has(cur)) {
      seen.add(cur);
      cur = next;
      next = parentOf.get(cur);
      depth += 1;
    }
    return depth;
  };
  const colOf = new Map(nodeIds.map((id) => [id, depthOf(id)]));
  const maxCol = nodeIds.reduce((m, id) => Math.max(m, colOf.get(id) ?? 0), 0);
  if (staged) colOf.set(staged, maxCol + 1); // a fresh rightmost column
  const order = staged ? [...nodeIds, staged] : nodeIds;

  const topCursor = new Map<number, number>();
  const nodes = order.map((id) => {
    const col = colOf.get(id) ?? 0;
    const top = topCursor.get(col) ?? PAD;
    const height = heightOf(id);
    topCursor.set(col, top + height + ROW_GAP);
    return { id, col, left: PAD + col * (NODE_W + COL_GAP), top, height };
  });
  const width = nodes.reduce((m, n) => Math.max(m, n.left + NODE_W), 0) + PAD;
  const height = nodes.reduce((m, n) => Math.max(m, n.top + n.height), NODE_MIN_H) + PAD;
  return { nodes, width, height };
}

export function QueryCanvas({
  datasetId,
  baseSourceId,
  workspaceId,
  relationships,
  joins,
  onAddJoin,
  onRemoveJoin,
}: QueryCanvasProps) {
  const { t } = useTranslation();
  const editable = Boolean(onAddJoin && onRemoveJoin);

  // R88 — EDGES resolve through the query's OWN relationships (qrelById). The
  // GOVERNED workspace rels are only the copy-on-pick LIBRARY (add-eligibility).
  const qrelById = useMemo(() => new Map(relationships.map((r) => [r.id, r])), [relationships]);
  const relationshipsQuery = useRelationshipsQuery(workspaceId);
  const rels = useMemo(() => relationshipsQuery.data ?? [], [relationshipsQuery.data]);
  const datasetsQuery = useDatasetsQuery(workspaceId);
  const datasets = useMemo(() => datasetsQuery.data ?? [], [datasetsQuery.data]);
  const dsNameById = useMemo(() => new Map(datasets.map((d) => [d.id, d.name])), [datasets]);
  const dsColumnsById = useMemo(() => new Map(datasets.map((d) => [d.id, d.columns])), [datasets]);
  const queriesQuery = useQueriesQuery(workspaceId);
  const qrNameById = useMemo(() => new Map((queriesQuery.data ?? []).map((q) => [q.id, q.name])), [queriesQuery.data]);
  const sourceName = (id: string) => dsNameById.get(id) ?? qrNameById.get(id) ?? id;

  const rootId = datasetId || baseSourceId;

  // R88 — per-edge staleness is now computed on the FE: a query-owned rel is stale
  // when one of its key columns no longer exists on the current dataset (data
  // drift). Unknown/not-yet-loaded datasets are treated as not-stale (the backend
  // run is the authoritative gate). Replaces R85–R87's governed `rel.status`.
  const columnMissing = (dsId: string, col: string): boolean => {
    const cols = dsColumnsById.get(dsId);
    return cols ? !cols.some((c) => c.name === col) : false;
  };

  // ── R87 editing state (FE-only staging, canvas.md Q1) ──────────────────────
  // The staged node is a not-yet-joined dataset placed on the canvas; it enters
  // `joins[]` only when a column link is drawn. `pickedColumn` is the first
  // (source) column of an in-progress column→column connect.
  const [staged, setStaged] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pickedColumn, setPickedColumn] = useState<PickedColumn | null>(null);
  const [noMatch, setNoMatch] = useState(false);
  const resetConnect = () => {
    setStaged(null);
    setAdding(false);
    setPickedColumn(null);
    setNoMatch(false);
  };

  // Build the node set (root + each hop's endpoints, insertion-ordered) and the
  // edges from the resolved relationships — exactly the tree `joins[]` encodes.
  const { nodeIds, edges, parentOf, unresolved } = useMemo(() => {
    const ids: string[] = [];
    const push = (id: string) => {
      if (id && !ids.includes(id)) ids.push(id);
    };
    push(rootId);
    const parent = new Map<string, string>();
    const built: Array<{
      key: string;
      from: string;
      to: string;
      qrel: QueryRelationship;
      type: JoinStep['type'];
      stale: boolean;
    }> = [];
    const missing: JoinStep[] = [];
    for (const hop of joins) {
      const qrel = qrelById.get(hop.queryRelId);
      if (!qrel) {
        missing.push(hop);
        continue;
      }
      push(qrel.leftDatasetId);
      push(qrel.rightDatasetId);
      if (!parent.has(qrel.rightDatasetId)) parent.set(qrel.rightDatasetId, qrel.leftDatasetId);
      const stale =
        columnMissing(qrel.leftDatasetId, qrel.leftColumn) || columnMissing(qrel.rightDatasetId, qrel.rightColumn);
      built.push({ key: hop.queryRelId, from: qrel.leftDatasetId, to: qrel.rightDatasetId, qrel, type: hop.type, stale });
    }
    return { nodeIds: ids, edges: built, parentOf: parent, unresolved: missing };
  }, [rootId, joins, qrelById, dsColumnsById]); // eslint-disable-line react-hooks/exhaustive-deps

  // Shared eligibility (joinGraph). Graph membership is over the query's OWN rels
  // (qrelById); the addable set is over the GOVERNED rels (the copy-on-pick library).
  const graphIds = useMemo(() => graphDatasetIds(rootId, joins, qrelById), [rootId, joins, qrelById]);
  const addEligible = useMemo(() => addEligibleRels(rels, graphIds), [rels, graphIds]);
  // The not-yet-joined datasets that CAN be connected (a staged node is always
  // connectable via ≥1 pair — its specific column pairs are picked next).
  const stageable = useMemo(() => {
    const ids = Array.from(new Set(addEligible.map((r) => r.rightDatasetId)));
    return ids.filter((id) => dsNameById.has(id));
  }, [addEligible, dsNameById]);
  // The eligible governed pairs that connect any in-graph source → the staged node.
  const eligibleForStaged = useMemo(
    () => (staged ? addEligible.filter((r) => r.rightDatasetId === staged) : []),
    [addEligible, staged],
  );
  const sourceColEligible = (nodeId: string, column: string) =>
    eligibleForStaged.some((r) => r.leftDatasetId === nodeId && r.leftColumn === column);
  const targetColEligible = (column: string) =>
    pickedColumn !== null &&
    eligibleForStaged.some(
      (r) =>
        r.leftDatasetId === pickedColumn.nodeId && r.leftColumn === pickedColumn.column && r.rightColumn === column,
    );

  // Column→column connect (the pick-pair gesture). A source-column click arms
  // the connect; a target-column click on the staged node commits the matching
  // governed rel — or guides to Relationships when no rel matches (no declare).
  const onColumnClick = (nodeId: string, column: string) => {
    if (!editable || !staged) return;
    if (nodeId === staged) {
      if (!pickedColumn) return; // a source column must be armed first
      const rel = eligibleForStaged.find(
        (r) =>
          r.leftDatasetId === pickedColumn.nodeId && r.leftColumn === pickedColumn.column && r.rightColumn === column,
      );
      if (rel) {
        onAddJoin?.(rel.id); // PICK the matching governed rel
        resetConnect();
      } else {
        setNoMatch(true); // pick-not-declare: no rel for this pair → guide
      }
      return;
    }
    // A source (in-graph) column — arm it (the row-highlight cue points at the
    // columns that actually have an eligible pair; non-eligible ones still arm,
    // so a no-match pair is drawable and lands on the guide, never a declare).
    setPickedColumn({ nodeId, column });
    setNoMatch(false);
  };

  const heightOf = (id: string): number => {
    if (!editable) return NODE_MIN_H;
    const cols = dsColumnsById.get(id) ?? [];
    return cols.length ? NODE_MIN_H + COLS_TOP + cols.length * COL_ROW_H : NODE_MIN_H;
  };

  const { nodes, width, height } = useMemo(
    () => layout(nodeIds, parentOf, heightOf, staged),
    // heightOf closes over editable + dsColumnsById (both stable across a render set)
    [nodeIds, parentOf, staged, editable, dsColumnsById],
  );
  const posById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const cardinalityLabel = (r: QueryRelationship) => t(`relationships.cardinality.${r.cardinality}`);
  const keyPairLabel = (r: QueryRelationship) => `${r.leftColumn} ↔ ${r.rightColumn}`;
  const staleEdges = edges.filter((e) => e.stale);
  const relationshipsHref = `/data-management/workspaces/${workspaceId}/relationships`;

  return (
    <div
      data-component="QueryCanvas"
      role="group"
      aria-label={t('queries.builder.viewCanvas')}
      style={{
        position: 'relative',
        width: '100%',
        overflowX: 'auto',
        background: 'var(--ant-color-bg-layout, #f5f5f5)',
        border: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
        borderRadius: 6,
        padding: 12,
      }}
    >
      <div style={{ position: 'relative', width, height: Math.max(height, NODE_MIN_H + PAD * 2) }}>
        {/* ── Edges (SVG, behind the node cards) ─────────────────────────── */}
        <svg
          width={width}
          height={Math.max(height, NODE_MIN_H + PAD * 2)}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          aria-hidden
        >
          {edges.map((e) => {
            const from = posById.get(e.from);
            const to = posById.get(e.to);
            if (!from || !to) return null;
            const x1 = from.left + NODE_W;
            const y1 = from.top + from.height / 2;
            const x2 = to.left;
            const y2 = to.top + to.height / 2;
            const stale = e.stale;
            return (
              <line
                key={e.key}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={stale ? 'var(--ant-color-warning, #faad14)' : 'var(--ant-color-border, #d9d9d9)'}
                strokeWidth={stale ? 2 : 1.5}
                strokeDasharray={stale ? '5 4' : undefined}
              />
            );
          })}
        </svg>

        {/* ── Edge labels (DOM, at each edge midpoint) + leaf [×] delete ──── */}
        {edges.map((e) => {
          const from = posById.get(e.from);
          const to = posById.get(e.to);
          if (!from || !to) return null;
          const midX = (from.left + NODE_W + to.left) / 2;
          const midY = (from.top + from.height / 2 + (to.top + to.height / 2)) / 2;
          const leaf = isLeafHop(e.key, joins, qrelById);
          return (
            <div
              key={e.key}
              data-component="CanvasEdge"
              data-stale={e.stale ? 'true' : 'false'}
              style={{
                position: 'absolute',
                left: midX,
                top: midY,
                transform: 'translate(-50%, -50%)',
                width: EDGE_LABEL_W,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                background: 'var(--ant-color-bg-layout, #f5f5f5)',
                padding: '2px 4px',
                pointerEvents: 'none',
                textAlign: 'center',
                lineHeight: 1.3,
              }}
            >
              <Typography.Text type="secondary" style={{ fontSize: 12, wordBreak: 'break-word' }}>
                {keyPairLabel(e.qrel)}
              </Typography.Text>
              <span
                style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}
              >
                <Tag style={{ margin: 0 }}>{cardinalityLabel(e.qrel)}</Tag>
                <Tag color="default" style={{ margin: 0 }}>
                  {t(`queries.builder.joinTypeShort.${e.type}`)}
                </Tag>
                {editable ? (
                  // The leaf rule, on the edge: a non-leaf [×] is disabled with the
                  // shipped removeJoinBlocked tooltip (aria-disabled, not a dead
                  // control). Always-visible + keyboard-reachable (canvas.md a11y).
                  <Tooltip title={leaf ? t('queries.builder.removeJoin') : t('queries.builder.removeJoinBlocked')}>
                    <Button
                      size="small"
                      type="text"
                      icon={<CloseOutlined />}
                      disabled={!leaf}
                      onClick={() => onRemoveJoin?.(e.key)}
                      aria-label={leaf ? t('queries.builder.removeJoin') : t('queries.builder.removeJoinBlocked')}
                      data-component="CanvasEdgeDelete"
                      data-leaf={leaf ? 'true' : 'false'}
                      style={{ margin: 0, pointerEvents: 'auto', height: 20, minWidth: 20 }}
                    />
                  </Tooltip>
                ) : null}
              </span>
            </div>
          );
        })}

        {/* ── Nodes (DOM cards, above the edges) ─────────────────────────── */}
        {nodes.map((n) => {
          const driving = n.id === rootId;
          const isStaged = n.id === staged;
          const cols = editable ? (dsColumnsById.get(n.id) ?? []) : [];
          return (
            <div
              key={n.id}
              data-component="CanvasNode"
              data-driving={driving ? 'true' : 'false'}
              data-staged={isStaged ? 'true' : 'false'}
              style={{
                position: 'absolute',
                left: n.left,
                top: n.top,
                width: NODE_W,
                minHeight: NODE_MIN_H,
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                padding: '8px 10px',
                background: 'var(--ant-color-bg-base, #fff)',
                border: `1px ${isStaged ? 'dashed' : 'solid'} ${
                  driving ? 'var(--ant-color-primary, #1677ff)' : 'var(--ant-color-border-secondary, #f0f0f0)'
                }`,
                borderRadius: 6,
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              <Typography.Text strong style={{ fontSize: 13 }}>
                {driving ? '◆ ' : ''}
                {sourceName(n.id)}
              </Typography.Text>
              {driving ? (
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {t('queries.builder.canvasDriving')}
                </Typography.Text>
              ) : null}
              {isStaged ? (
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {t('queries.builder.canvasStaged')}
                </Typography.Text>
              ) : null}
              {/* R87 — clickable columns (the column-granularity pick-pair). Only
                  rendered while editing; the staged node and in-graph sources both
                  list their columns so a source→target pair can be drawn. */}
              {cols.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: COLS_TOP }}>
                  {cols.map((c) => {
                    const armed = pickedColumn?.nodeId === n.id && pickedColumn.column === c.name;
                    const eligible = isStaged ? targetColEligible(c.name) : sourceColEligible(n.id, c.name);
                    const highlight = armed || (Boolean(staged) && eligible);
                    return (
                      <button
                        key={c.name}
                        type="button"
                        data-component="CanvasColumn"
                        data-node={n.id}
                        data-col={c.name}
                        data-eligible={eligible ? 'true' : 'false'}
                        aria-pressed={armed}
                        onClick={() => onColumnClick(n.id, c.name)}
                        disabled={!staged}
                        style={{
                          appearance: 'none',
                          textAlign: 'left',
                          border: highlight ? '1px solid var(--ant-color-primary, #1677ff)' : '1px solid transparent',
                          background: armed ? 'var(--ant-color-primary-bg, #e6f4ff)' : 'transparent',
                          borderRadius: 4,
                          padding: '1px 6px',
                          height: COL_ROW_H,
                          fontSize: 12,
                          cursor: staged ? 'pointer' : 'default',
                          color: 'var(--ant-color-text-secondary, #595959)',
                        }}
                      >
                        · {c.name}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* ── R87 editing toolbar — add a source + connect at column granularity ── */}
      {editable ? (
        <div
          data-component="CanvasEditTools"
          style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}
        >
          {staged ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Typography.Text data-component="CanvasConnectHint" style={{ fontSize: 12 }}>
                {pickedColumn
                  ? t('queries.builder.canvasConnectHintTarget', { name: sourceName(staged) })
                  : t('queries.builder.canvasConnectHint', { name: sourceName(staged) })}
              </Typography.Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* The keyboard/SR-complete equivalent of the click gesture: a
                    <Select> of the eligible governed column pairs (Metabase-style,
                    the most accessible path the prior-art brief found). */}
                <Select
                  value={undefined}
                  onChange={(relId?: string) => {
                    if (relId) {
                      onAddJoin?.(relId);
                      resetConnect();
                    }
                  }}
                  style={{ flex: 1, minWidth: 0 }}
                  placeholder={t('queries.builder.canvasConnectPlaceholder')}
                  aria-label={t('queries.builder.canvasConnectLabel')}
                  options={eligibleForStaged.map((r) => ({
                    value: r.id,
                    label: `${sourceName(r.leftDatasetId)}.${r.leftColumn} ↔ ${sourceName(staged)}.${r.rightColumn}`,
                  }))}
                  data-component="CanvasConnectSelect"
                />
                <Button onClick={resetConnect} data-component="CanvasStagedCancel" style={{ flexShrink: 0 }}>
                  {t('queries.builder.canvasStagedCancel')}
                </Button>
              </div>
              {noMatch ? (
                <Alert
                  role="note"
                  type="info"
                  showIcon
                  data-component="CanvasNoMatchGuide"
                  title={t('queries.builder.canvasNoMatch')}
                  action={
                    <Link to={relationshipsHref} data-component="CanvasNoMatchLink">
                      {t('queries.builder.canvasOpenRelationships')}
                    </Link>
                  }
                />
              ) : null}
            </div>
          ) : adding ? (
            <Select
              autoFocus
              open
              value={undefined}
              onChange={(id?: string) => {
                if (id) {
                  setStaged(id);
                  setAdding(false);
                }
              }}
              onBlur={() => setAdding(false)}
              style={{ width: 280 }}
              placeholder={t('queries.builder.canvasAddSourcePlaceholder')}
              aria-label={t('queries.builder.canvasAddSource')}
              options={stageable.map((id) => ({ value: id, label: sourceName(id) }))}
              data-component="CanvasAddSourceSelect"
            />
          ) : (
            <Tooltip title={addEligible.length === 0 ? t('queries.builder.addJoinNone') : ''}>
              <Button
                onClick={() => setAdding(true)}
                disabled={addEligible.length === 0}
                data-component="CanvasAddSource"
                style={{ alignSelf: 'flex-start' }}
              >
                {t('queries.builder.canvasAddSource')}
              </Button>
            </Tooltip>
          )}
        </div>
      ) : null}

      {/* ── Stale-edge alerts — flag-don't-crash, per edge (canvas.md). The
          per-edge state is derived from each resolved Relationship.status. ─── */}
      {staleEdges.map((e) => (
        <Alert
          key={`stale-${e.key}`}
          role="alert"
          type="warning"
          showIcon
          data-component="CanvasEdgeStale"
          style={{ marginTop: 10 }}
          title={t('queries.builder.canvasEdgeStale', {
            edge: `${sourceName(e.from)} ⋈ ${sourceName(e.to)}`,
            column: columnMissing(e.qrel.leftDatasetId, e.qrel.leftColumn) ? e.qrel.leftColumn : e.qrel.rightColumn,
          })}
        />
      ))}

      {/* Unresolvable hops (a relationship no longer in the workspace) — named,
          never a blank crash. Rare; the Form view resolves it. */}
      {unresolved.length > 0 ? (
        <Tooltip title={t('queries.builder.canvasUnresolvedEdge')}>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
            {t('queries.builder.canvasUnresolvedEdge')}
          </Typography.Text>
        </Tooltip>
      ) : null}
    </div>
  );
}
