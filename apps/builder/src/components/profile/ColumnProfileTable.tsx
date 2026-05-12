import { Table, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { ProfileColumn } from "../../api/types";

const { Text } = Typography;

export interface ColumnProfileTableProps {
  readonly columns: ProfileColumn[];
  readonly selectedColumnId?: string;
  readonly onSelect?: (columnId: string) => void;
}

const TYPE_COLOR: Record<string, string> = {
  int: "blue",
  integer: "blue",
  float: "geekblue",
  double: "geekblue",
  number: "geekblue",
  string: "default",
  text: "default",
  date: "purple",
  datetime: "purple",
  bool: "gold",
  boolean: "gold",
};

function typeColor(effectiveType?: string): string {
  if (!effectiveType) return "default";
  return TYPE_COLOR[effectiveType.toLowerCase()] ?? "default";
}

function formatTopK(values?: Record<string, number>): string {
  if (!values) return "—";
  const entries = Object.entries(values);
  if (entries.length === 0) return "—";
  return entries
    .slice(0, 3)
    .map(([value, count]) => `${value} (${count})`)
    .join(", ");
}

const tableColumns: ColumnsType<ProfileColumn> = [
  {
    title: "Column",
    dataIndex: "column_name",
    key: "column_name",
    render: (name: string, record) => (
      <div>
        <Text strong>{name}</Text>
        <br />
        <Text type="secondary" style={{ fontSize: 12 }}>
          {record.column_id}
        </Text>
      </div>
    ),
    width: 240,
  },
  {
    title: "Type",
    dataIndex: "effective_type",
    key: "effective_type",
    render: (type?: string) =>
      type ? (
        <Tag color={typeColor(type)} style={{ marginInlineEnd: 0 }}>
          {type}
        </Tag>
      ) : (
        <Text type="secondary">unknown</Text>
      ),
    width: 120,
  },
  {
    title: "Sample values (top 3)",
    dataIndex: "top_k_values_json",
    key: "top_k_values_json",
    render: (values?: Record<string, number>) => (
      <Tooltip title={values ? JSON.stringify(values, null, 2) : null}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          {formatTopK(values)}
        </Text>
      </Tooltip>
    ),
  },
];

export default function ColumnProfileTable({
  columns,
  selectedColumnId,
  onSelect,
}: ColumnProfileTableProps): React.ReactElement {
  return (
    <Table<ProfileColumn>
      size="small"
      rowKey="column_id"
      dataSource={columns}
      columns={tableColumns}
      pagination={false}
      locale={{ emptyText: "No columns profiled yet. Click 'Load profile'." }}
      rowSelection={
        onSelect
          ? {
              type: "radio",
              selectedRowKeys: selectedColumnId ? [selectedColumnId] : [],
              onChange: (keys) => {
                const next = keys[0];
                if (typeof next === "string") onSelect(next);
              },
            }
          : undefined
      }
      onRow={
        onSelect
          ? (record) => ({
              onClick: () => onSelect(record.column_id),
            })
          : undefined
      }
    />
  );
}
