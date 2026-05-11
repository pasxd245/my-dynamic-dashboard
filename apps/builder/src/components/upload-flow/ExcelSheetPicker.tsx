import type { UploadSheetOption } from "../../api/types";

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
    <div style={{ display: "grid", gap: "0.4rem", marginTop: "0.75rem", maxWidth: "22rem" }}>
      <label htmlFor="excel-sheet-select" style={{ fontWeight: 600 }}>
        Excel sheet
      </label>
      <select
        id="excel-sheet-select"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="" disabled>
          Select sheet
        </option>
        {options.map((option) => (
          <option key={`${option.index}-${option.name}`} value={option.name}>
            {option.name}
          </option>
        ))}
      </select>
      <small style={{ color: "#555" }}>
        Choose the worksheet to upload before submitting the workbook.
      </small>
    </div>
  );
}
