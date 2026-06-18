// QueryCanvas (R85, Phase A) — the READ-ONLY source-graph VIEW of a Query's
// `definition.joins` tree, a view mode of the builder (canvas.md § J-5).
//
// It is NOT a new model, route, or noun: it renders exactly the `joins[]` the
// hop-list (`JoinEditor`) already edits, resolving each hop's dataset names +
// key pair + cardinality through the SAME `useRelationshipsQuery` /
// `useDatasetsQuery` / `useQueriesQuery` the list uses (reuse, not a parallel
// fetch path). Nodes = the driving `sourceId` + each hop's right dataset; edges
// = the `JoinStep`s, labelled with the key pair + advisory cardinality. The
// render is a hand-rolled SVG (edges) + AntD-styled DOM node cards (R85 Design-
// gate decision — no graph-lib peer dep), positioned by a small deterministic
// depth/row tree-layout.
//
// Read-only: the LIST view stays the editor (canvas.md accessibility — List is
// the keyboard/SR-complete equivalent and the assistive-tech default). Phase A
// adds zero editing; draw-edge/delete-leaf is Phase B (R86).

import { Alert, Tag, Tooltip, Typography } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useDatasetsQuery } from '@/features/data-management/datasets/hooks';
import { useRelationshipsQuery } from '@/features/data-management/relationships/hooks';
import type { Relationship } from '@/features/data-management/relationships/types';
import { useQueriesQuery } from './hooks';
import type { JoinStep } from './types';

// Bounded-small trees (2–4 nodes, canvas.md J-2) → fixed node boxes + generous
// inter-column gaps for the edge + its text label.
const NODE_W = 150;
const NODE_H = 60;
// The inter-column gap must hold an edge's text label (key pair + tags) without
// overflowing into the neighbouring node — the label is width-capped to it below.
const COL_GAP = 196;
const ROW_GAP = 36;
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
  /** The working-copy hops (ordered, topological) — the same array the list edits. */
  joins: readonly JoinStep[];
}>;

type LaidOutNode = Readonly<{ id: string; col: number; row: number }>;

/** A small deterministic tree layout: BFS depth from the root (column), nodes
 *  stacked by insertion order within a column (row). Bounded-small, so a generic
 *  graph engine is overkill (R85 Design-gate decision). */
function layout(nodeIds: readonly string[], parentOf: Map<string, string>): {
  nodes: LaidOutNode[];
  cols: number;
  rows: number;
} {
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
  const rowCursor = new Map<number, number>();
  const nodes = nodeIds.map((id) => {
    const col = depthOf(id);
    const row = rowCursor.get(col) ?? 0;
    rowCursor.set(col, row + 1);
    return { id, col, row };
  });
  const cols = nodes.reduce((m, n) => Math.max(m, n.col), 0) + 1;
  const rows = Math.max(0, ...rowCursor.values());
  return { nodes, cols, rows };
}

const nodeLeft = (col: number) => PAD + col * (NODE_W + COL_GAP);
const nodeTop = (row: number) => PAD + row * (NODE_H + ROW_GAP);

export function QueryCanvas({ datasetId, baseSourceId, workspaceId, joins }: QueryCanvasProps) {
  const { t } = useTranslation();
  // Resolve names + edges through the SAME hooks the JoinEditor uses (reuse).
  const relationshipsQuery = useRelationshipsQuery(workspaceId);
  const rels = useMemo(() => relationshipsQuery.data ?? [], [relationshipsQuery.data]);
  const relById = useMemo(() => new Map(rels.map((r) => [r.id, r])), [rels]);
  const datasetsQuery = useDatasetsQuery(workspaceId);
  const datasets = useMemo(() => datasetsQuery.data ?? [], [datasetsQuery.data]);
  const dsNameById = useMemo(() => new Map(datasets.map((d) => [d.id, d.name])), [datasets]);
  const queriesQuery = useQueriesQuery(workspaceId);
  const qrNameById = useMemo(
    () => new Map((queriesQuery.data ?? []).map((q) => [q.id, q.name])),
    [queriesQuery.data],
  );
  const sourceName = (id: string) => dsNameById.get(id) ?? qrNameById.get(id) ?? id;

  const rootId = datasetId || baseSourceId;

  // Build the node set (root + each hop's endpoints, insertion-ordered) and the
  // edges from the resolved relationships — exactly the tree `joins[]` encodes.
  const { nodeIds, edges, parentOf, unresolved } = useMemo(() => {
    const ids: string[] = [];
    const push = (id: string) => {
      if (id && !ids.includes(id)) ids.push(id);
    };
    push(rootId);
    const parent = new Map<string, string>();
    const built: Array<{ key: string; from: string; to: string; rel: Relationship; type: JoinStep['type'] }> = [];
    const missing: JoinStep[] = [];
    for (const hop of joins) {
      const rel = relById.get(hop.relationshipId);
      if (!rel) {
        missing.push(hop);
        continue;
      }
      push(rel.leftDatasetId);
      push(rel.rightDatasetId);
      if (!parent.has(rel.rightDatasetId)) parent.set(rel.rightDatasetId, rel.leftDatasetId);
      built.push({ key: hop.relationshipId, from: rel.leftDatasetId, to: rel.rightDatasetId, rel, type: hop.type });
    }
    return { nodeIds: ids, edges: built, parentOf: parent, unresolved: missing };
  }, [rootId, joins, relById]);

  const { nodes, cols, rows } = useMemo(() => layout(nodeIds, parentOf), [nodeIds, parentOf]);
  const posById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const width = cols * (NODE_W + COL_GAP) - COL_GAP + PAD * 2;
  const height = rows * (NODE_H + ROW_GAP) - ROW_GAP + PAD * 2;

  const cardinalityLabel = (r: Relationship) => t(`relationships.cardinality.${r.cardinality}`);
  const keyPairLabel = (r: Relationship) => `${r.leftColumn} ↔ ${r.rightColumn}`;
  const staleEdges = edges.filter((e) => e.rel.status === 'stale');

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
      <div style={{ position: 'relative', width, height: Math.max(height, NODE_H + PAD * 2) }}>
        {/* ── Edges (SVG, behind the node cards) ─────────────────────────── */}
        <svg
          width={width}
          height={Math.max(height, NODE_H + PAD * 2)}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          aria-hidden
        >
          {edges.map((e) => {
            const from = posById.get(e.from);
            const to = posById.get(e.to);
            if (!from || !to) return null;
            const x1 = nodeLeft(from.col) + NODE_W;
            const y1 = nodeTop(from.row) + NODE_H / 2;
            const x2 = nodeLeft(to.col);
            const y2 = nodeTop(to.row) + NODE_H / 2;
            const stale = e.rel.status === 'stale';
            return (
              <line
                key={e.key}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={
                  stale
                    ? 'var(--ant-color-warning, #faad14)'
                    : 'var(--ant-color-border, #d9d9d9)'
                }
                strokeWidth={stale ? 2 : 1.5}
                strokeDasharray={stale ? '5 4' : undefined}
              />
            );
          })}
        </svg>

        {/* ── Edge labels (DOM, at each edge midpoint) ───────────────────── */}
        {edges.map((e) => {
          const from = posById.get(e.from);
          const to = posById.get(e.to);
          if (!from || !to) return null;
          const midX = (nodeLeft(from.col) + NODE_W + nodeLeft(to.col)) / 2;
          const midY = (nodeTop(from.row) + nodeTop(to.row)) / 2 + NODE_H / 2;
          return (
            <div
              key={e.key}
              data-component="CanvasEdge"
              data-stale={e.rel.status === 'stale' ? 'true' : 'false'}
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
                {keyPairLabel(e.rel)}
              </Typography.Text>
              <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Tag style={{ margin: 0 }}>{cardinalityLabel(e.rel)}</Tag>
                <Tag color="default" style={{ margin: 0 }}>
                  {t(`queries.builder.joinTypeShort.${e.type}`)}
                </Tag>
              </span>
            </div>
          );
        })}

        {/* ── Nodes (DOM cards, above the edges) ─────────────────────────── */}
        {nodes.map((n) => {
          const driving = n.id === rootId;
          return (
            <div
              key={n.id}
              data-component="CanvasNode"
              data-driving={driving ? 'true' : 'false'}
              style={{
                position: 'absolute',
                left: nodeLeft(n.col),
                top: nodeTop(n.row),
                width: NODE_W,
                minHeight: NODE_H,
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: 2,
                padding: '8px 10px',
                background: 'var(--ant-color-bg-base, #fff)',
                border: `1px solid ${
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
            </div>
          );
        })}
      </div>

      {/* ── Stale-edge alerts — flag-don't-crash, per edge (canvas.md). The
          per-edge state is derived from each resolved Relationship.status; the
          fix lives in the List view (Phase A is read-only). ──────────────── */}
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
            column: e.rel.leftColumn,
          })}
        />
      ))}

      {/* Unresolvable hops (a relationship no longer in the workspace) — named,
          never a blank crash. Rare; the List view resolves it. */}
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
