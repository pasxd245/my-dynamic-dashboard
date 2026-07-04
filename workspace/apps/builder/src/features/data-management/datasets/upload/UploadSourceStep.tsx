import {
  FileExcelOutlined,
  FileTextOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import { Alert, Card, Col, Form, Row, Select, Tag, Typography, Upload } from "antd";
import type { Dispatch } from "react";
import { useTranslation } from "react-i18next";
import { appConfig } from "@/config";
import { formatBytesCoarse } from "@/lib/formatBytes";
import { useWorkspacesQuery } from '@/features/data-management/workspaces/hooks';
import type { SourceFormat } from "../types";
import { useUploadInitMutation } from "../hooks";
import type { WizardAction, WizardState } from "./state";

const ACCEPT: Record<SourceFormat, string> = {
  csv: ".csv",
  excel: ".xlsx,.xls",
};

type Props = Readonly<{
  state: WizardState;
  dispatch: Dispatch<WizardAction>;
}>;

export function UploadSourceStep({ state, dispatch }: Props) {
  const { t } = useTranslation();
  const workspaces = useWorkspacesQuery();
  const initMutation = useUploadInitMutation();
  // Refresh mode: source + workspace are FIXED to the target dataset; the user
  // only re-picks the new export file (R145 § Refresh).
  const isRefresh = state.mode === 'refresh';
  const workspaceName =
    workspaces.data?.find((w) => w.id === state.workspaceId)?.name ?? state.workspaceId ?? '—';

  const startUpload = (file: File) => {
    dispatch({ type: "SET_FILE", file });
    initMutation.mutate(
      { file, sourceFormat: state.sourceFormat },
      {
        onSuccess: (response) => {
          dispatch({ type: "UPLOAD_INIT_SUCCESS", response });
        },
      },
    );
  };

  const maxSize = formatBytesCoarse(appConfig.uploadMaxBytes());
  const dropHint =
    state.sourceFormat === 'csv'
      ? t('upload.source.dropHintCsv', { maxSize })
      : t('upload.source.dropHintExcel', { maxSize });

  return (
    <div data-component="UploadSourceStep">
      {isRefresh ? (
        <Alert
          type="info"
          showIcon
          title={t('upload.refresh.sourceBannerTitle', { name: state.refreshTargetName ?? '' })}
          description={
            state.refreshLegacy
              ? `${t('upload.refresh.sourceBannerBody')} ${t('upload.refresh.legacyNote')}`
              : t('upload.refresh.sourceBannerBody')
          }
          style={{ marginBottom: 16 }}
          data-component="RefreshSourceBanner"
        />
      ) : null}
      {isRefresh ? null : (
        <>
          <Typography.Title level={5} style={{ marginTop: 0 }}>
            {t('upload.source.heading')} <RequiredMark />
          </Typography.Title>
          <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12}>
              <SourceCard
                label="Excel"
                meta={t('upload.source.excelMeta')}
                primaryLabel={t('upload.source.primary')}
                icon={<FileExcelOutlined style={{ color: "#117a3a" }} />}
                primary
                selected={state.sourceFormat === "excel"}
                onClick={() =>
                  dispatch({ type: "SET_SOURCE_FORMAT", sourceFormat: "excel" })
                }
              />
            </Col>
            <Col xs={24} sm={12}>
              <SourceCard
                label="CSV"
                meta={t('upload.source.csvMeta')}
                primaryLabel={t('upload.source.primary')}
                icon={<FileTextOutlined style={{ color: "#1677ff" }} />}
                primary={false}
                selected={state.sourceFormat === "csv"}
                onClick={() =>
                  dispatch({ type: "SET_SOURCE_FORMAT", sourceFormat: "csv" })
                }
              />
            </Col>
          </Row>
        </>
      )}

      <Form layout="vertical">
        <Form.Item
          label={t('upload.source.workspaceLabel')}
          required={!isRefresh}
          help={isRefresh ? undefined : t('upload.source.workspaceHelp')}
        >
          {isRefresh ? (
            <Typography.Text strong data-component="RefreshWorkspaceFixed">
              {workspaceName}
            </Typography.Text>
          ) : (
            <div data-component="WorkspaceSelect">
              <Select
                placeholder={t('upload.source.workspacePlaceholder')}
                value={state.workspaceId ?? undefined}
                options={(workspaces.data ?? []).map((w) => ({
                  value: w.id,
                  label: w.name,
                }))}
                onChange={(value) =>
                  dispatch({ type: "SET_WORKSPACE", workspaceId: value })
                }
                loading={workspaces.isLoading}
                style={{ width: "100%" }}
              />
            </div>
          )}
        </Form.Item>

        <Form.Item label={t('upload.source.fileLabel')} required>
          <Upload.Dragger
            multiple={false}
            accept={ACCEPT[state.sourceFormat]}
            disabled={!state.workspaceId || initMutation.isPending}
            beforeUpload={(file) => {
              startUpload(file as File);
              return false; // intercept; do not let AntD upload
            }}
            showUploadList={false}
            data-component="UploadDragger"
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ fontSize: 32, opacity: 1 }} />
            </p>
            <p
              className="ant-upload-text"
              style={{ fontSize: 14, fontWeight: 500 }}
            >
              {t('upload.source.dropHere')}
            </p>
            <p
              className="ant-upload-hint"
              style={{ fontSize: 12, opacity: 0.7 }}
            >
              {dropHint}
            </p>
          </Upload.Dragger>
        </Form.Item>
      </Form>

      {initMutation.isError ? (
        <Alert
          type="error"
          showIcon
          title={t('upload.source.errorTitle')}
          description={initMutation.error?.message}
          style={{ marginTop: 12 }}
          data-component="UploadInitError"
        />
      ) : null}
    </div>
  );
}

function RequiredMark() {
  return (
    <Typography.Text type="danger" style={{ marginLeft: 4 }}>
      *
    </Typography.Text>
  );
}

type SourceCardProps = Readonly<{
  label: string;
  meta: string;
  primaryLabel: string;
  icon: React.ReactNode;
  primary: boolean;
  selected: boolean;
  onClick: () => void;
}>;

function SourceCard({
  label,
  meta,
  primaryLabel,
  icon,
  primary,
  selected,
  onClick,
}: SourceCardProps) {
  return (
    <Card
      hoverable
      onClick={onClick}
      data-component="SourceCard"
      data-selected={selected}
      data-format={label.toLowerCase()}
      styles={{ body: { padding: 16 } }}
      style={{
        borderColor: selected ? "var(--ant-color-primary)" : undefined,
        borderWidth: selected ? 2 : 1,
        background: selected ? "var(--ant-color-primary-bg, #e6f4ff)" : undefined,
      }}
    >
      <div style={{ fontSize: 28, lineHeight: 1, marginBottom: 8 }}>
        {icon}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          {label}
        </Typography.Title>
        {primary ? (
          <Tag color="blue" style={{ marginInlineEnd: 0 }}>
            {primaryLabel}
          </Tag>
        ) : null}
      </div>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {meta}
      </Typography.Text>
    </Card>
  );
}
