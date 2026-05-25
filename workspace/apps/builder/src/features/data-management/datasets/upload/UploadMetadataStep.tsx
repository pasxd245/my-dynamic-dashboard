import {
  Alert,
  Button,
  Checkbox,
  Collapse,
  Input,
  InputNumber,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tabs,
  Typography,
} from 'antd';
import type { Dispatch } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { Column, ColumnOverride, Dtype, ParseOptions, SheetSummary } from '../types';
import { CSV_SHEET_KEY, type SheetState, type WizardAction, type WizardState } from './state';

const DTYPES: Dtype[] = ['string', 'integer', 'float', 'boolean', 'date', 'datetime'];

type Props = Readonly<{
  state: WizardState;
  dispatch: Dispatch<WizardAction>;
  /** Re-parse a sheet (Excel) or the whole file (CSV) with its
   *  current parseOptions. R26 extended this to CSV — see the
   *  uploads/parse.contract.yaml description for the wire shape. */
  onReparseSheet?: (sheet: string) => void;
}>;

export function UploadMetadataStep({ state, dispatch, onReparseSheet }: Props) {
  const { t } = useTranslation();
  const isCsv = state.sourceFormat === 'csv';
  const sheetKeys = isCsv ? [CSV_SHEET_KEY] : state.selectedSheets;

  if (sheetKeys.length === 0) {
    return (
      <Alert
        type="info"
        showIcon
        title={t('upload.metadata.noSheetsSelected')}
        description={t('upload.metadata.noSheetsHint')}
      />
    );
  }

  if (isCsv) {
    return (
      <div data-component="UploadMetadataStep">
        <SheetPane sheetKey={CSV_SHEET_KEY} state={state} dispatch={dispatch} onReparse={onReparseSheet} />
      </div>
    );
  }

  return (
    <div data-component="UploadMetadataStep">
      <Tabs
        items={sheetKeys.map((key) => ({
          key,
          label: tabLabel(key, state, t),
          children: <SheetPane sheetKey={key} state={state} dispatch={dispatch} onReparse={onReparseSheet} />,
        }))}
      />
    </div>
  );
}

function tabLabel(key: string, state: WizardState, t: TFunction): React.ReactNode {
  const name = key || 'CSV';
  const sheet = state.sheets[key];
  if (!sheet) return name;
  if (sheet.status === 'parsing') return `${name} ⏳`;
  if (sheet.status === 'failed') return `${name} ✗`;
  if (sheet.status === 'ok') {
    const hasOverrides = Object.keys(sheet.columnOverrides).length > 0 || sheet.excludedColumns.length > 0;
    if (hasOverrides) {
      return (
        <span data-component="SheetTabLabel" data-overridden="true">
          {name}{' '}
          <span
            style={{ color: '#d48806', fontWeight: 600 }}
            aria-label={t('upload.metadata.hasOverridesAria')}
            title={t('upload.metadata.hasOverridesTitle')}
          >
            ✎
          </span>
        </span>
      );
    }
    return (
      <span data-component="SheetTabLabel" data-overridden="false">
        {name}{' '}
        <span style={{ color: '#52c41a' }} aria-label={t('upload.metadata.parsedAria')}>
          ✓
        </span>
      </span>
    );
  }
  return name;
}

type PaneProps = Readonly<{
  sheetKey: string;
  state: WizardState;
  dispatch: Dispatch<WizardAction>;
  /** Re-parse callback: a single sheet (Excel) or the whole file
   *  (CSV; the `sheet` arg is `CSV_SHEET_KEY = ""`). R26 extension. */
  onReparse: ((sheet: string) => void) | undefined;
}>;

function SheetPane({ sheetKey, state, dispatch, onReparse }: PaneProps) {
  const { t } = useTranslation();
  const sheet = state.sheets[sheetKey];
  const isCsv = state.sourceFormat === 'csv';

  if (!sheet) {
    return <Alert type="info" title={t('upload.metadata.notParsedYet')} />;
  }

  if (sheet.status === 'parsing') {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin /> {t('upload.metadata.parsing')}
      </div>
    );
  }

  // The parse-options disclosure is always available (auto-expands on
  // failed so the user lands on the obvious next action).
  const optionsDisclosure = (
    <ParseOptionsDisclosure
      sheetKey={sheetKey}
      sheet={sheet}
      isCsv={isCsv}
      availableSheets={state.availableSheets}
      dispatch={dispatch}
      onReparse={onReparse}
    />
  );

  if (sheet.status === 'failed') {
    return (
      <div>
        {optionsDisclosure}
        <Alert
          type="error"
          showIcon
          title={t('upload.metadata.parseFailed', { error: sheet.parseError?.error ?? 'unknown' })}
          description={sheet.parseError?.detail}
          data-component="SheetParseFailed"
        />
        <ParseFailedActions sheetKey={sheetKey} isCsv={isCsv} dispatch={dispatch} />
      </div>
    );
  }

  const sheetLabel = isCsv ? '' : sheetKey;
  const total = sheet.columns.length;
  const kept = total - sheet.excludedColumns.length;

  const resetAll = () => {
    for (const col of sheet.columns) {
      if (sheet.columnOverrides[col.name]) {
        dispatch({
          type: 'SET_COLUMN_OVERRIDE',
          sheet: sheetKey,
          column: col.name,
          override: null,
        });
      }
    }
  };
  const hasAnyOverride = Object.keys(sheet.columnOverrides).length > 0;

  const tableColumns = [
    {
      title: t('upload.metadata.tableInclude'),
      key: 'include',
      width: 80,
      render: (_: unknown, row: Column) => (
        <Checkbox
          checked={!sheet.excludedColumns.includes(row.name)}
          onChange={() =>
            dispatch({
              type: 'TOGGLE_EXCLUDED_COLUMN',
              sheet: sheetKey,
              column: row.name,
            })
          }
          data-component="ColumnIncludeCheckbox"
          data-column={row.name}
        />
      ),
    },
    {
      title: t('upload.metadata.tableColumn'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <span style={{ fontWeight: 500 }}>{name}</span>,
    },
    {
      title: t('upload.metadata.tableDetected'),
      dataIndex: 'dtype',
      key: 'detected',
      render: (d: Dtype) => <Typography.Text type="secondary">{d}</Typography.Text>,
    },
    {
      title: t('upload.metadata.tableOverride'),
      key: 'override',
      render: (_: unknown, row: Column) => (
        <OverrideCell
          row={row}
          override={sheet.columnOverrides[row.name]}
          onChange={(override) =>
            dispatch({
              type: 'SET_COLUMN_OVERRIDE',
              sheet: sheetKey,
              column: row.name,
              override,
            })
          }
        />
      ),
    },
    {
      title: t('upload.metadata.tableSample'),
      key: 'sample',
      render: (_: unknown, row: Column) => (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {sampleFor(sheet.sampleRows, sheet.columns, row.name)}
        </Typography.Text>
      ),
    },
  ];

  return (
    <div>
      {optionsDisclosure}
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        {sheetLabel ? (
          <Trans
            i18nKey="upload.metadata.detectedSchemaWithLabel"
            values={{ sheet: sheetLabel, rows: sheet.rowCount.toLocaleString(), total }}
            components={{ strong: <strong /> }}
          />
        ) : (
          t('upload.metadata.detectedSchemaNoLabel', {
            rows: sheet.rowCount.toLocaleString(),
            total,
          })
        )}
      </Typography.Paragraph>
      <Table
        size="small"
        pagination={false}
        rowKey="name"
        dataSource={sheet.columns.map((c) => ({ ...c, key: c.name }))}
        columns={tableColumns}
      />
      <div
        style={{
          marginTop: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Button type="link" size="small" onClick={resetAll} disabled={!hasAnyOverride} data-component="ResetOverrides">
          {t('upload.metadata.resetAll')}
        </Button>
        <Typography.Text type="secondary" data-component="MetadataIncludedCount">
          {sheetLabel
            ? t('upload.metadata.includedCountWithSheet', { sheet: sheetLabel, kept, total })
            : t('upload.metadata.includedCount', { kept, total })}
        </Typography.Text>
      </div>
    </div>
  );
}

type OverrideProps = Readonly<{
  row: Column;
  override: ColumnOverride | undefined;
  onChange: (override: ColumnOverride | null) => void;
}>;

function OverrideCell({ row, override, onChange }: OverrideProps) {
  const dtype = override?.dtype ?? row.dtype;
  const showFormat = dtype === 'date' || dtype === 'datetime';
  const isOverridden = override !== undefined;
  return (
    <Space orientation="vertical" size={4} style={{ width: '100%' }}>
      <Select
        size="small"
        status={isOverridden ? 'warning' : undefined}
        style={{
          width: 140,
          background: isOverridden ? '#fffbe6' : undefined,
        }}
        value={dtype}
        options={DTYPES.map((d) => ({ value: d, label: d }))}
        onChange={(value) => {
          const same = value === row.dtype;
          if (same) {
            onChange(null);
            return;
          }
          const next: ColumnOverride = { dtype: value };
          if (value === 'date' || value === 'datetime') {
            next.format = override?.format ?? (value === 'date' ? 'yyyy-MM-dd' : 'yyyy-MM-dd HH:mm:ss');
          }
          onChange(next);
        }}
        data-component="ColumnDtypeSelect"
        data-column={row.name}
        data-overridden={isOverridden}
      />
      {showFormat ? (
        <Input
          size="small"
          value={override?.format ?? ''}
          placeholder={dtype === 'date' ? 'yyyy-MM-dd' : 'yyyy-MM-dd HH:mm:ss'}
          onChange={(e) => onChange({ dtype, format: e.target.value })}
          data-component="ColumnFormatInput"
          data-column={row.name}
          style={{ width: 180 }}
        />
      ) : null}
    </Space>
  );
}

function sampleFor(rows: (string | null)[][], cols: Column[], name: string): string {
  const idx = cols.findIndex((c) => c.name === name);
  if (idx < 0) return '—';
  const values = rows
    .map((r) => r[idx])
    .filter((v): v is string => v != null && v !== '')
    .slice(0, 3);
  if (values.length === 0) return '—';
  return values.join(', ');
}

type DisclosureProps = Readonly<{
  sheetKey: string;
  sheet: SheetState;
  isCsv: boolean;
  availableSheets: SheetSummary[];
  dispatch: Dispatch<WizardAction>;
  onReparse: ((sheet: string) => void) | undefined;
}>;

function ParseOptionsDisclosure({ sheetKey, sheet, isCsv, availableSheets, dispatch, onReparse }: DisclosureProps) {
  const { t } = useTranslation();
  const opts = sheet.parseOptions;
  const update = (patch: Partial<ParseOptions>) => {
    const next: ParseOptions = { ...opts, ...patch };
    // Strip undefined values so an empty input clears the field.
    for (const k of Object.keys(next) as (keyof ParseOptions)[]) {
      if (next[k] === undefined) delete next[k];
    }
    dispatch({ type: 'SET_PARSE_OPTIONS', sheet: sheetKey, options: next });
  };

  const usedRange = isCsv ? undefined : availableSheets.find((s) => s.sheet === sheetKey)?.usedRange;

  const body = (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      {isCsv ? (
        <div data-component="ParseOptionCsvSkipRows">
          <Typography.Text>{t('upload.metadata.skipRows')} </Typography.Text>
          <InputNumber
            min={0}
            value={opts.skip_rows ?? null}
            onChange={(v) => update({ skip_rows: typeof v === 'number' ? v : undefined })}
            placeholder="0"
            data-component="ParseOptionSkipRowsInput"
          />
          <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
            {t('upload.metadata.skipRowsHelp')}
          </Typography.Text>
        </div>
      ) : (
        <div data-component="ParseOptionExcelRange">
          <Typography.Text>{t('upload.metadata.range')} </Typography.Text>
          <Input
            value={opts.range ?? ''}
            onChange={(e) => {
              // Auto-uppercase: the contract pattern requires
              // `^[A-Z]+[0-9]+:[A-Z]+[0-9]+$`, so coerce as the user
              // types to keep the input forgiving.
              const raw = e.target.value;
              const next = raw === '' ? undefined : raw.toUpperCase();
              update({ range: next });
            }}
            placeholder={usedRange ?? 'A1:C20'}
            style={{ width: 160, textTransform: 'uppercase' }}
            data-component="ParseOptionRangeInput"
          />
          <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
            <Trans i18nKey="upload.metadata.rangeHelp" components={{ code: <code /> }} />
          </Typography.Text>
        </div>
      )}
      <div data-component="ParseOptionHasHeader">
        <Typography.Text style={{ marginRight: 8 }}>{t('upload.metadata.hasHeader')}</Typography.Text>
        <Switch
          checked={opts.has_header ?? true}
          onChange={(v) => update({ has_header: v })}
          data-component="ParseOptionHasHeaderSwitch"
        />
        <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
          <Trans i18nKey="upload.metadata.hasHeaderHelp" components={{ code: <code /> }} />
        </Typography.Text>
      </div>
      {onReparse ? (
        <Button
          onClick={() => onReparse(sheetKey)}
          disabled={sheet.status === 'parsing'}
          loading={sheet.status === 'parsing'}
          data-component="ParseOptionReparseButton"
        >
          {isCsv ? t('upload.metadata.reparseFile') : t('upload.metadata.reparseSheet')}
        </Button>
      ) : null}
      <Alert
        type="info"
        showIcon
        title={
          isCsv ? t('upload.metadata.resetWarningCsv') : t('upload.metadata.resetWarningExcel')
        }
        data-component="ParseOptionResetWarning"
      />
    </Space>
  );

  // Auto-expand on failed so the user lands on the obvious next action.
  const defaultOpen = sheet.status === 'failed';

  return (
    <Collapse
      size="small"
      style={{ marginBottom: 12 }}
      defaultActiveKey={defaultOpen ? ['parse-options'] : []}
      items={[
        {
          key: 'parse-options',
          label: t('upload.metadata.parseOptions'),
          children: body,
        },
      ]}
      data-component="ParseOptionsDisclosure"
    />
  );
}

type ParseFailedActionsProps = Readonly<{
  sheetKey: string;
  isCsv: boolean;
  dispatch: Dispatch<WizardAction>;
}>;

function ParseFailedActions({ sheetKey, isCsv, dispatch }: ParseFailedActionsProps) {
  const { t } = useTranslation();
  return (
    <Space style={{ marginTop: 12 }} data-component="SheetParseFailedActions">
      <Button
        onClick={() => dispatch({ type: 'GOTO_STEP', step: 'source' })}
        data-component="SheetParseFailedRepickFile"
      >
        {t('upload.metadata.repickFile')}
      </Button>
      {isCsv ? null : (
        <Button
          onClick={() => dispatch({ type: 'TOGGLE_SELECTED_SHEET', sheet: sheetKey })}
          data-component="SheetParseFailedDeselect"
        >
          {t('upload.metadata.deselectSheet')}
        </Button>
      )}
      <Typography.Text type="secondary" style={{ marginLeft: 4 }}>
        {t('upload.metadata.parseFailedAdjustHint')}
      </Typography.Text>
    </Space>
  );
}
