from __future__ import annotations

import hashlib
import json
import re
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path

import polars as pl


@dataclass
class ColumnProfile:
    name: str
    data_type: str
    is_nullable: bool


@dataclass
class UploadResult:
    file_id: str
    table_id: str
    filename: str
    version: int
    row_count: int
    parquet_path: str
    schema_hash: str
    schema_changed: bool
    columns: list[ColumnProfile]


def slugify_filename(filename: str) -> str:
    stem = Path(filename).stem.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", stem).strip("-")
    return slug or "table"


def read_dataframe(filename: str, file_bytes: bytes) -> pl.DataFrame:
    lower_name = filename.lower()

    if lower_name.endswith(".csv"):
        return pl.read_csv(BytesIO(file_bytes))

    if lower_name.endswith(".xlsx"):
        return pl.read_excel(BytesIO(file_bytes), engine="openpyxl")

    raise ValueError("Unsupported file type. Only .csv and .xlsx are allowed.")


def compute_column_profiles(df: pl.DataFrame) -> list[ColumnProfile]:
    profiles: list[ColumnProfile] = []

    for column_name in df.columns:
        series = df.get_column(column_name)
        profiles.append(
            ColumnProfile(
                name=column_name,
                data_type=str(series.dtype),
                is_nullable=bool(series.null_count() > 0),
            )
        )

    return profiles


def schema_hash(profiles: list[ColumnProfile]) -> str:
    payload = [
        {
            "name": profile.name,
            "data_type": profile.data_type,
            "is_nullable": profile.is_nullable,
        }
        for profile in profiles
    ]
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def save_parquet(df: pl.DataFrame, parquet_root: Path, table_id: str, version: int) -> Path:
    target_dir = parquet_root / table_id
    target_dir.mkdir(parents=True, exist_ok=True)

    parquet_path = target_dir / f"v{version}.parquet"
    df.write_parquet(parquet_path, compression="zstd", statistics=True)
    return parquet_path


def build_upload_result(
    filename: str,
    df: pl.DataFrame,
    parquet_path: Path,
    version: int,
    previous_schema_hash: str | None,
) -> UploadResult:
    columns = compute_column_profiles(df)
    current_schema_hash = schema_hash(columns)

    return UploadResult(
        file_id=str(uuid.uuid4()),
        table_id=slugify_filename(filename),
        filename=filename,
        version=version,
        row_count=df.height,
        parquet_path=str(parquet_path),
        schema_hash=current_schema_hash,
        schema_changed=previous_schema_hash is not None
        and previous_schema_hash != current_schema_hash,
        columns=columns,
    )


def utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()
