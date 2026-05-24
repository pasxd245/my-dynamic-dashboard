import { PlusOutlined, TableOutlined } from "@ant-design/icons";
import { PageCard, PageHeader } from "@mdd/ui";
import {
  Alert,
  Button,
  Empty,
  Select,
  Skeleton,
  Table,
  Tag,
  Typography,
} from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useWorkspacesQuery } from "../workspaces/hooks";
import { useDatasetsQuery } from "./hooks";
import type { Dataset } from "./types";

const BREADCRUMB = [
  { label: "Home", route: "/" },
  { label: "Data Management" },
  { label: "Datasets" },
];

const ALL_VALUE = "__all__";

export function DatasetsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const workspaceParam = searchParams.get("workspace") ?? undefined;

  const datasets = useDatasetsQuery(workspaceParam);
  const workspaces = useWorkspacesQuery();
  const workspaceById = new Map(
    (workspaces.data ?? []).map((w) => [w.id, w.name]),
  );

  const onFilterChange = (value: string) => {
    if (value === ALL_VALUE) {
      setSearchParams({});
    } else {
      setSearchParams({ workspace: value });
    }
  };

  const goNew = () => {
    const target = workspaceParam
      ? `/data-management/datasets/new?workspace=${encodeURIComponent(workspaceParam)}`
      : "/data-management/datasets/new";
    navigate(target);
  };

  const header = (
    <PageHeader
      breadcrumb={BREADCRUMB}
      title="Datasets"
      subtitle="All tables across your workspaces. Click a row to inspect, sort by any column."
      onNavigate={(route) => navigate(route)}
      actions={
        <Button type="primary" icon={<PlusOutlined />} onClick={goNew}>
          Upload
        </Button>
      }
    />
  );

  let body: React.ReactNode;
  if (datasets.isLoading || workspaces.isLoading) {
    body = (
      <Skeleton active paragraph={{ rows: 4 }} data-component="DatasetsLoading" />
    );
  } else if (datasets.isError) {
    body = (
      <Alert
        type="error"
        showIcon
        message="Couldn't load datasets"
        description={datasets.error?.message ?? "Unknown error"}
        data-component="DatasetsError"
      />
    );
  } else if ((datasets.data ?? []).length === 0) {
    body = (
      <Empty
        image={<TableOutlined style={{ fontSize: 48, opacity: 0.4 }} />}
        styles={{
          image: {
            height: 80,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          },
        }}
        description={
          <>
            <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 4 }}>
              No datasets yet
            </Typography.Title>
            <Typography.Text type="secondary">
              {workspaceParam
                ? "This workspace has no datasets. Upload one to get started."
                : "Upload your first dataset to get started."}
            </Typography.Text>
          </>
        }
        style={{ padding: "48px 0" }}
        data-component="DatasetsEmpty"
      >
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={goNew}>
          Upload your first dataset
        </Button>
      </Empty>
    );
  } else {
    body = (
      <DatasetTable
        rows={datasets.data ?? []}
        workspaceById={workspaceById}
      />
    );
  }

  return (
    <>
      {header}
      <PageCard>
        <div style={{ marginBottom: 16 }}>
          <Typography.Text strong style={{ marginRight: 8 }}>
            Workspace:
          </Typography.Text>
          <Select
            value={workspaceParam ?? ALL_VALUE}
            onChange={onFilterChange}
            style={{ minWidth: 220 }}
            data-component="WorkspaceFilter"
            options={[
              { value: ALL_VALUE, label: "All" },
              ...(workspaces.data ?? []).map((w) => ({
                value: w.id,
                label: w.name,
              })),
            ]}
          />
        </div>
        {body}
      </PageCard>
    </>
  );
}

type TableProps = Readonly<{
  rows: Dataset[];
  workspaceById: Map<string, string>;
}>;

function DatasetTable({ rows, workspaceById }: TableProps) {
  const data = rows.map((r) => ({ ...r, key: r.id }));
  return (
    <Table
      size="middle"
      pagination={{ pageSize: 20, hideOnSinglePage: true }}
      dataSource={data}
      rowKey="id"
      data-component="DatasetTable"
      columns={[
        {
          title: "Name",
          dataIndex: "name",
          key: "name",
          sorter: (a, b) => a.name.localeCompare(b.name),
        },
        {
          title: "Workspace",
          dataIndex: "workspaceId",
          key: "workspaceId",
          render: (id: string) => workspaceById.get(id) ?? id,
        },
        {
          title: "Rows",
          dataIndex: "rowCount",
          key: "rowCount",
          sorter: (a, b) => a.rowCount - b.rowCount,
        },
        {
          title: "Columns",
          dataIndex: "columnCount",
          key: "columnCount",
        },
        {
          title: "Size",
          dataIndex: "sizeBytes",
          key: "sizeBytes",
          render: formatBytes,
          sorter: (a, b) => a.sizeBytes - b.sizeBytes,
        },
        {
          title: "Source",
          dataIndex: "sourceFormat",
          key: "sourceFormat",
          render: (fmt: Dataset["sourceFormat"], row) => (
            <Tag color={fmt === "excel" ? "green" : "blue"}>
              {fmt.toUpperCase()}
              {row.sheetName ? ` · ${row.sheetName}` : ""}
            </Tag>
          ),
        },
        {
          title: "Created",
          dataIndex: "createdAt",
          key: "createdAt",
          render: (iso: string) => iso.slice(0, 10),
          sorter: (a, b) => a.createdAt.localeCompare(b.createdAt),
          defaultSortOrder: "descend",
        },
      ]}
    />
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
