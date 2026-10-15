import { useQuery } from '@tanstack/react-query';

import { metadataApi } from '@/api/metadataApi';
import type { MetadataKind, MetadataRead } from './types';

/** R180 — a noun's metadata entries. Cached per noun; a missing noun (404)
 *  or an unreachable API reads as "no entries" — the panel is informative,
 *  never blocking. */
export function useMetadataQuery(kind: MetadataKind, nounId: string | undefined) {
  return useQuery<MetadataRead>({
    queryKey: ['metadata', kind, nounId] as const,
    queryFn: () => metadataApi.get(kind, nounId as string),
    enabled: Boolean(nounId),
    retry: false,
    staleTime: 30_000,
  });
}
