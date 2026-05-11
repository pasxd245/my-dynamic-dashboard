import { useEffect, useState } from "react";
import { Alert, Form, Input, Modal, Select } from "antd";
import { updateSavedQuery } from "../../api/queryApi";
import type { SavedQueryDetailResponse } from "../../api/queryApi";

export interface UpdateQueryDialogProps {
  isOpen: boolean;
  workspaceId: string;
  query: SavedQueryDetailResponse;
  builderSnapshot?: Record<string, unknown>;
  existingTags?: string[];
  onUpdate: (response: SavedQueryDetailResponse) => void;
  onClose: () => void;
  onError?: (error: Error) => void;
}

const tagOptionsFrom = (tags: string[]): { label: string; value: string }[] =>
  tags.map((tag) => ({ label: tag, value: tag }));

const normalizeTag = (raw: string): string =>
  raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s\-_]/g, "")
    .trim();

export default function UpdateQueryDialog({
  isOpen,
  workspaceId,
  query,
  builderSnapshot,
  existingTags = [],
  onUpdate,
  onClose,
  onError,
}: Readonly<UpdateQueryDialogProps>): React.ReactElement {
  const [name, setName] = useState<string>(query.name);
  const [description, setDescription] = useState<string>(query.description || "");
  const [tags, setTags] = useState<string[]>(query.tags);
  const [changeSummary, setChangeSummary] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      setName(query.name);
      setDescription(query.description || "");
      setTags(query.tags);
      setChangeSummary("");
      setError("");
    }
  }, [isOpen, query]);

  const handleUpdate = async (): Promise<void> => {
    setError("");

    if (!name.trim()) {
      setError("Query name is required");
      return;
    }

    try {
      setIsLoading(true);
      const response = await updateSavedQuery(workspaceId, query.query_id, {
        name: name.trim(),
        description: description.trim() || null,
        tags,
        builder_snapshot: builderSnapshot,
        change_summary: changeSummary || null,
      });
      onUpdate(response);
      onClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to update query";
      setError(errorMsg);
      if (onError && err instanceof Error) {
        onError(err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      title="Update Query"
      okText={isLoading ? "Updating..." : "Update Query"}
      cancelText="Cancel"
      confirmLoading={isLoading}
      okButtonProps={{ disabled: isLoading }}
      onOk={() => {
        void handleUpdate();
      }}
      onCancel={onClose}
      destroyOnHidden
      width={520}
    >
      {error ? <Alert className="mb-3" type="error" description={error} showIcon /> : null}

      <Form layout="vertical" disabled={isLoading}>
        <Form.Item label="Query Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </Form.Item>

        <Form.Item label="Description">
          <Input.TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </Form.Item>

        <Form.Item label="Tags">
          <Select
            mode="tags"
            value={tags}
            onChange={(value: string[]) =>
              setTags(
                Array.from(
                  new Set(value.map(normalizeTag).filter((tag) => tag.length > 0)),
                ),
              )
            }
            placeholder="Type tag and press Enter"
            options={tagOptionsFrom(existingTags)}
            tokenSeparators={[","]}
            style={{ width: "100%" }}
          />
        </Form.Item>

        {builderSnapshot ? (
          <Form.Item
            label="Change Summary"
            extra="Updating the builder configuration will create a new immutable version."
          >
            <Input.TextArea
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              placeholder="Describe what changed (e.g., Added new filter, Updated aggregation)"
              rows={2}
            />
          </Form.Item>
        ) : null}
      </Form>
    </Modal>
  );
}
