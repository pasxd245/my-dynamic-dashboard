import { App, Modal, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PackErrorThrown } from '@/api/definitionsApi';
import type { Workspace } from '../types';
import { useExportPackMutation } from './hooks';
import { downloadPack, packCounts, packFileName } from './plan';
import type { PackProblem, PackUnresolvedReason } from './types';

type Unresolved = { workspace: string; problems: (PackProblem & { reason: PackUnresolvedReason })[] };

/** R201 (4.8) — the card's "Export definitions": read the pack, download it,
 *  say what it holds; a refusal (`pack_unresolved`) lists what to fix. */
export function useExportDefinitions(): { exportDefinitions: (ws: Workspace) => void; exportModal: React.ReactNode } {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const mutation = useExportPackMutation();
  const [unresolved, setUnresolved] = useState<Unresolved | null>(null);

  const exportDefinitions = (ws: Workspace) => {
    mutation.mutate(
      { workspaceId: ws.id },
      {
        onSuccess: (pack) => {
          downloadPack(pack, packFileName(ws.name));
          const c = packCounts(pack);
          if (c.queries + c.dashboards + c.workflows === 0) {
            message.info(t('workspaces.pack.exportEmpty'));
            return;
          }
          message.success(
            t('workspaces.pack.exported', {
              queries: t('workspaces.pack.nQueries', { count: c.queries }),
              dashboards: t('workspaces.pack.nDashboards', { count: c.dashboards }),
              workflows: t('workspaces.pack.nWorkflows', { count: c.workflows }),
            }),
          );
        },
        onError: (err) => {
          if (err instanceof PackErrorThrown && err.body.code === 'pack_unresolved') {
            setUnresolved({ workspace: ws.name, problems: err.body.problems });
            return;
          }
          message.error(t('workspaces.pack.exportCouldnt', { error: err.message }));
        },
      },
    );
  };

  const exportModal = (
    <Modal
      open={unresolved !== null}
      title={t('workspaces.pack.unresolvedTitle', { name: unresolved?.workspace ?? '' })}
      onOk={() => setUnresolved(null)}
      onCancel={() => setUnresolved(null)}
      okText={t('workspaces.pack.unresolvedOk')}
      cancelButtonProps={{ style: { display: 'none' } }}
      destroyOnHidden
      data-component="PackUnresolvedModal"
    >
      <Typography.Paragraph>{t('workspaces.pack.unresolvedIntro')}</Typography.Paragraph>
      <ul data-component="PackUnresolvedList" style={{ paddingInlineStart: 20, marginBottom: 0 }}>
        {(unresolved?.problems ?? []).map((p, i) => (
          <li key={`${p.kind}-${p.name}-${i}`}>
            {t(`workspaces.pack.unresolved.${p.reason}`, { name: p.name ?? '', ref: p.ref ?? '' })}
          </li>
        ))}
      </ul>
    </Modal>
  );

  return { exportDefinitions, exportModal };
}
