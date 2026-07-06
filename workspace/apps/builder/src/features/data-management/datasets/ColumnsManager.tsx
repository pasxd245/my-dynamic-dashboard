// ColumnsManager (R152, F7) — the ONLY surface that can re-show a hidden
// column (a header menu can't; the column isn't rendered). A toolbar button
// `[⚙ Columns N/M]` opens a Popover checklist. Two independent controls:
//   • the per-column checkboxes → the PERSISTED `hidden` set (Apply = PATCH)
//   • "Show all columns" → a SESSION-LOCAL preview override (never persisted),
//     so the hint is always an overridable default.
// Scope guard: a visibility editor only — no rename / reorder / dtype here.

import { GearIcon } from '@phosphor-icons/react';
import { Button, Checkbox, Divider, Popover, Space, Switch, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Column } from './types';

export type ColumnsManagerProps = Readonly<{
  columns: readonly Column[];
  /** Session-local preview override — show hidden columns without un-hiding. */
  showAll: boolean;
  onShowAllChange: (next: boolean) => void;
  /** Apply the visible/hidden set. Rejects → the popover stays open to retry. */
  onApply: (hidden: string[]) => Promise<void>;
  applying: boolean;
}>;

export function ColumnsManager({
  columns,
  showAll,
  onShowAllChange,
  onApply,
  applying,
}: ColumnsManagerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // Working copy of the HIDDEN set (by column name), seeded when the popover opens.
  const [draftHidden, setDraftHidden] = useState<ReadonlySet<string>>(new Set());

  const total = columns.length;
  const persistedVisible = columns.filter((c) => !c.hidden).length;
  const persistedHidden = new Set(columns.filter((c) => c.hidden).map((c) => c.name));

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraftHidden(new Set(persistedHidden));
    }
    setOpen(next);
  };

  const toggle = (name: string, visible: boolean) => {
    setDraftHidden((prev) => {
      const next = new Set(prev);
      if (visible) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const draftVisibleCount = total - draftHidden.size;
  const dirty =
    draftHidden.size !== persistedHidden.size ||
    [...draftHidden].some((n) => !persistedHidden.has(n));
  const canApply = draftVisibleCount >= 1 && dirty && !applying;

  const apply = async () => {
    try {
      await onApply([...draftHidden]);
      setOpen(false);
    } catch {
      // Parent surfaces the error (message.error); keep open so the user retries.
    }
  };

  const content = (
    <div data-component="ColumnsManagerPanel" style={{ width: 260 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography.Text>{t('datasets.detail.columns.showAll')}</Typography.Text>
        <Switch
          size="small"
          checked={showAll}
          onChange={onShowAllChange}
          data-component="ColumnsManagerShowAll"
        />
      </div>
      <Divider style={{ margin: '8px 0' }} />
      <div
        style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}
        data-component="ColumnsManagerList"
      >
        {columns.map((col) => (
          <Checkbox
            key={col.name}
            checked={!draftHidden.has(col.name)}
            onChange={(e) => toggle(col.name, e.target.checked)}
            data-component="ColumnsManagerItem"
            data-column={col.name}
          >
            {col.name}
          </Checkbox>
        ))}
      </div>
      {draftVisibleCount < 1 ? (
        <Typography.Text
          type="danger"
          style={{ fontSize: 12, display: 'block', marginTop: 8 }}
          data-component="ColumnsManagerGuard"
        >
          {t('datasets.detail.columns.atLeastOne')}
        </Typography.Text>
      ) : null}
      <Divider style={{ margin: '8px 0' }} />
      <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button size="small" onClick={() => setOpen(false)}>
          {t('common.cancel')}
        </Button>
        <Button
          size="small"
          type="primary"
          loading={applying}
          disabled={!canApply}
          onClick={apply}
          data-component="ColumnsManagerApply"
        >
          {t('datasets.detail.columns.apply')}
        </Button>
      </Space>
    </div>
  );

  return (
    <Popover
      open={open}
      onOpenChange={handleOpenChange}
      trigger="click"
      placement="bottomRight"
      content={content}
      destroyOnHidden
    >
      <Button
        size="small"
        icon={<GearIcon size={16} />}
        data-component="ColumnsManagerButton"
      >
        {t('datasets.detail.columns.button', { visible: persistedVisible, total })}
      </Button>
    </Popover>
  );
}
