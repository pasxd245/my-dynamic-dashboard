import {
  AppstoreOutlined,
  DeleteOutlined,
  EditOutlined,
  MoreOutlined,
  PlusOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';
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
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ERROR_CODES, NAME_LENGTHS } from '@/_generated/constants';
import { BlockedDeleteModal } from '../_shared/BlockedDeleteModal';
import { DeleteConfirmModal } from '../_shared/DeleteConfirmModal';
import { RenameModal } from '../_shared/RenameModal';
import { ApiErrorThrown } from '../_shared/types';
import type { Dataset } from '@/features/data-management/datasets/types';
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

type ModalState =
  | { kind: 'idle' }
  | { kind: 'rename'; target: Workspace }
  | { kind: 'delete'; target: Workspace }
  | { kind: 'blocked'; target: Workspace; datasetCount: number };

function WorkspaceCard({
  workspace,
  onOpen,
  onRelationships,
  onRename,
  onDelete,
}: Readonly<{
  workspace: Workspace;
  onOpen: (id: string) => void;
  onRelationships: (id: string) => void;
  onRename: (ws: Workspace) => void;
  onDelete: (ws: Workspace) => void;
}>) {
  const { t } = useTranslation();
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
                key: 'relationships',
                icon: <ShareAltOutlined />,
                label: t('nav.relationships'),
                onClick: ({ domEvent }) => {
                  domEvent.stopPropagation();
                  onRelationships(workspace.id);
                },
              },
              {
                key: 'rename',
                icon: <EditOutlined />,
                label: t('common.rename'),
                onClick: ({ domEvent }) => {
                  domEvent.stopPropagation();
                  onRename(workspace);
                },
              },
              {
                key: 'delete',
                icon: <DeleteOutlined />,
                label: t('common.delete'),
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
            aria-label={t('common.actionsForResource', {
              resource: t('resources.workspace'),
              name: workspace.name,
            })}
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
        {t('workspaces.createdAt', { date: createdDate })}
      </Typography.Text>
    </Card>
  );
}

type CreateModalProps = {
  open: boolean;
  onClose: () => void;
};

function CreateWorkspaceModal({ open, onClose }: Readonly<CreateModalProps>) {
  const { t } = useTranslation();
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

  const nameTaken = mutation.error instanceof ApiErrorThrown && mutation.error.body.code === ERROR_CODES.NAME_TAKEN;
  const genericError = mutation.error && !(mutation.error instanceof ApiErrorThrown) ? mutation.error.message : null;

  return (
    <Modal
      title={t('workspaces.createModalTitle')}
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      okText={t('workspaces.createOkText')}
      okButtonProps={{ loading: mutation.isPending }}
      cancelButtonProps={{ disabled: mutation.isPending }}
      destroyOnHidden
      data-component="CreateWorkspaceModal"
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          label={t('common.nameLabel')}
          name="name"
          rules={[
            { required: true, message: t('common.nameRequired') },
            {
              max: NAME_LENGTHS.WORKSPACE_MAX,
              message: t('common.nameMaxLength', { max: NAME_LENGTHS.WORKSPACE_MAX }),
            },
          ]}
        >
          <Input placeholder={t('workspaces.namePlaceholder')} autoFocus />
        </Form.Item>
        {nameTaken ? (
          <Alert
            type="error"
            showIcon
            title={t('workspaces.nameTaken')}
            data-component="CreateNameTaken"
          />
        ) : null}
        {genericError ? (
          <Alert type="error" showIcon title={t('workspaces.createCouldnt')} description={genericError} />
        ) : null}
      </Form>
    </Modal>
  );
}

export function WorkspacesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const query = useWorkspacesQuery();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const BREADCRUMB = [
    { label: t('nav.home'), route: '/' },
    // Data Management is a sidebar section, not a destination — no route.
    { label: t('nav.dataManagement') },
    { label: t('nav.workspaces') },
  ];
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
          message.success(t('workspaces.renameSuccess', { name: newName }));
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
        message.success(t('workspaces.deleteSuccess', { name: target.name }));
        setModalState({ kind: 'idle' });
      },
      onError: (err) => {
        // Race-conditioned authoritative path: cached count said 0 but
        // BE returned 409 non_empty. Swap confirm → blocked in place.
        if (err instanceof ApiErrorThrown && err.body.code === ERROR_CODES.NON_EMPTY) {
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
      title={t('workspaces.title')}
      subtitle={t('workspaces.subtitle')}
      onNavigate={(route) => navigate(route)}
      actions={
        showActions ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            {t('common.create')}
          </Button>
        ) : undefined
      }
    />
  );

  let body: React.ReactNode;
  if (query.isLoading) {
    // R31: card-grid skeleton matches the post-load layout
    // (xs={24} md={12} xl={8}) so the grid doesn't jump when
    // real data lands. 6 cards = 2 rows on xl, 3 rows on md.
    body = (
      <Row gutter={[16, 16]} data-component="WorkspacesLoading">
        {['s1', 's2', 's3', 's4', 's5', 's6'].map((k) => (
          <Col key={k} xs={24} md={12} xl={8}>
            <Card>
              <Skeleton active title paragraph={{ rows: 2 }} />
            </Card>
          </Col>
        ))}
      </Row>
    );
  } else if (query.isError) {
    body = (
      <Alert
        type="error"
        showIcon
        title={t('workspaces.loadCouldnt')}
        description={query.error?.message ?? t('common.unknownError')}
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
              {t('workspaces.empty.title')}
            </Typography.Title>
            <Typography.Text type="secondary">{t('workspaces.empty.description')}</Typography.Text>
          </>
        }
        style={{ padding: '48px 0' }}
      >
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={openCreate}>
          {t('workspaces.createFirst')}
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
              onRelationships={(id) => navigate(`/data-management/workspaces/${encodeURIComponent(id)}/relationships`)}
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
        maxLength={NAME_LENGTHS.WORKSPACE_MAX}
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
