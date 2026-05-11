from __future__ import annotations

import hashlib
from io import BytesIO
import json
from pathlib import Path

import pytest

from app.services.source_registry import SourceRegistry
from app.services.upload_service import read_dataframe
from app.sources.excel_source import ExcelSource, ExcelSourceConfig


def _excel_bytes() -> bytes:
    openpyxl = pytest.importorskip("openpyxl")
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Sheet1"
    ws.append(["id", "name", "flag"])
    ws.append([1, "A", True])
    ws.append([2, "B", False])
    stream = BytesIO()
    wb.save(stream)
    return stream.getvalue()


def _excel_bytes_mixed() -> bytes:
    openpyxl = pytest.importorskip("openpyxl")
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Sheet1"
    ws.append(["id", "amount", "flag"])
    ws.append([1, 10.5, True])
    ws.append([2, None, False])
    stream = BytesIO()
    wb.save(stream)
    return stream.getvalue()


def _excel_bytes_text_dates() -> bytes:
    openpyxl = pytest.importorskip("openpyxl")
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Sheet1"
    ws.append(["date", "label"])
    ws.append(["2026-01-01", "x"])
    ws.append(["2026-01-02", "y"])
    stream = BytesIO()
    wb.save(stream)
    return stream.getvalue()


def _parquet_hash(df) -> str:
    sink = BytesIO()
    df.write_parquet(sink, compression="zstd", statistics=True)
    return hashlib.sha256(sink.getvalue()).hexdigest()


@pytest.mark.parametrize(
    ("filename", "payload"),
    [
        ("single_sheet_basic.xlsx", _excel_bytes),
        ("mixed_types.xlsx", _excel_bytes_mixed),
        ("dates_and_text.xlsx", _excel_bytes_text_dates),
    ],
)
def test_excel_source_parity_hash_matches_legacy(filename: str, payload) -> None:
    source = ExcelSource()
    data = payload()

    via_source = source.parse(ExcelSourceConfig(filename=filename, file_bytes=data))
    legacy = read_dataframe(filename=filename, file_bytes=data)

    assert _parquet_hash(via_source) == _parquet_hash(legacy)


def test_excel_source_parse_matches_legacy_read_dataframe() -> None:
    payload = _excel_bytes()
    source = ExcelSource()

    via_source = source.parse(ExcelSourceConfig(filename="sample.xlsx", file_bytes=payload))
    legacy = read_dataframe(filename="sample.xlsx", file_bytes=payload)

    assert via_source.shape == legacy.shape
    assert via_source.columns == legacy.columns
    assert via_source.to_dict(as_series=False) == legacy.to_dict(as_series=False)


def test_excel_snapshots_fixture_has_expected_cases() -> None:
    fixture_path = Path(__file__).resolve().parents[1] / "fixtures" / "excel_snapshots.json"
    payload = json.loads(fixture_path.read_text(encoding="utf-8"))
    assert set(payload.keys()) == {"single_sheet_basic.xlsx", "mixed_types.xlsx", "dates_and_text.xlsx"}


def test_excel_source_error_parity_with_legacy() -> None:
    source = ExcelSource()
    bad_bytes = b"not an excel payload"

    with pytest.raises(Exception) as legacy_exc:
        read_dataframe(filename="broken.xlsx", file_bytes=bad_bytes)
    with pytest.raises(Exception) as source_exc:
        source.parse(ExcelSourceConfig(filename="broken.xlsx", file_bytes=bad_bytes))

    assert type(source_exc.value) is type(legacy_exc.value)
    assert str(source_exc.value) == str(legacy_exc.value)


def test_excel_source_config_roundtrip() -> None:
    config = ExcelSourceConfig(filename="example.xlsx", file_bytes=b"abc")
    payload = config.model_dump()
    restored = ExcelSourceConfig.model_validate(payload)

    assert restored.source_type == "excel"
    assert restored.filename == "example.xlsx"
    assert restored.file_bytes == b"abc"


def test_excel_source_can_be_registered_and_resolved() -> None:
    registry_before = SourceRegistry._registry.copy()
    metadata_before = SourceRegistry._metadata_cache.copy()
    try:
        SourceRegistry._registry.clear()
        SourceRegistry._metadata_cache.clear()
        SourceRegistry.register(ExcelSource)

        resolved = SourceRegistry.for_type("excel")
        assert isinstance(resolved, ExcelSource)
    finally:
        SourceRegistry._registry = registry_before
        SourceRegistry._metadata_cache = metadata_before