import type { UploadSheetOption } from "../../api/types";
import { Select } from "antd";

interface ExcelSheetPickerProps {
  options: UploadSheetOption[];
  value: string | null;
  onChange: (sheetName: string) => void;
  disabled?: boolean;
}

export default function ExcelSheetPicker({
  options,
  value,
  onChange,
  disabled = false,
}: ExcelSheetPickerProps): React.ReactElement | null {
  if (!options.length) {
    return null;
  }

  return (
    <div className="upload-control-group" style={{ marginTop: "0.75rem" }}>
      <label htmlFor="excel-sheet-select" className="upload-control-label">
        Excel sheet
      </label>
      <div className={`upload-control-shell${disabled ? " is-disabled" : ""}`}>
        <Select
          id="excel-sheet-select"
          className="upload-sheet-select"
          variant="borderless"
          value={value ?? undefined}
          onChange={(next) => onChange(next)}
          disabled={disabled}
          placeholder="Select sheet"
          options={options.map((option) => ({
            label: option.name,
            value: option.name,
          }))}
          style={{ width: "100%" }}
        />
      </div>
      <small className="upload-control-help">
        Choose the worksheet to upload before submitting the workbook.
      </small>
    </div>
  );
}
