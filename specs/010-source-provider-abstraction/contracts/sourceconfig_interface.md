# SourceConfig Interface Contract

## Purpose

Document the immutable Pydantic contract for source configuration payloads.

## Base Contract

`SourceConfig` must:

- inherit from `pydantic.BaseModel`
- set `model_config = ConfigDict(frozen=True)`
- expose `source_type: str`

## Built-in Configs

### `ExcelSourceConfig`

- `source_type = "excel"`
- `filename: str`
- `file_bytes: bytes`

### `CSVSourceConfig`

- `source_type = "csv"`
- `filename: str`
- `file_bytes: bytes`

## Serialization Contract

- Configs must support `.model_dump()` and `.model_validate(...)` round-trips.
- Configs must be safe to construct inside request-handling code without extra mutation.
