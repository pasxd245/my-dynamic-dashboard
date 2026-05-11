# Source Interface Contract

## Purpose

Define the stable contract for `Source` implementations in `apps/backend/app/sources/`.

## Required Methods

### `parse(config: SourceConfig) -> pl.DataFrame`

- Must accept the matching `SourceConfig` subclass.
- Must return a `polars.DataFrame`.
- Must preserve legacy parsing errors for equivalent inputs.
- Must not mutate shared global state.

### `compute_profiles(df: pl.DataFrame) -> list[ColumnProfile]`

- Must return one `ColumnProfile` per dataframe column.
- Must preserve existing profile semantics used by upload orchestration.

### `post_commit_hook(workspace_id: str, source_file_id: str, columns: list[ColumnProfile]) -> None`

- Optional hook.
- Exceptions should not break successful upload completion.
- Default implementation is a no-op.

## Built-in Implementations

- `ExcelSource`
- `CSVSource`

## Error Contract

- Unsupported file types must surface the existing unsupported-file message at the orchestration boundary.
- Excel fallback errors must preserve the `openpyxl failed: ...; calamine failed: ...` shape.
