// R180 — metadata is READ here; writing is an API-with-token affair the
// builder never does (`PUT /metadata/...` with a bearer token).

import { appConfig } from '../config';
import { ApiErrorThrown, isApiError } from '@/features/data-management/_shared/types';
import type { MetadataKind, MetadataParams, MetadataRead } from '@/features/metadata/types';

const API_BASE_URL = appConfig.apiBaseUrl();

export const metadataApi = {
  /** GET /metadata/{kind}/{noun_id} — every entry on the noun (+ children),
   *  read under the page's parameter values (R197: `p.<name>=`). */
  async get(kind: MetadataKind, nounId: string, params?: MetadataParams): Promise<MetadataRead> {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params ?? {})) search.set(`p.${k}`, v);
    const qs = search.toString();
    const resp = await fetch(`${API_BASE_URL}/metadata/${kind}/${encodeURIComponent(nounId)}${qs ? `?${qs}` : ''}`);
    if (!resp.ok) {
      const body: unknown = await resp.json().catch(() => null);
      if (isApiError(body)) throw new ApiErrorThrown(resp.status, body);
      throw new Error(`metadata ${kind}/${nounId}: ${resp.status}`);
    }
    return (await resp.json()) as MetadataRead;
  },
};
