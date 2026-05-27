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

import { OPS_BY_DTYPE, type Operator } from '@/features/data-management/datasets/filters/types';
import type { Column } from '@/features/data-management/datasets/types';
import { withContractValidation } from './contract-validator';
import { MOCK_DATASET, MOCK_ROWS, MOCK_WORKSPACE } from './fixtures';

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

function applyFiltersAndQ(
  rows: readonly (readonly (string | null)[])[],
  columns: readonly Column[],
  preds: readonly Pred[],
  q: string | null,
): (string | null)[][] {
  const ql = q ? q.toLowerCase() : '';
  return rows
    .filter((row) => {
      // AND across all per-column predicates.
      for (const p of preds) {
        const col = columns[p.col];
        if (!col) return false;
        if (!cellMatches(row[p.col] ?? null, p, col.dtype)) return false;
      }
      // q substring across any cell.
      if (q) {
        const any = row.some((c) => c !== null && c.toLowerCase().includes(ql));
        if (!any) return false;
      }
      return true;
    })
    .map((r) => [...r]);
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

// ─── Handlers ────────────────────────────────────────────────────────

export const handlers = [
  // Workspaces
  http.get(api('/workspaces'), () => HttpResponse.json([MOCK_WORKSPACE])),
  http.post(api('/workspaces'), async ({ request }) => {
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
  http.patch(api('/workspaces/:id'), async ({ params, request }) => {
    const body = (await request.json()) as { name?: string };
    return HttpResponse.json({
      ...MOCK_WORKSPACE,
      id: String(params.id),
      name: body.name ?? MOCK_WORKSPACE.name,
    });
  }),
  http.delete(api('/workspaces/:id'), () => new HttpResponse(null, { status: 204 })),

  // Datasets list / detail
  http.get(api('/datasets'), ({ request }) => {
    const url = new URL(request.url);
    const ws = url.searchParams.get('workspace_id');
    if (ws && ws !== MOCK_WORKSPACE.id) return HttpResponse.json([]);
    return HttpResponse.json([MOCK_DATASET]);
  }),
  http.get(api('/datasets/:id'), ({ params }) => {
    if (params.id !== MOCK_DATASET.id) {
      return HttpResponse.json({ code: 'not_found' }, { status: 404 });
    }
    return HttpResponse.json(MOCK_DATASET);
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

    const matched = applyFiltersAndQ(MOCK_ROWS, MOCK_DATASET.columns, preds, q);
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
  http.patch(api('/datasets/:id'), async ({ params, request }) => {
    const body = (await request.json()) as { name?: string };
    return HttpResponse.json({
      ...MOCK_DATASET,
      id: String(params.id),
      name: body.name ?? MOCK_DATASET.name,
    });
  }),
  http.delete(api('/datasets/:id'), () => new HttpResponse(null, { status: 204 })),
  http.post(api('/workspaces/:id/datasets/batch'), async ({ request }) => {
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

  // Uploads — minimal happy-path mock so the wizard can render in dev
  // mode without a BE. Returns a CSV temp upload by default.
  http.post(api('/uploads'), () =>
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
  http.post(api('/uploads/:tempId/parse'), () =>
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
