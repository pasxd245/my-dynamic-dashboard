import { useQuery } from '@tanstack/react-query';

import { metadataApi } from '@/api/metadataApi';
import type { MetadataKind, MetadataParams, MetadataRead } from './types';

/** R180 — a noun's metadata entries. Cached per noun; a missing noun (404)
 *  or an unreachable API reads as "no entries" — the panel is informative,
 *  never blocking. R197 — read under the page's parameter values (part of the
 *  key: another value is another reading). */
export function useMetadataQuery(kind: MetadataKind, nounId: string | undefined, params?: MetadataParams) {
  const p = params && Object.keys(params).length > 0 ? params : null;
  return useQuery<MetadataRead>({
    queryKey: ['metadata', kind, nounId, p] as const,
    queryFn: () => metadataApi.get(kind, nounId as string, p ?? undefined),
    enabled: Boolean(nounId),
    retry: false,
    staleTime: 30_000,
  });
}
