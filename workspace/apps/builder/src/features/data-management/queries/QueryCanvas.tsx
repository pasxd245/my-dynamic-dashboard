// QueryCanvas (R85 Phase A → R87 Phase B → R89 free-form, React Flow) — the
// source-graph VIEW + EDITOR of a Query's `definition.joins` tree, a view/edit mode
// of the builder (canvas.md). It renders the SAME working copy the hop list edits
// and edits it via the SAME `useQueryBuilder` ops.
//
// R89 — the canvas moves onto **React Flow** (`@xyflow/react`), the
// canvas.md-reserved graph engine, now that **drawing CREATES** (R87 F1 verdict:
// draw-to-pick felt list-like because it only selected; draw-to-define makes the
// gesture produce something). Nodes = sources (driving `sourceId` + each joined
// dataset) with a connect Handle per column; an edge = a `JoinStep` resolved through
// the query's OWN relationship (`queryRelId`). Dragging a column handle → another
// column handle (`resolveConnect`, the pure router):
//   • matches a governed `rel_` (in-graph→new orientation) → COPY-ON-PICK (`addJoin`)
//     — R87's behavior, preserved;
//   • no governed match → FREE-FORM DEFINE (`defineJoin`) after a cardinality pick —
//     the new R89 capability (a query-owned rel, `originRelationshipId: null`).
// A free-form / copied edge can be **promoted** up into the governed ER (`promoteRel`
// → POST /relationships); a copied edge whose origin governed rel changed/was removed
// shows a **divergence warn** with an opt-in **re-sync** (`resyncRel`) — warn-only,
// never automatic (the query keeps running on its own R88 snapshot). The Form tab
// stays the keyboard/SR-complete equivalent + assistive-tech default (canvas.md a11y).

import '@xyflow/react/dist/style.css';

import { Alert, App, Button, Modal, Select, Tag, Tooltip, Typography } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import {
  BaseEdge,
  Background,
  Controls,
  EdgeLabelRenderer,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getBezierPath,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeChange,
  type NodeProps,
  type XYPosition,
} from '@xyflow/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { useDatasetsQuery } from '@/features/data-management/datasets/hooks';
import { useRelationshipsQuery } from '@/features/data-management/relationships/hooks';
import type { Relationship } from '@/features/data-management/relationships/types';
import { useQueriesQuery } from './hooks';
import {
  addEligibleRels,
  graphDatasetIds,
  inferCardinality,
  isLeafHop,
  relDivergence,
  resolveConnect,
  type ConnectFields,
  type Divergence,
} from './joinGraph';
import type { RelFields } from './chain';
import type { JoinStep, QueryRelationship } from './types';

const NODE_W = 188;
const COL_GAP = 140;
const ROW_GAP = 36;
const PAD = 16;
const HEADER_H = 46;
const COL_ROW_H = 22;
const HANDLE_SZ = 11;

// R90 (handle discoverability) — the connect dots must READ as draggable. CSS-only
// affordances React Flow's inline handle style can't express: a grab/crosshair
// cursor, a hover halo, and a grow-on-hover. Scoped to handles inside the canvas.
const CANVAS_CSS = `
[data-component="QueryCanvas"] .react-flow__handle {
  cursor: crosshair;
  border: 1px solid var(--ant-color-bg-base, #fff);
  transition: transform .1s ease, box-shadow .1s ease;
}
[data-component="QueryCanvas"] .react-flow__handle:hover {
  transform: scale(1.5);
  box-shadow: 0 0 0 4px var(--ant-control-outline, rgba(22, 119, 255, 0.18));
}
[data-component="QueryCanvas"] [data-component="CanvasColumn"]:hover {
  background: var(--ant-color-fill-quaternary, rgba(0,0,0,0.02));
  border-radius: 4px;
}
`;

type Cardinality = QueryRelationship['cardinality'];
const CARDINALITIES: Cardinality[] = ['one_to_one', 'one_to_many', 'many_to_many'];

export type QueryCanvasProps = Readonly<{
  /** The driving (root) DATASET id — `ds_…`. Empty when the base is a composed
   *  `qr_…`; then `baseSourceId` is used. */
  datasetId: string;
  /** The driving source id (`ds_…` or `qr_…`) — the root node's identity. */
  baseSourceId: string;
  workspaceId: string;
  /** R88 — the query's OWN relationships (copy-on-pick / free-form); edges resolve
   *  through these by `queryRelId`. */
  relationships: readonly QueryRelationship[];
  /** The working-copy hops (ordered, topological) — the same array the list edits. */
  joins: readonly JoinStep[];
  /** Supplied iff the canvas is an EDITOR. `onAddJoin` takes a governed rel id
   *  (copy-on-pick); `onDefineJoin` takes a free-form column pair + cardinality;
   *  `onRemoveJoin` / `onPromoteRel` / `onResyncRel` key on a query-owned rel id. */
  onAddJoin?: (relationshipId: string) => void;
  onDefineJoin?: (fields: RelFields) => void;
  onRemoveJoin?: (queryRelId: string) => void;
  onPromoteRel?: (queryRelId: string) => void;
  onResyncRel?: (queryRelId: string) => void;
  /** R89 — the promote mutation's in-flight / error state (for the edge toolbar). */
  promoteState?: Readonly<{ pending: boolean; error: Error | null }>;
}>;

// ── Custom node: a source card with a connect Handle per column ────────────────
type ColumnData = Readonly<{ name: string; stale: boolean }>;
type SourceNodeData = {
  label: string;
  driving: boolean;
  staged: boolean;
  editable: boolean;
  columns: readonly ColumnData[];
  drivingLabel: string;
  stagedLabel: string;
  handleTip: string;
};

function SourceNode({ data, id }: NodeProps<Node<SourceNodeData>>) {
  return (
    <div
      data-component="CanvasNode"
      data-node={id}
      data-driving={data.driving ? 'true' : 'false'}
      data-staged={data.staged ? 'true' : 'false'}
      style={{
        width: NODE_W,
        boxSizing: 'border-box',
        padding: '8px 10px',
        background: 'var(--ant-color-bg-base, #fff)',
        border: `1px ${data.staged ? 'dashed' : 'solid'} ${
          data.driving ? 'var(--ant-color-primary, #1677ff)' : 'var(--ant-color-border-secondary, #f0f0f0)'
        }`,
        borderRadius: 6,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <Typography.Text strong style={{ fontSize: 13 }}>
        {data.driving ? '◆ ' : ''}
        {data.label}
      </Typography.Text>
      {data.driving ? (
        <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
          {data.drivingLabel}
        </Typography.Text>
      ) : null}
      {data.staged ? (
        <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
          {data.stagedLabel}
        </Typography.Text>
      ) : null}
      {data.columns.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 4 }}>
          {data.columns.map((c) => (
            <div
              key={c.name}
              data-component="CanvasColumn"
              data-node={id}
              data-col={c.name}
              style={{
                position: 'relative',
                height: COL_ROW_H,
                display: 'flex',
                alignItems: 'center',
                fontSize: 12,
                padding: '0 8px',
                color: c.stale ? 'var(--ant-color-warning, #faad14)' : 'var(--ant-color-text-secondary, #595959)',
              }}
            >
              {data.editable ? (
                <>
                  <Handle
                    type="target"
                    position={Position.Left}
                    id={c.name}
                    title={data.handleTip}
                    style={{ width: HANDLE_SZ, height: HANDLE_SZ, background: 'var(--ant-color-border, #d9d9d9)' }}
                  />
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={c.name}
                    title={data.handleTip}
                    style={{ width: HANDLE_SZ, height: HANDLE_SZ, background: 'var(--ant-color-primary, #1677ff)' }}
                  />
                </>
              ) : null}
              · {c.name}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── Custom edge: a labelled join with the promote / re-sync / delete toolbar ───
type RelEdgeData = {
  edgeId: string;
  keyPair: string;
  cardinalityLabel: string;
  typeLabel: string;
  free: boolean;
  divergence: Divergence;
  stale: boolean;
  leaf: boolean;
  /** Editor canvas — the context pad of actions is reachable. */
  editable: boolean;
  /** This edge is the selected one — reveal its context pad (bpmn-style). */
  selected: boolean;
  promoting: boolean;
  i18n: {
    freeForm: string;
    governed: string;
    promote: string;
    promoteTip: string;
    resync: string;
    remove: string;
    removeBlocked: string;
    selectTip: string;
  };
  onSelect: () => void;
  onPromote: () => void;
  onResync: () => void;
  onDelete: () => void;
};

function RelEdge(props: EdgeProps<Edge<RelEdgeData>>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props;
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  if (!data) return <BaseEdge id={id} path={path} />;
  const warn = data.stale || data.divergence !== null;
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: warn
            ? 'var(--ant-color-warning, #faad14)'
            : data.free
              ? 'var(--ant-color-primary, #1677ff)'
              : 'var(--ant-color-border, #d9d9d9)',
          strokeWidth: warn ? 2 : 1.5,
          strokeDasharray: warn || data.free ? '5 4' : undefined,
        }}
      />
      <EdgeLabelRenderer>
        {/* R90 — bpmn-style: at rest the edge shows only a compact, OPAQUE label
            (key-pair · cardinality · type · governed/free). Clicking it SELECTS the
            edge and reveals a floating context pad of actions (Promote · Re-sync ·
            [×]) lifted above the node cards (zIndex), so the toolbar never clips
            behind an adjacent node. Selection is canvas-local state (robust + testable),
            not React Flow's internal selection. */}
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            pointerEvents: 'all',
            zIndex: data.selected ? 1000 : 1,
          }}
        >
          <Tooltip title={data.editable && !data.selected ? data.i18n.selectTip : ''}>
            <div
              data-component="CanvasEdge"
              data-edge={data.edgeId}
              data-free={data.free ? 'true' : 'false'}
              data-diverged={data.divergence ?? 'false'}
              data-stale={data.stale ? 'true' : 'false'}
              data-selected={data.selected ? 'true' : 'false'}
              onClick={(e) => {
                if (!data.editable) return;
                e.stopPropagation();
                data.onSelect();
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                background: 'var(--ant-color-bg-base, #fff)',
                border: `1px solid ${
                  data.selected
                    ? 'var(--ant-color-primary, #1677ff)'
                    : 'var(--ant-color-border-secondary, #f0f0f0)'
                }`,
                padding: '2px 8px',
                borderRadius: 6,
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                cursor: data.editable ? 'pointer' : 'default',
                textAlign: 'center',
                lineHeight: 1.3,
              }}
            >
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {data.keyPair}
              </Typography.Text>
              <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                <Tag style={{ margin: 0 }}>{data.cardinalityLabel}</Tag>
                <Tag color="default" style={{ margin: 0 }}>
                  {data.typeLabel}
                </Tag>
                <Tag color={data.free ? 'blue' : 'default'} style={{ margin: 0 }}>
                  {data.free ? data.i18n.freeForm : data.i18n.governed}
                </Tag>
              </span>
            </div>
          </Tooltip>

          {/* The context pad — only when this edge is selected on an editor canvas. */}
          {data.editable && data.selected ? (
            <span
              data-component="CanvasEdgePad"
              onClick={(e) => e.stopPropagation()}
              style={{
                display: 'flex',
                gap: 2,
                alignItems: 'center',
                background: 'var(--ant-color-bg-base, #fff)',
                border: '1px solid var(--ant-color-border, #d9d9d9)',
                borderRadius: 6,
                padding: '1px 4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              }}
            >
              {/* Promote — any query-owned rel can be pushed up to the governed ER. */}
              <Tooltip title={data.i18n.promoteTip}>
                <Button
                  size="small"
                  type="link"
                  loading={data.promoting}
                  onClick={data.onPromote}
                  data-component="CanvasPromote"
                  style={{ margin: 0, padding: '0 4px', height: 22 }}
                >
                  {data.i18n.promote}
                </Button>
              </Tooltip>
              {/* Re-sync — only when a copied rel has diverged from its origin. */}
              {data.divergence !== null ? (
                <Button
                  size="small"
                  type="link"
                  onClick={data.onResync}
                  data-component="CanvasResync"
                  style={{ margin: 0, padding: '0 4px', height: 22, color: 'var(--ant-color-warning, #faad14)' }}
                >
                  {data.i18n.resync}
                </Button>
              ) : null}
              <Tooltip title={data.leaf ? data.i18n.remove : data.i18n.removeBlocked}>
                <Button
                  size="small"
                  type="text"
                  icon={<CloseOutlined />}
                  disabled={!data.leaf}
                  onClick={data.onDelete}
                  aria-label={data.leaf ? data.i18n.remove : data.i18n.removeBlocked}
                  data-component="CanvasEdgeDelete"
                  data-leaf={data.leaf ? 'true' : 'false'}
                  style={{ margin: 0, height: 22, minWidth: 22 }}
                />
              </Tooltip>
            </span>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { source: SourceNode };
const edgeTypes = { rel: RelEdge };

// A deterministic depth/row layout (BFS depth = column; nodes stack within a column,
// spaced by estimated height). Staged nodes go in a fresh rightmost column.
function layout(
  nodeIds: readonly string[],
  parentOf: ReadonlyMap<string, string>,
  staged: readonly string[],
  heightOf: (id: string) => number,
): Map<string, XYPosition> {
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
  const colOf = new Map(nodeIds.map((id) => [id, depthOf(id)] as const));
  const maxCol = nodeIds.reduce((m, id) => Math.max(m, colOf.get(id) ?? 0), 0);
  staged.forEach((id, i) => colOf.set(id, maxCol + 1 + i));
  const order = [...nodeIds, ...staged];
  const cursor = new Map<number, number>();
  const pos = new Map<string, XYPosition>();
  for (const id of order) {
    const col = colOf.get(id) ?? 0;
    const top = cursor.get(col) ?? PAD;
    pos.set(id, { x: PAD + col * (NODE_W + COL_GAP), y: top });
    cursor.set(col, top + heightOf(id) + ROW_GAP);
  }
  return pos;
}

function QueryCanvasInner({
  datasetId,
  baseSourceId,
  workspaceId,
  relationships,
  joins,
  onAddJoin,
  onDefineJoin,
  onRemoveJoin,
  onPromoteRel,
  onResyncRel,
  promoteState,
}: QueryCanvasProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const rf = useReactFlow();
  const editable = Boolean(onAddJoin && onDefineJoin && onRemoveJoin);

  const qrelById = useMemo(() => new Map(relationships.map((r) => [r.id, r])), [relationships]);
  const relationshipsQuery = useRelationshipsQuery(workspaceId);
  const rels = useMemo(() => relationshipsQuery.data ?? [], [relationshipsQuery.data]);
  const governedById = useMemo(() => new Map(rels.map((r) => [r.id, r])), [rels]);
  const datasetsQuery = useDatasetsQuery(workspaceId);
  const datasets = useMemo(() => datasetsQuery.data ?? [], [datasetsQuery.data]);
  const dsNameById = useMemo(() => new Map(datasets.map((d) => [d.id, d.name])), [datasets]);
  const dsColumnsById = useMemo(() => new Map(datasets.map((d) => [d.id, d.columns])), [datasets]);
  const queriesQuery = useQueriesQuery(workspaceId);
  const qrNameById = useMemo(
    () => new Map((queriesQuery.data ?? []).map((q) => [q.id, q.name])),
    [queriesQuery.data],
  );
  const sourceName = useCallback(
    (id: string) => dsNameById.get(id) ?? qrNameById.get(id) ?? id,
    [dsNameById, qrNameById],
  );

  const rootId = datasetId || baseSourceId;

  // Per-edge column-drift staleness (R88): a key column no longer exists on its
  // dataset. Unknown/not-yet-loaded datasets → not stale (the backend run is the gate).
  const columnMissing = useCallback(
    (dsId: string, col: string): boolean => {
      const cols = dsColumnsById.get(dsId);
      return cols ? !cols.some((c) => c.name === col) : false;
    },
    [dsColumnsById],
  );

  const [staged, setStaged] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [posOverride, setPosOverride] = useState<Record<string, XYPosition>>({});
  const [defineDraft, setDefineDraft] = useState<ConnectFields | null>(null);
  const [cardinality, setCardinality] = useState<Cardinality>('one_to_many');
  const [cardinalityInferred, setCardinalityInferred] = useState(false);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);

  // Build the node set (root + each hop's endpoints) and the edges from the query's
  // own relationships — exactly the tree `joins[]` encodes.
  const { nodeIds, parentOf, builtEdges, unresolved } = useMemo(() => {
    const ids: string[] = [];
    const push = (id: string) => {
      if (id && !ids.includes(id)) ids.push(id);
    };
    push(rootId);
    const parent = new Map<string, string>();
    const built: Array<{ hop: JoinStep; qrel: QueryRelationship; stale: boolean }> = [];
    const missing: JoinStep[] = [];
    for (const hop of joins) {
      const qrel = qrelById.get(hop.queryRelId);
      if (!qrel) {
        missing.push(hop);
        continue;
      }
      push(qrel.leftSourceId);
      push(qrel.rightSourceId);
      if (!parent.has(qrel.rightSourceId)) parent.set(qrel.rightSourceId, qrel.leftSourceId);
      const stale =
        columnMissing(qrel.leftSourceId, qrel.leftColumn) || columnMissing(qrel.rightSourceId, qrel.rightColumn);
      built.push({ hop, qrel, stale });
    }
    return { nodeIds: ids, parentOf: parent, builtEdges: built, unresolved: missing };
  }, [rootId, joins, qrelById, columnMissing]);

  const graphIds = useMemo(() => graphDatasetIds(rootId, joins, qrelById), [rootId, joins, qrelById]);
  // Staged nodes that haven't been joined yet (drop any that became in-graph).
  const liveStaged = useMemo(() => staged.filter((id) => !graphIds.includes(id)), [staged, graphIds]);
  // Free-form lets you add ANY not-in-graph dataset (not only ones with a governed
  // rel — that was R87's pick-only constraint). Governed eligibility still drives the
  // copy-on-pick hint, but the stage list is the full not-in-graph set.
  const stageable = useMemo(
    () => datasets.map((d) => d.id).filter((id) => !graphIds.includes(id) && !liveStaged.includes(id)),
    [datasets, graphIds, liveStaged],
  );
  const addEligible = useMemo(() => addEligibleRels(rels, graphIds), [rels, graphIds]);

  const heightOf = useCallback(
    (id: string): number => {
      const cols = dsColumnsById.get(id) ?? [];
      return HEADER_H + cols.length * COL_ROW_H;
    },
    [dsColumnsById],
  );

  const basePos = useMemo(
    () => layout(nodeIds, parentOf, liveStaged, heightOf),
    [nodeIds, parentOf, liveStaged, heightOf],
  );

  const nodes = useMemo<Node<SourceNodeData>[]>(() => {
    const drivingLabel = t('queries.builder.canvasDriving');
    const stagedLabel = t('queries.builder.canvasStaged');
    const handleTip = t('queries.builder.canvasHandleTip');
    const make = (id: string, isStaged: boolean): Node<SourceNodeData> => ({
      id,
      type: 'source',
      position: posOverride[id] ?? basePos.get(id) ?? { x: 0, y: 0 },
      data: {
        label: sourceName(id),
        driving: id === rootId,
        staged: isStaged,
        editable,
        drivingLabel,
        stagedLabel,
        handleTip,
        columns: (dsColumnsById.get(id) ?? []).map((c) => ({
          name: c.name,
          stale: columnMissing(id, c.name),
        })),
      },
    });
    return [...nodeIds.map((id) => make(id, false)), ...liveStaged.map((id) => make(id, true))];
  }, [nodeIds, liveStaged, posOverride, basePos, sourceName, rootId, editable, dsColumnsById, columnMissing, t]);

  const edges = useMemo<Edge<RelEdgeData>[]>(() => {
    const i18n = {
      freeForm: t('queries.builder.canvasFreeForm'),
      governed: t('queries.builder.canvasGoverned'),
      promote: t('queries.builder.canvasPromote'),
      promoteTip: t('queries.builder.canvasPromoteTip'),
      resync: t('queries.builder.canvasResync'),
      remove: t('queries.builder.removeJoin'),
      removeBlocked: t('queries.builder.removeJoinBlocked'),
      selectTip: t('queries.builder.canvasEdgeSelectTip'),
    };
    return builtEdges.map(({ hop, qrel, stale }) => {
      const free = !qrel.originRelationshipId;
      const divergence = relDivergence(qrel, governedById);
      return {
        id: hop.queryRelId,
        source: qrel.leftSourceId,
        sourceHandle: qrel.leftColumn,
        target: qrel.rightSourceId,
        targetHandle: qrel.rightColumn,
        type: 'rel',
        data: {
          edgeId: hop.queryRelId,
          keyPair: `${qrel.leftColumn} ↔ ${qrel.rightColumn}`,
          cardinalityLabel: t(`relationships.cardinality.${qrel.cardinality}`),
          typeLabel: t(`queries.builder.joinTypeShort.${hop.type}`),
          free,
          divergence,
          stale,
          leaf: isLeafHop(hop.queryRelId, joins, qrelById),
          editable,
          selected: selectedEdge === hop.queryRelId,
          promoting: promoteState?.pending === true && promotingId === hop.queryRelId,
          i18n,
          onSelect: () => setSelectedEdge(hop.queryRelId),
          onPromote: () => {
            setPromotingId(hop.queryRelId);
            onPromoteRel?.(hop.queryRelId);
          },
          onResync: () => onResyncRel?.(hop.queryRelId),
          onDelete: () => onRemoveJoin?.(hop.queryRelId),
        },
      };
    });
  }, [builtEdges, governedById, joins, qrelById, editable, selectedEdge, promoteState, promotingId, onPromoteRel, onResyncRel, onRemoveJoin, t]);

  // Keep the whole graph in view as nodes are staged/joined/removed — otherwise a
  // newly-staged node lands outside the viewport and the user can't see (or draw to)
  // it. Re-fit on the node-set size changing; the rAF lets React Flow measure first.
  const fitSignature = `${nodeIds.length}:${liveStaged.length}`;
  useEffect(() => {
    const id = requestAnimationFrame(() => rf.fitView({ padding: 0.2, duration: 200 }));
    return () => cancelAnimationFrame(id);
  }, [fitSignature, rf]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setPosOverride((prev) => {
      let next = prev;
      for (const c of changes) {
        if (c.type === 'position' && c.position) {
          next = { ...next, [c.id]: c.position };
        }
      }
      return next;
    });
  }, []);

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!editable) return;
      const res = resolveConnect(conn, graphIds, rels);
      if (res.kind === 'invalid') {
        if (res.reason !== 'incomplete') message.warning(t(`queries.builder.canvasConnect_${res.reason}`));
        return;
      }
      const newDs = graphIds.includes(conn.source ?? '') ? conn.target : conn.source;
      if (res.kind === 'copy') {
        onAddJoin?.(res.relId);
        if (newDs) setStaged((s) => s.filter((id) => id !== newDs));
        return;
      }
      // define — confirm cardinality first (the gesture that *creates*). R90 — the
      // modal opens pre-set to an INFERRED default from the drawn columns (key-like →
      // 1:1 / 1:N, non-key → M:N); advisory + confirmable, so a wrong guess is safe.
      setDefineDraft(res.fields);
      setCardinality(inferCardinality(res.fields.leftColumn, res.fields.rightColumn));
      setCardinalityInferred(true);
    },
    [editable, graphIds, rels, message, t, onAddJoin],
  );

  const confirmDefine = () => {
    if (!defineDraft) return;
    onDefineJoin?.({ ...defineDraft, cardinality });
    setStaged((s) => s.filter((id) => id !== defineDraft.rightSourceId));
    setDefineDraft(null);
    setCardinalityInferred(false);
  };

  const relationshipsHref = `/data-management/workspaces/${workspaceId}/relationships`;
  const staleEdges = builtEdges.filter((e) => e.stale);
  const divergedEdges = builtEdges
    .map((e) => ({ ...e, divergence: relDivergence(e.qrel, governedById) }))
    .filter((e) => e.divergence !== null);

  return (
    <div
      data-component="QueryCanvas"
      role="group"
      aria-label={t('queries.builder.viewCanvas')}
      style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%', minHeight: 440 }}
    >
      <style>{CANVAS_CSS}</style>
      {/* ── The graph ──────────────────────────────────────────────────── */}
      {/* React Flow needs a definitely-sized parent (a flex/`height:100%` chain
          that collapses leaves the pane 0px → nodes show but nothing is
          interactive). Pin an explicit height so the pane is always real. */}
      <div
        style={{
          height: 'clamp(420px, 60vh, 640px)',
          flex: '0 0 auto',
          border: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
          borderRadius: 6,
          background: 'var(--ant-color-bg-layout, #f5f5f5)',
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onConnect={onConnect}
          onPaneClick={() => setSelectedEdge(null)}
          nodesConnectable={editable}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {/* ── Editing toolbar — add a not-yet-joined source to draw to ──────── */}
      {editable ? (
        <div data-component="CanvasEditTools" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {adding ? (
            <Select
              autoFocus
              open
              showSearch
              optionFilterProp="label"
              value={undefined}
              onChange={(id?: string) => {
                if (id) setStaged((s) => [...s, id]);
                setAdding(false);
              }}
              onBlur={() => setAdding(false)}
              style={{ width: 280 }}
              placeholder={t('queries.builder.canvasAddSourcePlaceholder')}
              aria-label={t('queries.builder.canvasAddSource')}
              options={stageable.map((id) => ({ value: id, label: sourceName(id) }))}
              data-component="CanvasAddSourceSelect"
            />
          ) : (
            <Tooltip title={stageable.length === 0 ? t('queries.builder.canvasAddSourceNone') : ''}>
              <Button
                onClick={() => setAdding(true)}
                disabled={stageable.length === 0}
                data-component="CanvasAddSource"
              >
                {t('queries.builder.canvasAddSource')}
              </Button>
            </Tooltip>
          )}
          <Typography.Text type="secondary" style={{ fontSize: 12 }} data-component="CanvasDragHint">
            {addEligible.length > 0
              ? t('queries.builder.canvasDragHintGoverned')
              : t('queries.builder.canvasDragHint')}
          </Typography.Text>
        </div>
      ) : null}

      {/* ── Free-form define — pick a cardinality for the drawn pair ──────── */}
      <Modal
        open={defineDraft !== null}
        onCancel={() => setDefineDraft(null)}
        onOk={confirmDefine}
        okText={t('queries.builder.canvasDefineConfirm')}
        title={t('queries.builder.canvasDefineTitle')}
        data-component="CanvasDefineModal"
        destroyOnHidden
      >
        {defineDraft ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Typography.Text>
              {t('queries.builder.canvasDefineBody', {
                left: `${sourceName(defineDraft.leftSourceId)}.${defineDraft.leftColumn}`,
                right: `${sourceName(defineDraft.rightSourceId)}.${defineDraft.rightColumn}`,
              })}
            </Typography.Text>
            <div>
              <Typography.Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                {t('queries.builder.canvasCardinalityLabel')}
              </Typography.Text>
              <Select<Cardinality>
                value={cardinality}
                onChange={(c) => {
                  setCardinality(c);
                  setCardinalityInferred(false);
                }}
                style={{ width: '100%' }}
                aria-label={t('queries.builder.canvasCardinalityLabel')}
                data-component="CanvasCardinalitySelect"
                options={CARDINALITIES.map((c) => ({ value: c, label: t(`relationships.cardinality.${c}`) }))}
              />
              {cardinalityInferred ? (
                <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                  {t('queries.builder.canvasCardinalityInferred')}
                </Typography.Text>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ── Promote error (409 already-governed / 422 conflict) ──────────── */}
      {promoteState?.error ? (
        <Alert
          role="alert"
          type="warning"
          showIcon
          data-component="CanvasPromoteError"
          message={t('queries.builder.canvasPromoteFailed')}
        />
      ) : null}

      {/* ── Divergence warn — copied rel drifted from its origin (warn-only) ─ */}
      {divergedEdges.map((e) => (
        <Alert
          key={`diverged-${e.hop.queryRelId}`}
          role="alert"
          type="warning"
          showIcon
          data-component="CanvasEdgeDiverged"
          data-divergence={e.divergence ?? ''}
          message={t(
            e.divergence === 'removed'
              ? 'queries.builder.canvasDivergedRemoved'
              : 'queries.builder.canvasDivergedChanged',
            { edge: `${sourceName(e.qrel.leftSourceId)} ⋈ ${sourceName(e.qrel.rightSourceId)}` },
          )}
        />
      ))}

      {/* ── Stale-edge alerts — flag-don't-crash, per edge ──────────────── */}
      {staleEdges.map((e) => (
        <Alert
          key={`stale-${e.hop.queryRelId}`}
          role="alert"
          type="warning"
          showIcon
          data-component="CanvasEdgeStale"
          message={t('queries.builder.canvasEdgeStale', {
            edge: `${sourceName(e.qrel.leftSourceId)} ⋈ ${sourceName(e.qrel.rightSourceId)}`,
            column: columnMissing(e.qrel.leftSourceId, e.qrel.leftColumn) ? e.qrel.leftColumn : e.qrel.rightColumn,
          })}
        />
      ))}

      {/* Unresolvable hops — named, never a blank crash. */}
      {unresolved.length > 0 ? (
        <Typography.Text type="secondary" style={{ fontSize: 12 }} data-component="CanvasUnresolved">
          {t('queries.builder.canvasUnresolvedEdge')}{' '}
          <Link to={relationshipsHref}>{t('queries.builder.canvasOpenRelationships')}</Link>
        </Typography.Text>
      ) : null}
    </div>
  );
}

export function QueryCanvas(props: QueryCanvasProps) {
  return (
    <ReactFlowProvider>
      <QueryCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
