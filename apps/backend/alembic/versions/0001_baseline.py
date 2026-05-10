"""Baseline metadata schema parity.

Revision ID: 0001_baseline
Revises:
Create Date: 2026-05-10
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "workspaces",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="draft"),
        sa.Column("manifest_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("content_hash", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
    )
    op.create_table(
        "source_files",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("workspace_id", sa.Text(), sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("filename_original", sa.Text(), nullable=False),
        sa.Column("extension", sa.Text(), nullable=False),
        sa.Column("content_hash", sa.Text(), nullable=False),
        sa.Column("encoding_detected", sa.Text(), nullable=True),
        sa.Column("parse_status", sa.Text(), nullable=False),
        sa.Column("reject_reason", sa.Text(), nullable=True),
        sa.Column("uploaded_at", sa.Text(), nullable=False),
    )
    op.create_table(
        "sheets",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("source_file_id", sa.Text(), sa.ForeignKey("source_files.id"), nullable=False),
        sa.Column("sheet_name", sa.Text(), nullable=False),
        sa.Column("header_row_detected", sa.Integer(), nullable=False),
        sa.Column("header_row_effective", sa.Integer(), nullable=False),
        sa.Column("data_range_detected", sa.Text(), nullable=False),
        sa.Column("data_range_effective", sa.Text(), nullable=False),
        sa.Column("multi_range_warning", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("committed_at", sa.Text(), nullable=False),
    )
    op.create_table(
        "columns",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("sheet_id", sa.Text(), sa.ForeignKey("sheets.id"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.Column("inferred_type", sa.Text(), nullable=False),
        sa.Column("effective_type", sa.Text(), nullable=False),
        sa.Column("type_override_reason", sa.Text(), nullable=True),
        sa.Column("is_all_null", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_table(
        "column_profiles",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("column_id", sa.Text(), sa.ForeignKey("columns.id"), nullable=False),
        sa.Column("null_ratio", sa.Float(), nullable=False),
        sa.Column("distinct_count", sa.Integer(), nullable=False),
        sa.Column("uniqueness_ratio", sa.Float(), nullable=False),
        sa.Column("duplicate_signature", sa.Text(), nullable=True),
        sa.Column("numeric_min", sa.Float(), nullable=True),
        sa.Column("numeric_max", sa.Float(), nullable=True),
        sa.Column("date_min", sa.Text(), nullable=True),
        sa.Column("date_max", sa.Text(), nullable=True),
        sa.Column("top_k_values_json", sa.Text(), nullable=False),
        sa.Column("warnings_json", sa.Text(), nullable=False),
        sa.Column("sampled", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sample_size", sa.Integer(), nullable=True),
        sa.Column("sample_seed", sa.Integer(), nullable=True),
        sa.Column("computed_at", sa.Text(), nullable=False),
    )
    op.create_table(
        "role_assignments",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("column_id", sa.Text(), sa.ForeignKey("columns.id"), nullable=False),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("accepted", sa.Integer(), nullable=False),
        sa.Column("override_used", sa.Integer(), nullable=False),
        sa.Column("override_reason", sa.Text(), nullable=True),
        sa.Column("assigned_by", sa.Text(), nullable=True),
        sa.Column("assigned_at", sa.Text(), nullable=False),
    )
    op.create_table(
        "override_logs",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("workspace_id", sa.Text(), sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("target_kind", sa.Text(), nullable=False),
        sa.Column("target_id", sa.Text(), nullable=False),
        sa.Column("old_value_json", sa.Text(), nullable=False),
        sa.Column("new_value_json", sa.Text(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("actor", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
    )
    op.create_table(
        "manifest_snapshots",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("workspace_id", sa.Text(), sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("manifest_version", sa.Integer(), nullable=False),
        sa.Column("manifest_json", sa.Text(), nullable=False),
        sa.Column("manifest_hash", sa.Text(), nullable=False),
        sa.Column("exported_at", sa.Text(), nullable=False),
    )
    op.create_table(
        "files",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("table_id", sa.Text(), nullable=False),
        sa.Column("filename", sa.Text(), nullable=False),
        sa.Column("extension", sa.Text(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("parquet_path", sa.Text(), nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=False),
        sa.Column("schema_hash", sa.Text(), nullable=False),
        sa.Column("schema_changed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("uploaded_at", sa.Text(), nullable=False),
    )
    op.create_table(
        "file_schemas",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("file_id", sa.Text(), sa.ForeignKey("files.id"), nullable=False),
        sa.Column("column_name", sa.Text(), nullable=False),
        sa.Column("data_type", sa.Text(), nullable=False),
        sa.Column("is_nullable", sa.Integer(), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
    )
    op.create_table(
        "relationship_rules",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("workspace_id", sa.Text(), sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("from_column_id", sa.Text(), sa.ForeignKey("columns.id"), nullable=False),
        sa.Column("to_column_id", sa.Text(), sa.ForeignKey("columns.id"), nullable=False),
        sa.Column("join_type", sa.Text(), nullable=False),
        sa.Column("rel_type", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="suggested"),
        sa.Column("overlap_pct", sa.Float(), nullable=True),
        sa.Column("cardinality", sa.Text(), nullable=True),
        sa.Column("low_overlap_acknowledged", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("override_reason", sa.Text(), nullable=True),
        sa.Column("actor", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
    )
    op.create_table(
        "relationship_audit",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("relationship_id", sa.Text(), sa.ForeignKey("relationship_rules.id"), nullable=False),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("old_status", sa.Text(), nullable=True),
        sa.Column("new_status", sa.Text(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("actor", sa.Text(), nullable=True),
        sa.Column("timestamp", sa.Text(), nullable=False),
    )
    op.create_table(
        "saved_queries",
        sa.Column("query_id", sa.Text(), primary_key=True),
        sa.Column("workspace_id", sa.Text(), sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("query_config", sa.Text(), nullable=False),
        sa.Column("config_hash", sa.Text(), nullable=False),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
        sa.Column("last_executed_at", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Text(), nullable=True),
        sa.Column("tags_json", sa.Text(), nullable=True),
        sa.Column("deleted_at", sa.Text(), nullable=True),
        sa.Column("recoverable_until", sa.Text(), nullable=True),
        sa.Column("version_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("execution_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("source_query_id", sa.Text(), nullable=True),
    )
    op.create_table(
        "query_execution_log",
        sa.Column("execution_id", sa.Text(), primary_key=True),
        sa.Column("query_id", sa.Text(), sa.ForeignKey("saved_queries.query_id"), nullable=True),
        sa.Column("workspace_id", sa.Text(), sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("state", sa.Text(), nullable=False),
        sa.Column("result_row_count", sa.Integer(), nullable=True),
        sa.Column("result_column_count", sa.Integer(), nullable=True),
        sa.Column("execution_time_ms", sa.Integer(), nullable=True),
        sa.Column("is_preview", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("error_code", sa.Text(), nullable=True),
        sa.Column("lineage_metadata", sa.Text(), nullable=False),
        sa.Column("query_config_snapshot", sa.Text(), nullable=False),
        sa.Column("executed_at", sa.Text(), nullable=False),
    )
    op.create_table(
        "dashboards",
        sa.Column("dashboard_id", sa.Text(), primary_key=True),
        sa.Column("workspace_id", sa.Text(), sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("owner_user_id", sa.Text(), nullable=False),
        sa.Column("dashboard_name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("refresh_cadence", sa.Text(), nullable=False, server_default="manual"),
        sa.Column("current_run_id", sa.Text(), nullable=True),
        sa.Column("last_refreshed_at", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
        sa.Column("deleted_at", sa.Text(), nullable=True),
        sa.UniqueConstraint("workspace_id", "owner_user_id", "dashboard_name"),
        sa.CheckConstraint("refresh_cadence IN ('manual', '15min', '60min')"),
    )
    op.create_table(
        "dashboard_panels",
        sa.Column("panel_id", sa.Text(), primary_key=True),
        sa.Column("dashboard_id", sa.Text(), sa.ForeignKey("dashboards.dashboard_id"), nullable=False),
        sa.Column("saved_query_id", sa.Text(), sa.ForeignKey("saved_queries.query_id"), nullable=False),
        sa.Column("panel_name", sa.Text(), nullable=True),
        sa.Column("panel_order", sa.Integer(), nullable=False),
        sa.Column("is_visible", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("chart_config_json", sa.Text(), nullable=True),
        sa.Column("parameter_overrides_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
    )
    op.create_table(
        "dashboard_runs",
        sa.Column("run_id", sa.Text(), primary_key=True),
        sa.Column("dashboard_id", sa.Text(), sa.ForeignKey("dashboards.dashboard_id"), nullable=False),
        sa.Column("run_number", sa.Integer(), nullable=False),
        sa.Column("triggered_by", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("parameters_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("started_at", sa.Text(), nullable=True),
        sa.Column("completed_at", sa.Text(), nullable=True),
        sa.Column("total_duration_ms", sa.Integer(), nullable=True),
    )
    op.create_table(
        "dashboard_run_panels",
        sa.Column("run_panel_id", sa.Text(), primary_key=True),
        sa.Column("run_id", sa.Text(), sa.ForeignKey("dashboard_runs.run_id"), nullable=False),
        sa.Column("panel_id", sa.Text(), sa.ForeignKey("dashboard_panels.panel_id"), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("started_at", sa.Text(), nullable=True),
        sa.Column("completed_at", sa.Text(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("row_count", sa.Integer(), nullable=True),
        sa.Column("is_aggregated", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_type", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("chart_suggestion_type", sa.Text(), nullable=True),
        sa.Column("chart_suggestion_reason", sa.Text(), nullable=True),
        sa.Column("kpi_value", sa.Float(), nullable=True),
        sa.Column("kpi_label", sa.Text(), nullable=True),
        sa.Column("result_columns_json", sa.Text(), nullable=True),
        sa.Column("result_rows_json", sa.Text(), nullable=True),
    )
    op.create_table(
        "dashboard_run_events",
        sa.Column("event_id", sa.Text(), primary_key=True),
        sa.Column("run_id", sa.Text(), sa.ForeignKey("dashboard_runs.run_id"), nullable=False),
        sa.Column("event_type", sa.Text(), nullable=False),
        sa.Column("event_details_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
    )
    op.create_table(
        "deployment_bundles",
        sa.Column("bundle_id", sa.Text(), primary_key=True),
        sa.Column("release_version", sa.Text(), nullable=False),
        sa.Column("backend_image", sa.Text(), nullable=False),
        sa.Column("builder_image", sa.Text(), nullable=False),
        sa.Column("dashboard_image", sa.Text(), nullable=False),
        sa.Column("compose_revision", sa.Text(), nullable=False),
        sa.Column("env_contract_version", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("created_at_utc", sa.Text(), nullable=False),
        sa.Column("created_by", sa.Text(), nullable=False),
        sa.Column("backup_set_reference", sa.Text(), nullable=True),
    )
    op.create_table(
        "backup_artifacts",
        sa.Column("backup_id", sa.Text(), primary_key=True),
        sa.Column("artifact_name", sa.Text(), nullable=False),
        sa.Column("artifact_path", sa.Text(), nullable=False),
        sa.Column("created_at_utc", sa.Text(), nullable=False),
        sa.Column("sqlite_integrity_ok", sa.Integer(), nullable=False),
        sa.Column("checksum", sa.Text(), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("is_latest_valid", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("retention_expires_at_utc", sa.Text(), nullable=True),
    )
    op.create_table(
        "deployment_events",
        sa.Column("event_id", sa.Text(), primary_key=True),
        sa.Column("bundle_id", sa.Text(), sa.ForeignKey("deployment_bundles.bundle_id"), nullable=False),
        sa.Column("event_type", sa.Text(), nullable=False),
        sa.Column("operator_id", sa.Text(), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("service", sa.Text(), nullable=False, server_default="backend"),
        sa.Column("severity", sa.Text(), nullable=False, server_default="INFO"),
        sa.Column("created_at_utc", sa.Text(), nullable=False),
    )
    op.create_table(
        "restore_runs",
        sa.Column("restore_run_id", sa.Text(), primary_key=True),
        sa.Column("backup_id", sa.Text(), sa.ForeignKey("backup_artifacts.backup_id"), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("validation_result", sa.Text(), nullable=True),
        sa.Column("started_at_utc", sa.Text(), nullable=False),
        sa.Column("finished_at_utc", sa.Text(), nullable=True),
        sa.Column("requested_by", sa.Text(), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
    )
    op.create_table(
        "saved_query_versions",
        sa.Column("version_id", sa.Text(), primary_key=True),
        sa.Column("query_id", sa.Text(), sa.ForeignKey("saved_queries.query_id"), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("parent_version_id", sa.Text(), nullable=True),
        sa.Column("builder_snapshot", sa.Text(), nullable=False),
        sa.Column("sql_snapshot", sa.Text(), nullable=True),
        sa.Column("validation_state", sa.Text(), nullable=False, server_default="valid"),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("created_by", sa.Text(), nullable=True),
        sa.Column("change_summary", sa.Text(), nullable=True),
    )
    op.create_table(
        "saved_query_events",
        sa.Column("event_id", sa.Text(), primary_key=True),
        sa.Column("query_id", sa.Text(), sa.ForeignKey("saved_queries.query_id"), nullable=False),
        sa.Column("version_id", sa.Text(), nullable=True),
        sa.Column("event_type", sa.Text(), nullable=False),
        sa.Column("occurred_at", sa.Text(), nullable=False),
        sa.Column("performed_by", sa.Text(), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=True),
    )
    op.create_table(
        "saved_query_executions",
        sa.Column("execution_id", sa.Text(), primary_key=True),
        sa.Column("query_id", sa.Text(), sa.ForeignKey("saved_queries.query_id"), nullable=False),
        sa.Column("version_id", sa.Text(), nullable=True),
        sa.Column("executed_by", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default="completed"),
        sa.Column("row_count", sa.Integer(), nullable=True),
        sa.Column("execution_ms", sa.Integer(), nullable=True),
        sa.Column("executed_at", sa.Text(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
    )

    op.create_index("idx_files_filename_version", "files", ["filename", "version"])
    op.create_index("idx_file_schemas_file_id", "file_schemas", ["file_id"])
    op.create_index("idx_relationship_rules_workspace", "relationship_rules", ["workspace_id"])
    op.create_index("idx_relationship_rules_status", "relationship_rules", ["workspace_id", "status"])
    op.create_index("idx_relationship_rules_columns", "relationship_rules", ["from_column_id", "to_column_id"])
    op.create_index("idx_relationship_audit_timeline", "relationship_audit", ["relationship_id", "timestamp"])
    op.create_index("idx_source_files_workspace", "source_files", ["workspace_id"])
    op.create_index("idx_sheets_source", "sheets", ["source_file_id"])
    op.create_index("idx_columns_sheet", "columns", ["sheet_id"])
    op.create_index("idx_profiles_column", "column_profiles", ["column_id"])
    op.create_index("idx_roles_column", "role_assignments", ["column_id"])
    op.create_index("idx_saved_queries_workspace", "saved_queries", ["workspace_id"])
    op.create_index("idx_saved_queries_created_at", "saved_queries", [sa.text("created_at DESC")])
    op.create_index("idx_saved_queries_deleted_at", "saved_queries", ["workspace_id", "deleted_at"])
    op.create_index("idx_sq_versions_query_id", "saved_query_versions", ["query_id", "version_number"])
    op.create_index("idx_sq_events_query_id", "saved_query_events", ["query_id", "occurred_at"])
    op.create_index("idx_sq_executions_query_id", "saved_query_executions", [sa.text("query_id"), sa.text("executed_at DESC")])
    op.create_index("idx_query_execution_workspace", "query_execution_log", ["workspace_id"])
    op.create_index("idx_query_execution_query", "query_execution_log", ["query_id"])
    op.create_index("idx_query_execution_timeline", "query_execution_log", [sa.text("executed_at DESC")])
    op.create_index("idx_dashboards_list", "dashboards", ["workspace_id", "owner_user_id", "deleted_at", sa.text("updated_at DESC")])
    op.create_index("idx_dashboard_panels_order", "dashboard_panels", ["dashboard_id", "panel_order"])
    op.create_index("idx_dashboard_runs_history", "dashboard_runs", ["dashboard_id", sa.text("created_at DESC")])
    op.create_index("idx_dashboard_runs_active", "dashboard_runs", ["dashboard_id", "status"])
    op.create_index("idx_dashboard_run_panels_run", "dashboard_run_panels", ["run_id"])
    op.create_index("idx_dashboard_run_events_run", "dashboard_run_events", ["run_id", "created_at"])
    op.create_index("idx_deployment_bundles_created", "deployment_bundles", [sa.text("created_at_utc DESC")])
    op.create_index("idx_backup_artifacts_created", "backup_artifacts", [sa.text("created_at_utc DESC")])
    op.create_index("idx_restore_runs_started", "restore_runs", [sa.text("started_at_utc DESC")])
    op.create_index("idx_deployment_events_created", "deployment_events", [sa.text("created_at_utc DESC")])


def downgrade() -> None:
    for index_name, table_name in [
        ("idx_deployment_events_created", "deployment_events"),
        ("idx_restore_runs_started", "restore_runs"),
        ("idx_backup_artifacts_created", "backup_artifacts"),
        ("idx_deployment_bundles_created", "deployment_bundles"),
        ("idx_dashboard_run_events_run", "dashboard_run_events"),
        ("idx_dashboard_run_panels_run", "dashboard_run_panels"),
        ("idx_dashboard_runs_active", "dashboard_runs"),
        ("idx_dashboard_runs_history", "dashboard_runs"),
        ("idx_dashboard_panels_order", "dashboard_panels"),
        ("idx_dashboards_list", "dashboards"),
        ("idx_query_execution_timeline", "query_execution_log"),
        ("idx_query_execution_query", "query_execution_log"),
        ("idx_query_execution_workspace", "query_execution_log"),
        ("idx_sq_executions_query_id", "saved_query_executions"),
        ("idx_sq_events_query_id", "saved_query_events"),
        ("idx_sq_versions_query_id", "saved_query_versions"),
        ("idx_saved_queries_deleted_at", "saved_queries"),
        ("idx_saved_queries_created_at", "saved_queries"),
        ("idx_saved_queries_workspace", "saved_queries"),
        ("idx_roles_column", "role_assignments"),
        ("idx_profiles_column", "column_profiles"),
        ("idx_columns_sheet", "columns"),
        ("idx_sheets_source", "sheets"),
        ("idx_source_files_workspace", "source_files"),
        ("idx_relationship_audit_timeline", "relationship_audit"),
        ("idx_relationship_rules_columns", "relationship_rules"),
        ("idx_relationship_rules_status", "relationship_rules"),
        ("idx_relationship_rules_workspace", "relationship_rules"),
        ("idx_file_schemas_file_id", "file_schemas"),
        ("idx_files_filename_version", "files"),
    ]:
        op.drop_index(index_name, table_name=table_name)

    for table_name in [
        "saved_query_executions",
        "saved_query_events",
        "saved_query_versions",
        "restore_runs",
        "deployment_events",
        "backup_artifacts",
        "deployment_bundles",
        "dashboard_run_events",
        "dashboard_run_panels",
        "dashboard_runs",
        "dashboard_panels",
        "dashboards",
        "query_execution_log",
        "saved_queries",
        "relationship_audit",
        "relationship_rules",
        "file_schemas",
        "files",
        "manifest_snapshots",
        "override_logs",
        "role_assignments",
        "column_profiles",
        "columns",
        "sheets",
        "source_files",
        "workspaces",
    ]:
        op.drop_table(table_name)
