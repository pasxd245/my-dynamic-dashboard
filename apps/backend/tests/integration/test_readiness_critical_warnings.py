from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


def test_readiness_blocked_by_critical_warning_on_required_role(tmp_path: Path) -> None:
    client = TestClient(app)

    workspace_id = client.post("/api/v1/workspaces", json={"name": "ws-ready"}).json()["id"]
    source = tmp_path / "ready.csv"
    source.write_text(
        "id,event_date,amount,status\n"
        "1,2024-01-01,10,won\n"
        "2,2024-01-02,20,N/A\n",
        encoding="utf-8",
    )

    with source.open("rb") as file_handle:
        client.post(
            f"/api/v1/workspaces/{workspace_id}/sources/upload",
            files={"file": ("ready.csv", file_handle, "text/csv")},
        )

    columns = client.get(f"/api/v1/workspaces/{workspace_id}/profile").json()["columns"]
    by_name = {column["column_name"]: column["column_id"] for column in columns}

    client.put(
        f"/api/v1/workspaces/{workspace_id}/columns/{by_name['id']}/roles",
        json={"roles": ["identity_key"]},
    )
    client.put(
        f"/api/v1/workspaces/{workspace_id}/columns/{by_name['event_date']}/roles",
        json={"roles": ["time_anchor"], "override_reason": "date as text"},
    )
    client.put(
        f"/api/v1/workspaces/{workspace_id}/columns/{by_name['amount']}/roles",
        json={"roles": ["measure"]},
    )
    client.put(
        f"/api/v1/workspaces/{workspace_id}/columns/{by_name['status']}/roles",
        json={"roles": ["source_of_truth_outcome"]},
    )

    readiness = client.get(f"/api/v1/workspaces/{workspace_id}/readiness")
    assert readiness.status_code == 200
    payload = readiness.json()
    assert payload["complete"] is False
    assert any(
        warning.startswith("source_of_truth_outcome:")
        for warning in payload["unresolved_critical_warnings"]
    )
