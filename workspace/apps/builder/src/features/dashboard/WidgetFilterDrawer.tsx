// WidgetFilterDrawer (R103) — a right-side panel to filter ONE widget at
// runtime. Each widget filters on its OWN categorical columns (one-of values),
// client-side over its already-fetched rows — no cross-widget ambiguity, no
// contract/backend change, and the selection resets on reload. Formula-free:
// every control is a select. Opened from the per-card filter icon.
//
// Progressive disclosure: rather than list every column up front (a wall of
// fields for a wide query), the user "Add filter" → picks a column → picks
// values; only added filters show. Scales to wide queries.

import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Drawer, Empty, Select, Space, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

import type { DashboardFilter } from './aggregate';
import { useWidgetFilterOptions } from './hooks';
import type { Widget } from './types';

// Local, single-consumer layout value — NOT a shared token (it isn't an
// app-shell dimension, and layoutTokens lives in @mdd/ui, a layer below this
// feature). Roughly AntD's default Drawer width; tunable here.
const DRAWER_WIDTH = 360;

type WidgetFilterDrawerProps = Readonly<{
  open: boolean;
  /** The widget being filtered; kept set through the close animation, then
   *  cleared via `afterClose` (so content doesn't blank mid-slide-out). */
  widget: Widget | null;
  filters: readonly DashboardFilter[];
  onChange: (filters: DashboardFilter[]) => void;
  onClose: () => void;
  afterClose: () => void;
}>;

export function WidgetFilterDrawer({
  open,
  widget,
  filters,
  onChange,
  onClose,
  afterClose,
}: WidgetFilterDrawerProps) {
  const { t } = useTranslation();
  const options = useWidgetFilterOptions(widget?.queryId);

  // Distinct values offered for a column (the picker) vs the currently-selected
  // ones (from the active filters).
  const optionValues = (column: string): string[] => options.find((o) => o.column === column)?.values ?? [];
  const selected = (column: string): string[] => filters.find((f) => f.column === column)?.values.slice() ?? [];
  // Columns not yet added as a filter (the "Add filter" choices).
  const available = options.filter((o) => !filters.some((f) => f.column === o.column));

  const addFilter = (column: string) => onChange([...filters, { column, values: [] }]);
  const setValues = (column: string, values: string[]) =>
    onChange(filters.map((f) => (f.column === column ? { ...f, values } : f)));
  const removeFilter = (column: string) => onChange(filters.filter((f) => f.column !== column));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      afterOpenChange={(o) => {
        if (!o) afterClose();
      }}
      title={widget ? t('dashboard.filter.title', { title: widget.title }) : t('dashboard.filter.add')}
      width={DRAWER_WIDTH}
      extra={
        filters.length > 0 ? (
          <Button type="link" size="small" onClick={() => onChange([])} data-component="WidgetFilterClear">
            {t('dashboard.filter.clear')}
          </Button>
        ) : null
      }
    >
      {options.length === 0 ? (
        <Empty description={t('dashboard.filter.none')} />
      ) : (
        <Space direction="vertical" size="middle" style={{ width: '100%' }} data-component="WidgetFilterForm">
          {filters.map((f) => (
            <div key={f.column}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Typography.Text strong style={{ fontSize: 13 }}>
                  {f.column}
                </Typography.Text>
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={() => removeFilter(f.column)}
                  aria-label={t('dashboard.filter.remove', { column: f.column })}
                />
              </div>
              <Select
                mode="multiple"
                allowClear
                autoFocus={selected(f.column).length === 0}
                value={selected(f.column)}
                options={optionValues(f.column).map((v) => ({ value: v, label: v }))}
                onChange={(vals: string[]) => setValues(f.column, vals)}
                placeholder={t('dashboard.filter.valuesPlaceholder')}
                maxTagCount="responsive"
                style={{ width: '100%' }}
                aria-label={t('dashboard.filter.valuesFor', { column: f.column })}
              />
            </div>
          ))}
          {available.length > 0 ? (
            <Select
              // A controlled "picker" that always shows its placeholder (no value).
              value={null}
              showSearch
              optionFilterProp="label"
              placeholder={t('dashboard.filter.add')}
              suffixIcon={<PlusOutlined />}
              options={available.map((o) => ({ value: o.column, label: o.column }))}
              onChange={(col: string) => addFilter(col)}
              style={{ width: '100%' }}
              aria-label={t('dashboard.filter.add')}
              data-component="WidgetFilterAdd"
            />
          ) : null}
          {filters.length === 0 ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('dashboard.filter.hint')}
            </Typography.Text>
          ) : null}
        </Space>
      )}
    </Drawer>
  );
}
