import { Modal, Typography } from 'antd';

export type DeleteConfirmModalProps = Readonly<{
  resourceLabel: 'workspace' | 'dataset';
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
  const handleCancel = () => {
    if (isPending) return;
    onClose();
  };

  return (
    <Modal
      title={`Delete ${resourceLabel}`}
      open={open}
      onOk={onConfirm}
      onCancel={handleCancel}
      okText="Delete"
      okType="danger"
      okButtonProps={{ loading: isPending, danger: true, type: 'primary' }}
      cancelButtonProps={{ disabled: isPending }}
      destroyOnHidden
      data-component="DeleteConfirmModal"
      data-resource={resourceLabel}
    >
      <Typography.Paragraph style={{ marginBottom: 4 }}>
        Delete {resourceLabel} <strong>{resourceName}</strong>?
      </Typography.Paragraph>
      <Typography.Text type="secondary">This action cannot be undone.</Typography.Text>
    </Modal>
  );
}
