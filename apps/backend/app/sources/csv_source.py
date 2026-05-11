from __future__ import annotations

from io import BytesIO
from typing import TYPE_CHECKING

import polars as pl
from pydantic import Field

from app.sources.base import Source, SourceConfig, SourceMetadata

if TYPE_CHECKING:
    from app.services.upload_service import ColumnProfile


class CSVSourceConfig(SourceConfig):
    source_type: str = Field(default="csv", frozen=True)
    filename: str
    file_bytes: bytes


class CSVSource(Source):
    @classmethod
    def get_metadata(cls) -> SourceMetadata:
        return SourceMetadata(
            source_type="csv",
            display_name="CSV",
            description="Comma separated values ingestion.",
            supported_extensions=[".csv"],
            requires_config={"filename": "str", "file_bytes": "bytes"},
        )

    def parse(self, config: SourceConfig) -> pl.DataFrame:
        if not isinstance(config, CSVSourceConfig):
            raise TypeError("CSVSource requires CSVSourceConfig")
        return pl.read_csv(BytesIO(config.file_bytes))

    def compute_profiles(self, df: pl.DataFrame) -> list[ColumnProfile]:
        from app.services.upload_service import compute_column_profiles

        return compute_column_profiles(df)