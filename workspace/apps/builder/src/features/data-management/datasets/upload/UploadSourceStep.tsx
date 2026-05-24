import { FileExcelOutlined, FileTextOutlined, InboxOutlined } from "@ant-design/icons";
import { Alert, Card, Col, Form, Row, Select, Typography, Upload } from "antd";
import type { Dispatch } from "react";
import { useWorkspacesQuery } from "../../workspaces/hooks";
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
  const workspaces = useWorkspacesQuery();
  const initMutation = useUploadInitMutation();

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

  return (
    <div data-component="UploadSourceStep">
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        Data source
      </Typography.Title>
      <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12}>
          <SourceCard
            label="Excel"
            hint=".xlsx, .xls"
            icon={<FileExcelOutlined />}
            selected={state.sourceFormat === "excel"}
            onClick={() =>
              dispatch({ type: "SET_SOURCE_FORMAT", sourceFormat: "excel" })
            }
          />
        </Col>
        <Col xs={24} sm={12}>
          <SourceCard
            label="CSV"
            hint=".csv"
            icon={<FileTextOutlined />}
            selected={state.sourceFormat === "csv"}
            onClick={() =>
              dispatch({ type: "SET_SOURCE_FORMAT", sourceFormat: "csv" })
            }
          />
        </Col>
      </Row>

      <Form layout="vertical">
        <Form.Item label="Workspace" required>
          <div data-component="WorkspaceSelect">
            <Select
              placeholder="Select a workspace"
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
        </Form.Item>

        <Form.Item label="File" required>
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
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">
              Drop a file here, or click to browse
            </p>
            <p className="ant-upload-hint">
              {ACCEPT[state.sourceFormat]} · Up to 100 MB
            </p>
          </Upload.Dragger>
        </Form.Item>
      </Form>

      {initMutation.isError ? (
        <Alert
          type="error"
          showIcon
          message="Couldn't process the file"
          description={initMutation.error?.message}
          style={{ marginTop: 12 }}
          data-component="UploadInitError"
        />
      ) : null}
    </div>
  );
}

type SourceCardProps = Readonly<{
  label: string;
  hint: string;
  icon: React.ReactNode;
  selected: boolean;
  onClick: () => void;
}>;

function SourceCard({ label, hint, icon, selected, onClick }: SourceCardProps) {
  return (
    <Card
      hoverable
      onClick={onClick}
      data-component="SourceCard"
      data-selected={selected}
      style={{
        borderColor: selected ? "var(--ant-color-primary)" : undefined,
        borderWidth: selected ? 2 : 1,
      }}
    >
      <Typography.Title level={5} style={{ margin: 0 }}>
        {icon} {label}
      </Typography.Title>
      <Typography.Text type="secondary">{hint}</Typography.Text>
    </Card>
  );
}
