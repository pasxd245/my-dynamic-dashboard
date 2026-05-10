from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import Engine
from sqlmodel import Session, create_engine

from app.shared import DB_PATH


def sqlite_url(db_path: Path) -> str:
    return f"sqlite:///{db_path}"


def create_metadata_engine(db_path: Path) -> Engine:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return create_engine(sqlite_url(db_path), connect_args={"check_same_thread": False})


METADATA_ENGINE = create_metadata_engine(DB_PATH)


def get_session() -> Iterator[Session]:
    with Session(METADATA_ENGINE) as session:
        yield session
