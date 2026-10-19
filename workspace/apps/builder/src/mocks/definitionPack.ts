// R201 (item 4.8) — MSW stand-ins for the definition pack routes:
// GET /workspaces/:id/definitions and POST /workspaces/:id/definitions/import.
//
// The mock serves the SHAPE and the plan rules of
// .agents/design/data-management/_shared/definition-pack.md over the fixture
// workspace (one query, one workflow, one dashboard over `q1_pipeline_Deals`);
// it is not the server's engine — it runs no save check, so `check_failed`
// never appears here (tests serve it with `server.use`).

import { HttpResponse } from 'msw';

import type {
  DefinitionPack,
  ImportPlan,
  OnConflict,
  PackDashboard,
  PackDataset,
  PackQuery,
  PackWorkflow,
  PlanAction,
  PlanDataset,
  PlanItem,
  PlanKind,
} from '@/features/data-management/workspaces/definitionPack/types';
import {
  MOCK_DASHBOARDS,
  MOCK_DATASET,
  MOCK_DATASET_2,
  MOCK_DATASET_3,
  MOCK_DATASET_4,
  MOCK_DATASET_5,
  MOCK_QUERIES,
  MOCK_SAVED_WORKSPACE,
  MOCK_WORKFLOWS,
  MOCK_WORKSPACE,
} from './fixtures';

const DATASETS = [MOCK_DATASET, MOCK_DATASET_2, MOCK_DATASET_3, MOCK_DATASET_4, MOCK_DATASET_5];
const byName = <T extends { name: string }>(a: T, b: T) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

function datasetName(id: string): string {
  return DATASETS.find((d) => d.id === id)?.name ?? id;
}

function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>)
        .sort()
        .filter((k) => (v as Record<string, unknown>)[k] !== null && (v as Record<string, unknown>)[k] !== undefined)
        .map((k) => [k, canonical((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

const same = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

/** The fixture workspace's definitions, written by name. */
export function mockPackOf(workspaceName: string): DefinitionPack {
  const queryName = (id: string) => MOCK_QUERIES.find((q) => q.id === id)?.name ?? id;
  const queries: PackQuery[] = MOCK_QUERIES.map((q) => {
    const { relationships, ...rest } = q.definition as Record<string, unknown> & {
      relationships?: { leftSourceId: string; rightSourceId: string; originRelationshipId?: string }[];
    };
    return {
      name: q.name,
      dataset: datasetName(q.sourceId),
      definition: {
        ...rest,
        ...(relationships
          ? {
              relationships: relationships.map(({ leftSourceId, rightSourceId, originRelationshipId: _o, ...r }) => ({
                ...r,
                leftDataset: datasetName(leftSourceId),
                rightDataset: datasetName(rightSourceId),
              })),
            }
          : {}),
      },
    };
  }).sort(byName);
  const workflows: PackWorkflow[] = MOCK_WORKFLOWS.map((w) => ({
    name: w.name,
    definition: {
      ...w.definition,
      sources: w.definition.sources.map((s) =>
        s.startsWith('qr_') ? { query: queryName(s) } : { workflow: MOCK_WORKFLOWS.find((x) => x.id === s)?.name ?? s },
      ),
    },
  })).sort(byName);
  const dashboards: PackDashboard[] = MOCK_DASHBOARDS.map((d) => ({
    name: d.name,
    slug: d.slug,
    definition: {
      ...d.definition,
      widgets: d.definition.widgets.map(({ queryId, ...w }) => (queryId ? { ...w, query: queryName(queryId) } : w)),
    },
  })).sort(byName);
  const used = new Set(queries.map((q) => q.dataset));
  const datasets: PackDataset[] = DATASETS.filter((d) => used.has(d.name))
    .map((d) => ({ name: d.name, columns: d.columns.map(({ name, dtype }) => ({ name, dtype })) }))
    .sort(byName);
  return {
    packVersion: 1,
    exportedAt: '2026-10-19T09:00:00Z',
    exportedBy: '0.0.1.dev0',
    workspace: workspaceName,
    datasets,
    queries,
    workflows,
    dashboards,
  };
}

const ZERO: Record<PlanAction, number> = {
  create: 0,
  replace: 0,
  unchanged: 0,
  skip: 0,
  deferred: 0,
  conflict: 0,
  invalid: 0,
};

/** A mock stand-in for the server's `planHash` (FNV-1a over the decisions); the
 *  mock serves the rule (same decisions → same hash), not the server's value. */
function mockPlanHash(onConflict: OnConflict, datasets: PlanDataset[], items: PlanItem[]): string {
  const text = JSON.stringify(
    canonical({
      onConflict,
      datasets: datasets.map((d) => [d.name, d.status]),
      items: items.map((i) => [i.kind, i.name, i.action, i.reason, i.detail, i.via, i.binds]),
    }),
  );
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i += 1) {
    h1 = Math.imul(h1 ^ text.charCodeAt(i), 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ text.charCodeAt(i), 0x01000193) >>> 0;
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).slice(0, 12);
}

/** Plan a pack against the fixture workspace (any other main workspace is
 *  empty). Same rules as the server's step 2–3 (design § Import); no save
 *  check, and no `source_differs` (the fixture has one dataset per query). */
export function mockPlan(
  workspaceId: string,
  pack: DefinitionPack,
  onConflict: OnConflict,
  dryRun: boolean,
): ImportPlan {
  const inFixture = workspaceId === MOCK_WORKSPACE.id;
  const here = inFixture ? mockPackOf(MOCK_WORKSPACE.name) : null;
  const targetDatasets = inFixture ? DATASETS : [];
  const read = new Set(
    pack.queries.flatMap((q) => [
      q.dataset,
      ...((q.definition.relationships ?? []) as { leftDataset: string; rightDataset: string }[]).flatMap((r) => [
        r.leftDataset,
        r.rightDataset,
      ]),
    ]),
  );
  const packWorkflows = new Set(pack.workflows.map((w) => w.name));

  const datasets: PlanDataset[] = pack.datasets.map((ds) => {
    const pub = ds.publishedBy ? { publishedBy: ds.publishedBy } : {};
    if (!read.has(ds.name)) return { name: ds.name, status: 'unused', ...pub };
    const t = targetDatasets.find((d) => d.name === ds.name);
    if (!t) {
      return ds.publishedBy && packWorkflows.has(ds.publishedBy)
        ? { name: ds.name, status: 'awaits_publish', ...pub }
        : { name: ds.name, status: 'missing', ...pub };
    }
    const found = t.columns.map(({ name, dtype }) => ({ name, dtype }));
    return same(found, ds.columns)
      ? { name: ds.name, status: 'found', ...pub }
      : { name: ds.name, status: 'columns_differ', ...pub, columns: { expected: ds.columns, found } };
  });
  const dsOf = new Map(datasets.map((d) => [d.name, d]));
  const broken = new Set<string>(); // `${kind}:${name}` that cannot be imported
  const later = new Set<string>(); // deferred
  const kept = new Set<string>(); // skipped (Keep mine) with a differing definition

  const idHere = (kind: PlanKind, name: string): string | undefined => {
    const pool: readonly { id: string; name: string }[] =
      kind === 'query' ? MOCK_QUERIES : kind === 'workflow' ? MOCK_WORKFLOWS : MOCK_DASHBOARDS;
    return pool.find((n) => n.name === name)?.id;
  };
  const decide = (kind: PlanKind, name: string, existing: unknown, mine: unknown, reads: string[]): PlanItem => {
    const bound = reads
      .filter((k) => kept.has(k))
      .map((k) => ({ kind: k.split(':')[0] as PlanKind, name: k.slice(k.indexOf(':') + 1) }));
    const binds = bound.length ? { binds: bound } : {};
    if (existing === undefined) return { kind, name, action: 'create', ...binds };
    const id = idHere(kind, name);
    if (same(existing, mine)) return { kind, name, action: 'unchanged', id, ...binds };
    if (onConflict === 'replace') return { kind, name, action: 'replace', id, ...binds };
    if (onConflict === 'skip') {
      kept.add(`${kind}:${name}`);
      return { kind, name, action: 'skip', id, ...binds };
    }
    return { kind, name, action: 'conflict', id, reason: 'exists' };
  };
  const blocked = (kind: PlanKind, name: string, reads: string[]): PlanItem | null => {
    const bad = reads.find((k) => broken.has(k));
    if (bad) {
      broken.add(`${kind}:${name}`);
      return { kind, name, action: 'invalid', reason: 'needs', detail: bad.slice(bad.indexOf(':') + 1) };
    }
    const wait = reads.find((k) => later.has(k));
    if (wait) {
      later.add(`${kind}:${name}`);
      return { kind, name, action: 'deferred', reason: 'needs', detail: wait.slice(wait.indexOf(':') + 1) };
    }
    return null;
  };

  const items: PlanItem[] = [];
  for (const q of pack.queries) {
    const ds = dsOf.get(q.dataset);
    if (ds?.status === 'awaits_publish') {
      later.add(`query:${q.name}`);
      items.push({
        kind: 'query',
        name: q.name,
        action: 'deferred',
        reason: 'awaits_publish',
        detail: q.dataset,
        via: ds.publishedBy,
      });
      continue;
    }
    if (ds?.status !== 'found') {
      broken.add(`query:${q.name}`);
      items.push({
        kind: 'query',
        name: q.name,
        action: 'invalid',
        reason: ds?.status === 'columns_differ' ? 'columns_differ' : 'dataset_missing',
        detail: q.dataset,
      });
      continue;
    }
    items.push(
      decide(
        'query',
        q.name,
        here?.queries.find((x) => x.name === q.name),
        q,
        [],
      ),
    );
  }
  for (const w of pack.workflows) {
    const reads = w.definition.sources.map((s) => ('query' in s ? `query:${s.query}` : `workflow:${s.workflow}`));
    items.push(
      blocked('workflow', w.name, reads) ??
        decide(
          'workflow',
          w.name,
          here?.workflows.find((x) => x.name === w.name),
          w,
          reads,
        ),
    );
  }
  for (const d of pack.dashboards) {
    const reads = ((d.definition.widgets ?? []) as { query?: string }[]).flatMap((x) =>
      x.query === undefined ? [] : [`query:${x.query}`],
    );
    items.push(
      blocked('dashboard', d.name, reads) ??
        decide(
          'dashboard',
          d.name,
          here?.dashboards.find((x) => x.name === d.name),
          d,
          reads,
        ),
    );
  }

  const counts = { ...ZERO };
  for (const it of items) counts[it.action] += 1;
  const ok =
    datasets.every((d) => d.status !== 'missing' && d.status !== 'columns_differ') &&
    counts.conflict === 0 &&
    counts.invalid === 0;
  const applied = !dryRun && ok;
  return {
    dryRun,
    applied,
    onConflict,
    ok,
    planHash: mockPlanHash(onConflict, datasets, items),
    warnings: items.filter((i) => i.binds).length,
    datasets,
    items: applied
      ? items.map((it, i) =>
          it.action === 'create'
            ? {
                ...it,
                id: `${it.kind === 'query' ? 'qr' : it.kind === 'workflow' ? 'wf' : 'dsh'}_${(0x10000000 + i).toString(16)}`,
              }
            : it,
        )
      : items,
    counts,
  };
}

/** The two route resolvers (wrapped with contract validation in handlers.ts). */
export function exportDefinitionsResolver(workspaceId: string) {
  if (workspaceId !== MOCK_WORKSPACE.id && workspaceId !== MOCK_SAVED_WORKSPACE.id) {
    return HttpResponse.json({ code: 'not_found' }, { status: 404 });
  }
  const name = workspaceId === MOCK_WORKSPACE.id ? MOCK_WORKSPACE.name : MOCK_SAVED_WORKSPACE.name;
  return HttpResponse.json(
    workspaceId === MOCK_WORKSPACE.id
      ? mockPackOf(name)
      : { ...mockPackOf(name), datasets: [], queries: [], workflows: [], dashboards: [] },
  );
}

export function importDefinitionsResolver(workspaceId: string, url: URL, body: unknown) {
  if (workspaceId === MOCK_SAVED_WORKSPACE.id) {
    return HttpResponse.json({ code: 'read_only_workspace' }, { status: 409 });
  }
  const pack = body as DefinitionPack;
  if (pack?.packVersion !== 1) {
    return HttpResponse.json(
      { code: 'pack_invalid', reason: 'version', problems: [], packVersion: pack?.packVersion, supported: [1] },
      { status: 422 },
    );
  }
  const dryRun = url.searchParams.get('dryRun') === 'true';
  const onConflict = (url.searchParams.get('onConflict') ?? 'refuse') as OnConflict;
  const expected = url.searchParams.get('expectedPlan');
  const plan = mockPlan(workspaceId, pack, onConflict, dryRun);
  if (!dryRun && expected && expected !== plan.planHash) {
    return HttpResponse.json(
      { code: 'pack_refused', reason: 'plan_changed', plan: { ...plan, applied: false } },
      { status: 409 },
    );
  }
  if (!dryRun && !plan.ok) return HttpResponse.json({ code: 'pack_refused', reason: 'not_ok', plan }, { status: 409 });
  return HttpResponse.json(plan);
}
