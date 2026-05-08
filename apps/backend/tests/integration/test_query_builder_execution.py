from pathlib import Path

from fastapi.testclient import TestClient

import app.main as main_module
from app.core.metadata_db import init_metadata_db
from app.main import app
from app.services.query_builder_service import SqlTranslator
from app.schemas import AggregationSpec, FilterSpec, QueryConfig, SelectedColumn


def _bootstrap_workspace(client: TestClient) -> str:
    response = client.post("/api/v1/workspaces", json={"name": "query-integration"})
    assert response.status_code == 200
    return response.json()["id"]


def test_sql_translator_preserves_filter_parameter_order() -> None:
    config = QueryConfig(
        base_table_id="sales",
        selected_columns=[SelectedColumn(table_id="sales", column_name="region")],
        filters=[
            FilterSpec(column_id="region", operator="LIKE", value="EMEA%"),
            FilterSpec(column_id="amount", operator=">", value=1000),
            FilterSpec(column_id="status", operator="IN", value=["active", "paused"]),
        ],
        aggregations=[AggregationSpec(column_id="amount", function="SUM", alias="total_amount")],
        group_by_columns=["region"],
    )

    sql, parameters = SqlTranslator().translate(config)
    assert "WHERE" in sql
    assert parameters == ["EMEA%", 1000, "active", "paused"]


def test_validate_endpoint_reports_group_by_without_aggregation(tmp_path: Path, monkeypatch) -> None:
    db_path = tmp_path / "metadata.db"
    parquet_root = tmp_path / "parquet"
    monkeypatch.setattr(main_module, "DB_PATH", db_path)
    monkeypatch.setattr(main_module, "PARQUET_ROOT", parquet_root)
    init_metadata_db(db_path)

    client = TestClient(app)
    workspace_id = _bootstrap_workspace(client)
    payload = {
        "base_table_id": "sales",
        "selected_columns": [{"table_id": "sales", "column_name": "region", "alias": None}],
        "filters": [],
        "aggregations": [],
        "group_by_columns": ["region"],
        "joins": [],
        "result_limit": None,
        "execution_timeout_seconds": 5,
    }

    response = client.post(f"/api/v1/workspaces/{workspace_id}/queries/validate", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["valid"] is False
    assert any(issue["code"] == "GROUP_BY_WITHOUT_AGGREGATION" for issue in data["issues"])
