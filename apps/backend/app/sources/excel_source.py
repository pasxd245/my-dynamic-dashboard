from __future__ import annotations

from io import BytesIO
from typing import TYPE_CHECKING

import polars as pl
from pydantic import Field

from app.sources.base import Source, SourceConfig, SourceMetadata

if TYPE_CHECKING:
    from app.services.upload_service import ColumnProfile


class ExcelSourceConfig(SourceConfig):
    source_type: str = Field(default="excel", frozen=True)
    filename: str
    file_bytes: bytes
    sheet_name: str | None = None


class ExcelSource(Source):
    @classmethod
    def get_metadata(cls) -> SourceMetadata:
        return SourceMetadata(
            source_type="excel",
            display_name="Excel",
            description="Excel workbook ingestion via openpyxl with calamine fallback.",
            supported_extensions=[".xlsx", ".xlsm", ".xlsb", ".xls"],
            requires_config={"filename": "str", "file_bytes": "bytes"},
        )

    def parse(self, config: SourceConfig) -> pl.DataFrame:
        if not isinstance(config, ExcelSourceConfig):
            raise TypeError("ExcelSource requires ExcelSourceConfig")

        # Keep parser behavior byte-compatible with legacy read_dataframe().
        try:
            return pl.read_excel(
                BytesIO(config.file_bytes),
                engine="openpyxl",
                raise_if_empty=False,
                sheet_name=config.sheet_name,
            )
        except Exception as openpyxl_exc:
            try:
                return pl.read_excel(
                    BytesIO(config.file_bytes),
                    engine="calamine",
                    raise_if_empty=False,
                    sheet_name=config.sheet_name,
                )
            except Exception as calamine_exc:
                raise ValueError(f"openpyxl failed: {openpyxl_exc}; calamine failed: {calamine_exc}") from calamine_exc

    def compute_profiles(self, df: pl.DataFrame) -> list[ColumnProfile]:
        from app.services.upload_service import compute_column_profiles

        return compute_column_profiles(df)


def discover_excel_sheet_options(file_bytes: bytes) -> list[dict[str, int | str]]:
    openpyxl = __import__("openpyxl")
    workbook = openpyxl.load_workbook(BytesIO(file_bytes), read_only=True)
    try:
        return [{"name": name, "index": index} for index, name in enumerate(workbook.sheetnames)]
    finally:
        workbook.close()