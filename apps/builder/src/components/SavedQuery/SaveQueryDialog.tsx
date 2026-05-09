/**
 * SaveQueryDialog.tsx
 * 
 * Modal dialog for saving a query from the builder to the saved queries library.
 * Allows user to specify:
 * - Query name (required)
 * - Description (optional)
 * - Tags (optional, multi-value with autocomplete)
 * 
 * Handles tag normalization (lowercase, trim, deduplicate).
 * Emits onSave event with SaveQueryRequest payload.
 */

import { useState } from "react";
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

export default function SaveQueryDialog({
  isOpen,
  workspaceId,
  builderSnapshot,
  existingTags = [],
  onSave,
  onClose,
  onError,
}: SaveQueryDialogProps): React.ReactElement | null {
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [tagInput, setTagInput] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  if (!isOpen) {
    return null;
  }

  // Normalize and add tag
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

  const handleSave = async (): Promise<void> => {
    setError("");

    // Validation
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
      resetForm();
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

  const resetForm = (): void => {
    setName("");
    setDescription("");
    setTagInput("");
    setTags([]);
    setError("");
  };

  const handleClose = (): void => {
    resetForm();
    onClose();
  };

  // Get tag suggestions from existing tags
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
        <h2 className="mb-4 text-lg font-semibold">Save Query</h2>

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
            placeholder="e.g., Weekly Revenue Summary"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            disabled={isLoading}
          />
        </div>

        {/* Description */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Description <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Shows weekly revenue by product category"
            rows={3}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            disabled={isLoading}
          />
        </div>

        {/* Tags */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Tags <span className="text-gray-400">(optional)</span>
          </label>

          {/* Tag List */}
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

          {/* Tag Input with Autocomplete */}
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

            {/* Autocomplete Suggestions */}
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
            onClick={handleSave}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={isLoading || !name.trim()}
          >
            {isLoading ? "Saving..." : "Save Query"}
          </button>
        </div>
      </div>
    </div>
  );
}
