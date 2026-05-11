import type { UploadSourceType } from "../../api/types";

interface SourceTypeSelectorProps {
  value: UploadSourceType | null;
  onChange: (next: UploadSourceType) => void;
  disabled?: boolean;
}

export default function SourceTypeSelector({
  value,
  onChange,
  disabled = false,
}: SourceTypeSelectorProps): React.ReactElement {
  return (
    <div style={{ display: "grid", gap: "0.4rem", marginTop: "0.5rem", maxWidth: "22rem" }}>
      <label htmlFor="source-type-select" style={{ fontWeight: 600 }}>
        Source type
      </label>
      <select
        id="source-type-select"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value as UploadSourceType)}
        disabled={disabled}
      >
        <option value="" disabled>
          Select source type
        </option>
        <option value="csv">CSV</option>
        <option value="excel">Excel</option>
      </select>
      <small style={{ color: "#555" }}>
        Choose the source type before upload so file compatibility can be validated.
      </small>
    </div>
  );
}
