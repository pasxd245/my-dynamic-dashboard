// R180 — metadata is READ here; writing is an API-with-token affair the
// builder never does (`PUT /metadata/...` with a bearer token).

import { appConfig } from '../config';
import { ApiErrorThrown, isApiError } from '@/features/data-management/_shared/types';
import type { MetadataKind, MetadataRead } from '@/features/metadata/types';

const API_BASE_URL = appConfig.apiBaseUrl();

export const metadataApi = {
  /** GET /metadata/{kind}/{noun_id} — every entry on the noun (+ children). */
  async get(kind: MetadataKind, nounId: string): Promise<MetadataRead> {
    const resp = await fetch(`${API_BASE_URL}/metadata/${kind}/${encodeURIComponent(nounId)}`);
    if (!resp.ok) {
      const body: unknown = await resp.json().catch(() => null);
      if (isApiError(body)) throw new ApiErrorThrown(resp.status, body);
      throw new Error(`metadata ${kind}/${nounId}: ${resp.status}`);
    }
    return (await resp.json()) as MetadataRead;
  },
};
