// R101 — a name (+ optional slug) prompt, shared by "New dashboard" (create,
// with slug) and "Rename" (name only). Name is the only dashboard setting this
// round (decision #6); the slug is its URL-friendly identifier.

import { Form, Input, Modal } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { slugify } from './slug';

type NameModalProps = Readonly<{
  open: boolean;
  title: string;
  initialName?: string;
  okText?: string;
  /** Show a slug field (auto-derived from the name until edited). */
  withSlug?: boolean;
  onSubmit: (name: string, slug: string) => void;
  onCancel: () => void;
}>;

export function NameModal({ open, title, initialName, okText, withSlug, onSubmit, onCancel }: NameModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName ?? '');
  const [slug, setSlug] = useState('');
  // Once the user edits the slug by hand, stop auto-deriving it from the name.
  const slugTouched = useRef(false);

  useEffect(() => {
    if (!open) return;
    setName(initialName ?? '');
    setSlug(slugify(initialName ?? ''));
    slugTouched.current = false;
  }, [open, initialName]);

  const onNameChange = (value: string) => {
    setName(value);
    if (withSlug && !slugTouched.current) setSlug(slugify(value));
  };

  const trimmedName = name.trim();
  const effectiveSlug = withSlug ? slug.trim() || slugify(trimmedName) : '';
  const valid = trimmedName.length >= 1 && trimmedName.length <= 120 && (!withSlug || effectiveSlug.length > 0);

  const submit = () => {
    if (valid) onSubmit(trimmedName, effectiveSlug);
  };

  return (
    <Modal
      open={open}
      title={title}
      okText={okText ?? t('common.ok')}
      okButtonProps={{ disabled: !valid }}
      onOk={submit}
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
            onChange={(e) => onNameChange(e.target.value)}
            onPressEnter={submit}
          />
        </Form.Item>
        {withSlug ? (
          <Form.Item label={t('dashboard.slugLabel')} required help={t('dashboard.slugHelp')}>
            <Input
              value={slug}
              placeholder={t('dashboard.slugPlaceholder')}
              onChange={(e) => {
                slugTouched.current = true;
                setSlug(slugify(e.target.value));
              }}
              onPressEnter={submit}
              data-component="DashboardSlug"
            />
          </Form.Item>
        ) : null}
      </Form>
    </Modal>
  );
}
