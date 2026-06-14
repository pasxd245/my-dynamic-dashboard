// R41: MSW REST handlers mirroring the OpenAPI contracts under
// workspace/packages/contracts/. One default handler per endpoint
// the FE touches today; per-test overrides via `server.use(...)`.
//
// The rows-GET handler implements filter + q + pagination in JS so
// the dev experience round-trips correctly without a running BE.
// The per-dtype CAST semantics mirror R39's DuckDB SQL; the JS
// fixture is only ~10 rows so perf is irrelevant.
//
// URL matching uses a wildcard path so MSW handles both
// `http://localhost:8000/datasets` and any other API base — the
// production code resolves `apiBaseUrl()` from
// `src/config/appConfig.ts`; the mocks don't need to know which.

import { http, HttpResponse } from 'msw';

import { OPS_BY_DTYPE, type FilterPredicate, type Operator } from '@/features/data-management/datasets/filters/types';
import type { Column } from '@/features/data-management/datasets/types';
import type {
  CreateQueryRequest,
  PreviewQueryRequest,
  QueryDefinition,
  UpdateQueryRequest,
} from '@/features/data-management/queries/types';
import type { CreateRelationshipRequest } from '@/features/data-management/relationships/types';
import { withContractValidation } from './contract-validator';
import {
  MOCK_CHAIN_COLUMNS,
  MOCK_CHAIN_ROWS,
  MOCK_DATASET,
  MOCK_DATASET_2,
  MOCK_JOINED_QUERY,
  MOCK_JOINED_ROWS,
  MOCK_QUERIES,
  MOCK_QUERY,
  MOCK_RELATIONSHIPS_CHAIN,
  MOCK_ROWS,
  MOCK_STALE_JOIN_QUERY_ID,
  MOCK_STALE_QUERY_ID,
  MOCK_STALE_RELATIONSHIP,
  MOCK_WORKSPACE,
} from './fixtures';

// Match either the configured API base (production / dev) or any
// origin (test runs with arbitrary defaults). MSW v2 supports
// `*/path` as an origin-wildcard.
function api(path: string): string {
  return `*${path}`;
}

// ─── Helpers shared with the rows-GET handler ───────────────────────

type Pred = {
  col: number;
  op: Operator;
  val?: string;
  min?: string;
  max?: string;
};

function parsePredicates(searchParams: URLSearchParams): Pred[] {
  const byIndex = new Map<number, Pred>();
  for (const [key, value] of searchParams.entries()) {
    const m = /^f(\d+)_(op|val|min|max)$/.exec(key);
    if (!m) continue;
    const n = Number(m[1]);
    const field = m[2] as 'op' | 'val' | 'min' | 'max';
    const existing = byIndex.get(n) ?? { col: n, op: '' as Operator };
    if (field === 'op') existing.op = value as Operator;
    else existing[field] = value;
    byIndex.set(n, existing);
  }
  return [...byIndex.values()].sort((a, b) => a.col - b.col);
}

function cellMatches(cell: string | null, p: Pred, dtype: string): boolean {
  const op = p.op;
  if (op === 'is_null') return cell === null;
  if (op === 'is_not_null') return cell !== null;
  if (dtype === 'string') {
    if (op === 'is_empty') return cell === null || cell === '';
    if (op === 'is_not_empty') return cell !== null && cell !== '';
    if (cell === null) return false;
    const v = (p.val ?? '').toLowerCase();
    const c = cell.toLowerCase();
    if (op === 'contains') return c.includes(v);
    if (op === 'equals') return c === v;
    if (op === 'starts_with') return c.startsWith(v);
    if (op === 'ends_with') return c.endsWith(v);
    return false;
  }
  if (dtype === 'boolean') {
    if (cell === null) return false;
    if (op === 'is_true') return cell === 'true';
    if (op === 'is_false') return cell === 'false';
    return false;
  }
  if (dtype === 'integer' || dtype === 'float') {
    if (cell === null) return false;
    const cn = Number(cell);
    if (op === 'between') {
      const lo = Number(p.min);
      const hi = Number(p.max);
      return cn >= lo && cn <= hi;
    }
    const vn = Number(p.val);
    if (op === 'equals') return cn === vn;
    if (op === 'ne') return cn !== vn;
    if (op === 'gt') return cn > vn;
    if (op === 'lt') return cn < vn;
    if (op === 'gte') return cn >= vn;
    if (op === 'lte') return cn <= vn;
    return false;
  }
  if (dtype === 'date' || dtype === 'datetime') {
    if (cell === null) return false;
    if (op === 'between') {
      return cell >= (p.min ?? '') && cell <= (p.max ?? '');
    }
    const v = p.val ?? '';
    if (op === 'equals') return cell === v;
    if (op === 'ne') return cell !== v;
    if (op === 'before') return cell < v;
    if (op === 'after') return cell > v;
    return false;
  }
  return false;
}

/** A row matches the advanced query iff ANY group matches (OR),
 *  where a group matches iff ALL its atoms match (AND). Empty
 *  groups → no advanced query active → always matches. */
function rowMatchesAq(
  row: readonly (string | null)[],
  columns: readonly Column[],
  groups: readonly (readonly Pred[])[],
): boolean {
  if (groups.length === 0) return true;
  return groups.some((group) =>
    group.every((p) => {
      const col = columns[p.col];
      if (!col) return false;
      return cellMatches(row[p.col] ?? null, p, col.dtype);
    }),
  );
}

function applyFiltersAndQ(
  rows: readonly (readonly (string | null)[])[],
  columns: readonly Column[],
  preds: readonly Pred[],
  q: string | null,
  aqGroups: readonly (readonly Pred[])[],
): (string | null)[][] {
  const ql = q ? q.toLowerCase() : '';
  return rows
    .filter((row) => {
      // AND across all per-column chip predicates.
      for (const p of preds) {
        const col = columns[p.col];
        if (!col) return false;
        if (!cellMatches(row[p.col] ?? null, p, col.dtype)) return false;
      }
      // AND the advanced query (itself an OR-of-AND).
      if (!rowMatchesAq(row, columns, aqGroups)) return false;
      // q substring across any cell.
      if (q) {
        const any = row.some((c) => c !== null && c.toLowerCase().includes(ql));
        if (!any) return false;
      }
      return true;
    })
    .map((r) => [...r]);
}

type AqParseResult =
  | { ok: true; groups: Pred[][] }
  | { ok: false; loc: string[]; msg: string };

/** Parse + validate the `aq` JSON param. Mirrors the BE: malformed
 *  JSON / structure → `advanced_query_malformed`; a bad atom → the
 *  existing `filter_*` code with `loc = ["query", "aq"]`. */
function parseAq(searchParams: URLSearchParams, columns: readonly Column[]): AqParseResult {
  const raw = searchParams.get('aq');
  if (!raw) return { ok: true, groups: [] };
  const malformed = (reason: string): AqParseResult => ({
    ok: false,
    loc: ['query', 'aq'],
    msg: `advanced_query_malformed: ${reason}`,
  });
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return malformed('aq is not valid JSON');
  }
  if (!Array.isArray(parsed)) return malformed('aq must be an array of groups');
  const groups: Pred[][] = [];
  for (const group of parsed) {
    if (!Array.isArray(group)) return malformed('each aq group must be an array');
    const atoms: Pred[] = [];
    for (const atom of group) {
      if (typeof atom !== 'object' || atom === null) return malformed('each aq atom must be an object');
      const o = atom as Record<string, unknown>;
      const col = o.col;
      const op = o.op;
      if (typeof col !== 'number' || typeof op !== 'string') return malformed('atom needs numeric col + string op');
      if (col < 0 || col >= columns.length) {
        return {
          ok: false,
          loc: ['query', 'aq'],
          msg: `filter_col_out_of_range: column ${col} does not exist (columnCount = ${columns.length})`,
        };
      }
      const c = columns[col];
      if (!OPS_BY_DTYPE[c.dtype].includes(op as Operator)) {
        return {
          ok: false,
          loc: ['query', 'aq'],
          msg: `filter_op_dtype_mismatch: op '${op}' is not valid for dtype '${c.dtype}'`,
        };
      }
      atoms.push({
        col,
        op: op as Operator,
        val: o.val != null ? String(o.val) : undefined,
        min: o.min != null ? String(o.min) : undefined,
        max: o.max != null ? String(o.max) : undefined,
      });
    }
    if (atoms.length > 0) groups.push(atoms);
  }
  return { ok: true, groups };
}

function validateFiltersOr422(
  preds: readonly Pred[],
  columns: readonly Column[],
): { ok: true } | { ok: false; loc: string[]; msg: string } {
  for (const p of preds) {
    if (p.col >= columns.length) {
      return {
        ok: false,
        loc: ['query', `f${p.col}_op`],
        msg: `filter_col_out_of_range: column ${p.col} does not exist (columnCount = ${columns.length})`,
      };
    }
    const col = columns[p.col];
    if (!OPS_BY_DTYPE[col.dtype].includes(p.op)) {
      return {
        ok: false,
        loc: ['query', `f${p.col}_op`],
        msg: `filter_op_dtype_mismatch: op '${p.op}' is not valid for dtype '${col.dtype}'`,
      };
    }
  }
  return { ok: true };
}

// ─── Saved-query helpers (R69) ──────────────────────────────────────
//
// A saved Query stores a `definition` (the same FilterPredicate atoms
// the chip filters + advanced DNF produce). Running it re-uses the
// dataset rows-GET engine above: convert the stored atoms back into the
// handler's `Pred` shape and feed `applyFiltersAndQ`.

function predFromAtom(atom: FilterPredicate): Pred {
  const p: Pred = { col: atom.col, op: atom.op };
  if ('val' in atom && atom.val != null) p.val = String(atom.val);
  if ('min' in atom && atom.min != null) p.min = String(atom.min);
  if ('max' in atom && atom.max != null) p.max = String(atom.max);
  return p;
}

// ─── Handlers ────────────────────────────────────────────────────────
//
// R45: every JSON-2xx handler is wrapped with `withContractValidation`
// so response bodies are schema-checked against the contract YAMLs at
// the handler boundary. R42 wrapped only `getDatasetRows` (the only
// ref-less contract); R45 extended the validator with cross-file
// `$ref` resolution so the rest of the production endpoints can
// participate. DELETE handlers stay unwrapped — they return 204 and
// bypass the validator by the content-type guard.

export const handlers = [
  // Workspaces
  withContractValidation('get', api('/workspaces'), 'listWorkspaces', () =>
    HttpResponse.json([MOCK_WORKSPACE]),
  ),
  withContractValidation('post', api('/workspaces'), 'createWorkspace', async ({ request }) => {
    const body = (await request.json()) as { name?: string };
    return HttpResponse.json(
      {
        id: `ws_${Math.random().toString(16).slice(2, 10)}`,
        name: body.name ?? 'untitled',
        createdAt: new Date().toISOString(),
      },
      { status: 201 },
    );
  }),
  withContractValidation('patch', api('/workspaces/:id'), 'renameWorkspace', async ({ params, request }) => {
    const body = (await request.json()) as { name?: string };
    return HttpResponse.json({
      ...MOCK_WORKSPACE,
      id: String(params.id),
      name: body.name ?? MOCK_WORKSPACE.name,
    });
  }),
  http.delete(api('/workspaces/:id'), () => new HttpResponse(null, { status: 204 })),

  // Datasets list / detail
  withContractValidation('get', api('/datasets'), 'listDatasets', ({ request }) => {
    const url = new URL(request.url);
    const ws = url.searchParams.get('workspace_id');
    if (ws && ws !== MOCK_WORKSPACE.id) return HttpResponse.json([]);
    // Two datasets in the workspace (R70) so relationships have two sides.
    return HttpResponse.json([MOCK_DATASET, MOCK_DATASET_2]);
  }),
  withContractValidation('get', api('/datasets/:id'), 'getDataset', ({ params }) => {
    const ds = [MOCK_DATASET, MOCK_DATASET_2].find((d) => d.id === params.id);
    if (!ds) {
      return HttpResponse.json({ code: 'not_found' }, { status: 404 });
    }
    return HttpResponse.json(ds);
  }),

  // Datasets rows — filter + q + pagination AND-compose.
  // R42: wrapped with `withContractValidation` so the 200 response
  // body is schema-checked against the rows-get contract YAML.
  // Drift between this handler and the contract throws a
  // ContractDriftError in tests (loud) and warns in dev (visible).
  withContractValidation('get', api('/datasets/:id/rows'), 'getDatasetRows', ({ params, request }) => {
    if (params.id !== MOCK_DATASET.id) {
      return HttpResponse.json({ code: 'not_found' }, { status: 404 });
    }
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
    const pageSize = Math.max(1, Number(url.searchParams.get('page_size') ?? 50));
    const q = url.searchParams.get('q');
    const preds = parsePredicates(url.searchParams);

    const check = validateFiltersOr422(preds, MOCK_DATASET.columns);
    if (!check.ok) {
      return HttpResponse.json(
        { detail: [{ loc: check.loc, msg: check.msg, type: 'value_error' }] },
        { status: 422 },
      );
    }

    const aq = parseAq(url.searchParams, MOCK_DATASET.columns);
    if (!aq.ok) {
      return HttpResponse.json(
        { detail: [{ loc: aq.loc, msg: aq.msg, type: 'value_error' }] },
        { status: 422 },
      );
    }

    const matched = applyFiltersAndQ(MOCK_ROWS, MOCK_DATASET.columns, preds, q, aq.groups);
    const offset = (page - 1) * pageSize;
    const slice = matched.slice(offset, offset + pageSize);

    return HttpResponse.json({
      rows: slice,
      page,
      pageSize,
      total: matched.length,
    });
  }),

  // Datasets PATCH / DELETE / batch
  withContractValidation('patch', api('/datasets/:id'), 'renameDataset', async ({ params, request }) => {
    const body = (await request.json()) as { name?: string };
    return HttpResponse.json({
      ...MOCK_DATASET,
      id: String(params.id),
      name: body.name ?? MOCK_DATASET.name,
    });
  }),
  http.delete(api('/datasets/:id'), () => new HttpResponse(null, { status: 204 })),
  withContractValidation('post', api('/workspaces/:id/datasets/batch'), 'commitDatasetsBatch', async ({ request }) => {
    const body = (await request.json()) as { items?: Array<{ name?: string }> };
    const items = body.items ?? [];
    return HttpResponse.json(
      items.map((item, i) => ({
        ...MOCK_DATASET,
        id: `ds_${(i + 1).toString().padStart(8, '0')}`,
        name: item.name ?? `dataset_${i + 1}`,
      })),
      { status: 201 },
    );
  }),

  // Queries (R69 — Saved Query): create / list / get / run / delete.
  // The run handler re-executes the saved definition over MOCK_ROWS via
  // the SAME engine as getDatasetRows (live re-run, no materialization).
  withContractValidation('post', api('/workspaces/:id/queries'), 'createQuery', async ({ params, request }) => {
    const body = (await request.json()) as Partial<CreateQueryRequest>;
    return HttpResponse.json(
      {
        id: `qr_${Math.random().toString(16).slice(2, 10).padEnd(8, '0')}`,
        workspaceId: String(params.id),
        datasetId: body.datasetId ?? MOCK_DATASET.id,
        name: body.name ?? 'untitled query',
        definition: body.definition ?? { q: null, filters: [], advanced: [] },
        createdAt: new Date().toISOString(),
      },
      { status: 201 },
    );
  }),
  withContractValidation('get', api('/workspaces/:id/queries'), 'listQueries', ({ params }) => {
    if (params.id !== MOCK_WORKSPACE.id) return HttpResponse.json([]);
    return HttpResponse.json(MOCK_QUERIES);
  }),
  withContractValidation('get', api('/queries/:id'), 'getQuery', ({ params }) => {
    // R71: a joined query carries `definition.join` + `resolvedColumns`.
    if (params.id === MOCK_JOINED_QUERY.id) {
      return HttpResponse.json(MOCK_JOINED_QUERY);
    }
    if (params.id !== MOCK_QUERY.id) {
      return HttpResponse.json({ code: 'not_found' }, { status: 404 });
    }
    return HttpResponse.json(MOCK_QUERY);
  }),
  withContractValidation('get', api('/queries/:id/rows'), 'runQuery', ({ params, request }) => {
    if (params.id === MOCK_STALE_QUERY_ID) {
      return HttpResponse.json({ code: 'query_stale' }, { status: 409 });
    }
    // R71: a joined query over a stale edge → the join is blocked.
    if (params.id === MOCK_STALE_JOIN_QUERY_ID) {
      return HttpResponse.json({ code: 'relationship_stale' }, { status: 409 });
    }
    // R71: a valid joined query returns its joined rows (effective columns).
    if (params.id === MOCK_JOINED_QUERY.id) {
      const url = new URL(request.url);
      const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
      const pageSize = Math.max(1, Number(url.searchParams.get('page_size') ?? 50));
      const offset = (page - 1) * pageSize;
      return HttpResponse.json({
        rows: MOCK_JOINED_ROWS.rows.slice(offset, offset + pageSize),
        page,
        pageSize,
        total: MOCK_JOINED_ROWS.total,
      });
    }
    if (params.id !== MOCK_QUERY.id) {
      return HttpResponse.json({ code: 'not_found' }, { status: 404 });
    }
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
    const pageSize = Math.max(1, Number(url.searchParams.get('page_size') ?? 50));
    const def = MOCK_QUERY.definition;
    const preds = def.filters.map(predFromAtom);
    const aqGroups = def.advanced.map((g) => g.map(predFromAtom));
    const matched = applyFiltersAndQ(MOCK_ROWS, MOCK_DATASET.columns, preds, def.q ?? null, aqGroups);
    const offset = (page - 1) * pageSize;
    return HttpResponse.json({
      rows: matched.slice(offset, offset + pageSize),
      page,
      pageSize,
      total: matched.length,
    });
  }),
  // R72 — preview: run an UNSAVED working-copy definition (the live builder
  // preview), never persisted. Joined → combined columns + resolvedColumns;
  // a stale edge → 409 relationship_stale (the builder's join-unavailable
  // state). Reuses the same applyFiltersAndQ engine as the saved run.
  withContractValidation('post', api('/workspaces/:id/queries/preview'), 'previewQuery', async ({ request }) => {
    const body = (await request.json()) as PreviewQueryRequest;
    const def: QueryDefinition = body.definition ?? { q: null, filters: [], advanced: [] };
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
    const pageSize = Math.max(1, Number(url.searchParams.get('page_size') ?? 25));

    // R73 — fold either wire shape into the chain (legacy `join` → [join]).
    const chain = def.joins ?? (def.join ? [def.join] : []);
    if (chain.length > 0) {
      // Any stale hop blocks the whole chain (per-hop relationship_stale gate).
      if (chain.some((h) => h.relationshipId === MOCK_STALE_RELATIONSHIP.id)) {
        return HttpResponse.json({ code: 'relationship_stale' }, { status: 409 });
      }
      // 1 hop → Deals ⋈ Accounts (R71); ≥2 hops → Deals ⋈ Accounts ⋈ Owners (R73).
      const isChain = chain.length >= 2;
      const columns = isChain ? MOCK_CHAIN_COLUMNS : [...MOCK_DATASET.columns, ...MOCK_DATASET_2.columns];
      const sourceRows = isChain ? MOCK_CHAIN_ROWS.rows : MOCK_JOINED_ROWS.rows;
      const preds = def.filters.map(predFromAtom);
      const aqGroups = def.advanced.map((g) => g.map(predFromAtom));
      const matched = applyFiltersAndQ(sourceRows, columns, preds, def.q ?? null, aqGroups);
      const offset = (page - 1) * pageSize;
      return HttpResponse.json({
        rows: matched.slice(offset, offset + pageSize),
        page,
        pageSize,
        total: matched.length,
        resolvedColumns: columns,
      });
    }

    const preds = def.filters.map(predFromAtom);
    const aqGroups = def.advanced.map((g) => g.map(predFromAtom));
    const matched = applyFiltersAndQ(MOCK_ROWS, MOCK_DATASET.columns, preds, def.q ?? null, aqGroups);
    const offset = (page - 1) * pageSize;
    return HttpResponse.json({ rows: matched.slice(offset, offset + pageSize), page, pageSize, total: matched.length });
  }),

  // R73 (F1) — AD-HOC, UNWRAPPED: a multi-hop chain definition (`joins`) is not
  // on the R71/R72 contract yet (`_shared/query.yaml` still carries `join`); the
  // Contract gate migrates `join` → `joins` and re-wraps. Until then this handler
  // echoes a chain PUT so F1 can exercise save-a-chain. Non-chain PUTs return
  // `undefined` → MSW falls through to the contract-validated handler below.
  http.put(api('/queries/:id'), async ({ params, request }) => {
    // Read from a CLONE: a non-chain PUT falls through to the wrapped handler
    // below, which re-reads the (still-unconsumed) original body.
    const body = (await request.clone().json()) as UpdateQueryRequest;
    const joins = body.definition?.joins;
    if (!joins || joins.length < 2) return undefined;
    const base = params.id === MOCK_JOINED_QUERY.id ? MOCK_JOINED_QUERY : MOCK_QUERY;
    return HttpResponse.json({
      ...base,
      id: String(params.id),
      definition: body.definition,
      resolvedColumns: MOCK_CHAIN_COLUMNS,
    });
  }),

  // R72 — update: persist an edited DEFINITION (name unchanged). Echoes the
  // Query with the new definition (+ resolvedColumns when joined).
  withContractValidation('put', api('/queries/:id'), 'updateQuery', async ({ params, request }) => {
    const body = (await request.json()) as UpdateQueryRequest;
    const base = params.id === MOCK_JOINED_QUERY.id ? MOCK_JOINED_QUERY : MOCK_QUERY;
    const joined = Boolean(body.definition?.join);
    return HttpResponse.json({
      ...base,
      id: String(params.id),
      definition: body.definition,
      ...(joined ? { resolvedColumns: [...MOCK_DATASET.columns, ...MOCK_DATASET_2.columns] } : { resolvedColumns: undefined }),
    });
  }),

  http.delete(api('/queries/:id'), () => new HttpResponse(null, { status: 204 })),

  // Relationships (R70 — governance): declare / list / get / delete.
  // No /rows route — governance only; join execution is R71. `status` is
  // returned as the fixture's computed value (valid|stale).
  withContractValidation(
    'post',
    api('/workspaces/:id/relationships'),
    'createRelationship',
    async ({ params, request }) => {
      const body = (await request.json()) as Partial<CreateRelationshipRequest>;
      return HttpResponse.json(
        {
          id: `rel_${Math.random().toString(16).slice(2, 10).padEnd(8, '0')}`,
          workspaceId: String(params.id),
          leftDatasetId: body.leftDatasetId ?? MOCK_DATASET.id,
          leftColumn: body.leftColumn ?? 'deal_id',
          rightDatasetId: body.rightDatasetId ?? MOCK_DATASET_2.id,
          rightColumn: body.rightColumn ?? 'account_id',
          cardinality: body.cardinality ?? 'one_to_many',
          status: 'valid',
          // Contract createdAt is second-precision Z (no milliseconds).
          createdAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        },
        { status: 201 },
      );
    },
  ),
  withContractValidation('get', api('/workspaces/:id/relationships'), 'listRelationships', ({ params }) => {
    if (params.id !== MOCK_WORKSPACE.id) return HttpResponse.json([]);
    return HttpResponse.json(MOCK_RELATIONSHIPS_CHAIN);
  }),
  withContractValidation('get', api('/relationships/:id'), 'getRelationship', ({ params }) => {
    const rel = MOCK_RELATIONSHIPS_CHAIN.find((r) => r.id === params.id);
    if (!rel) return HttpResponse.json({ code: 'not_found' }, { status: 404 });
    return HttpResponse.json(rel);
  }),
  http.delete(api('/relationships/:id'), () => new HttpResponse(null, { status: 204 })),

  // Uploads — minimal happy-path mock so the wizard can render in dev
  // mode without a BE. Returns a CSV temp upload by default.
  withContractValidation('post', api('/uploads'), 'createTempUpload', () =>
    HttpResponse.json(
      {
        temp_id: 'tmp_aaaaaaaa',
        sourceFormat: 'csv',
        sizeBytes: 86_016,
        csvPreview: {
          columns: MOCK_DATASET.columns,
          rowCount: MOCK_ROWS.length,
          sampleRows: MOCK_ROWS.slice(0, 3).map((r) => [...r]),
        },
      },
      { status: 201 },
    ),
  ),
  withContractValidation('post', api('/uploads/:tempId/parse'), 'parseTempUpload', () =>
    HttpResponse.json({
      results: [
        {
          status: 'ok',
          columns: MOCK_DATASET.columns,
          rowCount: MOCK_ROWS.length,
          sampleRows: MOCK_ROWS.slice(0, 3).map((r) => [...r]),
        },
      ],
    }),
  ),
];
