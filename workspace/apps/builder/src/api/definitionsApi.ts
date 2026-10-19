// R201 (item 4.8) — the definition pack: export a workspace's queries,
// dashboards and workflows by name, and import a pack into a workspace (a dry
// run first). Contracts: workspaces/definitions-get + definitions-import.

import { appConfig } from '../config';
import { ERROR_CODES } from '@/_generated/constants';
import { ApiErrorThrown, isApiError } from '@/features/data-management/_shared/types';
import type {
  DefinitionPack,
  ImportPlan,
  OnConflict,
  PackError,
} from '@/features/data-management/workspaces/definitionPack/types';

const API_BASE_URL = appConfig.apiBaseUrl();

const PACK_CODES: ReadonlySet<string> = new Set([
  ERROR_CODES.PACK_INVALID,
  ERROR_CODES.PACK_REFUSED,
  ERROR_CODES.PACK_UNRESOLVED,
]);

/** A pack route's own refusal: the body carries the plan or the problems. */
export class PackErrorThrown extends Error {
  readonly status: number;
  readonly body: PackError;

  constructor(status: number, body: PackError) {
    super(`PackError ${status}: ${body.code}`);
    this.name = 'PackErrorThrown';
    this.status = status;
    this.body = body;
  }
}

function isPackError(body: unknown): body is PackError {
  if (typeof body !== 'object' || body === null) return false;
  const code = (body as { code?: unknown }).code;
  return typeof code === 'string' && PACK_CODES.has(code);
}

/** FastAPI's own 422 (`detail[]`) — the first message, for one readable line. */
function firstDetail(body: unknown): string | null {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const msg = (detail[0] as { msg?: unknown }).msg;
    if (typeof msg === 'string') return msg;
  }
  return null;
}

async function readPack<T>(resp: Response): Promise<T> {
  if (resp.ok) return (await resp.json()) as T;
  const body: unknown = await resp.json().catch(() => null);
  if (isPackError(body)) throw new PackErrorThrown(resp.status, body);
  if (isApiError(body)) throw new ApiErrorThrown(resp.status, body);
  throw new Error(firstDetail(body) ?? `Request failed: ${resp.status} ${resp.statusText}`);
}

export const definitionsApi = {
  /** GET /workspaces/{id}/definitions — the workspace's pack. 404 /
   *  409 pack_unresolved (a reference to a deleted noun). */
  async export(workspaceId: string): Promise<DefinitionPack> {
    const resp = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/definitions`);
    return readPack<DefinitionPack>(resp);
  },
  /** POST /workspaces/{id}/definitions/import — the plan (dry run) or the
   *  applied plan. 409 pack_refused {plan} / read_only_workspace, 422
   *  pack_invalid, 404. The pack is sent as read from the file. */
  async importPack(
    workspaceId: string,
    pack: unknown,
    opts: { dryRun: boolean; onConflict: OnConflict },
  ): Promise<ImportPlan> {
    const qs = new URLSearchParams({ dryRun: String(opts.dryRun), onConflict: opts.onConflict });
    const resp = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/definitions/import?${qs.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pack),
    });
    return readPack<ImportPlan>(resp);
  },
};
