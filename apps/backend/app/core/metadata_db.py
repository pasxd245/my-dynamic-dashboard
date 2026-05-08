from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator


def init_metadata_db(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(db_path) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
                table_id TEXT NOT NULL,
                filename TEXT NOT NULL,
                extension TEXT NOT NULL,
                version INTEGER NOT NULL,
                parquet_path TEXT NOT NULL,
                row_count INTEGER NOT NULL,
                schema_hash TEXT NOT NULL,
                schema_changed INTEGER NOT NULL DEFAULT 0,
                uploaded_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS file_schemas (
                id TEXT PRIMARY KEY,
                file_id TEXT NOT NULL,
                column_name TEXT NOT NULL,
                data_type TEXT NOT NULL,
                is_nullable INTEGER NOT NULL,
                ordinal INTEGER NOT NULL,
                FOREIGN KEY(file_id) REFERENCES files(id)
            )
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_files_filename_version
            ON files(filename, version)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_file_schemas_file_id
            ON file_schemas(file_id)
            """
        )


@contextmanager
def get_connection(db_path: Path) -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()
