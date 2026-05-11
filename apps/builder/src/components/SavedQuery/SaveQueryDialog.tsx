import { useEffect, useState } from "react";
import { Alert, Form, Input, Modal, Select } from "antd";
import { createSavedQuery } from "../../api/queryApi";
import type { SaveQueryRequest, SaveQueryResponse } from "../../api/queryApi";

export interface SaveQueryDialogProps {
  isOpen: boolean;
  workspaceId: string;
  builderSnapshot: Record<string, unknown>;
  existingTags?: string[];
  onSave: (response: SaveQueryResponse) => void;
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

export default function SaveQueryDialog({
  isOpen,
  workspaceId,
  builderSnapshot,
  existingTags = [],
  onSave,
  onClose,
  onError,
}: Readonly<SaveQueryDialogProps>): React.ReactElement {
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!isOpen) {
      setName("");
      setDescription("");
      setTags([]);
      setError("");
    }
  }, [isOpen]);

  const handleSave = async (): Promise<void> => {
    setError("");

    if (!name.trim()) {
      setError("Query name is required");
      return;
    }
    if (name.trim().length < 3) {
      setError("Query name must be at least 3 characters");
      return;
    }

    try {
      setIsLoading(true);
      const request: SaveQueryRequest = {
        name: name.trim(),
        description: description.trim() || null,
        builder_snapshot: builderSnapshot,
        tags,
      };
      const response = await createSavedQuery(workspaceId, request);
      onSave(response);
      onClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to save query";
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
      title="Save Query"
      okText={isLoading ? "Saving..." : "Save Query"}
      cancelText="Cancel"
      confirmLoading={isLoading}
      okButtonProps={{ disabled: isLoading || !name.trim() }}
      onOk={() => {
        void handleSave();
      }}
      onCancel={onClose}
      destroyOnHidden
      width={520}
    >
      {error ? <Alert className="mb-3" type="error" description={error} showIcon /> : null}

      <Form layout="vertical" disabled={isLoading}>
        <Form.Item label="Query Name" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Weekly Revenue Summary"
            maxLength={120}
          />
        </Form.Item>

        <Form.Item label="Description">
          <Input.TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Shows weekly revenue by product category"
            rows={3}
          />
        </Form.Item>

        <Form.Item label="Tags" extra="Type and press Enter to add a tag.">
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
      </Form>
    </Modal>
  );
}
