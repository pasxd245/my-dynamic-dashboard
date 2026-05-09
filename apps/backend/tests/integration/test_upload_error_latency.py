"""SC-005 latency guard: malformed and encrypted uploads must error within 5 seconds.

Validates that no partial workspace data is left behind after a failed upload.
"""
import time

from fastapi.testclient import TestClient

from app.main import app


def test_malformed_xlsx_errors_under_five_seconds() -> None:
    client = TestClient(app)

    workspace_id = client.post("/api/v1/workspaces", json={"name": "ws-latency-malformed"}).json()["id"]

    # Garbage bytes with .xlsx extension — openpyxl will reject them immediately
    garbage = b"\x00\x01\x02\x03\xff\xfe" * 512

    start = time.perf_counter()
    response = client.post(
        f"/api/v1/workspaces/{workspace_id}/sources/upload",
        files={"file": ("corrupted.xlsx", garbage, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    elapsed = time.perf_counter() - start

    # SC-005: human-readable error within 5 seconds
    assert response.status_code == 400, response.json()
    assert elapsed < 5.0, f"Upload error took {elapsed:.2f}s — exceeds 5s SC-005 limit"

    # No partial source file should be persisted
    profile_response = client.get(f"/api/v1/workspaces/{workspace_id}/profile")
    assert profile_response.status_code == 200
    assert profile_response.json()["columns"] == []


def test_malformed_csv_errors_under_five_seconds() -> None:
    client = TestClient(app)

    workspace_id = client.post("/api/v1/workspaces", json={"name": "ws-latency-csv"}).json()["id"]

    # Unterminated quote causes polars to raise a parse error
    bad_csv = b'id,name\n1,"unterminated\n2,b'

    start = time.perf_counter()
    response = client.post(
        f"/api/v1/workspaces/{workspace_id}/sources/upload",
        files={"file": ("bad.csv", bad_csv, "text/csv")},
    )
    elapsed = time.perf_counter() - start

    assert response.status_code == 400, response.json()
    assert elapsed < 5.0, f"Upload error took {elapsed:.2f}s — exceeds 5s SC-005 limit"
    # Spec 007 switched to ActionableError envelope (error_code at top level).
    body = response.json()
    error_code = body.get("error_code", body.get("error", {}).get("code", "")).lower()
    assert "parse" in error_code


def test_unsupported_file_type_errors_under_five_seconds() -> None:
    client = TestClient(app)

    workspace_id = client.post("/api/v1/workspaces", json={"name": "ws-latency-unsupported"}).json()["id"]

    start = time.perf_counter()
    response = client.post(
        f"/api/v1/workspaces/{workspace_id}/sources/upload",
        files={"file": ("report.pdf", b"%PDF-1.4 junk content", "application/pdf")},
    )
    elapsed = time.perf_counter() - start

    assert response.status_code == 400, response.json()
    assert elapsed < 5.0, f"Upload error took {elapsed:.2f}s — exceeds 5s SC-005 limit"
    body = response.json()
    error_code = body.get("error_code", body.get("error", {}).get("code", "")).lower()
    assert "unsupported" in error_code
