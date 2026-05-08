from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


def test_time_anchor_hard_reject_and_measure_soft_override(tmp_path: Path) -> None:
    client = TestClient(app)

    workspace_id = client.post("/api/v1/workspaces", json={"name": "ws-compat"}).json()["id"]
    source = tmp_path / "compat.csv"
    source.write_text("name,value\nA1,10\nA2,20\n", encoding="utf-8")

    with source.open("rb") as file_handle:
        client.post(
            f"/api/v1/workspaces/{workspace_id}/sources/upload",
            files={"file": ("compat.csv", file_handle, "text/csv")},
        )

    columns = client.get(f"/api/v1/workspaces/{workspace_id}/profile").json()["columns"]
    name_column_id = next(column["column_id"] for column in columns if column["column_name"] == "name")

    hard_fail = client.put(
        f"/api/v1/workspaces/{workspace_id}/columns/{name_column_id}/roles",
        json={"roles": ["time_anchor"]},
    )
    assert hard_fail.status_code == 422

    soft_fail = client.put(
        f"/api/v1/workspaces/{workspace_id}/columns/{name_column_id}/roles",
        json={"roles": ["measure"]},
    )
    assert soft_fail.status_code == 422

    soft_ok = client.put(
        f"/api/v1/workspaces/{workspace_id}/columns/{name_column_id}/roles",
        json={"roles": ["measure"], "override_reason": "business exception"},
    )
    assert soft_ok.status_code == 200
    assert soft_ok.json()["assignments"][0]["override_used"] is True
