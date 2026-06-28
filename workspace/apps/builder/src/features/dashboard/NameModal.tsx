// R101 — a name (+ optional workspace + slug) prompt, shared by "New dashboard"
// (create: workspace + name + slug) and "Rename" (name only). A dashboard is
// workspace-scoped, so the workspace (project) is chosen ONCE here at create
// and inherited by every widget; the slug is its URL-friendly identifier.

import { Form, Input, Modal, Select } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { slugify } from './slug';

type WorkspaceOption = Readonly<{ id: string; name: string }>;

type NameModalProps = Readonly<{
  open: boolean;
  title: string;
  initialName?: string;
  okText?: string;
  /** Show a slug field (auto-derived from the name until edited). */
  withSlug?: boolean;
  /** When provided, show a required Workspace (project) picker — the dashboard
   *  binds to the chosen workspace. Omitted for rename (workspace is fixed). */
  workspaces?: readonly WorkspaceOption[];
  onSubmit: (name: string, slug: string, workspaceId: string | undefined) => void;
  onCancel: () => void;
}>;

export function NameModal({
  open,
  title,
  initialName,
  okText,
  withSlug,
  workspaces,
  onSubmit,
  onCancel,
}: NameModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName ?? '');
  const [slug, setSlug] = useState('');
  const [workspaceId, setWorkspaceId] = useState<string | undefined>(undefined);
  // Once the user edits the slug by hand, stop auto-deriving it from the name.
  const slugTouched = useRef(false);

  const withWorkspace = workspaces !== undefined;
  // Preselect when exactly one workspace exists (create stays one-tap).
  const soleWorkspaceId = workspaces?.length === 1 ? workspaces[0].id : undefined;

  useEffect(() => {
    if (!open) return;
    setName(initialName ?? '');
    setSlug(slugify(initialName ?? ''));
    setWorkspaceId(soleWorkspaceId);
    slugTouched.current = false;
  }, [open, initialName, soleWorkspaceId]);

  const workspaceOptions = useMemo(
    () => (workspaces ?? []).map((w) => ({ value: w.id, label: w.name })),
    [workspaces],
  );

  const onNameChange = (value: string) => {
    setName(value);
    if (withSlug && !slugTouched.current) setSlug(slugify(value));
  };

  const trimmedName = name.trim();
  const effectiveSlug = withSlug ? slug.trim() || slugify(trimmedName) : '';
  const valid =
    trimmedName.length >= 1 &&
    trimmedName.length <= 120 &&
    (!withSlug || effectiveSlug.length > 0) &&
    (!withWorkspace || Boolean(workspaceId));

  const submit = () => {
    if (valid) onSubmit(trimmedName, effectiveSlug, workspaceId);
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
        {withWorkspace ? (
          <Form.Item label={t('dashboard.workspaceLabel')} required>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder={t('dashboard.workspacePlaceholder')}
              value={workspaceId}
              options={workspaceOptions}
              onChange={setWorkspaceId}
              data-component="DashboardWorkspace"
            />
          </Form.Item>
        ) : null}
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
