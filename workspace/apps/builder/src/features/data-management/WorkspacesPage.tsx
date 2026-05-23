import { AppstoreOutlined, PlusOutlined } from "@ant-design/icons";
import { PageCard, PageHeader } from "@mdd/ui";
import { Button, Card, Col, Empty, Row, Typography, theme } from "antd";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * R12: Workspaces page with static demo data. The card grid and
 * empty-state CTA are real React+AntD; the data is local `useState`
 * with hardcoded samples so the visual is fully verifiable.
 *
 * R13 replaces the local state with TanStack Query + real backend
 * stubs (`GET/POST /workspaces`) and adds the create modal flow.
 * The visual shape stays the same; only the data layer swaps.
 *
 * Per `.agents/design/data-management/workspaces.md`.
 */

type Workspace = {
  id: string;
  name: string;
  createdAt: string;
};

const SAMPLE_WORKSPACES: ReadonlyArray<Workspace> = [
  { id: "ws_marketing", name: "Marketing", createdAt: "2026-05-21" },
  { id: "ws_sales", name: "Sales Ops", createdAt: "2026-05-18" },
  { id: "ws_finance", name: "Finance", createdAt: "2026-05-10" },
  { id: "ws_rd", name: "R&D", createdAt: "2026-04-30" },
  {
    id: "ws_customer_success",
    name: "Customer Success",
    createdAt: "2026-04-22",
  },
];

const BREADCRUMB = [
  { label: "Home", route: "/" },
  // Data Management is a sidebar section, not a destination — no route.
  { label: "Data Management" },
  { label: "Workspaces" },
];

function nextId(): string {
  return `ws_${Math.random().toString(36).slice(2, 8)}`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function WorkspaceCard({
  workspace,
}: Readonly<{ workspace: Workspace }>) {
  const { token } = theme.useToken();
  const badgeStyle = {
    width: 32,
    height: 32,
    background: token.colorPrimaryBg,
    color: token.colorPrimary,
    borderRadius: token.borderRadius,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    marginBottom: 12,
  } as const;
  const initial = workspace.name.charAt(0).toUpperCase();
  return (
    <Card hoverable data-component="WorkspaceCard" data-workspace-id={workspace.id}>
      <div style={badgeStyle} aria-hidden="true">
        {initial}
      </div>
      <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
        {workspace.name}
      </Typography.Title>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Created {workspace.createdAt}
      </Typography.Text>
    </Card>
  );
}

export function WorkspacesPage() {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => [
    ...SAMPLE_WORKSPACES,
  ]);

  const addOne = () => {
    setWorkspaces((current) => [
      { id: nextId(), name: `Workspace ${current.length + 1}`, createdAt: todayISO() },
      ...current,
    ]);
  };

  const clearAll = () => setWorkspaces([]);

  const header = (
    <PageHeader
      breadcrumb={BREADCRUMB}
      title="Workspaces"
      subtitle="Manage logical containers for your data and reports."
      onNavigate={(route) => navigate(route)}
      actions={
        workspaces.length > 0 ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={addOne}>
            Create
          </Button>
        ) : undefined
      }
    />
  );

  /**
   * R12 demo toggle. Lets HIxAI flip between populated and empty
   * states for visual verification. R13 deletes this entirely once
   * real data + persistence land.
   */
  const demoToggle = (
    <div
      data-component="WorkspacesDemoToggle"
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        background: "#fff7e6",
        border: "1px solid #ffd591",
        borderRadius: 6,
        padding: "6px 10px",
        fontSize: 11,
        color: "#874d00",
        display: "flex",
        alignItems: "center",
        gap: 8,
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        zIndex: 100,
      }}
    >
      <span style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>
        R12 demo
      </span>
      <Button size="small" onClick={clearAll} disabled={workspaces.length === 0}>
        Empty
      </Button>
      <Button
        size="small"
        onClick={() => setWorkspaces([...SAMPLE_WORKSPACES])}
        disabled={workspaces.length === SAMPLE_WORKSPACES.length}
      >
        Populated
      </Button>
    </div>
  );

  if (workspaces.length === 0) {
    return (
      <>
        {header}
        <PageCard>
          <Empty
            image={<AppstoreOutlined style={{ fontSize: 48, opacity: 0.4 }} />}
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
                  No workspaces yet
                </Typography.Title>
                <Typography.Text type="secondary">
                  Create your first workspace to get started.
                </Typography.Text>
              </>
            }
            style={{ padding: "48px 0" }}
          >
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="large"
              onClick={addOne}
            >
              Create your first workspace
            </Button>
          </Empty>
        </PageCard>
        {demoToggle}
      </>
    );
  }

  return (
    <>
      {header}
      <PageCard>
        <Row gutter={[16, 16]}>
          {workspaces.map((ws) => (
            <Col key={ws.id} xs={24} md={12} xl={8}>
              <WorkspaceCard workspace={ws} />
            </Col>
          ))}
        </Row>
      </PageCard>
      {demoToggle}
    </>
  );
}
