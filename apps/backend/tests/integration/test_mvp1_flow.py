"""End-to-end regression test for the full MVP 1 flow.

Covers: upload → profile → role assignment → readiness (complete) → manifest export/import.
Uses an XLSX file so the date column is inferred as Datetime, satisfying time_anchor.
"""
import io
from datetime import date
from pathlib import Path

import openpyxl
from fastapi.testclient import TestClient

from app.main import app


def _make_xlsx_bytes() -> bytes:
    """Create a minimal XLSX with four semantically typed columns."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["cust_id", "event_date", "revenue", "outcome"])
    ws.append([1, date(2024, 1, 1), 100.0, "won"])
    ws.append([2, date(2024, 1, 2), 200.0, "lost"])
    ws.append([3, date(2024, 1, 3), 150.0, "won"])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_mvp1_end_to_end_flow(tmp_path: Path) -> None:
    client = TestClient(app)

    # 1. Create workspace
    workspace_id = client.post("/api/v1/workspaces", json={"name": "mvp1-e2e"}).json()["id"]
    assert workspace_id

    # 2. Upload source
    xlsx_bytes = _make_xlsx_bytes()
    upload_response = client.post(
        f"/api/v1/workspaces/{workspace_id}/sources/upload",
        files={"file": ("sample.xlsx", xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert upload_response.status_code == 200
    upload_payload = upload_response.json()
    assert len(upload_payload["sheets"]) == 1

    # 3. Get profile and locate columns
    profile_response = client.get(f"/api/v1/workspaces/{workspace_id}/profile")
    assert profile_response.status_code == 200
    columns = profile_response.json()["columns"]
    by_name = {col["column_name"]: col["column_id"] for col in columns}
    assert {"cust_id", "event_date", "revenue", "outcome"}.issubset(by_name)

    # 4. Assign all four required roles
    r1 = client.put(
        f"/api/v1/workspaces/{workspace_id}/columns/{by_name['cust_id']}/roles",
        json={"roles": ["identity_key"]},
    )
    assert r1.status_code == 200, r1.json()
    assert r1.json()["assignments"][0]["accepted"] is True

    r2 = client.put(
        f"/api/v1/workspaces/{workspace_id}/columns/{by_name['event_date']}/roles",
        json={"roles": ["time_anchor"]},
    )
    assert r2.status_code == 200, r2.json()
    assert r2.json()["assignments"][0]["accepted"] is True
    assert r2.json()["assignments"][0]["override_used"] is False

    r3 = client.put(
        f"/api/v1/workspaces/{workspace_id}/columns/{by_name['revenue']}/roles",
        json={"roles": ["measure"]},
    )
    assert r3.status_code == 200, r3.json()

    r4 = client.put(
        f"/api/v1/workspaces/{workspace_id}/columns/{by_name['outcome']}/roles",
        json={"roles": ["source_of_truth_outcome"]},
    )
    assert r4.status_code == 200, r4.json()

    # 5. Verify readiness is complete
    readiness_response = client.get(f"/api/v1/workspaces/{workspace_id}/readiness")
    assert readiness_response.status_code == 200
    readiness = readiness_response.json()
    assert readiness["complete"] is True
    assert readiness["missing_required_roles"] == []

    # 6. Export manifest
    export_response = client.post(f"/api/v1/workspaces/{workspace_id}/manifest/export")
    assert export_response.status_code == 200
    manifest = export_response.json()
    assert "manifest_hash" in manifest
    assert len(manifest["roles"]) == 4

    # 7. Import manifest and verify workspace is reconstructed
    import_response = client.post(
        "/api/v1/workspaces/manifest/import",
        json={"manifest": manifest},
    )
    assert import_response.status_code == 200
    imported_id = import_response.json()["id"]
    assert imported_id != workspace_id

    # 8. Re-export the imported workspace and verify it matches the original
    reexport_response = client.post(f"/api/v1/workspaces/{imported_id}/manifest/export")
    assert reexport_response.status_code == 200
    assert reexport_response.json() == manifest
