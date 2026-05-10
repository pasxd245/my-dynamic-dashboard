from __future__ import annotations

from sqlmodel import Field, SQLModel


class SavedQuery(SQLModel, table=True):
    __tablename__ = "saved_queries"

    query_id: str = Field(primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id")
    name: str
    description: str | None = None
    query_config: str
    config_hash: str
    created_at: str
    updated_at: str
    last_executed_at: str | None = None
    created_by: str | None = None
    tags_json: str | None = None
    deleted_at: str | None = None
    recoverable_until: str | None = None
    version_count: int = Field(default=1)
    execution_count: int = Field(default=0)
    source_query_id: str | None = None


class QueryExecutionLog(SQLModel, table=True):
    __tablename__ = "query_execution_log"

    execution_id: str = Field(primary_key=True)
    query_id: str | None = Field(default=None, foreign_key="saved_queries.query_id")
    workspace_id: str = Field(foreign_key="workspaces.id")
    state: str
    result_row_count: int | None = None
    result_column_count: int | None = None
    execution_time_ms: int | None = None
    is_preview: int = Field(default=0)
    error_message: str | None = None
    error_code: str | None = None
    lineage_metadata: str
    query_config_snapshot: str
    executed_at: str


class SavedQueryVersion(SQLModel, table=True):
    __tablename__ = "saved_query_versions"

    version_id: str = Field(primary_key=True)
    query_id: str = Field(foreign_key="saved_queries.query_id")
    version_number: int
    parent_version_id: str | None = None
    builder_snapshot: str
    sql_snapshot: str | None = None
    validation_state: str = Field(default="valid")
    created_at: str
    created_by: str | None = None
    change_summary: str | None = None


class SavedQueryEvent(SQLModel, table=True):
    __tablename__ = "saved_query_events"

    event_id: str = Field(primary_key=True)
    query_id: str = Field(foreign_key="saved_queries.query_id")
    version_id: str | None = None
    event_type: str
    occurred_at: str
    performed_by: str | None = None
    metadata_json: str | None = None


class SavedQueryExecution(SQLModel, table=True):
    __tablename__ = "saved_query_executions"

    execution_id: str = Field(primary_key=True)
    query_id: str = Field(foreign_key="saved_queries.query_id")
    version_id: str | None = None
    executed_by: str | None = None
    status: str = Field(default="completed")
    row_count: int | None = None
    execution_ms: int | None = None
    executed_at: str
    error_message: str | None = None
