import {
  FileExcelOutlined,
  FileTextOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import { Alert, Card, Col, Form, Row, Select, Tag, Typography, Upload } from "antd";
import type { Dispatch } from "react";
import { useWorkspacesQuery } from "../../workspaces/hooks";
import type { SourceFormat } from "../types";
import { useUploadInitMutation } from "../hooks";
import type { WizardAction, WizardState } from "./state";

const ACCEPT: Record<SourceFormat, string> = {
  csv: ".csv",
  excel: ".xlsx,.xls",
};

const DROP_HINT: Record<SourceFormat, string> = {
  csv: ".csv · Up to 100 MB",
  excel: ".xlsx · Up to 100 MB",
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
        Data source <RequiredMark />
      </Typography.Title>
      <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12}>
          <SourceCard
            label="Excel"
            meta=".xlsx, .xls · multi-sheet workbooks"
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
            meta=".csv · single-sheet, delimited text"
            icon={<FileTextOutlined style={{ color: "#1677ff" }} />}
            primary={false}
            selected={state.sourceFormat === "csv"}
            onClick={() =>
              dispatch({ type: "SET_SOURCE_FORMAT", sourceFormat: "csv" })
            }
          />
        </Col>
      </Row>

      <Form layout="vertical">
        <Form.Item
          label="Workspace"
          required
          help="The dataset will live in this workspace."
        >
          <div data-component="WorkspaceSelect">
            <Select
              placeholder="Select a workspace…"
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
              <InboxOutlined style={{ fontSize: 32, opacity: 0.55 }} />
            </p>
            <p
              className="ant-upload-text"
              style={{ fontSize: 14, fontWeight: 500 }}
            >
              Drop a file here, or click to browse
            </p>
            <p
              className="ant-upload-hint"
              style={{ fontSize: 12, opacity: 0.7 }}
            >
              {DROP_HINT[state.sourceFormat]}
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
  icon: React.ReactNode;
  primary: boolean;
  selected: boolean;
  onClick: () => void;
}>;

function SourceCard({
  label,
  meta,
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
            Primary
          </Tag>
        ) : null}
      </div>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {meta}
      </Typography.Text>
    </Card>
  );
}
