import type { UploadSourceType } from "../../api/types";
import { Select } from "antd";

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
    <div className="upload-control-group upload-control-group--spaced">
      <label htmlFor="source-type-select" className="upload-control-label">
        Source type
      </label>
      <div className={`upload-control-shell${disabled ? " is-disabled" : ""}`}>
        <Select
          id="source-type-select"
          className="source-type-select"
          variant="borderless"
          value={value ?? undefined}
          onChange={(next) => onChange(next as UploadSourceType)}
          disabled={disabled}
          placeholder="Select source type"
          options={[
            { label: "CSV", value: "csv" },
            { label: "Excel", value: "excel" },
          ]}
          style={{ width: "100%" }}
        />
      </div>
      <small className="upload-control-help">
        Choose the source type before upload so file compatibility can be validated.
      </small>
    </div>
  );
}
