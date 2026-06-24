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

import { Alert, App, Button, Modal, Popover, Select, Tag, Tooltip, Typography } from 'antd';
import {
  CloseOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { CalendarBlankIcon, CheckSquareIcon, ClockIcon, HashIcon, type Icon, TextAaIcon } from '@phosphor-icons/react';
import {
  BaseEdge,
  Background,
  ControlButton,
  Controls,
  EdgeLabelRenderer,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getSmoothStepPath,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeChange,
  type NodeProps,
  type XYPosition,
} from '@xyflow/react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { useDatasetsQuery } from '@/features/data-management/datasets/hooks';
import { useRelationshipsQuery } from '@/features/data-management/relationships/hooks';
import { useQueriesQuery } from './hooks';
import {
  addEligibleRels,
  graphDatasetIds,
  inferCardinality,
  isLeafHop,
  relDivergence,
  resolveConnect,
  type ColumnProvenance,
  type ConnectFields,
  type Divergence,
} from './joinGraph';
import type { RelFields } from './chain';
import type { JoinStep, QueryRelationship, ResolvedColumn } from './types';

type Dtype = ResolvedColumn['dtype'];

/** R93 — one effective column of a `qr_` source as the canvas renders it: its display
 *  name, dtype (for the per-field type glyph), + the leaf it traces to (`null` for a
 *  future derived column). Read off the wire (`resolvedColumns`), no longer re-derived. */
type EffectiveColumn = Readonly<{ name: string; dtype: Dtype; owner: ColumnProvenance | null }>;

const NODE_W = 188;
const COL_GAP = 140;
const ROW_GAP = 36;
const PAD = 16;
const HEADER_H = 46;
const COL_ROW_H = 22;
const HANDLE_SZ = 11;
// R92 — a query (`qr_`) source exposes its full EFFECTIVE space, which can be wide
// (a composed/joined query has every leaf column). Collapse past a threshold to keep
// the node legible — "+ N more" reveals the rest, and a revealed column is drawable
// like any other (the reveal-to-draw crux, Round_92.md). Datasets are narrow and
// rarely trip the threshold.
const COLLAPSE_AT = 8;
const COLLAPSE_VISIBLE = 6;

// R93 (F2) — a per-field column-type glyph (the Attio fidelity item): a muted line
// icon per dtype, left of each column name. It is SUPPLEMENTARY to the text name
// (carries a `title` for the dtype) — never colour/glyph-alone, so accessibility holds.
const DTYPE_ICON: Record<Dtype, Icon> = {
  string: TextAaIcon,
  integer: HashIcon,
  float: HashIcon,
  boolean: CheckSquareIcon,
  date: CalendarBlankIcon,
  datetime: ClockIcon,
};

function DtypeGlyph({ dtype }: Readonly<{ dtype: Dtype }>) {
  const Glyph = DTYPE_ICON[dtype];
  return (
    <span
      title={dtype}
      aria-hidden
      style={{ display: 'inline-flex', flex: '0 0 auto', color: 'var(--ant-color-text-quaternary, #bfbfbf)' }}
    >
      <Glyph size={12} />
    </span>
  );
}

// R90 (handle discoverability) — the connect dots must READ as draggable. CSS-only
// affordances React Flow's inline handle style can't express: a grab/crosshair
// cursor, a hover halo, and a grow-on-hover. Scoped to handles inside the canvas.
const CANVAS_CSS = `
/* R93 (F2) — distinct cursors for the canvas's actions, so each reads differently on
   hover: the PANE pans (grab/grabbing, React Flow's default), a NODE card repositions
   (move = 4-arrow, UNCHANGING while dragging), a column ROW is neutral (default arrow),
   and a connect HANDLE draws a join (crosshair). The neutral row → crosshair handle
   contrast makes the draw-a-join affordance obvious as you reach the dot. */
[data-component="QueryCanvas"] .react-flow__node {
  cursor: move;
}
[data-component="QueryCanvas"] [data-component="CanvasColumn"] {
  cursor: default;
}
[data-component="QueryCanvas"] .react-flow__handle {
  cursor: crosshair;
  border: 1px solid var(--ant-color-bg-base, #fff);
  transition: transform .1s ease, box-shadow .1s ease;
}
/* R93 (F2) — enlarge the GRAB/HOVER area without enlarging the visible dot: a
   transparent ::before extends the hit target (the event still targets the handle, so
   React Flow starts the connection from anywhere in it). Generous horizontally — into
   the row + out toward the canvas, where the pointer approaches — and modest vertically
   so stacked same-edge handles don't overlap into an ambiguous target. */
[data-component="QueryCanvas"] .react-flow__handle::before {
  content: '';
  position: absolute;
  inset: -5px -9px;
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
  /** R93 (F2) — the preview status chip, rendered by the parent (it owns the preview
   *  gate) but placed in the canvas's single top-right toolbar row, between Add and Help. */
  statusChip?: ReactNode;
}>;

// ── Custom node: a source card with a connect Handle per column ────────────────
type ColumnData = Readonly<{ name: string; dtype: Dtype; stale: boolean }>;
type SourceNodeData = {
  label: string;
  /** R92 — a dataset (`ds_`) or a saved query (`qr_`); drives the header type `<Tag>`
   *  + the 🔎 query marker (Round_92.md decision 9). */
  kind: 'dataset' | 'query';
  /** R92 — a `qr_` that can't be resolved (deleted / composition cycle): a marked
   *  "unavailable" card with no handles (decision 11), not a blank crash. */
  unavailable: boolean;
  driving: boolean;
  staged: boolean;
  editable: boolean;
  columns: readonly ColumnData[];
  drivingLabel: string;
  stagedLabel: string;
  handleTip: string;
  typeLabel: string;
  unavailableLabel: string;
  moreLabel: (n: number) => string;
  fewerLabel: string;
};

function SourceNode({ data, id }: NodeProps<Node<SourceNodeData>>) {
  // R92 — disclosure is node-local view state: a wide `qr_` collapses to the first
  // few columns; "+ N more" reveals the rest (a revealed column draws like any other).
  const [expanded, setExpanded] = useState(false);
  const collapsible = data.columns.length > COLLAPSE_AT;
  const visible = collapsible && !expanded ? data.columns.slice(0, COLLAPSE_VISIBLE) : data.columns;
  const hidden = data.columns.length - visible.length;
  return (
    <div
      data-component="CanvasNode"
      data-node={id}
      data-kind={data.kind}
      data-unavailable={data.unavailable ? 'true' : 'false'}
      data-driving={data.driving ? 'true' : 'false'}
      data-staged={data.staged ? 'true' : 'false'}
      style={{
        width: NODE_W,
        boxSizing: 'border-box',
        padding: '8px 10px',
        background: 'var(--ant-color-bg-base, #fff)',
        border: `1px ${data.staged ? 'dashed' : 'solid'} ${
          data.unavailable
            ? 'var(--ant-color-warning, #faad14)'
            : data.driving
              ? 'var(--ant-color-primary, #1677ff)'
              : 'var(--ant-color-border-secondary, #f0f0f0)'
        }`,
        borderRadius: 6,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Typography.Text strong style={{ fontSize: 13, flex: 1, minWidth: 0 }} ellipsis>
          {data.driving ? '◆ ' : ''}
          {data.kind === 'query' ? '🔎 ' : ''}
          {data.label}
        </Typography.Text>
        <Tag style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>{data.typeLabel}</Tag>
      </div>
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
      {data.unavailable ? (
        <Typography.Text type="warning" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
          {data.unavailableLabel}
        </Typography.Text>
      ) : null}
      {visible.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 4 }}>
          {visible.map((c) => (
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
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <DtypeGlyph dtype={c.dtype} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {collapsible ? (
        <Button
          type="link"
          size="small"
          onClick={() => setExpanded((e) => !e)}
          data-component="CanvasColumnsToggle"
          data-expanded={expanded ? 'true' : 'false'}
          style={{ padding: '0 8px', height: COL_ROW_H, fontSize: 11 }}
        >
          {expanded ? data.fewerLabel : data.moreLabel(hidden)}
        </Button>
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
  /** R92 — a `qr_`-side edge is non-promotable (Dec 3: the governed ER stays
   *  dataset-only); the context pad hides Promote for it. */
  promotable: boolean;
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
  // R93 (F2) — rounded orthogonal routing (the Attio look): right-angle turns with
  // softened corners, replacing the prior bezier S-curve.
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 12,
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
                  data.selected ? 'var(--ant-color-primary, #1677ff)' : 'var(--ant-color-border-secondary, #f0f0f0)'
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
              <span
                style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}
              >
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
              {/* Promote — any dataset↔dataset query-owned rel can be pushed up to the
                  governed ER. R92 (Dec 3): suppressed on a `qr_`-side edge — the governed
                  ER stays dataset-only, so a query×query join has no governed counterpart. */}
              {data.promotable ? (
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
              ) : null}
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
  statusChip,
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
  const queries = useMemo(() => queriesQuery.data ?? [], [queriesQuery.data]);
  const qrById = useMemo(() => new Map(queries.map((q) => [q.id, q])), [queries]);
  const qrNameById = useMemo(() => new Map(queries.map((q) => [q.id, q.name])), [queries]);
  const sourceName = useCallback(
    (id: string) => dsNameById.get(id) ?? qrNameById.get(id) ?? id,
    [dsNameById, qrNameById],
  );
  const kindOf = useCallback((id: string): 'dataset' | 'query' => (id.startsWith('qr_') ? 'query' : 'dataset'), []);

  // R93 — a `qr_` source's EFFECTIVE columns + the leaf `(ds_, col)` each traces to,
  // read straight off the WIRE: a joined/composed query carries `resolvedColumns` with
  // per-column provenance (`ownerSourceId` / `sourceColumn`) the resolver now emits, so
  // the canvas no longer re-derives it (the R92 F1 `provenance.ts` mock is retired). A
  // single-source query omits `resolvedColumns` → its driving dataset's columns, owned
  // 1:1. Keyed by `qr_` id; a column with no owner (a future derived column) maps to null.
  const effectiveByQr = useMemo(() => {
    const m = new Map<string, EffectiveColumn[]>();
    for (const q of queries) {
      const resolved = q.resolvedColumns;
      if (resolved && resolved.length > 0) {
        m.set(
          q.id,
          resolved.map((c) => ({
            name: c.name,
            dtype: c.dtype,
            owner:
              c.ownerSourceId && c.sourceColumn
                ? { ownerSourceId: c.ownerSourceId, sourceColumn: c.sourceColumn }
                : null,
          })),
        );
      } else if (q.sourceId.startsWith('ds_')) {
        // Single-source query — its effective space is the driving dataset's columns,
        // each owned 1:1 by that leaf.
        m.set(
          q.id,
          (dsColumnsById.get(q.sourceId) ?? []).map((c) => ({
            name: c.name,
            dtype: c.dtype,
            owner: { ownerSourceId: q.sourceId, sourceColumn: c.name },
          })),
        );
      } else {
        m.set(q.id, []);
      }
    }
    return m;
  }, [queries, dsColumnsById]);

  // A `qr_` is UNAVAILABLE when it isn't in the loaded set (deleted / cycle / stale base)
  // — it renders a marked card with no handles (Dec 11), never a blank crash.
  const unavailableOf = useCallback((id: string): boolean => id.startsWith('qr_') && !qrById.has(id), [qrById]);

  // The display columns of any source — a dataset's own, or a query's effective space —
  // each with its dtype (for the per-field type glyph, R93 F2).
  const columnsOf = useCallback(
    (id: string): { name: string; dtype: Dtype }[] => {
      if (id.startsWith('qr_')) return (effectiveByQr.get(id) ?? []).map((c) => ({ name: c.name, dtype: c.dtype }));
      return (dsColumnsById.get(id) ?? []).map((c) => ({ name: c.name, dtype: c.dtype }));
    },
    [dsColumnsById, effectiveByQr],
  );

  // R92 — resolve a drawn endpoint's effective column to its owning leaf `ds_`. A `ds_`
  // owns itself; a `qr_` column maps through the mock provenance (or `null` when derived).
  const provenanceOf = useCallback(
    (sourceId: string, column: string) => {
      if (!sourceId.startsWith('qr_')) return { ownerSourceId: sourceId, sourceColumn: column };
      return (effectiveByQr.get(sourceId) ?? []).find((c) => c.name === column)?.owner ?? null;
    },
    [effectiveByQr],
  );

  // R93 — a drawn column's dtype (from the same per-source column space the nodes render),
  // for the draw-time dtype guard; `null` when unknown (data not yet loaded → not blocked).
  const dtypeOf = useCallback(
    (sourceId: string, column: string): string | null =>
      columnsOf(sourceId).find((c) => c.name === column)?.dtype ?? null,
    [columnsOf],
  );

  const rootId = datasetId || baseSourceId;

  // Per-edge column-drift staleness (R88): a key column no longer exists on its
  // dataset. Unknown/not-yet-loaded datasets → not stale (the backend run is the gate).
  // R92 — a `qr_` side is never flagged here (it has no flat dataset columns); the
  // backend run stays the authoritative gate for a query×query edge.
  const columnMissing = useCallback(
    (dsId: string, col: string): boolean => {
      if (dsId.startsWith('qr_')) return false;
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

  // R93 (F2) — "fullscreen" = MAXIMIZE the canvas to fill the browser TAB via an in-page
  // fixed overlay, NOT the OS Fullscreen API: the API left the graph pane unmeasured at
  // toggle → a blank canvas, and it can be blocked inside embeds. The overlay gives the
  // pane a definite viewport size (so React Flow measures + fits), keeps the app's own
  // chrome, and `Esc` exits. The fit re-runs on toggle (fitSignature includes `maximized`).
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    if (!maximized) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMaximized(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [maximized]);

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
  // Free-form lets you add ANY not-in-graph source (not only ones with a governed
  // rel — that was R87's pick-only constraint). R92 — the stage list now spans BOTH
  // datasets AND saved queries (the symmetric "join anything to anything" canvas);
  // a query can't be joined to itself, so the query under edit is excluded.
  const editingQueryId = baseSourceId.startsWith('qr_') ? baseSourceId : '';
  const stageableDatasets = useMemo(
    () => datasets.map((d) => d.id).filter((id) => !graphIds.includes(id) && !liveStaged.includes(id)),
    [datasets, graphIds, liveStaged],
  );
  const stageableQueries = useMemo(
    () =>
      queries
        .map((q) => q.id)
        .filter((id) => id !== editingQueryId && !graphIds.includes(id) && !liveStaged.includes(id)),
    [queries, editingQueryId, graphIds, liveStaged],
  );
  const stageable = useMemo(() => [...stageableDatasets, ...stageableQueries], [stageableDatasets, stageableQueries]);
  const addEligible = useMemo(() => addEligibleRels(rels, graphIds), [rels, graphIds]);

  const heightOf = useCallback(
    (id: string): number => {
      const n = columnsOf(id).length;
      // Collapsed-tall nodes (a wide `qr_`) only render the visible slice + a toggle row.
      const shown = n > COLLAPSE_AT ? COLLAPSE_VISIBLE + 1 : n;
      return HEADER_H + shown * COL_ROW_H;
    },
    [columnsOf],
  );

  const basePos = useMemo(
    () => layout(nodeIds, parentOf, liveStaged, heightOf),
    [nodeIds, parentOf, liveStaged, heightOf],
  );

  const nodes = useMemo<Node<SourceNodeData>[]>(() => {
    const drivingLabel = t('queries.builder.canvasDriving');
    const stagedLabel = t('queries.builder.canvasStaged');
    const handleTip = t('queries.builder.canvasHandleTip');
    const fewerLabel = t('queries.builder.canvasColumnsFewer');
    const moreLabel = (n: number) => t('queries.builder.canvasColumnsMore', { count: n });
    const unavailableLabel = t('queries.builder.canvasQueryUnavailable');
    const make = (id: string, isStaged: boolean): Node<SourceNodeData> => {
      const kind = kindOf(id);
      const unavailable = unavailableOf(id);
      return {
        id,
        type: 'source',
        position: posOverride[id] ?? basePos.get(id) ?? { x: 0, y: 0 },
        data: {
          label: sourceName(id),
          kind,
          unavailable,
          driving: id === rootId,
          staged: isStaged,
          editable,
          drivingLabel,
          stagedLabel,
          handleTip,
          typeLabel: t(
            kind === 'query' ? 'queries.builder.canvasNodeTypeQuery' : 'queries.builder.canvasNodeTypeDataset',
          ),
          unavailableLabel,
          moreLabel,
          fewerLabel,
          // An unavailable `qr_` has no resolvable columns → no handles (Dec 11).
          columns: unavailable
            ? []
            : columnsOf(id).map((c) => ({ name: c.name, dtype: c.dtype, stale: columnMissing(id, c.name) })),
        },
      };
    };
    return [...nodeIds.map((id) => make(id, false)), ...liveStaged.map((id) => make(id, true))];
  }, [
    nodeIds,
    liveStaged,
    posOverride,
    basePos,
    sourceName,
    rootId,
    editable,
    columnsOf,
    columnMissing,
    kindOf,
    unavailableOf,
    t,
  ]);

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
      // R92 (Dec 3) — a `qr_`-side edge has no governed counterpart, so it's non-promotable.
      const promotable = !qrel.leftSourceId.startsWith('qr_') && !qrel.rightSourceId.startsWith('qr_');
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
          promotable,
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
  }, [
    builtEdges,
    governedById,
    joins,
    qrelById,
    editable,
    selectedEdge,
    promoteState,
    promotingId,
    onPromoteRel,
    onResyncRel,
    onRemoveJoin,
    t,
  ]);

  // Keep the whole graph in view as nodes are staged/joined/removed — otherwise a
  // newly-staged node lands outside the viewport and the user can't see (or draw to)
  // it. Re-fit on the node-set size changing; the rAF lets React Flow measure first.
  const fitSignature = `${nodeIds.length}:${liveStaged.length}:${maximized}`;
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
      // R92 — `provenanceOf` lets a drag OFF a `qr_` node's effective column resolve to
      // its owning leaf `ds_` for the hop's LEFT (the resolver matches leaf ids); a
      // derived column has no owner → routed to `invalid: 'derived'`.
      const res = resolveConnect(conn, graphIds, rels, provenanceOf, dtypeOf);
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
    [editable, graphIds, rels, provenanceOf, dtypeOf, message, t, onAddJoin],
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
      data-maximized={maximized ? 'true' : 'false'}
      role="group"
      aria-label={t('queries.builder.viewCanvas')}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minHeight: 440,
        // R93 (F2) — maximized: an in-page overlay filling the browser tab's viewport.
        ...(maximized
          ? {
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              height: '100%',
              padding: 8,
              background: 'var(--ant-color-bg-base, #fff)',
            }
          : { height: '100%' }),
      }}
    >
      <style>{CANVAS_CSS}</style>
      {/* ── Top toolbar — ONE right-aligned row: Add a source › Preview › Help, all
          uniform text+icon buttons. The preview chip is passed in by the parent (which
          owns the preview gate) and sits BETWEEN add and help; the drag instructions live
          in the help popover so the bar stays a single line. ── */}
      {editable || statusChip ? (
        <div
          data-component="CanvasEditTools"
          style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', flex: '0 0 auto' }}
        >
          {editable &&
            (adding ? (
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
                // R92 — grouped so a saved query (`qr_`) is disambiguated from a dataset
                // (`ds_`) at the point of choosing; both can be joined in (Dec 9/10).
                options={[
                  {
                    label: t('queries.builder.canvasAddSourceGroupDatasets'),
                    options: stageableDatasets.map((id) => ({ value: id, label: sourceName(id) })),
                  },
                  {
                    label: t('queries.builder.canvasAddSourceGroupQueries'),
                    options: stageableQueries.map((id) => ({ value: id, label: `🔎 ${sourceName(id)}` })),
                  },
                ].filter((g) => g.options.length > 0)}
                data-component="CanvasAddSourceSelect"
              />
            ) : (
              <Tooltip title={stageable.length === 0 ? t('queries.builder.canvasAddSourceNone') : ''}>
                <Button
                  type="text"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => setAdding(true)}
                  disabled={stageable.length === 0}
                  data-component="CanvasAddSource"
                >
                  {t('queries.builder.canvasAddSource')}
                </Button>
              </Tooltip>
            ))}
          {statusChip}
          {editable && (
            <Popover
              trigger="click"
              placement="bottomRight"
              title={t('queries.builder.canvasHelpTitle')}
              content={
                <div style={{ maxWidth: 300, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Typography.Text style={{ fontSize: 12 }} data-component="CanvasDragHint">
                    {addEligible.length > 0
                      ? t('queries.builder.canvasDragHintGoverned')
                      : t('queries.builder.canvasDragHint')}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {t('queries.builder.canvasHelpAddSource')}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {t('queries.builder.canvasHelpEdges')}
                  </Typography.Text>
                </div>
              }
            >
              <Button type="text" size="small" icon={<QuestionCircleOutlined />} data-component="CanvasHelp">
                {t('queries.builder.canvasHelp')}
              </Button>
            </Popover>
          )}
        </div>
      ) : null}

      {/* ── The graph ──────────────────────────────────────────────────── */}
      {/* React Flow needs a definitely-sized parent (a flex/`height:100%` chain
          that collapses leaves the pane 0px → nodes show but nothing is
          interactive). Pin an explicit height so the pane is always real. */}
      <div
        data-component="QueryCanvasPane"
        style={{
          // Maximized: fill the remaining overlay height; otherwise the clamped pane.
          ...(maximized
            ? { flex: '1 1 auto', minHeight: 0 }
            : { height: 'clamp(420px, 60vh, 640px)', flex: '0 0 auto' }),
          border: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
          borderRadius: maximized ? 0 : 6,
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
          <Controls showInteractive={false}>
            {/* R93 (F2) — a maximize toggle alongside zoom/fit, to fill the tab and draw
                with room (Esc exits). */}
            <ControlButton
              onClick={() => setMaximized((m) => !m)}
              title={maximized ? t('queries.builder.canvasExitMaximize') : t('queries.builder.canvasMaximize')}
              aria-label={maximized ? t('queries.builder.canvasExitMaximize') : t('queries.builder.canvasMaximize')}
              data-component="CanvasFullscreen"
            >
              {maximized ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
            </ControlButton>
          </Controls>
        </ReactFlow>
      </div>

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
