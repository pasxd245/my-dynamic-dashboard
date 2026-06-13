import { Modal, Typography } from 'antd';
import { Trans, useTranslation } from 'react-i18next';

export type DeleteConfirmModalProps = Readonly<{
  resourceLabel: 'workspace' | 'dataset' | 'query';
  /** The resource's display name, shown in the confirmation copy. */
  resourceName: string;
  open: boolean;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}>;

/** R26: shared delete-confirm modal. Renders R23 modal states 4 + 5
 *  (delete-dataset confirm; delete-workspace empty confirm). Uses
 *  AntD `<Modal>` with a `danger`-styled primary action. */
export function DeleteConfirmModal({
  resourceLabel,
  resourceName,
  open,
  isPending,
  onConfirm,
  onClose,
}: DeleteConfirmModalProps) {
  const { t } = useTranslation();
  const handleCancel = () => {
    if (isPending) return;
    onClose();
  };

  const resource = t(`resources.${resourceLabel}`);

  return (
    <Modal
      title={t('deleteConfirm.title', { resource })}
      open={open}
      onOk={onConfirm}
      onCancel={handleCancel}
      okText={t('deleteConfirm.ok')}
      okType="danger"
      okButtonProps={{ loading: isPending, danger: true, type: 'primary' }}
      cancelButtonProps={{ disabled: isPending }}
      destroyOnHidden
      data-component="DeleteConfirmModal"
      data-resource={resourceLabel}
    >
      <Typography.Paragraph style={{ marginBottom: 4 }}>
        <Trans
          i18nKey="deleteConfirm.body"
          values={{ resource, name: resourceName }}
          components={{ strong: <strong /> }}
        />
      </Typography.Paragraph>
      <Typography.Text type="secondary">{t('deleteConfirm.warning')}</Typography.Text>
    </Modal>
  );
}
