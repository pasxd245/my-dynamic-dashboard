# SourceRegistry Interface Contract

## Purpose

Define the registry API used by upload dispatch and extensibility tests.

## Methods

### `register(source_class: type[Source]) -> None`

- Registers a concrete source class by `get_metadata().source_type`.
- Raises `ValueError` on duplicate registration.

### `register_builtin_sources() -> None`

- Ensures `ExcelSource` and `CSVSource` are registered.
- Must be idempotent.
- Used by app startup and upload dispatch bootstrap paths.

### `is_registered(source_type: str) -> bool`

- Returns whether the given source type already exists in the registry.

### `for_type(source_type: str) -> Source`

- Returns a fresh source instance.
- Raises `KeyError` when the type is not registered.

### `detect_source_type(filename: str) -> str | None`

- Returns `"excel"` for `.xlsx`, `.xlsm`, `.xlsb`, `.xls`
- Returns `"csv"` for `.csv`
- Returns `None` for unsupported extensions

### `list_sources() -> list[SourceMetadata]`

- Returns registered source metadata for introspection or UI discovery.
- Empty registry should return an empty list.
