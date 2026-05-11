import { useEffect, useState } from "react";
import { Form, Input, Radio, Select } from "antd";

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
}: Readonly<SavedQuerySearchProps>): React.ReactElement {
  const [query, setQuery] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [state, setState] = useState<"active" | "deleted">("active");

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch({ query, tags, state });
    }, 300);

    return () => clearTimeout(timer);
  }, [query, tags, state, onSearch]);

  const tagOptions = allTags.map((tag) => ({ label: tag, value: tag }));

  return (
    <Form layout="vertical" disabled={isLoading} className="rounded-lg bg-slate-50 p-4">
      <Form.Item label="Search">
        <Input.Search
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, description, or tags..."
          allowClear
        />
      </Form.Item>

      <Form.Item label="Filter by Tags">
        <Select
          mode="tags"
          value={tags}
          onChange={(value: string[]) => setTags(value)}
          placeholder="Add tags to filter..."
          options={tagOptions}
          allowClear
          tokenSeparators={[","]}
          style={{ width: "100%" }}
        />
      </Form.Item>

      <Form.Item label="Status" style={{ marginBottom: 0 }}>
        <Radio.Group
          value={state}
          onChange={(e) => setState(e.target.value as "active" | "deleted")}
        >
          <Radio value="active">Active</Radio>
          <Radio value="deleted">Deleted (Recoverable)</Radio>
        </Radio.Group>
      </Form.Item>
    </Form>
  );
}
