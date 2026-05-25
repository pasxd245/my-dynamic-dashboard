import { AppstoreOutlined, DeleteOutlined, EditOutlined, MoreOutlined, PlusOutlined } from '@ant-design/icons';
import { PageCard, PageHeader } from '@mdd/ui';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Dropdown,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Skeleton,
  Typography,
  theme,
} from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { BlockedDeleteModal } from '../_shared/BlockedDeleteModal';
import { DeleteConfirmModal } from '../_shared/DeleteConfirmModal';
import { RenameModal } from '../_shared/RenameModal';
import { ApiErrorThrown } from '../_shared/types';
import type { Dataset } from '../datasets/types';
import {
  useCreateWorkspaceMutation,
  useDeleteWorkspaceMutation,
  useRenameWorkspaceMutation,
  useWorkspacesQuery,
} from './hooks';
import type { Workspace } from './types';

/**
 * R13: TanStack Query against the real backend (`GET/POST /workspaces`).
 * R26: rename + delete affordances on each card via an overflow menu;
 * block-on-non-empty cascade rule per `crud-hygiene.md`.
 *
 * Per `.agents/design/data-management/workspaces.md` and
 * `.agents/design/data-management/crud-hygiene.md`.
 */

const BREADCRUMB = [
  { label: 'Home', route: '/' },
  // Data Management is a sidebar section, not a destination — no route.
  { label: 'Data Management' },
  { label: 'Workspaces' },
];

type ModalState =
  | { kind: 'idle' }
  | { kind: 'rename'; target: Workspace }
  | { kind: 'delete'; target: Workspace }
  | { kind: 'blocked'; target: Workspace; datasetCount: number };

function WorkspaceCard({
  workspace,
  onOpen,
  onRename,
  onDelete,
}: Readonly<{
  workspace: Workspace;
  onOpen: (id: string) => void;
  onRename: (ws: Workspace) => void;
  onDelete: (ws: Workspace) => void;
}>) {
  const { token } = theme.useToken();
  const badgeStyle = {
    width: 32,
    height: 32,
    background: token.colorPrimaryBg,
    color: token.colorPrimary,
    borderRadius: token.borderRadius,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    marginBottom: 12,
  } as const;
  const initial = workspace.name.charAt(0).toUpperCase();
  const createdDate = workspace.createdAt.slice(0, 10);

  // The Dropdown trigger must NOT bubble to the Card's onClick (which
  // navigates to the workspace-filtered datasets view).
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <Card
      hoverable
      onClick={() => onOpen(workspace.id)}
      data-component="WorkspaceCard"
      data-workspace-id={workspace.id}
      style={{ position: 'relative' }}
    >
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }}>
        <Dropdown
          menu={{
            items: [
              {
                key: 'rename',
                icon: <EditOutlined />,
                label: 'Rename',
                onClick: ({ domEvent }) => {
                  domEvent.stopPropagation();
                  onRename(workspace);
                },
              },
              {
                key: 'delete',
                icon: <DeleteOutlined />,
                label: 'Delete',
                danger: true,
                onClick: ({ domEvent }) => {
                  domEvent.stopPropagation();
                  onDelete(workspace);
                },
              },
            ],
          }}
          trigger={['click']}
        >
          <Button
            type="text"
            icon={<MoreOutlined />}
            onClick={stop}
            aria-label={`Actions for workspace ${workspace.name}`}
            data-component="WorkspaceCardMoreButton"
            size="small"
          />
        </Dropdown>
      </div>
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

  const nameTaken = mutation.error instanceof ApiErrorThrown && mutation.error.body.code === 'name_taken';
  const genericError = mutation.error && !(mutation.error instanceof ApiErrorThrown) ? mutation.error.message : null;

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
            { required: true, message: 'Name is required' },
            { max: 80, message: 'Name must be 80 characters or fewer' },
          ]}
        >
          <Input placeholder="e.g. Marketing" autoFocus />
        </Form.Item>
        {nameTaken ? (
          <Alert
            type="error"
            showIcon
            message="Another workspace already has that name."
            data-component="CreateNameTaken"
          />
        ) : null}
        {genericError ? (
          <Alert type="error" showIcon message="Couldn't create the workspace" description={genericError} />
        ) : null}
      </Form>
    </Modal>
  );
}

export function WorkspacesPage() {
  const navigate = useNavigate();
  const query = useWorkspacesQuery();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [createOpen, setCreateOpen] = useState(false);
  const [modalState, setModalState] = useState<ModalState>({ kind: 'idle' });

  const renameMutation = useRenameWorkspaceMutation();
  const deleteMutation = useDeleteWorkspaceMutation();

  const openCreate = () => setCreateOpen(true);
  const closeCreate = () => setCreateOpen(false);

  const closeModal = () => {
    if (renameMutation.isPending || deleteMutation.isPending) return;
    setModalState({ kind: 'idle' });
    renameMutation.reset();
    deleteMutation.reset();
  };

  const onRename = (ws: Workspace) => {
    renameMutation.reset();
    setModalState({ kind: 'rename', target: ws });
  };

  const onDelete = (ws: Workspace) => {
    // Pre-flight: check cached datasets for this workspace. If any exist,
    // open the blocked modal directly without a server round-trip. The
    // BE's 409 is still the source of truth — we never trust the cache
    // alone for the destructive action.
    const cached = queryClient.getQueryData<Dataset[]>(['datasets']);
    const owned = (cached ?? []).filter((d) => d.workspaceId === ws.id);
    if (owned.length > 0) {
      setModalState({
        kind: 'blocked',
        target: ws,
        datasetCount: owned.length,
      });
      return;
    }
    deleteMutation.reset();
    setModalState({ kind: 'delete', target: ws });
  };

  const submitRename = (newName: string) => {
    if (modalState.kind !== 'rename') return;
    const target = modalState.target;
    renameMutation.mutate(
      { id: target.id, name: newName },
      {
        onSuccess: () => {
          message.success(`Workspace renamed to ${newName}.`);
          setModalState({ kind: 'idle' });
        },
      },
    );
  };

  const confirmDelete = () => {
    if (modalState.kind !== 'delete') return;
    const target = modalState.target;
    deleteMutation.mutate(target.id, {
      onSuccess: () => {
        message.success(`Workspace ${target.name} deleted.`);
        setModalState({ kind: 'idle' });
      },
      onError: (err) => {
        // Race-conditioned authoritative path: cached count said 0 but
        // BE returned 409 non_empty. Swap confirm → blocked in place.
        if (err instanceof ApiErrorThrown && err.body.code === 'non_empty') {
          setModalState({
            kind: 'blocked',
            target,
            datasetCount: err.body.datasetCount,
          });
          deleteMutation.reset();
        }
      },
    });
  };

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
    body = <Skeleton active paragraph={{ rows: 4 }} data-component="WorkspacesLoading" />;
  } else if (query.isError) {
    body = (
      <Alert
        type="error"
        showIcon
        message="Couldn't load workspaces"
        description={query.error?.message ?? 'Unknown error'}
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
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          },
        }}
        description={
          <>
            <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 4 }}>
              No workspaces yet
            </Typography.Title>
            <Typography.Text type="secondary">Create your first workspace to get started.</Typography.Text>
          </>
        }
        style={{ padding: '48px 0' }}
      >
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={openCreate}>
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
              onOpen={(id) => navigate(`/data-management/datasets?workspace=${encodeURIComponent(id)}`)}
              onRename={onRename}
              onDelete={onDelete}
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
      <RenameModal
        resourceLabel="workspace"
        maxLength={80}
        currentName={modalState.kind === 'rename' ? modalState.target.name : ''}
        open={modalState.kind === 'rename'}
        isPending={renameMutation.isPending}
        error={renameMutation.error}
        onSubmit={submitRename}
        onClose={closeModal}
      />
      <DeleteConfirmModal
        resourceLabel="workspace"
        resourceName={modalState.kind === 'delete' ? modalState.target.name : ''}
        open={modalState.kind === 'delete'}
        isPending={deleteMutation.isPending}
        onConfirm={confirmDelete}
        onClose={closeModal}
      />
      <BlockedDeleteModal
        workspaceName={modalState.kind === 'blocked' ? modalState.target.name : ''}
        datasetCount={modalState.kind === 'blocked' ? modalState.datasetCount : 0}
        open={modalState.kind === 'blocked'}
        onClose={closeModal}
      />
    </>
  );
}
