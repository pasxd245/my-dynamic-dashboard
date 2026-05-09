from pathlib import Path

from fastapi.testclient import TestClient

import app.main as main_module
from app.core.metadata_db import init_metadata_db
from app.main import app


def _bootstrap_workspace(client: TestClient) -> str:
    response = client.post("/api/v1/workspaces", json={"name": "query-contract"})
    assert response.status_code == 200
    return response.json()["id"]


def test_query_validate_contract_shape(tmp_path: Path, monkeypatch) -> None:
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
        "group_by_columns": [],
        "joins": [],
        "result_limit": 100,
        "execution_timeout_seconds": 5,
    }
    response = client.post(f"/api/v1/workspaces/{workspace_id}/queries/validate", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert set(data.keys()) == {"valid", "issues", "sql_preview"}
    assert data["valid"] is True
    assert isinstance(data["issues"], list)
    assert isinstance(data["sql_preview"], str)


def test_query_validate_invalid_operator_rejected_by_schema(tmp_path: Path, monkeypatch) -> None:
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
        "filters": [{"column_id": "amount", "operator": "BETWEEN", "value": 100}],
        "aggregations": [],
        "group_by_columns": [],
        "joins": [],
        "result_limit": None,
        "execution_timeout_seconds": 5,
    }

    response = client.post(f"/api/v1/workspaces/{workspace_id}/queries/validate", json=payload)
    assert response.status_code == 422


def test_query_validate_missing_filter_value_returns_issue(tmp_path: Path, monkeypatch) -> None:
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
        "filters": [{"column_id": "amount", "operator": ">", "value": None}],
        "aggregations": [],
        "group_by_columns": [],
        "joins": [],
        "result_limit": None,
        "execution_timeout_seconds": 5,
    }

    response = client.post(f"/api/v1/workspaces/{workspace_id}/queries/validate", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["valid"] is False
    assert any(issue["code"] == "MISSING_FILTER_VALUE" for issue in data["issues"])
