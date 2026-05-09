/**
 * SavedQuerySearch.tsx
 * 
 * Search and filter controls for the saved queries library.
 * Provides:
 * - Keyword search input (searches name, description, tags)
 * - Tag filter with autocomplete
 * - Active/Deleted state toggle
 * 
 * Emits onSearch when criteria change.
 */

import { useState, useEffect } from "react";

export interface SearchFilters {
  query: string;
  tags: string[];
  state: "active" | "deleted";
}

export interface SavedQuerySearchProps {
  allTags?: string[];
  onSearch: (filters: SearchFilters) => void;
  isLoading?: boolean;
}

export default function SavedQuerySearch({
  allTags = [],
  onSearch,
  isLoading = false,
}: SavedQuerySearchProps): React.ReactElement {
  const [query, setQuery] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState<string>("");
  const [state, setState] = useState<"active" | "deleted">("active");
  const [showTagSuggestions, setShowTagSuggestions] = useState<boolean>(false);

  // Debounce search to avoid excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch({ query, tags, state });
    }, 300);

    return () => clearTimeout(timer);
  }, [query, tags, state, onSearch]);

  const addTag = (tag: string): void => {
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput("");
      setShowTagSuggestions(false);
    }
  };

  const removeTag = (tagToRemove: string): void => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      addTag(tagInput.trim());
    }
  };

  const suggestions = tagInput.trim()
    ? allTags.filter(
        (tag) =>
          tag.toLowerCase().includes(tagInput.toLowerCase()) && !tags.includes(tag),
      )
    : allTags.filter((tag) => !tags.includes(tag));

  return (
    <div className="space-y-4 rounded-lg bg-gray-50 p-4">
      {/* Keyword Search */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Search</label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, description, or tags..."
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          disabled={isLoading}
        />
      </div>

      {/* Tag Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Filter by Tags</label>

        {/* Selected Tags */}
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

        {/* Tag Input */}
        <div className="relative">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => {
              setTagInput(e.target.value);
              setShowTagSuggestions(true);
            }}
            onKeyDown={handleTagInputKeyDown}
            onFocus={() => setShowTagSuggestions(true)}
            placeholder="Add tags to filter..."
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            disabled={isLoading}
          />

          {/* Suggestions Dropdown */}
          {showTagSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full z-10 mt-1 w-full rounded border border-gray-300 bg-white shadow-md">
              {suggestions.slice(0, 5).map((suggestion) => (
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

      {/* State Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Status</label>
        <div className="mt-1 flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={state === "active"}
              onChange={() => setState("active")}
              disabled={isLoading}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Active</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={state === "deleted"}
              onChange={() => setState("deleted")}
              disabled={isLoading}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Deleted (Recoverable)</span>
          </label>
        </div>
      </div>
    </div>
  );
}
