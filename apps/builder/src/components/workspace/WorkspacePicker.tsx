import React, { useEffect, useState } from "react";
import {
  Modal,
  Button,
  Input,
  List,
  Spin,
  Empty,
  Badge,
} from "antd";
import { PlusOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { useWorkspaceStore } from "../../state/workspaceStore";
import type { WorkspaceResponse } from "../../api/types";

interface WorkspacePickerProps {
  visible: boolean;
  onWorkspaceSelected: (workspace: WorkspaceResponse) => void;
  onClose: () => void;
}

export const WorkspacePicker: React.FC<WorkspacePickerProps> = ({
  visible,
  onWorkspaceSelected,
  onClose,
}) => {
  const {
    workspaces,
    selectedWorkspaceId,
    isLoading,
    error,
    loadWorkspaces,
    selectWorkspace,
    createAndSelectWorkspace,
  } = useWorkspaceStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const createActionsStyle: React.CSSProperties = {
    width: "100%",
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.5rem",
    borderTop: "1px solid #eceefb",
    marginTop: "1.1rem",
    paddingTop: "0.85rem",
  };

  const cancelButtonStyle: React.CSSProperties = {
    borderRadius: "999px",
    border: "1px solid #d6d9ec",
    background: "#ffffff",
    color: "#47516f",
    fontWeight: 600,
    minWidth: "6.25rem",
  };

  const createButtonStyle: React.CSSProperties = {
    borderRadius: "999px",
    border: "1px solid #4f45b6",
    background: "#4f45b6",
    color: "#ffffff",
    fontWeight: 700,
    minWidth: "9rem",
  };

  useEffect(() => {
    if (visible && workspaces.length === 0) {
      loadWorkspaces();
    }
  }, [visible, workspaces.length, loadWorkspaces]);

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) {
      setCreateError("Workspace name is required");
      return;
    }

    if (newWorkspaceName.length > 50) {
      setCreateError("Workspace name must be 50 characters or less");
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const newWorkspace = await createAndSelectWorkspace(newWorkspaceName);
      selectWorkspace(newWorkspace.id);
      onWorkspaceSelected(newWorkspace);
      setNewWorkspaceName("");
      setShowCreateForm(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create workspace";
      setCreateError(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectWorkspace = (workspace: WorkspaceResponse) => {
    selectWorkspace(workspace.id);
    onWorkspaceSelected(workspace);
  };

  const handleCloseModal = () => {
    setNewWorkspaceName("");
    setShowCreateForm(false);
    setCreateError(null);
    onClose();
  };

  return (
    <Modal
      title="Select or Create a Workspace"
      open={visible}
      onCancel={handleCloseModal}
      footer={null}
      width={500}
      style={{ maxWidth: "90vw" }}
    >
      <Spin spinning={isLoading && !showCreateForm} tip="Loading workspaces...">
        {error && !showCreateForm && (
          <div
            style={{
              padding: "1rem",
              marginBottom: "1rem",
              backgroundColor: "#fff1f1",
              border: "1px solid #f4b6b8",
              borderRadius: "0.5rem",
              color: "#7f1d1d",
              fontSize: "0.875rem",
            }}
          >
            {error}
          </div>
        )}

        {!showCreateForm ? (
          <>
            {workspaces.length > 0 ? (
              <>
                <List
                  dataSource={workspaces}
                  renderItem={(workspace) => (
                    <List.Item
                      style={{
                        padding: "0.75rem 0",
                        cursor: "pointer",
                        borderRadius: "0.5rem",
                        marginBottom: "0.5rem",
                        backgroundColor:
                          selectedWorkspaceId === workspace.id ? "#eef1ff" : "transparent",
                        transition: "background-color 150ms ease",
                      }}
                      onClick={() => handleSelectWorkspace(workspace)}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                          width: "100%",
                        }}
                      >
                        {selectedWorkspaceId === workspace.id && (
                          <CheckCircleOutlined style={{ color: "#4f45b6", fontSize: "1.2rem" }} />
                        )}
                        <span style={{ flex: 1 }}>{workspace.name}</span>
                        {selectedWorkspaceId === workspace.id && (
                          <Badge status="success" text="Selected" />
                        )}
                      </div>
                    </List.Item>
                  )}
                />
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  block
                  onClick={() => setShowCreateForm(true)}
                  style={{ marginTop: "1rem" }}
                >
                  Create New Workspace
                </Button>
              </>
            ) : (
              <>
                <Empty description="No workspaces found" style={{ margin: "2rem 0" }} />
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  block
                  onClick={() => setShowCreateForm(true)}
                >
                  Create Your First Workspace
                </Button>
              </>
            )}
          </>
        ) : (
          <>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
                Workspace Name
              </label>
              <Input
                placeholder="Enter workspace name (1-50 characters)"
                value={newWorkspaceName}
                onChange={(e) => {
                  setNewWorkspaceName(e.target.value);
                  setCreateError(null);
                }}
                onPressEnter={handleCreateWorkspace}
                disabled={isCreating}
                maxLength={50}
                showCount
                autoFocus
              />
            </div>

            {createError && (
              <div
                style={{
                  padding: "0.75rem",
                  marginBottom: "1rem",
                  backgroundColor: "#fff1f1",
                  border: "1px solid #f4b6b8",
                  borderRadius: "0.5rem",
                  color: "#7f1d1d",
                  fontSize: "0.875rem",
                }}
              >
                {createError}
              </div>
            )}

            <div style={createActionsStyle}>
              <Button
                onClick={() => {
                  setShowCreateForm(false);
                  setNewWorkspaceName("");
                  setCreateError(null);
                }}
                disabled={isCreating}
                style={cancelButtonStyle}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                onClick={handleCreateWorkspace}
                loading={isCreating}
                style={createButtonStyle}
              >
                Create Workspace
              </Button>
            </div>
          </>
        )}
      </Spin>
    </Modal>
  );
};

export default WorkspacePicker;
