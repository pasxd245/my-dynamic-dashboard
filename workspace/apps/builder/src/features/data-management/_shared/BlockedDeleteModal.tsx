import { WarningOutlined } from '@ant-design/icons';
import { Modal, Typography } from 'antd';
import { Trans, useTranslation } from 'react-i18next';

export type BlockedDeleteModalProps = Readonly<{
  /** Workspace name shown in the warning copy. */
  workspaceName: string;
  /** Count of datasets blocking the delete. */
  datasetCount: number;
  open: boolean;
  onClose: () => void;
}>;

/** R26: workspace-only "non-empty" blocked modal. Reached two ways:
 *  (1) FE pre-flight check finds cached datasets in this workspace;
 *  (2) BE returned 409 `non_empty` from `DELETE /workspaces/{id}`.
 *  R23 modal state 6. Informational (not destructive) — one dismissive
 *  button. */
export function BlockedDeleteModal({ workspaceName, datasetCount, open, onClose }: BlockedDeleteModalProps) {
  const { t } = useTranslation();
  return (
    <Modal
      title={t('workspaces.blockedDeleteTitle')}
      open={open}
      onOk={onClose}
      onCancel={onClose}
      okText={t('workspaces.blockedDeleteGotIt')}
      cancelButtonProps={{ style: { display: 'none' } }}
      destroyOnHidden
      data-component="BlockedDeleteModal"
    >
      <div style={{ display: 'flex', gap: 12 }}>
        <WarningOutlined style={{ color: '#faad14', fontSize: 20, flexShrink: 0 }} />
        <div>
          <Typography.Paragraph style={{ marginBottom: 4, fontWeight: 500 }}>
            <Trans
              i18nKey="workspaces.blockedDeleteBody"
              count={datasetCount}
              values={{ name: workspaceName, count: datasetCount }}
              components={{ strong: <strong /> }}
            />
          </Typography.Paragraph>
          <Typography.Text type="secondary">{t('workspaces.blockedDeleteHint')}</Typography.Text>
        </div>
      </div>
    </Modal>
  );
}
