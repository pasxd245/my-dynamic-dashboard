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
  AggregateRequest,
  CreateQueryRequest,
  PreviewQueryRequest,
  QueryDefinition,
  Step,
  UpdateQueryRequest,
} from '@/features/data-management/queries/types';
import type { CreateRelationshipRequest } from '@/features/data-management/relationships/types';
import type { CreateWorkflowRequest } from '@/features/data-management/workflows/types';
import type { CreateDashboardRequest, UpdateDashboardRequest } from '@/features/dashboard/wire';
import { withContractValidation } from './contract-validator';
import {
  MOCK_CHAIN_COLUMNS,
  MOCK_CHAIN_ROWS,
  MOCK_COMPOSED_QUERY,
  MOCK_CYCLE_QUERY_ID,
  MOCK_DASHBOARD,
  MOCK_DASHBOARDS,
  MOCK_DATASET,
  MOCK_DATASET_2,
  MOCK_DATASET_3,
  MOCK_DATASET_4,
  MOCK_DATASET_5,
  MOCK_JOINED_QUERY,
  MOCK_JOINED_ROWS,
  MOCK_QUERIES,
  MOCK_QUERY,
  MOCK_RELATIONSHIPS_CHAIN,
  MOCK_ROWS,
  MOCK_STALE_JOIN_QUERY_ID,
  MOCK_STALE_QUERY_ID,
  MOCK_WORKFLOW,
  MOCK_WORKFLOWS,
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

type AqParseResult = { ok: true; groups: Pred[][] } | { ok: false; loc: string[]; msg: string };

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

// ─── Aggregate helper (R119) ─────────────────────────────────────────
//
// Mirrors the backend `query_aggregate_rows`: over the query's matched rows,
// push the R103 dashboard filters (name-based one-of; `null` matches a
// NULL/empty cell), GROUP BY the dimensions, and compute the measures
// (`sum` → COALESCE 0; `count` → row tally). A scalar (no dimensions) returns
// exactly one row. Output columns are dimensions then measures.

const _aggColIdx = (columns: readonly Column[], name: string): number => {
  const exact = columns.findIndex((c) => c.name === name);
  return exact !== -1 ? exact : columns.findIndex((c) => c.name.endsWith(`.${name}`));
};

function computeAggregate(
  columns: readonly Column[],
  rows: readonly (readonly (string | null)[])[],
  body: AggregateRequest,
): { columns: { name: string; dtype: Column['dtype'] }[]; rows: (string | null)[][]; total: number } {
  let matched = rows;
  for (const f of body.filters ?? []) {
    const idx = _aggColIdx(columns, f.column);
    if (idx === -1) continue; // a filter on a column this query lacks is skipped
    const wantsBlank = f.values.includes(null);
    const set = new Set(f.values);
    matched = matched.filter((r) => {
      const cell = r[idx] ?? null;
      if (cell === null || cell === '') return wantsBlank;
      return set.has(cell);
    });
  }
  const dimIdxs = body.dimensions.map((d) => _aggColIdx(columns, d));
  const measureIdxs = body.measures.map((m) => (m.col ? _aggColIdx(columns, m.col) : -1));

  // R140 — sum/avg/min/max/count_distinct join count. Numbers compare numerically;
  // min/max on date/datetime compare lexically (ISO strings order correctly).
  // sum/avg coalesce an empty/all-NULL group to 0 (backend parity); min/max → null.
  const measuresFor = (groupRows: readonly (readonly (string | null)[])[]): (string | null)[] =>
    body.measures.map((m, i) => {
      if (m.agg === 'count') return String(groupRows.length);
      const cells = groupRows.map((r) => r[measureIdxs[i]]).filter((c): c is string => c !== null && c !== '');
      if (m.agg === 'count_distinct') return String(new Set(cells).size);
      if (m.agg === 'min' || m.agg === 'max') {
        if (cells.length === 0) return null;
        const numeric = cells.every((c) => Number.isFinite(Number(c)));
        const pick = (a: string, b: string) => {
          const less = numeric ? Number(a) < Number(b) : a < b;
          return (m.agg === 'min') === less ? a : b;
        };
        return cells.reduce(pick);
      }
      let sum = 0;
      for (const c of cells) {
        const n = Number(c);
        sum += Number.isFinite(n) ? n : 0;
      }
      return String(m.agg === 'avg' ? (cells.length ? sum / cells.length : 0) : sum);
    });

  let outRows: (string | null)[][];
  if (body.dimensions.length === 0) {
    outRows = [measuresFor(matched)]; // scalar — always one row
  } else {
    const groups = new Map<string, { keyCells: (string | null)[]; rows: (string | null)[][] }>();
    for (const r of matched) {
      const keyCells = dimIdxs.map((i) => r[i] ?? null);
      const key = JSON.stringify(keyCells); // printable, collision-free group key
      const g = groups.get(key) ?? { keyCells, rows: [] };
      g.rows.push([...r]);
      groups.set(key, g);
    }
    outRows = [...groups.values()].map((g) => [...g.keyCells, ...measuresFor(g.rows)]);
  }

  const outColumns: { name: string; dtype: Column['dtype'] }[] = body.dimensions.map((d) => ({
    name: d,
    dtype: columns[_aggColIdx(columns, d)]?.dtype ?? 'string',
  }));
  body.measures.forEach((m, i) => {
    // R140 dtype mirror: avg → float; count/count_distinct → integer;
    // sum/min/max keep the measure column's dtype.
    if (m.agg === 'count') outColumns.push({ name: 'count', dtype: 'integer' });
    else if (m.agg === 'count_distinct') outColumns.push({ name: m.col ?? '', dtype: 'integer' });
    else if (m.agg === 'avg') outColumns.push({ name: m.col ?? '', dtype: 'float' });
    else outColumns.push({ name: m.col ?? '', dtype: columns[measureIdxs[i]]?.dtype ?? 'integer' });
  });
  return { columns: outColumns, rows: outRows, total: outRows.length };
}

// ─── R126: steps-aware preview mock ──────────────────────────────────
//
// Mirror the backend `run_steps` over the mock rows so a previewed stepped
// definition shows the SHAPED result in dev + tests (the builder's live preview).
// Approximate (JS vs DuckDB number formatting); the backend pytest is the
// correctness gate. Threads (columns, rows) through each step.

type MockTable = { columns: { name: string; dtype: Column['dtype'] }[]; rows: (string | null)[][] };

function deriveStepMock(step: Extract<Step, { kind: 'derive' }>, table: MockTable): MockTable {
  const li = _aggColIdx(table.columns, step.left);
  const ri = step.right.kind === 'col' ? _aggColIdx(table.columns, step.right.col) : -1;
  const rows = table.rows.map((row) => {
    const l = Number(row[li]);
    const rv = step.right.kind === 'col' ? Number(row[ri]) : step.right.value;
    let v: number | null;
    if (step.op === '/') v = rv === 0 ? null : l / rv;
    else v = step.op === '+' ? l + rv : step.op === '-' ? l - rv : l * rv;
    return [...row, v === null || !Number.isFinite(v) ? null : String(v)];
  });
  return { columns: [...table.columns, { name: step.name, dtype: 'float' }], rows };
}

function filterStepMock(step: Extract<Step, { kind: 'filter' }>, table: MockTable): MockTable {
  const preds = step.predicates.map((p) => ({ idx: _aggColIdx(table.columns, p.col), p }));
  const rows = table.rows.filter((row) =>
    preds.every(({ idx, p }) =>
      cellMatches(
        row[idx] ?? null,
        {
          col: idx,
          op: p.op as Operator,
          val: p.val != null ? String(p.val) : undefined,
          min: p.min != null ? String(p.min) : undefined,
          max: p.max != null ? String(p.max) : undefined,
        },
        table.columns[idx]?.dtype ?? 'string',
      ),
    ),
  );
  return { columns: table.columns, rows };
}

function topNStepMock(step: Extract<Step, { kind: 'top_n' }>, table: MockTable): MockTable {
  const ci = _aggColIdx(table.columns, step.col);
  const num = (cell: string | null) => (Number.isFinite(Number(cell)) ? Number(cell) : 0);
  const rows = [...table.rows]
    .sort((a, b) => (step.descending ? num(b[ci]) - num(a[ci]) : num(a[ci]) - num(b[ci])))
    .slice(0, step.n);
  return { columns: table.columns, rows };
}

function sortStepMock(step: Extract<Step, { kind: 'sort' }>, table: MockTable): MockTable {
  // R141 mirror: multi-key, later keys tie-break; NULLs/blanks last in BOTH
  // directions (backend NULLS LAST); numbers compare numerically, else lexically.
  const keys = step.keys.map((k) => ({ idx: _aggColIdx(table.columns, k.col), desc: k.descending ?? false }));
  const cmp = (a: string | null, b: string | null, desc: boolean): number => {
    const aBlank = a === null || a === '';
    const bBlank = b === null || b === '';
    if (aBlank || bBlank) return aBlank === bBlank ? 0 : aBlank ? 1 : -1; // blanks last, direction-independent
    const an = Number(a);
    const bn = Number(b);
    const numeric = Number.isFinite(an) && Number.isFinite(bn);
    const base = numeric ? an - bn : a < b ? -1 : a > b ? 1 : 0;
    return desc ? -base : base;
  };
  const rows = [...table.rows].sort((a, b) => {
    for (const { idx, desc } of keys) {
      const c = cmp(a[idx] ?? null, b[idx] ?? null, desc);
      if (c !== 0) return c;
    }
    return 0;
  });
  return { columns: table.columns, rows };
}

function selectStepMock(step: Extract<Step, { kind: 'select' }>, table: MockTable): MockTable {
  // R141 mirror: output = EXACTLY the entries in order, dtypes kept, `name ?? col`.
  const picked = step.cols.map((s) => ({ idx: _aggColIdx(table.columns, s.col), out: s.name ?? s.col }));
  return {
    columns: picked.map(({ idx, out }) => ({ name: out, dtype: table.columns[idx]?.dtype ?? 'string' })),
    rows: table.rows.map((row) => picked.map(({ idx }) => row[idx] ?? null)),
  };
}

function dateBucketStepMock(step: Extract<Step, { kind: 'date_bucket' }>, table: MockTable): MockTable {
  // R144 mirror: append the period's START date as `YYYY-MM-DD` (week =
  // ISO-8601 Monday-start, matching DuckDB date_trunc). Approximate — cells
  // that don't Date-parse read as NULL; the backend pytest is the gate.
  const ci = _aggColIdx(table.columns, step.col);
  const pad = (n: number) => String(n).padStart(2, '0');
  const rows = table.rows.map((row) => {
    const cell = row[ci];
    const d = cell ? new Date(cell) : null;
    if (!d || Number.isNaN(d.getTime())) return [...row, null];
    let y = d.getFullYear();
    let m = d.getMonth();
    let day = d.getDate();
    if (step.granularity === 'week') {
      const monday = new Date(y, m, day - ((d.getDay() + 6) % 7));
      [y, m, day] = [monday.getFullYear(), monday.getMonth(), monday.getDate()];
    } else if (step.granularity === 'month') day = 1;
    else if (step.granularity === 'quarter') [m, day] = [Math.floor(m / 3) * 3, 1];
    else if (step.granularity === 'year') [m, day] = [0, 1];
    return [...row, `${y}-${pad(m + 1)}-${pad(day)}`];
  });
  return { columns: [...table.columns, { name: step.name, dtype: 'date' }], rows };
}

function applyStepsMock(
  columns: readonly Column[],
  rows: readonly (readonly (string | null)[])[],
  steps: readonly Step[],
): MockTable {
  let table: MockTable = { columns: [...columns], rows: rows.map((r) => [...r]) };
  for (const step of steps) {
    if (step.kind === 'aggregate') {
      table = computeAggregate(table.columns, table.rows, {
        dimensions: step.dimensions,
        measures: step.measures,
        filters: [],
      });
    } else if (step.kind === 'derive') {
      table = deriveStepMock(step, table);
    } else if (step.kind === 'filter') {
      table = filterStepMock(step, table);
    } else if (step.kind === 'sort') {
      table = sortStepMock(step, table);
    } else if (step.kind === 'select') {
      table = selectStepMock(step, table);
    } else if (step.kind === 'date_bucket') {
      table = dateBucketStepMock(step, table);
    } else {
      table = topNStepMock(step, table);
    }
  }
  return table;
}

/** Build a preview JSON response, applying any `steps` (shaped result + post-step
 *  `resolvedColumns`). `alwaysResolved` carries the joined/composed contract
 *  (resolvedColumns even with no steps); a stepped query always reports them. */
function previewJson(
  columns: readonly Column[],
  matched: (string | null)[][],
  page: number,
  pageSize: number,
  steps: readonly Step[] | undefined,
  alwaysResolved: boolean,
) {
  const shaped = steps?.length ? applyStepsMock(columns, matched, steps) : { columns: [...columns], rows: matched };
  const offset = (page - 1) * pageSize;
  const body: Record<string, unknown> = {
    rows: shaped.rows.slice(offset, offset + pageSize),
    page,
    pageSize,
    total: shaped.rows.length,
  };
  if (alwaysResolved || steps?.length) body.resolvedColumns = shaped.columns;
  // R129 — a stepped preview reports the PRE-step (base) columns too.
  if (steps?.length) body.baseColumns = columns.map((c) => ({ name: c.name, dtype: c.dtype }));
  return HttpResponse.json(body);
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
  withContractValidation('get', api('/workspaces'), 'listWorkspaces', () => HttpResponse.json([MOCK_WORKSPACE])),
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
    // The datasets in the workspace: Deals + accounts (R70), owners (R73 chain),
    // and tiers + regions (R74 branch leaves) — so a join graph has its sources.
    return HttpResponse.json([MOCK_DATASET, MOCK_DATASET_2, MOCK_DATASET_3, MOCK_DATASET_4, MOCK_DATASET_5]);
  }),
  withContractValidation('get', api('/datasets/:id'), 'getDataset', ({ params }) => {
    const ds = [MOCK_DATASET, MOCK_DATASET_2, MOCK_DATASET_3, MOCK_DATASET_4, MOCK_DATASET_5].find(
      (d) => d.id === params.id,
    );
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
      return HttpResponse.json({ detail: [{ loc: check.loc, msg: check.msg, type: 'value_error' }] }, { status: 422 });
    }

    const aq = parseAq(url.searchParams, MOCK_DATASET.columns);
    if (!aq.ok) {
      return HttpResponse.json({ detail: [{ loc: aq.loc, msg: aq.msg, type: 'value_error' }] }, { status: 422 });
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
    // R79 — the body carries the canonical, required `sourceId` (a `ds_` for a
    // plain save, a `qr_` for a composed "Build on this query"); echo it back.
    return HttpResponse.json(
      {
        id: `qr_${Math.random().toString(16).slice(2, 10).padEnd(8, '0')}`,
        workspaceId: String(params.id),
        sourceId: body.sourceId ?? MOCK_DATASET.id,
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
    // R76: a composed query carries `sourceId` (a `qr_` base) + resolvedColumns.
    if (params.id === MOCK_COMPOSED_QUERY.id) {
      return HttpResponse.json(MOCK_COMPOSED_QUERY);
    }
    // R76: a composed query whose base loops back — still resolvable as metadata
    // (the cycle is caught on RUN), so it gets the composed shape here.
    if (params.id === MOCK_CYCLE_QUERY_ID) {
      return HttpResponse.json({ ...MOCK_COMPOSED_QUERY, id: MOCK_CYCLE_QUERY_ID });
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
    // R76: a composed query whose base loops back → the run is blocked.
    if (params.id === MOCK_CYCLE_QUERY_ID) {
      return HttpResponse.json({ code: 'composition_cycle' }, { status: 409 });
    }
    // R107 — `unpaged=true` returns the full result in one response (page=1,
    // pageSize=row count); otherwise a page slice. Shared across the valid-run
    // branches below.
    const url = new URL(request.url);
    const unpaged = url.searchParams.get('unpaged') === 'true';
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
    const pageSize = Math.max(1, Number(url.searchParams.get('page_size') ?? 50));
    const pageOf = (allRows: (string | null)[][], total: number) => {
      if (unpaged) return { rows: allRows, page: 1, pageSize: allRows.length, total };
      const offset = (page - 1) * pageSize;
      return { rows: allRows.slice(offset, offset + pageSize), page, pageSize, total };
    };
    // R76: a valid composed query returns its composed rows (the base's rows
    // fed through the join → the composed effective space).
    if (params.id === MOCK_COMPOSED_QUERY.id) {
      return HttpResponse.json(pageOf(MOCK_CHAIN_ROWS.rows, MOCK_CHAIN_ROWS.total));
    }
    // R71: a valid joined query returns its joined rows (effective columns).
    if (params.id === MOCK_JOINED_QUERY.id) {
      return HttpResponse.json(pageOf(MOCK_JOINED_ROWS.rows, MOCK_JOINED_ROWS.total));
    }
    if (params.id !== MOCK_QUERY.id) {
      return HttpResponse.json({ code: 'not_found' }, { status: 404 });
    }
    const def = MOCK_QUERY.definition;
    const preds = def.filters.map(predFromAtom);
    const aqGroups = def.advanced.map((g) => g.map(predFromAtom));
    const matched = applyFiltersAndQ(MOCK_ROWS, MOCK_DATASET.columns, preds, def.q ?? null, aqGroups);
    return HttpResponse.json(pageOf(matched, matched.length));
  }),
  // R119 — aggregate: a server-side GROUP BY over a saved query. Mirrors the
  // saved-run drift branches (stale / join-stale / composition cycle / 404),
  // then computes the aggregate over the query's matched rows + the pushed
  // dashboard filters. The aggregate result is small (one row per group) — no
  // cap. Contract-validated against queries/aggregate.contract.yaml.
  withContractValidation('post', api('/queries/:id/aggregate'), 'aggregateQuery', async ({ params, request }) => {
    if (params.id === MOCK_STALE_QUERY_ID) {
      return HttpResponse.json({ code: 'query_stale' }, { status: 409 });
    }
    if (params.id === MOCK_STALE_JOIN_QUERY_ID) {
      return HttpResponse.json({ code: 'relationship_stale' }, { status: 409 });
    }
    if (params.id === MOCK_CYCLE_QUERY_ID) {
      return HttpResponse.json({ code: 'composition_cycle' }, { status: 409 });
    }
    const body = (await request.json()) as AggregateRequest;
    if (params.id === MOCK_COMPOSED_QUERY.id) {
      return HttpResponse.json(computeAggregate(MOCK_CHAIN_COLUMNS, MOCK_CHAIN_ROWS.rows, body));
    }
    if (params.id === MOCK_JOINED_QUERY.id) {
      return HttpResponse.json(computeAggregate(MOCK_JOINED_QUERY.resolvedColumns ?? [], MOCK_JOINED_ROWS.rows, body));
    }
    if (params.id !== MOCK_QUERY.id) {
      return HttpResponse.json({ code: 'not_found' }, { status: 404 });
    }
    const def = MOCK_QUERY.definition;
    const preds = def.filters.map(predFromAtom);
    const aqGroups = def.advanced.map((g) => g.map(predFromAtom));
    const matched = applyFiltersAndQ(MOCK_ROWS, MOCK_DATASET.columns, preds, def.q ?? null, aqGroups);
    return HttpResponse.json(computeAggregate(MOCK_DATASET.columns, matched, body));
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

    // R76 (composition, F1) — a `qr_` driving source: the preview is COMPOSED
    // (built ON that saved Query), so it returns the composed effective space.
    // The base Query's own rows + the working-copy joins fold into one virtual
    // table; F1 mocks that with the chain fixture (the wire field `sourceId` and
    // the real recursive resolver land at the Contract / Backend gates).
    if (typeof body.sourceId === 'string' && body.sourceId.startsWith('qr_')) {
      const columns = MOCK_CHAIN_COLUMNS;
      const preds = def.filters.map(predFromAtom);
      const aqGroups = def.advanced.map((g) => g.map(predFromAtom));
      const matched = applyFiltersAndQ(MOCK_CHAIN_ROWS.rows, columns, preds, def.q ?? null, aqGroups);
      return previewJson(columns, matched, page, pageSize, def.steps, true);
    }

    const chain = def.joins ?? [];
    if (chain.length > 0) {
      // R88 — a hop's QUERY-OWNED rel is stale when a key column no longer exists
      // on its dataset (mirrors the backend resolver's dtype-compat check against
      // current columns); any stale hop blocks the chain (relationship_stale gate).
      const dsCols = new Map(
        [MOCK_DATASET, MOCK_DATASET_2, MOCK_DATASET_3, MOCK_DATASET_4, MOCK_DATASET_5].map((d) => [d.id, d.columns]),
      );
      const colMissing = (dsId: string, col: string) => {
        const cs = dsCols.get(dsId);
        return cs ? !cs.some((c) => c.name === col) : false;
      };
      const anyStale = (def.relationships ?? []).some(
        // R91 — `…SourceId` (the right may be a `qr_`; `colMissing` over datasets returns
        // false for a `qr_`, so the mock doesn't flag a query×query edge stale — the real
        // backend resolves it, tested in pytest + Integration).
        (r) => colMissing(r.leftSourceId, r.leftColumn) || colMissing(r.rightSourceId, r.rightColumn),
      );
      if (anyStale) {
        return HttpResponse.json({ code: 'relationship_stale' }, { status: 409 });
      }
      // 1 hop → Deals ⋈ Accounts (R71); ≥2 hops → Deals ⋈ Accounts ⋈ Owners (R73).
      const isChain = chain.length >= 2;
      const columns = isChain ? MOCK_CHAIN_COLUMNS : [...MOCK_DATASET.columns, ...MOCK_DATASET_2.columns];
      const sourceRows = isChain ? MOCK_CHAIN_ROWS.rows : MOCK_JOINED_ROWS.rows;
      const preds = def.filters.map(predFromAtom);
      const aqGroups = def.advanced.map((g) => g.map(predFromAtom));
      const matched = applyFiltersAndQ(sourceRows, columns, preds, def.q ?? null, aqGroups);
      return previewJson(columns, matched, page, pageSize, def.steps, true);
    }

    const preds = def.filters.map(predFromAtom);
    const aqGroups = def.advanced.map((g) => g.map(predFromAtom));
    const matched = applyFiltersAndQ(MOCK_ROWS, MOCK_DATASET.columns, preds, def.q ?? null, aqGroups);
    return previewJson(MOCK_DATASET.columns, matched, page, pageSize, def.steps, false);
  }),

  // R72 — update: persist an edited DEFINITION (name unchanged). R73 — the
  // definition may now carry a `joins` chain; the contract migrated `join` →
  // `joins`, so this stays contract-validated for chains too. Echoes the Query
  // with the recomputed resolvedColumns (1 hop = Deals ⋈ Accounts; ≥2 = the
  // chain; absent = single-source).
  withContractValidation('put', api('/queries/:id'), 'updateQuery', async ({ params, request }) => {
    const body = (await request.json()) as UpdateQueryRequest;
    const base = params.id === MOCK_JOINED_QUERY.id ? MOCK_JOINED_QUERY : MOCK_QUERY;
    const chain = body.definition?.joins ?? [];
    let resolvedColumns: typeof MOCK_CHAIN_COLUMNS | undefined;
    if (chain.length >= 2) resolvedColumns = MOCK_CHAIN_COLUMNS;
    else if (chain.length === 1) resolvedColumns = [...MOCK_DATASET.columns, ...MOCK_DATASET_2.columns];
    return HttpResponse.json({
      ...base,
      id: String(params.id),
      definition: body.definition,
      resolvedColumns,
    });
  }),

  http.delete(api('/queries/:id'), () => new HttpResponse(null, { status: 204 })),

  // Workflows (R132–R135 — the `queries ⇒ workflows` module): create / list /
  // get / run / rows / delete. Stateless mocks echoing contract-valid shapes.
  // `getWorkflow`/`runWorkflow` return the MATERIALIZED shape so the detail page
  // shows its output; `workflowRows` pages MOCK_ROWS (the materialized output).
  withContractValidation('post', api('/workspaces/:id/workflows'), 'createWorkflow', async ({ params, request }) => {
    const body = (await request.json()) as Partial<CreateWorkflowRequest>;
    return HttpResponse.json(
      {
        id: `wf_${Math.random().toString(16).slice(2, 10).padEnd(8, '0')}`,
        workspaceId: String(params.id),
        name: body.name ?? 'untitled workflow',
        definition: body.definition ?? { sources: [MOCK_QUERY.id], steps: [] },
        createdAt: new Date().toISOString(),
      },
      { status: 201 },
    );
  }),
  withContractValidation('get', api('/workspaces/:id/workflows'), 'listWorkflows', ({ params }) => {
    if (params.id !== MOCK_WORKSPACE.id) return HttpResponse.json([]);
    return HttpResponse.json(MOCK_WORKFLOWS);
  }),
  withContractValidation('get', api('/workflows/:id'), 'getWorkflow', ({ params }) => {
    if (params.id !== MOCK_WORKFLOW.id) {
      return HttpResponse.json({ code: 'not_found' }, { status: 404 });
    }
    return HttpResponse.json(MOCK_WORKFLOW);
  }),
  withContractValidation('post', api('/workflows/:id/run'), 'runWorkflow', ({ params }) => {
    if (params.id !== MOCK_WORKFLOW.id) {
      return HttpResponse.json({ code: 'not_found' }, { status: 404 });
    }
    // Materialize → echo the workflow with resolvedColumns + materializedAt.
    return HttpResponse.json({ ...MOCK_WORKFLOW, materializedAt: new Date().toISOString() });
  }),
  withContractValidation('get', api('/workflows/:id/rows'), 'workflowRows', ({ params, request }) => {
    if (params.id !== MOCK_WORKFLOW.id) {
      return HttpResponse.json({ code: 'not_found' }, { status: 404 });
    }
    const url = new URL(request.url);
    const unpaged = url.searchParams.get('unpaged') === 'true';
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
    const pageSize = Math.max(1, Number(url.searchParams.get('page_size') ?? 50));
    const all = MOCK_ROWS.map((r) => [...r]);
    if (unpaged) return HttpResponse.json({ rows: all, page: 1, pageSize: all.length, total: all.length });
    const offset = (page - 1) * pageSize;
    return HttpResponse.json({ rows: all.slice(offset, offset + pageSize), page, pageSize, total: all.length });
  }),
  withContractValidation('put', api('/workflows/:id'), 'updateWorkflow', async ({ params, request }) => {
    if (params.id !== MOCK_WORKFLOW.id) {
      return HttpResponse.json({ code: 'not_found' }, { status: 404 });
    }
    const body = (await request.json()) as Partial<CreateWorkflowRequest>;
    return HttpResponse.json({
      ...MOCK_WORKFLOW,
      name: body.name ?? MOCK_WORKFLOW.name,
      definition: body.definition ?? MOCK_WORKFLOW.definition,
    });
  }),
  http.delete(api('/workflows/:id'), () => new HttpResponse(null, { status: 204 })),

  // Dashboards (R101 — dashboard-as-a-persisted-noun): create / list / get /
  // update / delete. Stateless mocks that echo contract-valid shapes (the live
  // re-run of each widget's query reuses the existing /queries/{id}/rows
  // handler). Both `name` and `slug` are unique per-workspace; the detail route
  // (/dashboards/<ws_id>/<slug>) resolves the slug from the workspace list.
  withContractValidation('post', api('/workspaces/:id/dashboards'), 'createDashboard', async ({ params, request }) => {
    const body = (await request.json()) as Partial<CreateDashboardRequest>;
    return HttpResponse.json(
      {
        id: `dsh_${Math.random().toString(16).slice(2, 10).padEnd(8, '0')}`,
        workspaceId: String(params.id),
        name: body.name ?? 'untitled dashboard',
        slug: body.slug ?? 'untitled-dashboard',
        definition: body.definition ?? { widgets: [] },
        createdAt: new Date().toISOString(),
      },
      { status: 201 },
    );
  }),
  withContractValidation('get', api('/workspaces/:id/dashboards'), 'listDashboards', ({ params }) => {
    if (params.id !== MOCK_WORKSPACE.id) return HttpResponse.json([]);
    return HttpResponse.json(MOCK_DASHBOARDS);
  }),
  withContractValidation('get', api('/dashboards/:id'), 'getDashboard', ({ params }) => {
    if (params.id !== MOCK_DASHBOARD.id) {
      return HttpResponse.json({ code: 'not_found' }, { status: 404 });
    }
    return HttpResponse.json(MOCK_DASHBOARD);
  }),
  withContractValidation('put', api('/dashboards/:id'), 'updateDashboard', async ({ params, request }) => {
    const body = (await request.json()) as UpdateDashboardRequest;
    return HttpResponse.json({
      ...MOCK_DASHBOARD,
      id: String(params.id),
      name: body.name,
      slug: body.slug,
      definition: body.definition,
    });
  }),
  http.delete(api('/dashboards/:id'), () => new HttpResponse(null, { status: 204 })),

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
