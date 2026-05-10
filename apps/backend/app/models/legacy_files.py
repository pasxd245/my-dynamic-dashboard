from __future__ import annotations

from sqlmodel import Field, SQLModel


class File(SQLModel, table=True):
    __tablename__ = "files"

    id: str = Field(primary_key=True)
    table_id: str
    filename: str
    extension: str
    version: int
    parquet_path: str
    row_count: int
    schema_hash: str
    schema_changed: int = Field(default=0)
    uploaded_at: str


class FileSchema(SQLModel, table=True):
    __tablename__ = "file_schemas"

    id: str = Field(primary_key=True)
    file_id: str = Field(foreign_key="files.id")
    column_name: str
    data_type: str
    is_nullable: int
    ordinal: int
