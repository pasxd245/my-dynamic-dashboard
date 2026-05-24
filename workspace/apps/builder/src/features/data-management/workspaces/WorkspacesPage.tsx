import { AppstoreOutlined, PlusOutlined } from "@ant-design/icons";
import { PageCard, PageHeader } from "@mdd/ui";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Skeleton,
  Typography,
  theme,
} from "antd";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useCreateWorkspaceMutation,
  useWorkspacesQuery,
} from "./hooks";
import type { Workspace } from "./types";

/**
 * R13: TanStack Query against the real backend (`GET/POST /workspaces`).
 * Loading / error / empty / populated states all render off
 * `useWorkspacesQuery`; the create flow goes through
 * `useCreateWorkspaceMutation`. R12's local-state demo toggle and
 * `SAMPLE_WORKSPACES` are gone.
 *
 * Per `.agents/design/data-management/workspaces.md`.
 */

const BREADCRUMB = [
  { label: "Home", route: "/" },
  // Data Management is a sidebar section, not a destination — no route.
  { label: "Data Management" },
  { label: "Workspaces" },
];

function WorkspaceCard({
  workspace,
  onOpen,
}: Readonly<{ workspace: Workspace; onOpen: (id: string) => void }>) {
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
  const createdDate = workspace.createdAt.slice(0, 10);
  return (
    <Card
      hoverable
      onClick={() => onOpen(workspace.id)}
      data-component="WorkspaceCard"
      data-workspace-id={workspace.id}
    >
      <div style={badgeStyle} aria-hidden="true">
        {initial}
      </div>
      <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
        {workspace.name}
      </Typography.Title>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Created {createdDate}
      </Typography.Text>
    </Card>
  );
}

type CreateModalProps = {
  open: boolean;
  onClose: () => void;
};

function CreateWorkspaceModal({ open, onClose }: Readonly<CreateModalProps>) {
  const [form] = Form.useForm<{ name: string }>();
  const mutation = useCreateWorkspaceMutation();

  const handleOk = async () => {
    const values = await form.validateFields();
    mutation.mutate(values, {
      onSuccess: () => {
        form.resetFields();
        onClose();
      },
    });
  };

  const handleCancel = () => {
    if (mutation.isPending) return;
    form.resetFields();
    mutation.reset();
    onClose();
  };

  return (
    <Modal
      title="Create workspace"
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      okText="Create"
      okButtonProps={{ loading: mutation.isPending }}
      cancelButtonProps={{ disabled: mutation.isPending }}
      destroyOnHidden
      data-component="CreateWorkspaceModal"
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          label="Name"
          name="name"
          rules={[
            { required: true, message: "Name is required" },
            { max: 80, message: "Name must be 80 characters or fewer" },
          ]}
        >
          <Input placeholder="e.g. Marketing" autoFocus />
        </Form.Item>
        {mutation.isError ? (
          <Alert
            type="error"
            showIcon
            title="Couldn't create the workspace"
            description={mutation.error?.message}
          />
        ) : null}
      </Form>
    </Modal>
  );
}

export function WorkspacesPage() {
  const navigate = useNavigate();
  const query = useWorkspacesQuery();
  const [createOpen, setCreateOpen] = useState(false);

  const openCreate = () => setCreateOpen(true);
  const closeCreate = () => setCreateOpen(false);

  const workspaces = query.data ?? [];
  const showActions = !query.isLoading && !query.isError && workspaces.length > 0;

  const header = (
    <PageHeader
      breadcrumb={BREADCRUMB}
      title="Workspaces"
      subtitle="Manage logical containers for your data and reports."
      onNavigate={(route) => navigate(route)}
      actions={
        showActions ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Create
          </Button>
        ) : undefined
      }
    />
  );

  let body: React.ReactNode;
  if (query.isLoading) {
    body = (
      <Skeleton active paragraph={{ rows: 4 }} data-component="WorkspacesLoading" />
    );
  } else if (query.isError) {
    body = (
      <Alert
        type="error"
        showIcon
        title="Couldn't load workspaces"
        description={query.error?.message ?? "Unknown error"}
        data-component="WorkspacesError"
      />
    );
  } else if (workspaces.length === 0) {
    body = (
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
          onClick={openCreate}
        >
          Create your first workspace
        </Button>
      </Empty>
    );
  } else {
    body = (
      <Row gutter={[16, 16]}>
        {workspaces.map((ws) => (
          <Col key={ws.id} xs={24} md={12} xl={8}>
            <WorkspaceCard
              workspace={ws}
              onOpen={(id) =>
                navigate(
                  `/data-management/datasets?workspace=${encodeURIComponent(id)}`,
                )
              }
            />
          </Col>
        ))}
      </Row>
    );
  }

  return (
    <>
      {header}
      <PageCard>{body}</PageCard>
      <CreateWorkspaceModal open={createOpen} onClose={closeCreate} />
    </>
  );
}
