"""SQLModel table models — the **schema of record** for `app.sqlite`.

R78 (persistence foundation): these four models replace the
hand-bootstrapped `_SCHEMA` in [db.py](db.py) as the canonical
definition of the metadata schema. Alembic's `env.py` targets
`SQLModel.metadata`; `db.create_all_for_tests()` builds the test
schema from it; the `0001_baseline` migration reproduces it for
production.

Every column uses an explicit ``sa_column=Column(...)`` so the emitted
SQLite DDL matches the legacy schema's type names exactly — a bare
``str`` annotation renders ``VARCHAR`` where the hand-built schema used
``TEXT``. The ``CheckConstraint`` text is copied **verbatim** from the
legacy ``_SCHEMA`` so the introspected ``CHECK`` clauses are identical
(see ``tests/test_schema_parity.py``).

Mirrors mainstream's current 4 tables exactly (R78 J-1) — it does **not**
adopt the drifted ref app's schema. Behaviour-preserving: same columns,
types, nullability, FKs + ``ON DELETE CASCADE``, ``CHECK``s, and indexes.
"""

from __future__ import annotations

from sqlalchemy import CheckConstraint, Column, ForeignKey, Index, Integer, Text
from sqlmodel import Field, SQLModel


class Workspace(SQLModel, table=True):
    __tablename__ = "workspaces"
    __table_args__ = (
        CheckConstraint("length(name) BETWEEN 1 AND 80"),
        Index("idx_workspaces_name_unique", "name", unique=True),
    )

    id: str = Field(sa_column=Column(Text, primary_key=True))
    name: str = Field(sa_column=Column(Text, nullable=False))
    created_at: str = Field(sa_column=Column(Text, nullable=False))


class Dataset(SQLModel, table=True):
    __tablename__ = "datasets"
    __table_args__ = (
        CheckConstraint("length(name) BETWEEN 1 AND 120"),
        CheckConstraint("size_bytes >= 0"),
        CheckConstraint("row_count >= 0"),
        CheckConstraint("column_count >= 1"),
        CheckConstraint("source_format IN ('csv', 'excel')"),
        Index("idx_datasets_workspace_id", "workspace_id"),
        Index("idx_datasets_name_unique", "workspace_id", "name", unique=True),
    )

    id: str = Field(sa_column=Column(Text, primary_key=True))
    workspace_id: str = Field(
        sa_column=Column(
            Text,
            ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    name: str = Field(sa_column=Column(Text, nullable=False))
    size_bytes: int = Field(sa_column=Column(Integer, nullable=False))
    row_count: int = Field(sa_column=Column(Integer, nullable=False))
    column_count: int = Field(sa_column=Column(Integer, nullable=False))
    columns_json: str = Field(sa_column=Column(Text, nullable=False))
    source_format: str = Field(sa_column=Column(Text, nullable=False))
    sheet_name: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    created_at: str = Field(sa_column=Column(Text, nullable=False))


class Query(SQLModel, table=True):
    __tablename__ = "queries"
    __table_args__ = (
        CheckConstraint("length(name) BETWEEN 1 AND 120"),
        Index("idx_queries_workspace_id", "workspace_id"),
        Index("idx_queries_name_unique", "workspace_id", "name", unique=True),
    )

    id: str = Field(sa_column=Column(Text, primary_key=True))
    workspace_id: str = Field(
        sa_column=Column(
            Text,
            ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    # R79 — the single, canonical polymorphic driving source (completes the
    # `dataset_id → source_id` rename R76 designed). A `ds_` for a dataset-rooted
    # query (backfilled from the retired `dataset_id`) or a `qr_` for a composed
    # one. No FK: a polymorphic column can't express one — the dataset-delete →
    # query cascade moved to the app (R79 J-1, `routers/datasets.py`).
    source_id: str = Field(sa_column=Column(Text, nullable=False))
    name: str = Field(sa_column=Column(Text, nullable=False))
    definition_json: str = Field(sa_column=Column(Text, nullable=False))
    created_at: str = Field(sa_column=Column(Text, nullable=False))


class Relationship(SQLModel, table=True):
    __tablename__ = "relationships"
    __table_args__ = (
        CheckConstraint(
            "cardinality IN ('one_to_one', 'one_to_many', 'many_to_many')"
        ),
        Index("idx_relationships_workspace_id", "workspace_id"),
        Index(
            "idx_relationships_pair_unique",
            "workspace_id",
            "left_dataset_id",
            "left_column",
            "right_dataset_id",
            "right_column",
            unique=True,
        ),
    )

    id: str = Field(sa_column=Column(Text, primary_key=True))
    workspace_id: str = Field(
        sa_column=Column(
            Text,
            ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    left_dataset_id: str = Field(
        sa_column=Column(
            Text,
            ForeignKey("datasets.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    left_column: str = Field(sa_column=Column(Text, nullable=False))
    right_dataset_id: str = Field(
        sa_column=Column(
            Text,
            ForeignKey("datasets.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    right_column: str = Field(sa_column=Column(Text, nullable=False))
    cardinality: str = Field(sa_column=Column(Text, nullable=False))
    created_at: str = Field(sa_column=Column(Text, nullable=False))
