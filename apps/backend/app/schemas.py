from __future__ import annotations

from pydantic import BaseModel


class ColumnSchema(BaseModel):
    name: str
    data_type: str
    is_nullable: bool


class UploadTableResponse(BaseModel):
    file_id: str
    table_id: str
    filename: str
    version: int
    row_count: int
    parquet_path: str
    schema_changed: bool
    schema: list[ColumnSchema]


class TableSummary(BaseModel):
    file_id: str
    table_id: str
    filename: str
    version: int
    row_count: int
    schema_changed: bool
    schema: list[ColumnSchema]
