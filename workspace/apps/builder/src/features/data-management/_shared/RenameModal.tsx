import { Alert, Form, Input, Modal } from "antd";
import { useTranslation } from "react-i18next";
import { ERROR_CODES } from '@/_generated/constants';
import { ApiErrorThrown } from "./types";

export type RenameModalProps = Readonly<{
  /** "workspace" | "dataset" — drives the title copy. */
  resourceLabel: "workspace" | "dataset";
  /** Max characters allowed — 80 for workspaces, 120 for datasets. */
  maxLength: number;
  /** Current name — pre-fills the input via Form `initialValues`. */
  currentName: string;
  open: boolean;
  /** True while the PATCH is in flight. */
  isPending: boolean;
  /** The structured error from the last failed submit, if any. */
  error: unknown;
  onSubmit: (newName: string) => void;
  onClose: () => void;
}>;

/** R26: shared rename modal for both workspaces and datasets.
 *  Renders an AntD Modal with a single text input. Inline 409
 *  `name_taken` error shown via Alert (covers R23 modal state 3).
 *
 *  Pre-fill: the Modal uses `destroyOnHidden`, so the Form mounts
 *  fresh on each open. We pass `initialValues` on the Form AND a
 *  `key` derived from `currentName` so React unmounts and remounts
 *  when the target resource changes — guaranteeing the new initial
 *  value lands before the input first renders. */
export function RenameModal({
  resourceLabel,
  maxLength,
  currentName,
  open,
  isPending,
  error,
  onSubmit,
  onClose,
}: RenameModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<{ name: string }>();

  const handleOk = async () => {
    const values = await form.validateFields();
    onSubmit(values.name);
  };

  const handleCancel = () => {
    if (isPending) return;
    onClose();
  };

  const nameTaken =
    error instanceof ApiErrorThrown && error.body.code === ERROR_CODES.NAME_TAKEN;
  const genericError =
    error instanceof Error && !(error instanceof ApiErrorThrown)
      ? error.message
      : null;
  const resource = t(`resources.${resourceLabel}`);

  return (
    <Modal
      title={t('rename.title', { resource })}
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      okText={t('rename.ok')}
      okButtonProps={{ loading: isPending }}
      cancelButtonProps={{ disabled: isPending }}
      destroyOnHidden
      data-component="RenameModal"
      data-resource={resourceLabel}
    >
      <Form
        key={currentName}
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={{ name: currentName }}
      >
        <Form.Item
          label={t('common.nameLabel')}
          name="name"
          rules={[
            { required: true, message: t('common.nameRequired') },
            {
              max: maxLength,
              message: t('common.nameMaxLength', { max: maxLength }),
            },
          ]}
        >
          <Input
            autoFocus
            disabled={isPending}
            placeholder={t('common.newResourceName', { resource })}
          />
        </Form.Item>
        {nameTaken ? (
          <Alert
            type="error"
            showIcon
            title={t('rename.duplicate', { resource })}
            data-component="RenameNameTaken"
          />
        ) : null}
        {genericError ? (
          <Alert
            type="error"
            showIcon
            title={t('rename.couldnt')}
            description={genericError}
            data-component="RenameGenericError"
          />
        ) : null}
      </Form>
    </Modal>
  );
}
