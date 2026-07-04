import { CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { Alert, Checkbox, Space, Table, Tag, Typography } from 'antd';
import type { Dispatch } from 'react';
import { useTranslation } from 'react-i18next';
import {
  computeSchemaDrift,
  hasSchemaDrift,
  refreshSheetKey,
  type WizardAction,
  type WizardState,
} from './state';

type Props = Readonly<{
  state: WizardState;
  dispatch: Dispatch<WizardAction>;
}>;

/** F10 — Drift review. The incoming file's parsed schema is diffed against the
 *  refreshed dataset's committed columns; added / removed / dtype-changed
 *  columns are surfaced loudly (never silently absorbed). Per the R145 D-gate
 *  domain decision, drift NEVER blocks the refresh — the user acknowledges and
 *  proceeds; the runtime stale machinery catches broken dependents on next open.
 *  The dependent-artifact blast-radius preview is a backend read that lands at
 *  C/B (upload.md § Refresh F10 — the slice 1a/1b seam). */
export function UploadDriftStep({ state, dispatch }: Props) {
  const { t } = useTranslation();
  const key = refreshSheetKey(state);
  const incoming = state.sheets[key]?.columns ?? [];
  const baseline = state.refreshBaseline ?? [];
  const drift = computeSchemaDrift(baseline, incoming);
  const dirty = hasSchemaDrift(drift);

  if (!dirty) {
    return (
      <div data-component="UploadDriftStep">
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          title={t('upload.drift.noneTitle')}
          description={t('upload.drift.noneBody')}
          data-component="DriftNone"
        />
      </div>
    );
  }

  return (
    <div data-component="UploadDriftStep">
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        <WarningOutlined style={{ color: 'var(--ant-color-warning, #faad14)', marginRight: 8 }} />
        {t('upload.drift.title')}
      </Typography.Title>
      <Typography.Paragraph type="secondary">{t('upload.drift.subtitle')}</Typography.Paragraph>

      {drift.removed.length > 0 ? (
        <DriftGroup
          tone="removed"
          title={t('upload.drift.removedTitle', { count: drift.removed.length })}
          hint={t('upload.drift.removedHint')}
          rows={drift.removed.map((c) => ({ key: c.name, name: c.name, detail: c.dtype }))}
        />
      ) : null}

      {drift.dtypeChanged.length > 0 ? (
        <DriftGroup
          tone="changed"
          title={t('upload.drift.dtypeChangedTitle', { count: drift.dtypeChanged.length })}
          hint={t('upload.drift.dtypeChangedHint')}
          rows={drift.dtypeChanged.map((c) => ({
            key: c.name,
            name: c.name,
            detail: t('upload.drift.dtypeArrow', { from: c.from, to: c.to }),
          }))}
        />
      ) : null}

      {drift.added.length > 0 ? (
        <DriftGroup
          tone="added"
          title={t('upload.drift.addedTitle', { count: drift.added.length })}
          hint={t('upload.drift.addedHint')}
          rows={drift.added.map((c) => ({ key: c.name, name: c.name, detail: c.dtype }))}
        />
      ) : null}

      {drift.removed.length > 0 || drift.dtypeChanged.length > 0 ? (
        <Alert
          type="info"
          showIcon
          title={t('upload.drift.blastRadiusTitle')}
          description={t('upload.drift.blastRadiusStub')}
          style={{ marginTop: 12 }}
          data-component="DriftBlastRadius"
        />
      ) : null}

      <div style={{ marginTop: 16 }} data-component="DriftAcknowledge">
        <Checkbox
          checked={state.driftAcknowledged}
          onChange={(e) => dispatch({ type: 'SET_DRIFT_ACK', acknowledged: e.target.checked })}
        >
          {t('upload.drift.acknowledge')}
        </Checkbox>
      </div>
    </div>
  );
}

type DriftRow = { key: string; name: string; detail: string };

const TONE_COLOR: Record<'removed' | 'changed' | 'added', string> = {
  removed: 'error',
  changed: 'warning',
  added: 'blue',
};

function DriftGroup({
  tone,
  title,
  hint,
  rows,
}: Readonly<{
  tone: 'removed' | 'changed' | 'added';
  title: string;
  hint: string;
  rows: DriftRow[];
}>) {
  return (
    <div style={{ marginBottom: 16 }} data-component="DriftGroup" data-tone={tone}>
      <Space align="baseline" style={{ marginBottom: 4 }}>
        <Tag color={TONE_COLOR[tone]}>{title}</Tag>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {hint}
        </Typography.Text>
      </Space>
      <Table
        size="small"
        pagination={false}
        showHeader={false}
        rowKey="key"
        dataSource={rows}
        columns={[
          {
            dataIndex: 'name',
            key: 'name',
            render: (name: string) => <code>{name}</code>,
          },
          {
            dataIndex: 'detail',
            key: 'detail',
            align: 'right' as const,
            render: (detail: string) => (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {detail}
              </Typography.Text>
            ),
          },
        ]}
      />
    </div>
  );
}
