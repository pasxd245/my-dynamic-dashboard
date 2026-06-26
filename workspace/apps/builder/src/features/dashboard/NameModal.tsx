// R101 — a tiny name prompt, shared by "New dashboard" (create) and "Rename".
// Name is the only dashboard setting this round (decision #6).

import { Form, Input, Modal } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type NameModalProps = Readonly<{
  open: boolean;
  title: string;
  initialName?: string;
  okText?: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}>;

export function NameModal({ open, title, initialName, okText, onSubmit, onCancel }: NameModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName ?? '');

  useEffect(() => {
    if (open) setName(initialName ?? '');
  }, [open, initialName]);

  const trimmed = name.trim();
  const valid = trimmed.length >= 1 && trimmed.length <= 120;

  return (
    <Modal
      open={open}
      title={title}
      okText={okText ?? t('common.ok')}
      okButtonProps={{ disabled: !valid }}
      onOk={() => valid && onSubmit(trimmed)}
      onCancel={onCancel}
      destroyOnHidden
      data-component="DashboardNameModal"
    >
      <Form layout="vertical">
        <Form.Item label={t('dashboard.nameLabel')} required>
          <Input
            autoFocus
            value={name}
            maxLength={120}
            placeholder={t('dashboard.namePlaceholder')}
            onChange={(e) => setName(e.target.value)}
            onPressEnter={() => valid && onSubmit(trimmed)}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
