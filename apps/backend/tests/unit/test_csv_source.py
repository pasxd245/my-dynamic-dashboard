from __future__ import annotations

import hashlib
from io import BytesIO
import json
from pathlib import Path

import pytest

from app.services.source_registry import SourceRegistry
from app.services.upload_service import read_dataframe
from app.sources.csv_source import CSVSource, CSVSourceConfig


def _parquet_hash(df) -> str:
    sink = BytesIO()
    df.write_parquet(sink, compression="zstd", statistics=True)
    return hashlib.sha256(sink.getvalue()).hexdigest()


@pytest.mark.parametrize(
    ("filename", "payload"),
    [
        ("simple.csv", b"id,name\n1,A\n2,B\n"),
        ("quoted_fields.csv", b'id,notes\n1,"hello, world"\n2,"quoted"\n'),
        ("special_chars.csv", b"id,name\n1,Jose\n2,Tokyo\n"),
    ],
)
def test_csv_source_parity_hash_matches_legacy(filename: str, payload: bytes) -> None:
    source = CSVSource()
    via_source = source.parse(CSVSourceConfig(filename=filename, file_bytes=payload))
    legacy = read_dataframe(filename=filename, file_bytes=payload)
    assert _parquet_hash(via_source) == _parquet_hash(legacy)


def test_csv_source_parse_matches_legacy_read_dataframe() -> None:
    payload = b'id,name,amount\n1,"Alice",10\n2,"Bob",20\n'
    source = CSVSource()

    via_source = source.parse(CSVSourceConfig(filename="sample.csv", file_bytes=payload))
    legacy = read_dataframe(filename="sample.csv", file_bytes=payload)

    assert via_source.to_dict(as_series=False) == legacy.to_dict(as_series=False)


def test_csv_snapshots_fixture_matches_expected_hashes() -> None:
    fixture_path = Path(__file__).resolve().parents[1] / "fixtures" / "csv_snapshots.json"
    snapshots = json.loads(fixture_path.read_text(encoding="utf-8"))

    for filename, payload in {
        "simple.csv": b"id,name\n1,A\n2,B\n",
        "quoted_fields.csv": b'id,notes\n1,"hello, world"\n2,"quoted"\n',
        "special_chars.csv": b"id,name\n1,Jose\n2,Tokyo\n",
    }.items():
        legacy = read_dataframe(filename=filename, file_bytes=payload)
        assert snapshots[filename] == _parquet_hash(legacy)


def test_csv_source_error_parity_with_legacy() -> None:
    source = CSVSource()
    bad_payload = b'id,name\n1,"unterminated\n2,b'

    with pytest.raises(Exception) as legacy_exc:
        read_dataframe(filename="bad.csv", file_bytes=bad_payload)
    with pytest.raises(Exception) as source_exc:
        source.parse(CSVSourceConfig(filename="bad.csv", file_bytes=bad_payload))

    assert type(source_exc.value) is type(legacy_exc.value)
    assert str(source_exc.value) == str(legacy_exc.value)


def test_csv_source_config_roundtrip() -> None:
    config = CSVSourceConfig(filename="example.csv", file_bytes=b"a,b\n1,2\n")
    payload = config.model_dump()
    restored = CSVSourceConfig.model_validate(payload)

    assert restored.source_type == "csv"
    assert restored.filename == "example.csv"
    assert restored.file_bytes == b"a,b\n1,2\n"


def test_csv_source_can_be_registered_and_resolved() -> None:
    registry_before = SourceRegistry._registry.copy()
    metadata_before = SourceRegistry._metadata_cache.copy()
    try:
        SourceRegistry._registry.clear()
        SourceRegistry._metadata_cache.clear()
        SourceRegistry.register(CSVSource)

        resolved = SourceRegistry.for_type("csv")
        assert isinstance(resolved, CSVSource)
    finally:
        SourceRegistry._registry = registry_before
        SourceRegistry._metadata_cache = metadata_before