/**
 * UpdateQueryDialog.tsx
 * 
 * Modal dialog for updating a saved query.
 * Allows editing:
 * - Query name
 * - Description
 * - Tags
 * - Builder configuration (creates new immutable version)
 * 
 * Creates new immutable version when builder snapshot changes.
 */

import { useState } from "react";
import { updateSavedQuery } from "../api/queryApi";
import type { SavedQueryDetailResponse } from "../api/queryApi";

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

export default function UpdateQueryDialog({
  isOpen,
  workspaceId,
  query,
  builderSnapshot,
  existingTags = [],
  onUpdate,
  onClose,
  onError,
}: UpdateQueryDialogProps): React.ReactElement | null {
  const [name, setName] = useState<string>(query.name);
  const [description, setDescription] = useState<string>(query.description || "");
  const [tagInput, setTagInput] = useState<string>("");
  const [tags, setTags] = useState<string[]>(query.tags);
  const [changeSummary, setChangeSummary] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  if (!isOpen) {
    return null;
  }

  const addTag = (newTag: string): void => {
    const normalized = newTag
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-_]/g, "")
      .trim();

    if (normalized && !tags.includes(normalized)) {
      setTags([...tags, normalized]);
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string): void => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(tagInput);
    }
  };

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
      resetForm();
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

  const resetForm = (): void => {
    setName(query.name);
    setDescription(query.description || "");
    setTagInput("");
    setTags(query.tags);
    setChangeSummary("");
    setError("");
  };

  const handleClose = (): void => {
    resetForm();
    onClose();
  };

  const suggestions = tagInput.trim()
    ? existingTags.filter(
        (tag) =>
          tag.toLowerCase().startsWith(tagInput.toLowerCase()) &&
          !tags.includes(tag),
      )
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">Update Query</h2>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Query Name */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Query Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            disabled={isLoading}
          />
        </div>

        {/* Description */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            disabled={isLoading}
          />
        </div>

        {/* Tags */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Tags</label>

          {tags.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-1 text-blue-600 hover:text-blue-800"
                    disabled={isLoading}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="relative">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type tag and press Enter"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              disabled={isLoading}
            />

            {suggestions.length > 0 && (
              <div className="absolute top-full z-10 mt-1 w-full rounded border border-gray-300 bg-white shadow-md">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => addTag(suggestion)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
                    disabled={isLoading}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Change Summary */}
        {builderSnapshot && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">
              Change Summary <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              placeholder="Describe what changed (e.g., Added new filter, Updated aggregation)"
              rows={2}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              disabled={isLoading}
            />
            <p className="mt-1 text-xs text-gray-500">
              Note: Updating the builder configuration will create a new immutable version.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpdate}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? "Updating..." : "Update Query"}
          </button>
        </div>
      </div>
    </div>
  );
}
