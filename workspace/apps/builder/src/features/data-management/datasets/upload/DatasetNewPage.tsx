import { ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { PageCard, PageContainer, PageHeader } from '@mdd/ui';
import { Button, Space, Steps } from 'antd';
import { useEffect, useReducer } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  useDatasetQuery,
  useDatasetsCommitMutation,
  useRefreshSettingsQuery,
  useUploadParseMutation,
} from '../hooks';
import type { CommitBatchItem } from '../types';
import {
  computeSchemaDrift,
  CSV_SHEET_KEY,
  hasParseOptionsSet,
  hasSchemaDrift,
  INITIAL_WIZARD_STATE,
  refreshSheetKey,
  wizardReducer,
  wizardSteps,
} from './state';
import { UploadConfirmStep } from './UploadConfirmStep';
import { UploadDriftStep } from './UploadDriftStep';
import { UploadMetadataStep } from './UploadMetadataStep';
import { UploadPreviewStep } from './UploadPreviewStep';
import { UploadSheetStep } from './UploadSheetStep';
import { UploadSourceStep } from './UploadSourceStep';

export function DatasetNewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Refresh mode: `/data-management/datasets/:id/refresh` re-uploads into an
  // existing dataset (R145 § Refresh). The wizard is reused as a MODE, not a
  // parallel page — same reducer, a carry-forward preset, and a Drift step.
  const { id: refreshId } = useParams<{ id: string }>();
  const isRefresh = typeof refreshId === 'string';
  const targetQuery = useDatasetQuery(refreshId);
  const target = targetQuery.data;
  const settingsQuery = useRefreshSettingsQuery(refreshId);

  const [state, dispatch] = useReducer(wizardReducer, INITIAL_WIZARD_STATE);
  const parseMutation = useUploadParseMutation();
  const commitMutation = useDatasetsCommitMutation();

  // Seed refresh mode once BOTH the target dataset and its carry-forward
  // settings have settled (so the preset is the faithful commitSettings, not a
  // premature lossy fallback). Guard fires exactly once per target.
  const settingsSettled = settingsQuery.isSuccess || settingsQuery.isError;
  useEffect(() => {
    if (isRefresh && target && settingsSettled && state.targetDatasetId !== target.id) {
      dispatch({ type: 'SEED_REFRESH', target, settings: settingsQuery.data ?? null });
    }
  }, [isRefresh, target, settingsSettled, settingsQuery.data, state.targetDatasetId]);

  // Pre-fill the workspace from `?workspace=<ws_id>` (create mode only).
  const workspaceQs = searchParams.get('workspace');
  useEffect(() => {
    if (!isRefresh && workspaceQs && !state.workspaceId) {
      dispatch({ type: 'SET_WORKSPACE', workspaceId: workspaceQs });
    }
  }, [isRefresh, workspaceQs, state.workspaceId]);

  const refreshName = state.refreshTargetName ?? target?.name ?? '';
  const BREADCRUMB = isRefresh
    ? [
        { label: t('nav.home'), route: '/' },
        { label: t('nav.dataManagement') },
        { label: t('nav.datasets'), route: '/data-management/datasets' },
        { label: refreshName || t('nav.datasets') },
        { label: t('upload.refresh.crumb') },
      ]
    : [
        { label: t('nav.home'), route: '/' },
        { label: t('nav.dataManagement') },
        { label: t('nav.datasets'), route: '/data-management/datasets' },
        { label: t('nav.new') },
      ];

  const steps = wizardSteps(state);
  const currentIdx = Math.max(0, steps.indexOf(state.step));

  const goBack = () => {
    if (currentIdx === 0) {
      navigate('/data-management/datasets');
      return;
    }
    dispatch({ type: 'GOTO_STEP', step: steps[currentIdx - 1] });
  };

  const goNext = async () => {
    const next = steps[currentIdx + 1];
    if (!next) return;
    // Excel: when leaving the Sheet step, kick off parses for selected sheets.
    if (state.step === 'sheet' && next === 'metadata') {
      if (state.selectedSheets.length === 0 || !state.tempId) return;
      for (const sheet of state.selectedSheets) {
        dispatch({ type: 'PARSE_SHEET_START', sheet });
      }
      try {
        const res = await parseMutation.mutateAsync({
          tempId: state.tempId,
          body: {
            items: state.selectedSheets.map((sheet) => {
              const opts = state.sheets[sheet]?.parseOptions;
              return hasParseOptionsSet(opts) ? { sheet, parse_options: opts } : { sheet };
            }),
          },
        });
        for (const result of res.results) {
          // Excel batch — server always echoes `sheet`. R26 widened the
          // response type for CSV support; this Excel path narrows back.
          const sheet = result.sheet ?? '';
          if (result.status === 'ok') {
            dispatch({
              type: 'PARSE_SHEET_SUCCESS',
              sheet,
              result: { ...result, sheet },
            });
          } else {
            dispatch({
              type: 'PARSE_SHEET_FAILED',
              sheet,
              result: { ...result, sheet },
            });
          }
        }
      } catch (err) {
        // Mark all selected as failed with a generic error.
        for (const sheet of state.selectedSheets) {
          dispatch({
            type: 'PARSE_SHEET_FAILED',
            sheet,
            result: {
              sheet,
              status: 'failed',
              error: 'request_failed',
              detail: err instanceof Error ? err.message : 'Unknown error',
            },
          });
        }
      }
    }
    dispatch({ type: 'GOTO_STEP', step: next });
  };

  // Re-parse a single sheet (Excel) or the whole file (CSV) with the
  // current parseOptions. R26 extended this from Excel-only to also
  // handle CSV via the same /uploads/{temp_id}/parse endpoint (closes
  // R19 Q1=C). For CSV the `sheet` arg is the CSV_SHEET_KEY sentinel
  // ("") and the wire item omits `sheet`.
  const reparseSheet = async (sheet: string) => {
    if (!state.tempId) return;
    const isCsv = state.sourceFormat === 'csv';
    const opts = state.sheets[sheet]?.parseOptions;
    dispatch({ type: 'PARSE_SHEET_START', sheet });
    try {
      const item: { sheet?: string; parse_options?: typeof opts } = {};
      if (!isCsv) item.sheet = sheet;
      if (hasParseOptionsSet(opts)) item.parse_options = opts;
      const res = await parseMutation.mutateAsync({
        tempId: state.tempId,
        body: { items: [item] },
      });
      // Excel response items carry `sheet`; CSV's single item omits it.
      const result = isCsv ? res.results[0] : res.results.find((r) => r.sheet === sheet);
      if (!result) return;
      if (result.status === 'ok') {
        dispatch({
          type: 'PARSE_SHEET_SUCCESS',
          sheet,
          result: { ...result, sheet },
        });
      } else {
        dispatch({
          type: 'PARSE_SHEET_FAILED',
          sheet,
          result: { ...result, sheet },
        });
      }
    } catch (err) {
      dispatch({
        type: 'PARSE_SHEET_FAILED',
        sheet,
        result: {
          sheet,
          status: 'failed',
          error: 'request_failed',
          detail: err instanceof Error ? err.message : 'Unknown error',
        },
      });
    }
  };

  // R145 refresh commit — one item carrying `target_dataset_id` (whole-table
  // replace). `name` is required by the wire but ignored server-side (the
  // target keeps its name); we send the target's name. Sends the wizard's
  // CURRENT settings (the user may have edited the carried-forward preset).
  const commitRefresh = async () => {
    if (!state.tempId || !state.workspaceId || !state.targetDatasetId) return;
    const key = refreshSheetKey(state);
    const s = state.sheets[key];
    if (!s) return;
    const item: CommitBatchItem = {
      name: state.refreshTargetName ?? 'dataset',
      target_dataset_id: state.targetDatasetId,
    };
    if (state.sourceFormat !== 'csv') item.sheet = key;
    if (hasParseOptionsSet(s.parseOptions)) item.parse_options = s.parseOptions;
    if (Object.keys(s.columnOverrides).length > 0) item.column_overrides = s.columnOverrides;
    if (s.excludedColumns.length > 0) item.excluded_columns = s.excludedColumns;
    try {
      await commitMutation.mutateAsync({
        workspaceId: state.workspaceId,
        body: { temp_id: state.tempId, items: [item] },
      });
      navigate(`/data-management/datasets/${state.targetDatasetId}`);
    } catch {
      // Error surfaces via commitMutation.isError (rendered on Confirm).
    }
  };

  const commit = async () => {
    if (isRefresh) {
      await commitRefresh();
      return;
    }
    if (!state.tempId || !state.workspaceId) return;
    const isCsv = state.sourceFormat === 'csv';
    const sheetKeys = isCsv ? [CSV_SHEET_KEY] : state.selectedSheets;
    const items: CommitBatchItem[] = sheetKeys.map((key) => {
      const s = state.sheets[key];
      const item: CommitBatchItem = { name: s.name };
      if (!isCsv) item.sheet = key;
      if (hasParseOptionsSet(s.parseOptions)) {
        item.parse_options = s.parseOptions;
      }
      if (Object.keys(s.columnOverrides).length > 0) {
        item.column_overrides = s.columnOverrides;
      }
      if (s.excludedColumns.length > 0) {
        item.excluded_columns = s.excludedColumns;
      }
      return item;
    });
    try {
      await commitMutation.mutateAsync({
        workspaceId: state.workspaceId,
        body: { temp_id: state.tempId, items },
      });
      navigate('/data-management/datasets');
    } catch {
      // Error surfaces via mutation.isError; nothing to do here.
    }
  };

  const canAdvance = (() => {
    switch (state.step) {
      case 'source':
        return state.tempId !== null && state.workspaceId !== null;
      case 'sheet':
        return state.selectedSheets.length > 0;
      case 'metadata': {
        const isCsv = state.sourceFormat === 'csv';
        const keys = isCsv ? [CSV_SHEET_KEY] : state.selectedSheets;
        return keys.every((k) => state.sheets[k]?.status === 'ok');
      }
      case 'preview':
        return true;
      case 'drift': {
        // Warn-loud, never block (R145 D): clean schema advances freely; any
        // drift requires the explicit acknowledge.
        const key = refreshSheetKey(state);
        const drift = computeSchemaDrift(state.refreshBaseline ?? [], state.sheets[key]?.columns ?? []);
        return !hasSchemaDrift(drift) || state.driftAcknowledged;
      }
      case 'confirm':
        return false; // handled separately by Commit button
    }
  })();

  const header = (
    <PageHeader
      breadcrumb={BREADCRUMB}
      title={isRefresh ? t('upload.refresh.title') : t('upload.title')}
      subtitle={isRefresh ? t('upload.refresh.subtitle', { name: refreshName }) : t('upload.subtitle')}
      onNavigate={(route) => navigate(route)}
      actions={<Button onClick={() => navigate('/data-management/datasets')}>{t('common.cancel')}</Button>}
    />
  );

  let body: React.ReactNode;
  switch (state.step) {
    case 'source':
      body = <UploadSourceStep state={state} dispatch={dispatch} />;
      break;
    case 'sheet':
      body = <UploadSheetStep state={state} dispatch={dispatch} />;
      break;
    case 'metadata':
      body = <UploadMetadataStep state={state} dispatch={dispatch} onReparseSheet={reparseSheet} />;
      break;
    case 'preview':
      body = <UploadPreviewStep state={state} dispatch={dispatch} />;
      break;
    case 'drift':
      body = <UploadDriftStep state={state} dispatch={dispatch} />;
      break;
    case 'confirm':
      body = (
        <UploadConfirmStep
          state={state}
          dispatch={dispatch}
          commitError={commitMutation.isError ? commitMutation.error : null}
        />
      );
      break;
  }

  return (
    // R95 (D2/D3): `fill` swaps the old hard `height: calc(100vh-88px)` for a
    // min-height (tall fills so the body scrolls inside the card; short
    // document-scrolls), `data` caps + centers the wizard on wide screens.
    <PageContainer fill width="data" dataComponent="DatasetNewPage">
      {header}
      <PageCard variant="fill">
        <Steps
          current={currentIdx}
          size="small"
          style={{ marginBottom: 16, flex: '0 0 auto' }}
          items={steps.map((s) => ({ title: t(`upload.steps.${s}`) }))}
        />
        <div
          data-component="WizardBodyScroll"
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingRight: 4,
          }}
        >
          {body}
        </div>
        <div
          data-component="WizardNav"
          style={{
            flex: '0 0 auto',
            marginTop: 16,
            paddingTop: 16,
            display: 'flex',
            justifyContent: 'space-between',
            borderTop: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
          }}
        >
          <Button onClick={goBack} icon={<ArrowLeftOutlined />} data-component="WizardBackButton">
            {t('common.back')}
          </Button>
          <Space>
            {state.step === 'confirm' ? (
              <Button
                type="primary"
                onClick={commit}
                loading={commitMutation.isPending}
                disabled={!state.workspaceId}
                data-component="WizardCommitButton"
              >
                {isRefresh ? t('upload.refresh.commitLabel') : t('upload.createDatasets')}
              </Button>
            ) : (
              <Button
                type="primary"
                onClick={goNext}
                disabled={!canAdvance}
                loading={parseMutation.isPending && state.step === 'sheet'}
                data-component="WizardNextButton"
              >
                {t('common.next')} <ArrowRightOutlined />
              </Button>
            )}
          </Space>
        </div>
      </PageCard>
    </PageContainer>
  );
}
