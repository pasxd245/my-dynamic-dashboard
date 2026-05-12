import { Button, Card, Flex, Form, Input, InputNumber, Select, Space, Typography } from "antd";
import type { ActionableError, ProfileResponse } from "../../api/types";
import ActionableErrorPanel from "../errors/ActionableErrorPanel";
import ColumnProfileTable from "./ColumnProfileTable";

const { Title, Paragraph } = Typography;

const ROLE_OPTIONS = [
  { value: "identity_key", label: "identity_key" },
  { value: "time_anchor", label: "time_anchor" },
  { value: "measure", label: "measure" },
  { value: "dimension", label: "dimension" },
  { value: "status", label: "status" },
  { value: "source_of_truth_outcome", label: "source_of_truth_outcome" },
];

export interface OverrideFormValues {
  readonly headerRow: number;
  readonly dataRange: string;
  readonly reason: string;
}

export interface ProfilePanelProps {
  readonly profile: ProfileResponse | null;
  readonly profileError: ActionableError | null;

  readonly headerRow: string;
  readonly dataRange: string;
  readonly reason: string;
  readonly onHeaderRowChange: (value: string) => void;
  readonly onDataRangeChange: (value: string) => void;
  readonly onReasonChange: (value: string) => void;
  readonly onApplyOverride: () => void;

  readonly onLoadProfile: () => void;

  readonly selectedColumnId: string;
  readonly onSelectColumn: (columnId: string) => void;
  readonly selectedRole: string;
  readonly onSelectRole: (role: string) => void;
  readonly overrideReason: string;
  readonly onOverrideReasonChange: (value: string) => void;
  readonly onAssignRole: () => void;
  readonly onLoadReadiness: () => void;
}

export default function ProfilePanel({
  profile,
  profileError,
  headerRow,
  dataRange,
  reason,
  onHeaderRowChange,
  onDataRangeChange,
  onReasonChange,
  onApplyOverride,
  onLoadProfile,
  selectedColumnId,
  onSelectColumn,
  selectedRole,
  onSelectRole,
  overrideReason,
  onOverrideReasonChange,
  onAssignRole,
  onLoadReadiness,
}: ProfilePanelProps): React.ReactElement {
  return (
    <Flex vertical gap={16}>
      <Card
        size="small"
        title="Sheet override"
        extra={
          <Paragraph type="secondary" style={{ margin: 0, fontSize: 13 }}>
            Applies to the active uploaded sheet only.
          </Paragraph>
        }
      >
        {profileError && profileError.stage !== "upload_source" ? (
          <div style={{ marginBottom: 12 }}>
            <ActionableErrorPanel error={profileError} />
          </div>
        ) : null}
        <Form layout="vertical" style={{ maxWidth: 480 }}>
          <Form.Item label="Header row" help="Row index where headers live (1-based).">
            <InputNumber
              min={1}
              value={Number(headerRow) || 1}
              onChange={(value) => onHeaderRowChange(String(value ?? ""))}
              style={{ width: "100%" }}
            />
          </Form.Item>
          <Form.Item label="Data range" help="Excel range, e.g. A1:C100. Leave blank to auto-detect.">
            <Input
              value={dataRange}
              onChange={(event) => onDataRangeChange(event.target.value)}
              placeholder="A1:C100"
            />
          </Form.Item>
          <Form.Item label="Override reason">
            <Input
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              placeholder="Why are you overriding the inferred values?"
            />
          </Form.Item>
          <Button type="primary" onClick={onApplyOverride}>
            Apply override
          </Button>
        </Form>
      </Card>

      <Card
        size="small"
        title="Column profile"
        extra={<Button onClick={onLoadProfile}>Load profile</Button>}
      >
        <ColumnProfileTable
          columns={profile?.columns ?? []}
          selectedColumnId={selectedColumnId}
          onSelect={onSelectColumn}
        />
      </Card>

      <Card size="small" title="Assign role">
        <Form layout="vertical" style={{ maxWidth: 520 }}>
          <Form.Item
            label="Column"
            help={
              profile?.columns?.length
                ? "Pick a column above (table) or from this list."
                : "Load the profile first to see columns."
            }
          >
            <Select
              value={selectedColumnId || undefined}
              onChange={onSelectColumn}
              placeholder="Select column"
              options={(profile?.columns ?? []).map((column) => ({
                value: column.column_id,
                label: `${column.column_name} (${column.column_id})`,
              }))}
            />
          </Form.Item>
          <Form.Item label="Role">
            <Select value={selectedRole} onChange={onSelectRole} options={ROLE_OPTIONS} />
          </Form.Item>
          <Form.Item label="Override reason (optional)">
            <Input
              value={overrideReason}
              onChange={(event) => onOverrideReasonChange(event.target.value)}
              placeholder="Why is this role being assigned manually?"
            />
          </Form.Item>
          <Space>
            <Button onClick={onAssignRole} disabled={!selectedColumnId}>
              Assign role
            </Button>
            <Button onClick={onLoadReadiness}>Load readiness</Button>
          </Space>
        </Form>
      </Card>

      <Title level={5} style={{ margin: 0, color: "var(--color-gray-4)" }}>
        Documented gaps (out of Spec 019 scope, backend changes required):
      </Title>
      <Paragraph type="secondary" style={{ margin: 0, fontSize: 13 }}>
        Nullability indicator and per-column type overrides are not yet
        surfaced — backend `ProfileColumn` doesn't expose nullability and no
        type-override endpoint exists. Tracked for a follow-up spec.
      </Paragraph>
    </Flex>
  );
}
