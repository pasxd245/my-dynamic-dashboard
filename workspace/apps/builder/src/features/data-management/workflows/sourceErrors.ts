import type { TFunction } from 'i18next';

import type { WorkflowSourceError } from '@/api/workflowsApi';

/** R186 — the save-time source refusal as one sentence: which source (1-based, as
 *  the picker numbers them) and why, followed by the server's detail (the column
 *  names that differ, the id listed twice). */
export function sourceErrorText(err: WorkflowSourceError, t: TFunction): string {
  const lead = t(`workflows.builder.source_${err.code}`, { n: err.index + 1 });
  return err.detail ? `${lead} ${err.detail}` : lead;
}
