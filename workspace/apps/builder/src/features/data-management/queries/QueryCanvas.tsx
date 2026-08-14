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
  TableOutlined,
  WarningOutlined,
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
import {
  addEligibleRels,
  buildSourceGraph,
  graphDatasetIds,
  inferCardinality,
  isLeafHop,
  promoteWouldCollide,
  relDivergence,
  resolveConnect,
  type ConnectFields,
  type Divergence,
} from './joinGraph';
import type { RelFields } from './chain';
import type { JoinStep, QueryRelationship, ResolvedColumn } from './types';

type Dtype = ResolvedColumn['dtype'];

const NODE_W = 188;
const COL_GAP = 140;
const ROW_GAP = 36;
const PAD = 16;
const HEADER_H = 46;
const COL_ROW_H = 22;
const HANDLE_SZ = 11;
// A wide source's column list can overflow the node card, so collapse past a threshold
// to keep it legible — "+ N more" reveals the rest, and a revealed column is drawable
// like any other (the reveal-to-draw crux, Round_92.md). This mattered most for a `qr_`
// node's full effective space; datasets rarely trip the threshold, but the disclosure
// stays — a wide dataset is common enough in this product's CRM exports.
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
/* R97 Item 2 — the edge info-box animates in on select (show). */
@keyframes canvasEdgeBoxIn {
  from { opacity: 0; transform: translateY(-3px) scale(0.97); }
  to   { opacity: 1; transform: none; }
}
[data-component="QueryCanvas"] .canvas-edge-box,
[data-component="QueryCanvasPane"] .canvas-edge-box {
  animation: canvasEdgeBoxIn 0.12s ease-out;
}
`;

type Cardinality = QueryRelationship['cardinality'];
const CARDINALITIES: Cardinality[] = ['one_to_one', 'one_to_many', 'many_to_one', 'many_to_many'];

export type QueryCanvasProps = Readonly<{
  /** The driving (root) source — a dataset (`ds_…`), which is the root node's identity.
   *  R167 collapsed two props into this one: `datasetId` (the graph ROOT, empty when the
   *  base was a composed `qr_`) and `baseSourceId` (the driving id, either kind) can no
   *  longer differ, because a driving source is always a dataset. */
  rootSourceId: string;
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
// R167 — every node is a DATASET. The type carried a `kind` ('dataset' | 'query')
// and an `unavailable` state for a source that could not be resolved (a deleted or
// cyclic query base); both retired with composition, along with the query icon and the
// type `<Tag>`'s second value.
type SourceNodeData = {
  label: string;
  driving: boolean;
  staged: boolean;
  editable: boolean;
  columns: readonly ColumnData[];
  drivingLabel: string;
  stagedLabel: string;
  handleTip: string;
  typeLabel: string;
  moreLabel: (n: number) => string;
  fewerLabel: string;
  /** R97 — remove an unconnected STAGED source from the canvas (pure canvas
   *  state — a staged node isn't in the definition). Set only for staged,
   *  editable nodes; otherwise the only escape was a tab-switch (clears all). */
  onUnstage?: () => void;
  unstageLabel: string;
};

function SourceNode({ data, id }: NodeProps<Node<SourceNodeData>>) {
  // Disclosure is node-local view state: a wide source collapses to the first
  // few columns; "+ N more" reveals the rest (a revealed column draws like any other).
  const [expanded, setExpanded] = useState(false);
  const collapsible = data.columns.length > COLLAPSE_AT;
  const visible = collapsible && !expanded ? data.columns.slice(0, COLLAPSE_VISIBLE) : data.columns;
  const hidden = data.columns.length - visible.length;
  return (
    <div
      data-component="CanvasNode"
      data-node={id}
      data-kind="dataset"
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* R97 — the default node icon (no per-dataset icon field yet), mirroring the
            nav. R167 — always a table: the query variant retired with composition. */}
        <span
          style={{
            flex: '0 0 auto',
            display: 'inline-flex',
            fontSize: 13,
            color: 'var(--ant-color-text-secondary, #595959)',
          }}
          aria-hidden="true"
        >
          <TableOutlined />
        </span>
        <Typography.Text
          strong
          style={{ fontSize: 13, flex: 1, minWidth: 0 }}
          ellipsis={{ tooltip: data.label }}
        >
          {data.driving ? '◆ ' : ''}
          {data.label}
        </Typography.Text>
        <Tag style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>{data.typeLabel}</Tag>
        {/* R97 — remove an unconnected staged source (no edge to delete it via). */}
        {data.staged && data.onUnstage ? (
          <Tooltip title={data.unstageLabel}>
            <Button
              size="small"
              type="text"
              icon={<CloseOutlined />}
              aria-label={data.unstageLabel}
              data-component="CanvasUnstage"
              onClick={(e) => {
                e.stopPropagation();
                data.onUnstage?.();
              }}
              style={{ margin: 0, height: 18, minWidth: 18, flex: '0 0 auto' }}
            />
          </Tooltip>
        ) : null}
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
                <span title={c.name} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.name}
                </span>
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
  divergence: Divergence;
  /** R171 item 4 — the governed ER already holds this ordered pair, so
   *  promoting it could only return `409 relationship_exists`. */
  promoteCollides: boolean;
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
    promoteBlocked: string;
    resync: string;
    remove: string;
    removeBlocked: string;
    selectTip: string;
    onLabel: string;
    joinLabel: string;
    relLabel: string;
    relTypeLabel: string;
    close: string;
  };
  onSelect: () => void;
  onDeselect: () => void;
  onPromote: () => void;
  onResync: () => void;
  onDelete: () => void;
};

// R97 Item 2 — a labelled row inside the expanded edge info-box.
function EdgeInfoRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 12, lineHeight: 1.5, alignItems: 'baseline' }}>
      <span style={{ color: 'var(--ant-color-text-tertiary, #8c8c8c)', flex: '0 0 auto', minWidth: 88 }}>{label}</span>
      <span style={{ color: 'var(--ant-color-text, #000)', fontWeight: 500, wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

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
        {/* R97 Item 2 — at rest the edge is a COMPACT, plain cardinality label
            (1:1/1:n/n:n — no chip background). Clicking it opens an info-box
            ("modal"-style) — on · join type · relationship · relationship type —
            with Promote / Re-sync / Remove (labelled) + a close [×] top-right; the
            badge HIDES while the box is open (not both at once), and the box
            animates in. Selection is canvas-local state (robust + testable). */}
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
          {/* Collapsed badge — always in the DOM (carries the edge's data attrs +
              is the click target); hidden while the box is open. */}
          <Tooltip title={data.editable && !data.selected ? data.i18n.selectTip : ''}>
            <div
              data-component="CanvasEdge"
              data-edge={data.edgeId}
              data-free={data.free ? 'true' : 'false'}
              data-diverged={data.divergence ?? 'false'}
              data-stale={data.stale ? 'true' : 'false'}
              data-selected={data.selected ? 'true' : 'false'}
              role="button"
              aria-label={`${data.i18n.relLabel}: ${data.cardinalityLabel} · ${
                data.free ? data.i18n.freeForm : data.i18n.governed
              }${warn ? ' ⚠' : ''}`}
              onClick={(e) => {
                if (!data.editable || data.selected) return;
                e.stopPropagation();
                data.onSelect();
              }}
              style={
                data.selected
                  ? { display: 'none' }
                  : {
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      // Plain cardinality text — no tag fill; a faint chip only for
                      // readability over the canvas + a click affordance.
                      background: 'var(--ant-color-bg-base, #fff)',
                      border: `1px solid ${
                        warn ? 'var(--ant-color-warning, #faad14)' : 'var(--ant-color-border-secondary, #f0f0f0)'
                      }`,
                      padding: '2px 12px',
                      borderRadius: 12,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                      cursor: data.editable ? 'pointer' : 'default',
                      lineHeight: 1.5,
                      fontSize: 12,
                      fontWeight: 600,
                      color: data.free ? 'var(--ant-color-primary, #1677ff)' : 'var(--ant-color-text-secondary, #595959)',
                    }
              }
            >
              <span>{data.cardinalityLabel}</span>
              {warn ? (
                <WarningOutlined style={{ color: 'var(--ant-color-warning, #faad14)', fontSize: 12 }} />
              ) : null}
            </div>
          </Tooltip>

          {/* Expanded info-box — only when selected on an editor canvas. */}
          {data.editable && data.selected ? (
            <div
              data-component="CanvasEdgePad"
              className="canvas-edge-box"
              onClick={(e) => e.stopPropagation()}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                minWidth: 220,
                maxWidth: 320,
                background: 'var(--ant-color-bg-base, #fff)',
                border: '1px solid var(--ant-color-border, #d9d9d9)',
                borderRadius: 8,
                padding: '8px 12px 10px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.16)',
              }}
            >
              {/* close [×] — circle, top-right */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: -6 }}>
                <Button
                  size="small"
                  type="text"
                  shape="circle"
                  icon={<CloseOutlined />}
                  aria-label={data.i18n.close}
                  onClick={data.onDeselect}
                  data-component="CanvasEdgeClose"
                  style={{ height: 22, minWidth: 22 }}
                />
              </div>
              <EdgeInfoRow label={data.i18n.onLabel} value={data.keyPair} />
              <EdgeInfoRow label={data.i18n.joinLabel} value={data.typeLabel} />
              <EdgeInfoRow label={data.i18n.relLabel} value={data.cardinalityLabel} />
              <EdgeInfoRow
                label={data.i18n.relTypeLabel}
                value={data.free ? data.i18n.freeForm : data.i18n.governed}
              />
              <span
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  flexWrap: 'wrap',
                  borderTop: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
                  paddingTop: 8,
                  marginTop: 2,
                }}
              >
                {/* Promote — a query-owned rel pushed up to the governed ER.
                    R167 removed the `promotable` guard that hid this on a
                    `qr_`-side edge; R171 restored a guard for the OTHER shape it
                    left open. An edge whose ordered pair the governed ER already
                    holds — a copy-on-picked one, most obviously — can only come
                    back `409 relationship_exists`, so it is offered DISABLED
                    with the reason rather than hidden: hiding it on some edges
                    and not others raises the question the tooltip answers. D4
                    (unofferable at the gesture, never an error at run). */}
                <Tooltip title={data.promoteCollides ? data.i18n.promoteBlocked : data.i18n.promoteTip}>
                  <Button
                    size="small"
                    type="link"
                    loading={data.promoting}
                    disabled={data.promoteCollides}
                    onClick={data.onPromote}
                    data-component="CanvasPromote"
                    data-blocked={data.promoteCollides ? 'true' : 'false'}
                    style={{ margin: 0, padding: 0, height: 22 }}
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
                    style={{ margin: 0, padding: 0, height: 22, color: 'var(--ant-color-warning, #faad14)' }}
                  >
                    {data.i18n.resync}
                  </Button>
                ) : null}
                {/* Remove — a labelled link (like Promote), not a bare [×] icon. */}
                <Tooltip title={data.leaf ? '' : data.i18n.removeBlocked}>
                  <Button
                    size="small"
                    type="link"
                    danger
                    disabled={!data.leaf}
                    onClick={data.onDelete}
                    aria-label={data.leaf ? data.i18n.remove : data.i18n.removeBlocked}
                    data-component="CanvasEdgeDelete"
                    data-leaf={data.leaf ? 'true' : 'false'}
                    style={{ margin: 0, padding: 0, height: 22 }}
                  >
                    {data.i18n.remove}
                  </Button>
                </Tooltip>
              </span>
            </div>
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
  rootSourceId,
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
  const sourceName = useCallback((id: string) => dsNameById.get(id) ?? id, [dsNameById]);

  // The display columns of a source — every source is a dataset since R167, so this is
  // just its own columns, each with its dtype (for the per-field type glyph, R93 F2).
  // It used to fan out to a `qr_`'s EFFECTIVE space (read off wire provenance); that
  // whole apparatus retired with composition.
  const columnsOf = useCallback(
    (id: string): { name: string; dtype: Dtype }[] =>
      (dsColumnsById.get(id) ?? []).map((c) => ({ name: c.name, dtype: c.dtype })),
    [dsColumnsById],
  );

  // R93 — a drawn column's dtype (from the same per-source column space the nodes render),
  // for the draw-time dtype guard; `null` when unknown (data not yet loaded → not blocked).
  const dtypeOf = useCallback(
    (sourceId: string, column: string): string | null =>
      columnsOf(sourceId).find((c) => c.name === column)?.dtype ?? null,
    [columnsOf],
  );

  const rootId = rootSourceId;

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

  // Build the node set + edges from the query's own join tree (pure `buildSourceGraph`,
  // shared logic in joinGraph.ts), then attach the per-edge column-drift staleness flag
  // (a loaded-data check that stays component-side).
  const { nodeIds, parentOf, builtEdges, unresolved } = useMemo(() => {
    const g = buildSourceGraph(rootId, joins, qrelById);
    const built = g.edges.map((e) => ({
      ...e,
      stale:
        columnMissing(e.qrel.leftSourceId, e.qrel.leftColumn) ||
        columnMissing(e.qrel.rightSourceId, e.qrel.rightColumn),
    }));
    return { nodeIds: g.nodeIds, parentOf: g.parentOf, builtEdges: built, unresolved: g.unresolved };
  }, [rootId, joins, qrelById, columnMissing]);

  const graphIds = useMemo(() => graphDatasetIds(rootId, joins, qrelById), [rootId, joins, qrelById]);
  // Staged nodes that haven't been joined yet (drop any that became in-graph).
  const liveStaged = useMemo(() => staged.filter((id) => !graphIds.includes(id)), [staged, graphIds]);
  // Free-form lets you add ANY not-in-graph DATASET (not only ones with a governed
  // rel — that was R87's pick-only constraint).
  //
  // R166 — saved queries are no longer stageable. R92 had made the list symmetric
  // (datasets AND queries, "join anything to anything"), which is `query⋈query` —
  // what the closed Query concept refuses (_noun-model.md § D5, entry point #2).
  // The group is removed with NO replacement, deliberately: the intent it served —
  // compare two shaped results — is answered by the within-group column family
  // (R163/R165), inside one query, not by joining two. So the picker's rule is now
  // ONE rule (not on the canvas yet), and a user reaching for a saved query meets
  // an absence carrying no explanation — an explanation would advertise a
  // capability the product does not have (D4: unofferable at the gesture, never an
  // error at run).
  const stageable = useMemo(
    () => datasets.map((d) => d.id).filter((id) => !graphIds.includes(id) && !liveStaged.includes(id)),
    [datasets, graphIds, liveStaged],
  );
  const addEligible = useMemo(() => addEligibleRels(rels, graphIds), [rels, graphIds]);

  const heightOf = useCallback(
    (id: string): number => {
      const n = columnsOf(id).length;
      // Collapsed-tall nodes (a wide source) only render the visible slice + a toggle row.
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
    const unstageLabel = t('queries.builder.canvasUnstageSource');
    const make = (id: string, isStaged: boolean): Node<SourceNodeData> => {
      return {
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
          typeLabel: t('queries.builder.canvasNodeTypeDataset'),
          moreLabel,
          fewerLabel,
          unstageLabel,
          // Staged + editable → a [×] to unstage (pure canvas state).
          onUnstage: isStaged && editable ? () => setStaged((s) => s.filter((x) => x !== id)) : undefined,
          columns: columnsOf(id).map((c) => ({ name: c.name, dtype: c.dtype, stale: columnMissing(id, c.name) })),
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
    t,
  ]);

  const edges = useMemo<Edge<RelEdgeData>[]>(() => {
    const i18n = {
      freeForm: t('queries.builder.canvasFreeForm'),
      governed: t('queries.builder.canvasGoverned'),
      promote: t('queries.builder.canvasPromote'),
      promoteTip: t('queries.builder.canvasPromoteTip'),
      promoteBlocked: t('queries.builder.canvasPromoteBlocked'),
      resync: t('queries.builder.canvasResync'),
      remove: t('queries.builder.removeJoin'),
      removeBlocked: t('queries.builder.removeJoinBlocked'),
      selectTip: t('queries.builder.canvasEdgeSelectTip'),
      onLabel: t('queries.builder.canvasEdgeOnLabel'),
      joinLabel: t('queries.builder.canvasEdgeJoinLabel'),
      relLabel: t('queries.builder.canvasEdgeRelLabel'),
      relTypeLabel: t('queries.builder.canvasEdgeRelTypeLabel'),
      close: t('common.close'),
    };
    return builtEdges.map(({ hop, qrel, stale, leftNode, leftHandle }) => {
      const free = !qrel.originRelationshipId;
      const divergence = relDivergence(qrel, governedById);
      // R171 item 4 — Promote is offerable only when it can succeed.
      const promoteCollides = promoteWouldCollide(qrel, governedById);
      return {
        id: hop.queryRelId,
        source: leftNode,
        sourceHandle: leftHandle,
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
          promoteCollides,
          stale,
          leaf: isLeafHop(hop.queryRelId, joins, qrelById),
          editable,
          selected: selectedEdge === hop.queryRelId,
          promoting: promoteState?.pending === true && promotingId === hop.queryRelId,
          i18n,
          onSelect: () => setSelectedEdge(hop.queryRelId),
          onDeselect: () => setSelectedEdge(null),
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
    const id = requestAnimationFrame(() => rf.fitView({ padding: 0.2, maxZoom: 1, duration: 200 }));
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
      const res = resolveConnect(conn, graphIds, rels, dtypeOf);
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
    [editable, graphIds, rels, dtypeOf, message, t, onAddJoin],
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
                // R166 — a FLAT list of datasets. It was grouped (Datasets / Saved
                // queries) so the two kinds were told apart at the point of choosing;
                // with queries withdrawn there is one kind left, and a lone heading
                // labelling a list that can hold nothing else is chrome, not structure.
                options={stageable.map((id) => ({ value: id, label: sourceName(id) }))}
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
      {/* React Flow needs a DEFINITE-height parent (a flex chain that collapses
          → 0px → error #004). So the pane keeps an explicit height. R97 Item 1:
          the height is now VIEWPORT-RELATIVE — `calc(100svh - 280px)`, floored at
          420 — so it FILLS large screens, instead of the old `clamp(…, 60vh, 640)`
          that capped at 640px. (Definite, so no #004; the ~280px chrome offset is
          eyeball-tunable.) */}
      <div
        data-component="QueryCanvasPane"
        style={{
          // Maximized: fill the overlay (definite height:100% root). Inline: an
          // explicit viewport-relative height that fills + stays definite.
          ...(maximized
            ? { flex: '1 1 auto', minHeight: 0 }
            : { height: 'clamp(420px, calc(100svh - 280px), 2400px)', flex: '0 0 auto' }),
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
          // R97 Item 1 — cap the initial fit at 100% zoom; React Flow's default
          // maxZoom (2×) blew a small graph up to fill the (now larger) pane.
          fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          {/* R93 (I-phase) — pin the zoom/fit/maximize controls TOP-LEFT, not React Flow's
              default bottom-left: on a short viewport the bottom controls fell below the fold
              and needed a scroll to reach. Top-left is clear (the toolbar sits top-right). */}
          <Controls position="top-left" showInteractive={false}>
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
