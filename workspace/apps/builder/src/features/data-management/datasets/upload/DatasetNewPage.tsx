import { ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { PageCard, PageContainer, PageHeader } from '@mdd/ui';
import { Button, Space, Steps } from 'antd';
import { useEffect, useReducer } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDatasetsCommitMutation, useUploadParseMutation } from '../hooks';
import type { CommitBatchItem } from '../types';
import {
  CSV_SHEET_KEY,
  hasParseOptionsSet,
  INITIAL_WIZARD_STATE,
  stepIndex,
  type WizardStep,
  wizardReducer,
} from './state';
import { UploadConfirmStep } from './UploadConfirmStep';
import { UploadMetadataStep } from './UploadMetadataStep';
import { UploadPreviewStep } from './UploadPreviewStep';
import { UploadSheetStep } from './UploadSheetStep';
import { UploadSourceStep } from './UploadSourceStep';

export function DatasetNewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const BREADCRUMB = [
    { label: t('nav.home'), route: '/' },
    { label: t('nav.dataManagement') },
    { label: t('nav.datasets'), route: '/data-management/datasets' },
    { label: t('nav.new') },
  ];
  const [state, dispatch] = useReducer(wizardReducer, INITIAL_WIZARD_STATE);
  const parseMutation = useUploadParseMutation();
  const commitMutation = useDatasetsCommitMutation();

  // Pre-fill the workspace from `?workspace=<ws_id>` if present.
  const workspaceQs = searchParams.get('workspace');
  useEffect(() => {
    if (workspaceQs && !state.workspaceId) {
      dispatch({ type: 'SET_WORKSPACE', workspaceId: workspaceQs });
    }
  }, [workspaceQs, state.workspaceId]);

  const stepsByFormat: Record<typeof state.sourceFormat, WizardStep[]> = {
    csv: ['source', 'metadata', 'preview', 'confirm'],
    excel: ['source', 'sheet', 'metadata', 'preview', 'confirm'],
  };
  const steps = stepsByFormat[state.sourceFormat];
  const currentIdx = stepIndex(state) - 1;

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

  const commit = async () => {
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
      case 'confirm':
        return false; // handled separately by Commit button
    }
  })();

  const header = (
    <PageHeader
      breadcrumb={BREADCRUMB}
      title={t('upload.title')}
      subtitle={t('upload.subtitle')}
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
                {t('upload.createDatasets')}
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
