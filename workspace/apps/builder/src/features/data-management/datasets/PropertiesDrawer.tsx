// PropertiesDrawer (R153) — the dataset's schema view + visibility editor in a
// right-side Drawer. Evolves the R152 Columns manager (popover → drawer) and
// absorbs its visibility checklist. CONTROLLED: the parent owns `open` and the
// two entries to this one surface — the `[▦ Columns N/M]` toolbar button and the
// `Actions ▾ → Properties` menu item.
//
// One row per column (incl. hidden): name · dtype · a show/hide checkbox — all
// read from the `Column` (zero backend; Apply reuses the R152 PATCH). "Show all"
// is a SESSION-LOCAL preview override (never persisted), so the hint stays an
// overridable default. Scope guard: schema view + visibility edit only — no
// rename / reorder / dtype.

import { Button, Checkbox, Drawer, Skeleton, Space, Switch, Tag, Typography } from 'antd';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Column, ColumnProfile, DatasetProfile } from './types';

function SectionHeader({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Typography.Text
      type="secondary"
      style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}
    >
      {children}
    </Typography.Text>
  );
}

export type PropertiesDrawerProps = Readonly<{
  open: boolean;
  onClose: () => void;
  /** Dataset-level facts (label/value), shared with the inline MetadataStrip. */
  datasetMeta: ReadonlyArray<{ label: string; value: string }>;
  columns: readonly Column[];
  /** Session-local preview override — show hidden columns without un-hiding. */
  showAll: boolean;
  onShowAllChange: (next: boolean) => void;
  /** Apply the visible/hidden set. Rejects → the drawer stays open to retry. */
  onApply: (hidden: string[]) => Promise<void>;
  applying: boolean;
  /** R154 — on-demand profile (lazy, fetched while the drawer is open). */
  profile: DatasetProfile | undefined;
  profileLoading: boolean;
  profileError: boolean;
  onRetryProfile: () => void;
}>;

/** One compact stat line per column: null% · distinct · min–max · sample —
 *  only the parts that apply to the dtype (the contract's per-dtype shape). */
function profileStatParts(cp: ColumnProfile, t: ReturnType<typeof useTranslation>['t']): string[] {
  const parts = [
    t('datasets.detail.profile.nullPct', { pct: cp.nullPct }),
    t('datasets.detail.profile.distinct', { count: cp.distinctCount }),
  ];
  if (cp.min !== null && cp.max !== null) {
    parts.push(t('datasets.detail.profile.range', { min: cp.min, max: cp.max }));
  }
  if (cp.sample && cp.sample.length > 0) {
    parts.push(t('datasets.detail.profile.sample', { values: cp.sample.join(', ') }));
  }
  return parts;
}

export function PropertiesDrawer({
  open,
  onClose,
  datasetMeta,
  columns,
  showAll,
  onShowAllChange,
  onApply,
  applying,
  profile,
  profileLoading,
  profileError,
  onRetryProfile,
}: PropertiesDrawerProps) {
  const { t } = useTranslation();
  // Per-column date/datetime format, folded in from the profile response —
  // it lives in commitSettings, not the Column, so it appears once the (lazy)
  // profile loads. null / absent → nothing rendered.
  const formatByName = new Map((profile?.columns ?? []).map((c) => [c.name, c.format]));
  // Working copy of the HIDDEN set (by column name), re-seeded each time it opens.
  const [draftHidden, setDraftHidden] = useState<ReadonlySet<string>>(new Set());

  const persistedHidden = new Set(columns.filter((c) => c.hidden).map((c) => c.name));
  const total = columns.length;

  useEffect(() => {
    if (open) {
      setDraftHidden(new Set(columns.filter((c) => c.hidden).map((c) => c.name)));
    }
  }, [open, columns]);

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
      onClose();
    } catch {
      // Parent surfaces the error (message.error); keep open so the user retries.
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="right"
      title={t('datasets.detail.properties.title')}
    >
      {/* Dataset section — the dataset-level facts (shared with the inline strip). */}
      <SectionHeader>{t('datasets.detail.properties.dataset')}</SectionHeader>
      <div data-component="PropertiesDrawerDataset" style={{ marginBottom: 16 }}>
        {datasetMeta.map((item) => (
          <div
            key={item.label}
            style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 4px' }}
          >
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {item.label}
            </Typography.Text>
            <Typography.Text strong style={{ fontSize: 12, textAlign: 'right' }}>
              {item.value}
            </Typography.Text>
          </div>
        ))}
      </div>

      {/* Columns section — the schema + the visibility editor. */}
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}
      >
        <SectionHeader>{t('datasets.detail.properties.columns')}</SectionHeader>
        <Space size="small">
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('datasets.detail.columns.showAll')}
          </Typography.Text>
          <Switch
            size="small"
            checked={showAll}
            onChange={onShowAllChange}
            data-component="PropertiesDrawerShowAll"
          />
        </Space>
      </div>
      <div data-component="PropertiesDrawerList">
        {columns.map((col) => (
          <div
            key={col.name}
            data-component="PropertiesDrawerItem"
            data-column={col.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '7px 4px',
              borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
            }}
          >
            <Checkbox
              checked={!draftHidden.has(col.name)}
              onChange={(e) => toggle(col.name, e.target.checked)}
              data-component="PropertiesDrawerItemToggle"
            >
              {col.name}
            </Checkbox>
            <Space size="small">
              {formatByName.get(col.name) ? (
                <Typography.Text
                  type="secondary"
                  style={{ fontSize: 11 }}
                  data-component="PropertiesDrawerFormat"
                  data-column={col.name}
                >
                  {t('datasets.detail.properties.formatLabel', { format: formatByName.get(col.name) })}
                </Typography.Text>
              ) : null}
              <Tag
                style={{ marginInlineEnd: 0, fontSize: 11 }}
                data-component="PropertiesDrawerDtype"
                data-dtype={col.dtype}
              >
                {t(`datasets.detail.dtype.${col.dtype}`)}
              </Tag>
            </Space>
          </div>
        ))}
      </div>

      {draftVisibleCount < 1 ? (
        <Typography.Text
          type="danger"
          style={{ fontSize: 12, display: 'block', marginTop: 10 }}
          data-component="PropertiesDrawerGuard"
        >
          {t('datasets.detail.columns.atLeastOne')}
        </Typography.Text>
      ) : null}

      <Space style={{ width: '100%', justifyContent: 'flex-end', marginTop: 16 }}>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          type="primary"
          loading={applying}
          disabled={!canApply}
          onClick={apply}
          data-component="PropertiesDrawerApply"
        >
          {t('datasets.detail.columns.apply')}
        </Button>
      </Space>

      {/* Profiling section (R154) — read-only, lazy. Its own loading / error
          states; the compute is isolated from the free sections above. */}
      <div style={{ borderTop: '1px solid var(--ant-color-border-secondary, #f0f0f0)', marginTop: 20, paddingTop: 12 }}>
        <SectionHeader>{t('datasets.detail.profile.title')}</SectionHeader>
        <div data-component="PropertiesDrawerProfile" style={{ marginTop: 8 }}>
          {profileLoading ? (
            <Skeleton active paragraph={{ rows: 3 }} title={false} data-component="PropertiesDrawerProfileLoading" />
          ) : null}

          {!profileLoading && profileError ? (
            <Space orientation="vertical" size={4} data-component="PropertiesDrawerProfileError">
              <Typography.Text type="danger" style={{ fontSize: 12 }}>
                {t('datasets.detail.profile.error')}
              </Typography.Text>
              <Button size="small" onClick={onRetryProfile} data-component="PropertiesDrawerProfileRetry">
                {t('datasets.detail.profile.retry')}
              </Button>
            </Space>
          ) : null}

          {!profileLoading && !profileError && profile ? (
            <>
              {profile.approx ? (
                <Typography.Text
                  type="warning"
                  style={{ fontSize: 11, display: 'block', marginBottom: 6 }}
                  data-component="PropertiesDrawerProfileApprox"
                >
                  {t('datasets.detail.profile.approxNote', {
                    rows: (profile.sampledRows ?? 0).toLocaleString(),
                  })}
                </Typography.Text>
              ) : null}
              {profile.columns.map((cp) => (
                <div
                  key={cp.name}
                  data-component="PropertiesDrawerProfileRow"
                  data-column={cp.name}
                  style={{ padding: '5px 4px', borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)' }}
                >
                  <Typography.Text style={{ fontSize: 12 }}>{cp.name}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                    {profileStatParts(cp, t).join(' · ')}
                  </Typography.Text>
                </div>
              ))}
            </>
          ) : null}
        </div>
      </div>
    </Drawer>
  );
}
