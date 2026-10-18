"""SQLModel table models — the **schema of record** for `app.sqlite`.

R78 (persistence foundation): these models replace the
hand-bootstrapped `_SCHEMA` in [db.py](db.py) as the canonical
definition of the metadata schema. Alembic's `env.py` targets
`SQLModel.metadata`; `db.create_all_for_tests()` builds the test
schema from it; the `0001_baseline` migration (+ later additive revisions,
e.g. R101's `0002_dashboards`) reproduces it for production.

Every column uses an explicit ``sa_column=Column(...)`` so the emitted
SQLite DDL matches the legacy schema's type names exactly — a bare
``str`` annotation renders ``VARCHAR`` where the hand-built schema used
``TEXT``. The ``CheckConstraint`` text is copied **verbatim** from the
legacy ``_SCHEMA`` so the introspected ``CHECK`` clauses are identical
(see ``tests/test_schema_parity.py``).

Started from mainstream's 4 tables exactly (R78 J-1) — it does **not** adopt the
drifted ref app's schema; R101 added a 5th (``dashboards``). Behaviour-preserving:
same columns, types, nullability, FKs + ``ON DELETE CASCADE``, ``CHECK``s, indexes.
"""

from __future__ import annotations

from sqlalchemy import CheckConstraint, Column, ForeignKey, Index, Integer, Text, text
from sqlmodel import Field, SQLModel


class Workspace(SQLModel, table=True):
    __tablename__ = "workspaces"
    __table_args__ = (
        CheckConstraint("length(name) BETWEEN 1 AND 80"),
        CheckConstraint("kind IN ('main', 'saved')"),
        Index("idx_workspaces_name_unique", "name", unique=True),
        # R193 — at most one saved workspace per main workspace (NULLs are distinct).
        Index("idx_workspaces_parent_unique", "parent_workspace_id", unique=True),
    )

    id: str = Field(sa_column=Column(Text, primary_key=True))
    name: str = Field(sa_column=Column(Text, nullable=False))
    created_at: str = Field(sa_column=Column(Text, nullable=False))
    # R193 (item 3.6b) — `saved`: the read-only workspace holding frozen copies
    # of its parent (main) workspace's datasets. No FK on the parent: the app
    # refuses to delete a main workspace that has a saved one.
    kind: str = Field(
        default="main", sa_column=Column(Text, nullable=False, server_default=text("'main'"))
    )
    parent_workspace_id: str | None = Field(default=None, sa_column=Column(Text, nullable=True))


class Dataset(SQLModel, table=True):
    __tablename__ = "datasets"
    __table_args__ = (
        CheckConstraint("length(name) BETWEEN 1 AND 120"),
        CheckConstraint("size_bytes >= 0"),
        CheckConstraint("row_count >= 0"),
        CheckConstraint("column_count >= 1"),
        CheckConstraint("source_format IN ('csv', 'excel', 'workflow')"),
        Index("idx_datasets_workspace_id", "workspace_id"),
        Index("idx_datasets_name_unique", "workspace_id", "name", unique=True),
        # R192 — one published dataset per workflow per workspace (NULLs are distinct).
        Index("idx_datasets_published_unique", "workspace_id", "published_workflow_id", unique=True),
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
    # R185 (W-4) — server-stamped data identity: when the rows last changed
    # (create or refresh) and a counter bumped by every refresh. Never written by
    # a client. `refreshed_at` is nullable only because SQLite's ADD COLUMN cannot
    # add a NOT NULL column without a default; 0006 backfills it and every write
    # path sets it.
    refreshed_at: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    data_version: int = Field(
        default=1, sa_column=Column(Integer, nullable=False, server_default=text("1"))
    )
    # R192 (item 3.6a) — a dataset published from a workflow's output: the
    # server-written lineage (JSON) and, internal only, the publishing workflow
    # (UNIQUE per workspace above — the re-publish target). NULL on uploads.
    lineage_json: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    published_workflow_id: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    # R193 (item 3.6b) — a saved copy's server-written `savedFrom` (JSON). NULL
    # on every other dataset.
    saved_from_json: str | None = Field(default=None, sa_column=Column(Text, nullable=True))


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


class Dashboard(SQLModel, table=True):
    """R101 — a persisted dashboard noun (workspace-scoped). The widgets live in
    the opaque ``definition_json`` blob (mirrors ``queries.definition_json``; no
    separate ``dashboard_widgets`` table). Both ``name`` and ``slug`` are unique
    PER WORKSPACE (the route nests the project — ``/dashboards/<ws_id>/<slug>``)."""

    __tablename__ = "dashboards"
    __table_args__ = (
        CheckConstraint("length(name) BETWEEN 1 AND 120"),
        CheckConstraint("length(slug) BETWEEN 1 AND 120"),
        Index("idx_dashboards_workspace_id", "workspace_id"),
        Index("idx_dashboards_name_unique", "workspace_id", "name", unique=True),
        Index("idx_dashboards_slug_unique", "workspace_id", "slug", unique=True),
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
    slug: str = Field(sa_column=Column(Text, nullable=False))
    definition_json: str = Field(sa_column=Column(Text, nullable=False))
    created_at: str = Field(sa_column=Column(Text, nullable=False))


class Workflow(SQLModel, table=True):
    """R132 — a Workflow noun (workspace-scoped): consolidates + transforms saved
    queries into a MATERIALIZED output. The ``definition_json`` blob holds the
    sources (``qr_`` ids) + steps (mirrors ``queries.definition_json``). The
    output is materialized on RUN (R133): ``output_columns_json`` (captured
    schema) + ``materialized_at`` are NULL until the first run. ``name`` is unique
    per workspace (mirrors query/dashboard)."""

    __tablename__ = "workflows"
    __table_args__ = (
        CheckConstraint("length(name) BETWEEN 1 AND 120"),
        Index("idx_workflows_workspace_id", "workspace_id"),
        Index("idx_workflows_name_unique", "workspace_id", "name", unique=True),
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
    definition_json: str = Field(sa_column=Column(Text, nullable=False))
    # R133 — the captured output schema + materialize timestamp; NULL until first run.
    output_columns_json: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    materialized_at: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    created_at: str = Field(sa_column=Column(Text, nullable=False))
    # R187 (W-7) — the run stamp, server-written by POST /workflows/{id}/run: a run
    # id, a per-workflow run counter (never reset), and the JSON of what the run
    # read (the workflow's definition hash + each source's definition hash / data
    # versions / run id). NULL id/json before the first run and after a definition
    # change (which clears the materialized output).
    run_id: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    run_number: int = Field(default=0, sa_column=Column(Integer, nullable=False, server_default=text("0")))
    run_json: str | None = Field(default=None, sa_column=Column(Text, nullable=True))


class Relationship(SQLModel, table=True):
    __tablename__ = "relationships"
    __table_args__ = (
        CheckConstraint("cardinality IN ('one_to_one', 'one_to_many', 'many_to_one', 'many_to_many')"),
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


class MetadataEntry(SQLModel, table=True):
    """R180 — a read-only (to the UI) annotation on one noun, in one namespace.
    ``kind`` names the noun kind; ``noun_id`` is the noun's id (``<ds_id>:<col>``
    for a column, ``<dsh_id>:<wdg_id>`` for a widget); ``namespace`` is the
    writer's free-form string (``^[a-z][a-z0-9_]{0,31}$``, ``system`` reserved).
    ``md`` is the safe-subset markdown (≤ 64 KiB, may open with YAML
    frontmatter the server does not interpret); ``source`` / ``author`` /
    ``written_at`` are stamped by the server from the writing token;
    ``definition_version`` is the noun's definition hash at write time, so a
    reader can flag an entry whose subject has since changed. No FK: the noun
    kinds live in five tables. Nothing sweeps a deleted noun's entries yet — an
    orphan stays in the table, harmless and unreadable (no read path resolves
    it); the cascade is item 3.8's (R191 corrected this docstring)."""

    __tablename__ = "metadata_entries"
    __table_args__ = (
        CheckConstraint("kind IN ('dataset', 'column', 'relationship', 'query', 'workflow', 'dashboard', 'widget')"),
        CheckConstraint("source IN ('ai', 'human', 'system')"),
        CheckConstraint("length(namespace) BETWEEN 1 AND 32"),
        Index("idx_metadata_entries_noun", "kind", "noun_id"),
    )

    kind: str = Field(sa_column=Column(Text, primary_key=True))
    noun_id: str = Field(sa_column=Column(Text, primary_key=True))
    namespace: str = Field(sa_column=Column(Text, primary_key=True))
    md: str = Field(sa_column=Column(Text, nullable=False))
    source: str = Field(sa_column=Column(Text, nullable=False))
    author: str = Field(sa_column=Column(Text, nullable=False))
    written_at: str = Field(sa_column=Column(Text, nullable=False))
    definition_version: str = Field(sa_column=Column(Text, nullable=False))
