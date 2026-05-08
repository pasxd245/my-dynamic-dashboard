"""SC-001 execution-time benchmark: full workspace setup must complete in reasonable time.

SC-001 states an analyst can upload, profile, and fully role-assign a sample
workspace in under 10 minutes.  This harness automates the same flow for a
multi-source workspace and asserts it completes within a conservative automated
budget of 60 seconds (well within the 10-minute human target).
"""
import io
import time
from datetime import date

import openpyxl
from fastapi.testclient import TestClient

from app.main import app


def _csv_bytes(rows: int = 50) -> bytes:
    lines = ["id,category,value,flag"]
    for i in range(1, rows + 1):
        lines.append(f"{i},cat_{i % 5},{i * 1.5},{'yes' if i % 2 == 0 else 'no'}")
    return "\n".join(lines).encode("utf-8")


def _xlsx_bytes(rows: int = 50) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["cust_id", "event_date", "revenue", "outcome"])
    for i in range(1, rows + 1):
        ws.append([i, date(2024, 1, (i % 28) + 1), float(i * 10), "won" if i % 2 == 0 else "lost"])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_sample_workspace_setup_within_time_budget() -> None:
    """Full MVP1 flow (3 sources) must complete under 60 seconds."""
    client = TestClient(app)
    start = time.perf_counter()

    # --- Create workspace ---
    workspace_id = client.post("/api/v1/workspaces", json={"name": "sc001-bench"}).json()["id"]

    # --- Upload 3 sources ---
    # Source 1: CSV
    r = client.post(
        f"/api/v1/workspaces/{workspace_id}/sources/upload",
        files={"file": ("sales.csv", _csv_bytes(), "text/csv")},
    )
    assert r.status_code == 200

    # Source 2: another CSV
    r = client.post(
        f"/api/v1/workspaces/{workspace_id}/sources/upload",
        files={"file": ("accounts.csv", _csv_bytes(rows=30), "text/csv")},
    )
    assert r.status_code == 200

    # Source 3: XLSX (provides date column for time_anchor)
    r = client.post(
        f"/api/v1/workspaces/{workspace_id}/sources/upload",
        files={"file": (
            "events.xlsx",
            _xlsx_bytes(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )},
    )
    assert r.status_code == 200

    # --- Profile all sources ---
    profile_response = client.get(f"/api/v1/workspaces/{workspace_id}/profile")
    assert profile_response.status_code == 200
    columns = profile_response.json()["columns"]
    by_name = {col["column_name"]: col["column_id"] for col in columns}

    # --- Assign required roles using the XLSX columns ---
    client.put(
        f"/api/v1/workspaces/{workspace_id}/columns/{by_name['cust_id']}/roles",
        json={"roles": ["identity_key"]},
    )
    client.put(
        f"/api/v1/workspaces/{workspace_id}/columns/{by_name['event_date']}/roles",
        json={"roles": ["time_anchor"]},
    )
    client.put(
        f"/api/v1/workspaces/{workspace_id}/columns/{by_name['revenue']}/roles",
        json={"roles": ["measure"]},
    )
    client.put(
        f"/api/v1/workspaces/{workspace_id}/columns/{by_name['outcome']}/roles",
        json={"roles": ["source_of_truth_outcome"]},
    )

    # --- Readiness check ---
    readiness = client.get(f"/api/v1/workspaces/{workspace_id}/readiness").json()
    assert readiness["complete"] is True

    # --- Manifest export ---
    manifest_response = client.post(f"/api/v1/workspaces/{workspace_id}/manifest/export")
    assert manifest_response.status_code == 200

    elapsed = time.perf_counter() - start
    assert elapsed < 60.0, (
        f"Full workspace setup took {elapsed:.2f}s — exceeds 60s automated budget "
        f"(SC-001 human target: 10 min)"
    )
