import { Alert, Form, Input, Modal } from "antd";
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
    error instanceof ApiErrorThrown && error.body.code === "name_taken";
  const genericError =
    error instanceof Error && !(error instanceof ApiErrorThrown)
      ? error.message
      : null;

  return (
    <Modal
      title={`Rename ${resourceLabel}`}
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      okText="Save"
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
          label="Name"
          name="name"
          rules={[
            { required: true, message: "Name is required" },
            {
              max: maxLength,
              message: `Name must be ${maxLength} characters or fewer`,
            },
          ]}
        >
          <Input
            autoFocus
            disabled={isPending}
            placeholder={`New ${resourceLabel} name`}
          />
        </Form.Item>
        {nameTaken ? (
          <Alert
            type="error"
            showIcon
            message={`Another ${resourceLabel} already has that name.`}
            data-component="RenameNameTaken"
          />
        ) : null}
        {genericError ? (
          <Alert
            type="error"
            showIcon
            message="Couldn't rename"
            description={genericError}
            data-component="RenameGenericError"
          />
        ) : null}
      </Form>
    </Modal>
  );
}
