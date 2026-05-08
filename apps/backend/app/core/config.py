from __future__ import annotations

from pathlib import Path


def repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


def data_dir() -> Path:
    root = repo_root() / "data"
    root.mkdir(parents=True, exist_ok=True)
    return root


def metadata_db_path() -> Path:
    return data_dir() / "metadata.db"


def parquet_root_dir() -> Path:
    root = data_dir() / "parquet"
    root.mkdir(parents=True, exist_ok=True)
    return root
